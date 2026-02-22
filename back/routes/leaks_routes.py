import re
from datetime import datetime, timezone
import hashlib
import json
from email.utils import parsedate_to_datetime
from html import unescape
import xml.etree.ElementTree as ET
from urllib.parse import urljoin
import os

import requests
from flask import jsonify, request

from back.app import log, get_system_paths


RSS_SOURCES = [
    {"name": "The Hacker News", "url": "https://feeds.feedburner.com/TheHackersNews"},
    {"name": "BleepingComputer", "url": "https://www.bleepingcomputer.com/feed/"},
    {"name": "SecurityWeek", "url": "https://feeds.feedburner.com/securityweek"},
]

REQUEST_HEADERS = {
    "User-Agent": "SafePass/1.0 (+https://localhost)",
    "Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}

LEAK_HINT_RE = re.compile(
    r"breach|data leak|leak|leaked|compromis|pirat|stolen|database|credential|dump|exposed|ransom",
    flags=re.IGNORECASE,
)

IMG_URL_RE = re.compile(r"https?://[^\s\"'<>]+\.(?:png|jpe?g|webp|gif|svg)(?:\?[^\s\"'<>]*)?", flags=re.IGNORECASE)

PAGE_IMAGE_CACHE = {}
PAGE_IMAGE_CACHE_MAX = 400
RSS_CACHE_TTL_SECONDS = 14 * 24 * 60 * 60
RSS_CACHE_FILE_NAME = 'rss_feed_cache.json'


def _utc_now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def _cache_dir_path():
    sp = get_system_paths()
    cache_dir = sp.get('cache_dir') or os.path.join(sp.get('root_dir') or os.getcwd(), 'cache')
    os.makedirs(cache_dir, exist_ok=True)
    return cache_dir


def _rss_cache_file_path():
    return os.path.join(_cache_dir_path(), RSS_CACHE_FILE_NAME)


def _read_json_cache(path):
    try:
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
    except Exception:
        return {}
    return {}


def _write_json_cache(path, payload):
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
    except Exception as e:
        log.warning(f'Failed to write RSS cache file: {e}')


def _is_iso_fresh(iso_value, ttl_seconds):
    try:
        if not iso_value:
            return False
        ts = datetime.fromisoformat(str(iso_value).replace('Z', '+00:00'))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - ts.astimezone(timezone.utc)).total_seconds()
        return age <= max(1, int(ttl_seconds))
    except Exception:
        return False


def _entry_hash(entry):
    try:
        raw = json.dumps(entry, ensure_ascii=False, sort_keys=True)
    except Exception:
        raw = str(entry)
    return hashlib.sha256(raw.encode('utf-8', errors='ignore')).hexdigest()


def _entries_hash(entries):
    h = hashlib.sha256()
    for entry in (entries or []):
        h.update(_entry_hash(entry).encode('utf-8'))
    return h.hexdigest()


def _refresh_rss_cache_if_needed(force=False):
    cache_path = _rss_cache_file_path()
    cache = _read_json_cache(cache_path)
    checked_at = cache.get('checked_at') if isinstance(cache, dict) else None
    sources_cache = cache.get('sources') if isinstance(cache.get('sources'), dict) else {}

    if not force and _is_iso_fresh(checked_at, RSS_CACHE_TTL_SECONDS) and sources_cache:
        return {
            'checked_at': checked_at,
            'sources': sources_cache,
            'from_cache': True,
            'updated': False,
        }

    now_iso = _utc_now_iso()
    updated_any = False
    next_sources = {}

    for source in RSS_SOURCES:
        source_name = source.get('name') or 'RSS'
        source_url = source.get('url') or ''
        prev_raw = sources_cache.get(source_name) if isinstance(sources_cache, dict) else {}
        prev = prev_raw if isinstance(prev_raw, dict) else {}
        prev_items_raw = prev.get('items')
        prev_items = prev_items_raw if isinstance(prev_items_raw, list) else []
        prev_hash = prev.get('items_hash') or _entries_hash(prev_items)

        headers = dict(REQUEST_HEADERS)
        try:
            prev_etag = prev.get('etag')
            prev_last_modified = prev.get('last_modified')
            if prev_etag:
                headers['If-None-Match'] = str(prev_etag)
            if prev_last_modified:
                headers['If-Modified-Since'] = str(prev_last_modified)
        except Exception:
            pass

        try:
            resp = requests.get(source_url, timeout=12, headers=headers)

            if resp.status_code == 304:
                next_sources[source_name] = {
                    'url': source_url,
                    'items': prev_items,
                    'items_hash': prev_hash,
                    'etag': prev.get('etag'),
                    'last_modified': prev.get('last_modified'),
                    'fetched_at': prev.get('fetched_at') or checked_at,
                    'checked_at': now_iso,
                }
                continue

            resp.raise_for_status()
            source_items = _rss_items_from_xml(resp.text, source_name)
            new_hash = _entries_hash(source_items)
            if new_hash != prev_hash:
                updated_any = True

            next_sources[source_name] = {
                'url': source_url,
                'items': source_items,
                'items_hash': new_hash,
                'etag': resp.headers.get('ETag'),
                'last_modified': resp.headers.get('Last-Modified'),
                'fetched_at': now_iso,
                'checked_at': now_iso,
            }
        except Exception as e:
            log.warning(f"RSS leak source failed ({source_name}): {e}")
            if prev:
                next_sources[source_name] = {
                    'url': source_url,
                    'items': prev_items,
                    'items_hash': prev_hash,
                    'etag': prev.get('etag'),
                    'last_modified': prev.get('last_modified'),
                    'fetched_at': prev.get('fetched_at'),
                    'checked_at': now_iso,
                }

    if not next_sources and sources_cache:
        safe_sources = {}
        for k, v in (sources_cache.items() if isinstance(sources_cache, dict) else []):
            if isinstance(v, dict):
                safe_sources[k] = v
        next_sources = safe_sources

    next_cache = {
        'checked_at': now_iso,
        'updated_at': now_iso if updated_any else (cache.get('updated_at') or now_iso),
        'sources': next_sources,
    }
    _write_json_cache(cache_path, next_cache)

    return {
        'checked_at': next_cache.get('checked_at'),
        'updated_at': next_cache.get('updated_at'),
        'sources': next_sources,
        'from_cache': False,
        'updated': updated_any,
    }


def _clean_text(v):
    if v is None:
        return ""
    s = str(v)
    s = re.sub(r"<[^>]+>", " ", s)
    s = unescape(s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _normalize_keywords(raw_keywords):
    out = []
    seen = set()
    for kw in (raw_keywords or []):
        s = _clean_text(kw).lower()
        if not s:
            continue
        s = re.sub(r"[^a-z0-9._-]", "", s)
        if len(s) < 3:
            continue
        if s in seen:
            continue
        seen.add(s)
        out.append(s)
        if len(out) >= 80:
            break
    return out


def _parse_dt(value):
    if not value:
        return None
    txt = _clean_text(value)
    if not txt:
        return None
    try:
        dt = parsedate_to_datetime(txt)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        pass
    try:
        dt = datetime.fromisoformat(txt.replace('Z', '+00:00'))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _match_keywords(text, keywords):
    if not text or not keywords:
        return []
    hay_raw = _clean_text(text).lower()
    hay_norm = re.sub(r"[^a-z0-9]+", " ", hay_raw).strip()
    hay_compact = hay_norm.replace(" ", "")

    matched = []
    seen = set()
    for kw in keywords:
        k_raw = _clean_text(kw).lower()
        if not k_raw:
            continue
        k_norm = re.sub(r"[^a-z0-9]+", " ", k_raw).strip()
        k_compact = k_norm.replace(" ", "")

        hit = False
        if k_raw and k_raw in hay_raw:
            hit = True
        elif k_norm and k_norm in hay_norm:
            hit = True
        elif k_compact and len(k_compact) >= 3 and k_compact in hay_compact:
            hit = True

        if hit and kw not in seen:
            seen.add(kw)
            matched.append(kw)
    return matched


def _extract_image_from_description(raw_description):
    if not raw_description:
        return ""
    try:
        m = re.search(r"<img\b[^>]*\bsrc=[\"']([^\"']+)[\"']", str(raw_description), flags=re.IGNORECASE)
        if m and m.group(1):
            return _clean_text(m.group(1))
    except Exception:
        pass
    m2 = IMG_URL_RE.search(str(raw_description))
    if m2:
        return _clean_text(m2.group(0))
    return ""


def _extract_all_images_from_description(raw_description):
    out = []
    if not raw_description:
        return out
    try:
        for m in re.findall(r"<img\b[^>]*\bsrc=[\"']([^\"']+)[\"']", str(raw_description), flags=re.IGNORECASE):
            u = _clean_text(m)
            if u:
                out.append(u)
    except Exception:
        pass
    try:
        for m in IMG_URL_RE.findall(str(raw_description)):
            u = _clean_text(m)
            if u:
                out.append(u)
    except Exception:
        pass

    dedup = []
    seen = set()
    for u in out:
        k = u.lower()
        if k in seen:
            continue
        seen.add(k)
        dedup.append(u)
        if len(dedup) >= 8:
            break
    return dedup


def _first_text(el, names, ns=None):
    if el is None:
        return ""
    for name in names:
        try:
            txt = el.findtext(name, default='', namespaces=(ns or {}))
            txt = _clean_text(txt)
            if txt:
                return txt
        except Exception:
            continue
    return ""


def _extract_page_image_candidates(page_url):
    if not page_url:
        return []

    cache_key = _clean_text(page_url)
    if not cache_key:
        return []

    cached = PAGE_IMAGE_CACHE.get(cache_key)
    if isinstance(cached, list):
        return cached[:]

    out = []
    try:
        resp = requests.get(page_url, timeout=8, headers=REQUEST_HEADERS)
        resp.raise_for_status()
        html = resp.text or ""

        meta_patterns = [
            r'<meta[^>]+property=["\']og:image(?::secure_url)?["\'][^>]+content=["\']([^"\']+)["\']',
            r'<meta[^>]+name=["\']twitter:image(?::src)?["\'][^>]+content=["\']([^"\']+)["\']',
            r'<link[^>]+rel=["\']image_src["\'][^>]+href=["\']([^"\']+)["\']',
        ]
        for pat in meta_patterns:
            for m in re.findall(pat, html, flags=re.IGNORECASE):
                u = _clean_text(m)
                if not u:
                    continue
                if not u.lower().startswith('http'):
                    u = urljoin(page_url, u)
                out.append(u)

        for m in re.findall(r'<img\b[^>]*\bsrc=["\']([^"\']+)["\']', html, flags=re.IGNORECASE):
            u = _clean_text(m)
            if not u:
                continue
            if not u.lower().startswith('http'):
                u = urljoin(page_url, u)
            out.append(u)

    except Exception:
        out = out

    scored = []
    for u in out:
        low = (u or '').lower()
        if not low:
            continue

        score = 0
        if re.search(r'\.(jpg|jpeg|png|webp)(\?|$)', low):
            score += 30
        if re.search(r'\.(svg|gif)(\?|$)', low):
            score -= 6
        if 'favicon' in low or '/icon' in low or '/logo' in low or 'avatar' in low or 'sprite' in low:
            score -= 80
        if '/wp-content/' in low or '/uploads/' in low or '/media/' in low:
            score += 8
        if 'og-image' in low or 'opengraph' in low or 'share' in low:
            score += 12

        scored.append((score, u))

    scored.sort(key=lambda x: x[0], reverse=True)

    dedup = []
    seen = set()
    for _, u in scored:
        k = (u or '').lower().strip()
        if not k or k in seen:
            continue
        seen.add(k)
        dedup.append(u)
        if len(dedup) >= 8:
            break

    if len(PAGE_IMAGE_CACHE) >= PAGE_IMAGE_CACHE_MAX:
        try:
            PAGE_IMAGE_CACHE.clear()
        except Exception:
            pass
    PAGE_IMAGE_CACHE[cache_key] = dedup[:]

    return dedup


def _rss_items_from_xml(xml_text, source_name):
    items = []
    if not xml_text:
        return items

    try:
        root = ET.fromstring(xml_text)
    except Exception:
        return items

    # RSS 2.0
    for item in root.findall('.//item'):
        title = _clean_text(item.findtext('title'))
        link = _clean_text(item.findtext('link'))
        pub = _clean_text(item.findtext('pubDate'))
        raw_desc = item.findtext('description')
        desc = _clean_text(raw_desc)

        image_candidates = []
        try:
            enclosure = item.find('enclosure')
            if enclosure is not None:
                enc_type = _clean_text(enclosure.attrib.get('type') or '').lower()
                enc_url = _clean_text(enclosure.attrib.get('url') or '')
                if enc_url and ('image' in enc_type or IMG_URL_RE.search(enc_url)):
                    image_candidates.append(enc_url)
        except Exception:
            image_candidates = image_candidates

        for tag in ('{http://search.yahoo.com/mrss/}thumbnail', '{http://search.yahoo.com/mrss/}content'):
            try:
                media_el = item.find(tag)
                if media_el is None:
                    continue
                candidate = _clean_text(media_el.attrib.get('url') or '')
                if candidate:
                    image_candidates.append(candidate)
            except Exception:
                continue

        image_candidates.extend(_extract_all_images_from_description(raw_desc))

        dedup_images = []
        seen_images = set()
        for u in image_candidates:
            k = (u or '').lower()
            if not k or k in seen_images:
                continue
            seen_images.add(k)
            dedup_images.append(u)
            if len(dedup_images) >= 8:
                break
        image_url = dedup_images[0] if dedup_images else ''

        if title and link:
            items.append({
                'title': title,
                'link': link,
                'published': pub,
                'summary': desc,
                'image_url': image_url,
                'image_candidates': dedup_images,
                'source': source_name,
            })

    # Atom
    if not items:
        ns = {
            'a': 'http://www.w3.org/2005/Atom',
            'media': 'http://search.yahoo.com/mrss/',
        }
        for entry in root.findall('.//a:entry', ns):
            title = _first_text(entry, ['a:title'], ns)
            link = ''
            try:
                for link_el in entry.findall('a:link', ns):
                    rel = _clean_text(link_el.attrib.get('rel') or '').lower()
                    href = _clean_text(link_el.attrib.get('href') or link_el.text)
                    if not href:
                        continue
                    if rel in ('', 'alternate'):
                        link = href
                        break
                if not link:
                    link_el = entry.find('a:link', ns)
                    if link_el is not None:
                        link = _clean_text(link_el.attrib.get('href') or link_el.text)
            except Exception:
                link = ''
            pub = _clean_text(
                entry.findtext('a:updated', default='', namespaces=ns)
                or entry.findtext('a:published', default='', namespaces=ns)
            )
            raw_summary = (
                entry.findtext('a:summary', default='', namespaces=ns)
                or entry.findtext('a:content', default='', namespaces=ns)
            )
            summary = _clean_text(raw_summary)

            image_candidates = []
            try:
                for link_el in entry.findall('a:link', ns):
                    rel = _clean_text(link_el.attrib.get('rel') or '').lower()
                    href = _clean_text(link_el.attrib.get('href') or '')
                    ltype = _clean_text(link_el.attrib.get('type') or '').lower()
                    if rel == 'enclosure' and href and ('image' in ltype or IMG_URL_RE.search(href)):
                        image_candidates.append(href)
            except Exception:
                image_candidates = image_candidates

            try:
                media_el = entry.find('media:thumbnail', ns) or entry.find('media:content', ns)
                if media_el is not None:
                    candidate = _clean_text(media_el.attrib.get('url') or '')
                    if candidate:
                        image_candidates.append(candidate)
            except Exception:
                image_candidates = image_candidates

            image_candidates.extend(_extract_all_images_from_description(raw_summary))

            dedup_images = []
            seen_images = set()
            for u in image_candidates:
                k = (u or '').lower()
                if not k or k in seen_images:
                    continue
                seen_images.add(k)
                dedup_images.append(u)
                if len(dedup_images) >= 8:
                    break
            image_url = dedup_images[0] if dedup_images else ''

            if title and link:
                items.append({
                    'title': title,
                    'link': link,
                    'published': pub,
                    'summary': summary,
                    'image_url': image_url,
                    'image_candidates': dedup_images,
                    'source': source_name,
                })

    return items


def register(app):
    @app.route('/api/leaks/rss-matches', methods=['POST'])
    def get_rss_leak_matches():
        fetched_at = _utc_now_iso()
        try:
            payload = request.get_json(silent=True) or {}
            keywords = _normalize_keywords(payload.get('keywords') if isinstance(payload, dict) else [])
            max_items = 8
            try:
                max_items = int(payload.get('max_items') or 8)
            except Exception:
                max_items = 8
            max_items = max(1, min(max_items, 20))

            if not keywords:
                return jsonify({
                    'status': 'success',
                    'fetched_at': fetched_at,
                    'items': [],
                    'note': 'Aucun mot-clé fourni pour le filtrage.'
                })

            matched_items = []
            fallback_candidates = []
            all_recent_entries = []
            seen_links = set()

            cache_result = _refresh_rss_cache_if_needed(force=False)
            fetched_at = cache_result.get('checked_at') or fetched_at
            source_map = cache_result.get('sources') if isinstance(cache_result.get('sources'), dict) else {}

            for source in RSS_SOURCES:
                source_name = source.get('name') or 'RSS'
                source_entry_raw = source_map.get(source_name) if isinstance(source_map, dict) else {}
                source_entry = source_entry_raw if isinstance(source_entry_raw, dict) else {}
                source_items_raw = source_entry.get('items')
                source_items = source_items_raw if isinstance(source_items_raw, list) else []
                try:
                    for entry in source_items:
                        if not isinstance(entry, dict):
                            continue
                        all_recent_entries.append(entry)
                        text_blob = ' '.join([
                            entry.get('title') or '',
                            entry.get('summary') or '',
                            entry.get('link') or '',
                        ])
                        has_leak_hint = bool(LEAK_HINT_RE.search(text_blob))

                        # Keep general leak-like entries as fallback if keyword matching is empty.
                        if has_leak_hint:
                            fallback_candidates.append(entry)

                        matched_keywords = _match_keywords(text_blob, keywords)
                        if not matched_keywords:
                            continue

                        link = entry.get('link') or ''
                        if not link or link in seen_links:
                            continue
                        seen_links.add(link)

                        image_candidates = entry.get('image_candidates') if isinstance(entry.get('image_candidates'), list) else []
                        image_candidates = [u for u in image_candidates if isinstance(u, str) and u.strip()]
                        if not image_candidates and link:
                            try:
                                image_candidates = _extract_page_image_candidates(link)
                            except Exception:
                                image_candidates = image_candidates

                        image_url = image_candidates[0] if image_candidates else (entry.get('image_url') or '')

                        matched_items.append({
                            'title': entry.get('title') or 'Leak détectée',
                            'link': link,
                            'published': entry.get('published') or '',
                            'image_url': image_url,
                            'image_candidates': image_candidates,
                            'source': entry.get('source') or 'RSS',
                            'matched_keywords': matched_keywords[:6],
                            'leak_hint': has_leak_hint,
                        })
                except Exception as e:
                    log.warning(f"RSS leak source processing failed ({source_name}): {e}")

            matched_items.sort(
                key=lambda x: (
                    1 if x.get('leak_hint') else 0,
                    _parse_dt(x.get('published')) or datetime(1970, 1, 1, tzinfo=timezone.utc),
                ),
                reverse=True,
            )

            if not matched_items:
                fallback_rows = []
                seen_fallback_links = set()
                for entry in fallback_candidates:
                    if not isinstance(entry, dict):
                        continue
                    link = entry.get('link') or ''
                    if not link or link in seen_fallback_links:
                        continue
                    seen_fallback_links.add(link)

                    image_candidates = entry.get('image_candidates') if isinstance(entry.get('image_candidates'), list) else []
                    image_candidates = [u for u in image_candidates if isinstance(u, str) and u.strip()]
                    if not image_candidates and link:
                        try:
                            image_candidates = _extract_page_image_candidates(link)
                        except Exception:
                            image_candidates = image_candidates

                    image_url = image_candidates[0] if image_candidates else (entry.get('image_url') or '')
                    fallback_rows.append({
                        'title': entry.get('title') or 'Leak détectée',
                        'link': link,
                        'published': entry.get('published') or '',
                        'image_url': image_url,
                        'image_candidates': image_candidates,
                        'source': entry.get('source') or 'RSS',
                        'matched_keywords': [],
                        'leak_hint': True,
                    })

                fallback_rows.sort(
                    key=lambda x: _parse_dt(x.get('published')) or datetime(1970, 1, 1, tzinfo=timezone.utc),
                    reverse=True,
                )
                matched_items = fallback_rows

            # Last-resort fallback: still return recent RSS entries to keep cards visible.
            if not matched_items:
                generic_rows = []
                seen_generic_links = set()
                for entry in all_recent_entries:
                    if not isinstance(entry, dict):
                        continue
                    link = entry.get('link') or ''
                    if not link or link in seen_generic_links:
                        continue
                    seen_generic_links.add(link)

                    image_candidates = entry.get('image_candidates') if isinstance(entry.get('image_candidates'), list) else []
                    image_candidates = [u for u in image_candidates if isinstance(u, str) and u.strip()]
                    if not image_candidates and link:
                        try:
                            image_candidates = _extract_page_image_candidates(link)
                        except Exception:
                            image_candidates = image_candidates

                    image_url = image_candidates[0] if image_candidates else (entry.get('image_url') or '')
                    generic_rows.append({
                        'title': entry.get('title') or 'Alerte sécurité',
                        'link': link,
                        'published': entry.get('published') or '',
                        'image_url': image_url,
                        'image_candidates': image_candidates,
                        'source': entry.get('source') or 'RSS',
                        'matched_keywords': [],
                        'leak_hint': bool(LEAK_HINT_RE.search(' '.join([
                            entry.get('title') or '',
                            entry.get('summary') or '',
                            entry.get('link') or '',
                        ]))),
                    })

                generic_rows.sort(
                    key=lambda x: _parse_dt(x.get('published')) or datetime(1970, 1, 1, tzinfo=timezone.utc),
                    reverse=True,
                )
                matched_items = generic_rows

            return jsonify({
                'status': 'success',
                'fetched_at': fetched_at,
                'items': matched_items[:max_items],
                'keywords_count': len(keywords),
                'sources': [s.get('name') for s in RSS_SOURCES],
                'cache': {
                    'used': bool(cache_result.get('from_cache')),
                    'updated': bool(cache_result.get('updated')),
                    'updated_at': cache_result.get('updated_at'),
                },
                'fallback_used': len(keywords) > 0 and len(matched_items) > 0 and all(not (it.get('matched_keywords') or []) for it in matched_items[:max_items]),
            })
        except Exception as e:
            log.warning(f"RSS leaks endpoint failed: {e}")
            return jsonify({
                'status': 'success',
                'fetched_at': fetched_at,
                'items': [],
                'note': 'Impossible de récupérer le flux leaks pour le moment.'
            })
