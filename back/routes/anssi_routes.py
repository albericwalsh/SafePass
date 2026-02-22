import re
from datetime import datetime, timezone
import hashlib
from html import unescape
from urllib.parse import urljoin
import json
import os

import requests
from flask import jsonify

from back.app import log, get_system_paths


ANSSI_GUIDES_API_URL = "https://messervices.cyber.gouv.fr/api/guides"
ANSSI_GUIDE_ID = "recommandations-relatives-lauthentification-multifacteur-et-aux-mots-de-passe"
ANSSI_GUIDE_URL = f"https://messervices.cyber.gouv.fr/guides/{ANSSI_GUIDE_ID}"

REQUEST_HEADERS = {
    "User-Agent": "SafePass/1.0 (+https://localhost)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}

ANSSI_CACHE_TTL_SECONDS = 14 * 24 * 60 * 60
ANSSI_CACHE_FILE_NAME = 'anssi_recommendations_cache.json'


def _cache_dir_path():
    sp = get_system_paths()
    cache_dir = sp.get('cache_dir') or os.path.join(sp.get('root_dir') or os.getcwd(), 'cache')
    os.makedirs(cache_dir, exist_ok=True)
    return cache_dir


def _anssi_cache_file_path():
    return os.path.join(_cache_dir_path(), ANSSI_CACHE_FILE_NAME)


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
        log.warning(f'Failed to write ANSSI cache file: {e}')


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


def _payload_hash(payload_obj):
    try:
        raw = json.dumps(payload_obj, ensure_ascii=False, sort_keys=True)
    except Exception:
        raw = str(payload_obj)
    return hashlib.sha256(raw.encode('utf-8', errors='ignore')).hexdigest()


def _cached_anssi_response(cache_obj, note=None):
    data = cache_obj.get('data') if isinstance(cache_obj.get('data'), dict) else {}
    resp = {
        'status': 'success',
        'dynamic': bool(data.get('dynamic', False)),
        'source_url': data.get('source_url') or ANSSI_GUIDE_URL,
        'document_url': data.get('document_url'),
        'fetched_at': cache_obj.get('fetched_at') or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
        'recommendations': data.get('recommendations') if isinstance(data.get('recommendations'), list) else _fallback_recommendations(),
        'signals': data.get('signals') if isinstance(data.get('signals'), dict) else None,
        'cache': {
            'used': True,
            'updated': False,
            'checked_at': cache_obj.get('checked_at'),
        }
    }
    if note:
        resp['note'] = note
    if resp.get('signals') is None:
        resp.pop('signals', None)
    return resp


def _clean_html_text(s):
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", " ", s)
    s = unescape(s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _extract_recommendations_from_html(html):
    if not html:
        return []

    li_items = re.findall(r"<li\b[^>]*>(.*?)</li>", html, flags=re.IGNORECASE | re.DOTALL)
    cleaned = []
    for item in li_items:
        txt = _clean_html_text(item)
        if not txt or len(txt) < 20:
            continue
        cleaned.append(txt)

    keywords = re.compile(
        r"mot de passe|phrase de passe|authentification|second facteur|multifacteur|longueur|caract[eè]re|gestionnaire|r[eé]utilisation|secret",
        flags=re.IGNORECASE,
    )

    # Also parse bullet-based content often rendered as "• ..." in guide pages.
    raw_text = _clean_html_text(html)
    bullet_items = re.findall(r"•\s*([^•]{20,320})", raw_text)
    for item in bullet_items:
        txt = re.sub(r"\s+", " ", item).strip()
        if txt:
            cleaned.append(txt)

    filtered = []
    seen = set()
    for txt in cleaned:
        if not keywords.search(txt):
            continue
        norm = txt.lower()
        if norm in seen:
            continue
        seen.add(norm)
        filtered.append(txt)
        if len(filtered) >= 7:
            break

    return filtered


def _extract_text_blocks_from_html(html):
    if not html:
        return []

    blocks = []
    for tag in ("li", "p", "h2", "h3", "h4"):
        for item in re.findall(rf"<{tag}\b[^>]*>(.*?)</{tag}>", html, flags=re.IGNORECASE | re.DOTALL):
            txt = _clean_html_text(item)
            if txt and len(txt) >= 20:
                blocks.append(txt)

    raw_text = _clean_html_text(html)
    for item in re.findall(r"•\s*([^•]{20,320})", raw_text):
        txt = re.sub(r"\s+", " ", item).strip()
        if txt:
            blocks.append(txt)

    # Plain-text fallback for markdown-like payloads without reliable list tags.
    if raw_text:
        for item in re.split(r"[\n\r]+", raw_text):
            txt = re.sub(r"\s+", " ", item).strip(" -•\t")
            if txt and len(txt) >= 40:
                blocks.append(txt)

        for item in re.split(r"(?<=[\.!?])\s+", raw_text):
            txt = re.sub(r"\s+", " ", item).strip()
            if txt and len(txt) >= 60:
                blocks.append(txt)

    dedup = []
    seen = set()
    for txt in blocks:
        k = txt.lower()
        if k in seen:
            continue
        seen.add(k)
        dedup.append(txt)
    return dedup


def _extract_password_signals(text_blocks):
    signals = {
        'min_length': None,
        'has_passphrase': False,
        'has_mfa': False,
        'has_no_reuse': False,
        'has_manager': False,
        'has_no_personal': False,
        'has_renew_after_incident': False,
        'has_complexity_guidance': False,
    }

    if not text_blocks:
        return signals

    length_re = re.compile(r"(\d{1,2})\s*(?:caract[eè]res?|chars?)", flags=re.IGNORECASE)

    for txt in text_blocks:
        low = txt.lower()

        for m in length_re.finditer(txt):
            try:
                n = int(m.group(1))
                if 6 <= n <= 64:
                    if signals['min_length'] is None or n > signals['min_length']:
                        signals['min_length'] = n
            except Exception:
                continue

        if re.search(r"phrase de passe|passphrase", low):
            signals['has_passphrase'] = True

        if re.search(r"multifacteur|multi-facteur|mfa|second facteur|2fa|double facteur", low):
            signals['has_mfa'] = True

        if re.search(r"ne pas r[ée]utiliser|pas r[ée]utiliser|r[ée]utilisation|unique par service|diff[ée]rent pour chaque", low):
            signals['has_no_reuse'] = True

        if re.search(r"gestionnaire de mot de passe|coffre-fort|password manager", low):
            signals['has_manager'] = True

        if re.search(r"information personnelle|donn[ée]es personnelles|pr[ée]visible|suite|dictionnaire", low):
            signals['has_no_personal'] = True

        if re.search(r"changer|renouveler|rotation|compromis|fuite|incident", low):
            signals['has_renew_after_incident'] = True

        if re.search(r"majuscule|minuscule|chiffre|caract[eè]re sp[ée]cial|symbole|alphabet", low):
            signals['has_complexity_guidance'] = True

    return signals


def _build_awareness_recommendations_from_signals(signals):
    recos = []

    min_len = signals.get('min_length')
    if isinstance(min_len, int) and min_len >= 8:
        recos.append(f"Utiliser un secret d'au moins {min_len} caractères (mot de passe ou phrase de passe).")
    else:
        recos.append("Utiliser un secret long (idéalement 12 caractères ou plus), de préférence sous forme de phrase de passe.")

    if signals.get('has_complexity_guidance'):
        recos.append("Mélanger plusieurs types de caractères (minuscules, majuscules, chiffres et, si possible, symboles).")
    else:
        recos.append("Favoriser la longueur et la diversité des caractères pour augmenter la robustesse du secret.")

    if signals.get('has_no_personal'):
        recos.append("Éviter les mots courants, suites prévisibles et informations personnelles dans vos secrets.")
    else:
        recos.append("Ne pas utiliser d'informations personnelles ni de motifs évidents (ex: 1234, azerty, dates).")

    if signals.get('has_no_reuse'):
        recos.append("Ne jamais réutiliser le même mot de passe entre plusieurs services.")
    else:
        recos.append("Utiliser un mot de passe différent pour chaque application et chaque site.")

    if signals.get('has_manager'):
        recos.append("Utiliser un gestionnaire de mots de passe pour générer et stocker des secrets uniques.")
    else:
        recos.append("S'appuyer sur un gestionnaire de mots de passe pour gérer des secrets longs et uniques.")

    if signals.get('has_mfa'):
        recos.append("Activer l'authentification multifacteur (MFA) dès qu'elle est disponible.")
    else:
        recos.append("Ajouter un second facteur d'authentification pour limiter l'impact d'un mot de passe compromis.")

    if signals.get('has_renew_after_incident'):
        recos.append("Changer immédiatement un mot de passe suspecté compromis (fuite, phishing, incident).")

    return recos[:8]


def _extract_document_urls_from_guide(guide_item):
    urls = []
    if not isinstance(guide_item, dict):
        return urls
    docs = guide_item.get('documents') if isinstance(guide_item.get('documents'), list) else []
    for doc in docs:
        if not isinstance(doc, dict):
            continue
        u = (doc.get('url') or '').strip()
        if u:
            urls.append(u)
    return urls


def _load_additional_anssi_texts(base_url, document_urls):
    texts = []

    try:
        page_resp = requests.get(base_url, timeout=15, headers=REQUEST_HEADERS)
        page_resp.raise_for_status()
        texts.extend(_extract_text_blocks_from_html(page_resp.text or ''))
    except Exception:
        texts = texts

    for raw_url in (document_urls or [])[:3]:
        try:
            url = urljoin(base_url, raw_url)
            low = url.lower()
            if not (low.endswith('.html') or low.endswith('.htm') or low.endswith('.txt') or '/guides/' in low):
                continue
            doc_resp = requests.get(url, timeout=15, headers=REQUEST_HEADERS)
            doc_resp.raise_for_status()
            ctype = (doc_resp.headers.get('Content-Type') or '').lower()
            body = doc_resp.text or ''
            if 'html' in ctype or '<html' in body.lower():
                texts.extend(_extract_text_blocks_from_html(body))
            else:
                cleaned = _clean_html_text(body)
                if cleaned and len(cleaned) >= 40:
                    texts.append(cleaned)
        except Exception:
            continue

    dedup = []
    seen = set()
    for txt in texts:
        k = txt.lower().strip()
        if not k or k in seen:
            continue
        seen.add(k)
        dedup.append(txt)
        if len(dedup) >= 200:
            break
    return dedup


def _extract_recommendations_from_guide_description(description_html):
    if not description_html:
        return []

    desc = description_html
    marker = "Les principales recommandations"
    lower_desc = desc.lower()
    marker_idx = lower_desc.find(marker.lower())
    scoped = desc[marker_idx:] if marker_idx >= 0 else desc

    li_items = re.findall(r"<li\b[^>]*>(.*?)</li>", scoped, flags=re.IGNORECASE | re.DOTALL)
    cleaned = []
    for item in li_items:
        txt = _clean_html_text(item)
        if txt and len(txt) >= 20:
            cleaned.append(txt)

    if not cleaned:
        li_items_all = re.findall(r"<li\b[^>]*>(.*?)</li>", desc, flags=re.IGNORECASE | re.DOTALL)
        for item in li_items_all:
            txt = _clean_html_text(item)
            if txt and len(txt) >= 20:
                cleaned.append(txt)

    keywords = re.compile(
        r"mot de passe|phrase de passe|authentification|second facteur|multifacteur|longueur|caract[eè]re|gestionnaire|r[eé]utilisation|secret|coffre-fort",
        flags=re.IGNORECASE,
    )

    filtered = []
    seen = set()
    for txt in cleaned:
        if not keywords.search(txt):
            continue
        norm = txt.lower()
        if norm in seen:
            continue
        seen.add(norm)
        filtered.append(txt)
        if len(filtered) >= 7:
            break

    return filtered


def _fallback_recommendations():
    return [
        "Privilégier des mots de passe ou phrases de passe longs, idéalement 12 caractères ou plus.",
        "Éviter les secrets basés sur des informations personnelles ou des suites prévisibles.",
        "Ne pas réutiliser un même mot de passe sur plusieurs services.",
        "Utiliser un gestionnaire de mots de passe pour générer et stocker des secrets robustes.",
        "Activer l'authentification multifacteur lorsque disponible.",
    ]


def register(app):
    @app.route('/api/anssi/recommendations', methods=['GET'])
    def get_anssi_recommendations():
        fetched_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
        cache_path = _anssi_cache_file_path()
        cache = _read_json_cache(cache_path)
        if _is_iso_fresh(cache.get('checked_at'), ANSSI_CACHE_TTL_SECONDS):
            return jsonify(_cached_anssi_response(cache))
        try:
            resp = requests.get(ANSSI_GUIDES_API_URL, timeout=15, headers=REQUEST_HEADERS)
            resp.raise_for_status()
            items = resp.json()
            if not isinstance(items, list):
                raise ValueError('ANSSI guides API payload is not a list')

            guide = None
            for item in items:
                if not isinstance(item, dict):
                    continue
                if (item.get('id') or '').strip() == ANSSI_GUIDE_ID:
                    guide = item
                    break

            if not guide:
                raise ValueError(f'Guide {ANSSI_GUIDE_ID} not found in API payload')

            description_html = guide.get('description') or ''
            document_urls = _extract_document_urls_from_guide(guide)

            text_blocks = []
            text_blocks.extend(_extract_text_blocks_from_html(description_html))
            text_blocks.extend(_load_additional_anssi_texts(ANSSI_GUIDE_URL, document_urls))

            signals = _extract_password_signals(text_blocks)
            recos = _build_awareness_recommendations_from_signals(signals)

            if recos:
                live_payload = {
                    'dynamic': True,
                    'source_url': ANSSI_GUIDE_URL,
                    'document_url': document_urls[0] if document_urls else None,
                    'recommendations': recos,
                    'signals': signals,
                }

                payload_hash = _payload_hash(live_payload)
                prev_hash = cache.get('payload_hash') if isinstance(cache, dict) else None
                checked_at = fetched_at

                if payload_hash != prev_hash:
                    to_write = {
                        'checked_at': checked_at,
                        'fetched_at': fetched_at,
                        'payload_hash': payload_hash,
                        'data': live_payload,
                    }
                    _write_json_cache(cache_path, to_write)
                    out = {
                        'status': 'success',
                        'dynamic': True,
                        'source_url': ANSSI_GUIDE_URL,
                        'document_url': document_urls[0] if document_urls else None,
                        'fetched_at': fetched_at,
                        'recommendations': recos,
                        'signals': signals,
                        'cache': {'used': False, 'updated': True, 'checked_at': checked_at},
                    }
                    return jsonify(out)

                same_data = cache.get('data') if isinstance(cache.get('data'), dict) else live_payload
                to_write = {
                    'checked_at': checked_at,
                    'fetched_at': cache.get('fetched_at') or fetched_at,
                    'payload_hash': payload_hash,
                    'data': same_data,
                }
                _write_json_cache(cache_path, to_write)
                return jsonify(_cached_anssi_response(to_write))

            # Legacy fallback extraction if signal synthesis unexpectedly fails.
            recos_legacy = _extract_recommendations_from_guide_description(description_html)
            if recos_legacy:
                live_payload = {
                    'dynamic': True,
                    'source_url': ANSSI_GUIDE_URL,
                    'document_url': document_urls[0] if document_urls else None,
                    'recommendations': recos_legacy,
                }
                payload_hash = _payload_hash(live_payload)
                prev_hash = cache.get('payload_hash') if isinstance(cache, dict) else None
                checked_at = fetched_at
                if payload_hash != prev_hash:
                    to_write = {
                        'checked_at': checked_at,
                        'fetched_at': fetched_at,
                        'payload_hash': payload_hash,
                        'data': live_payload,
                    }
                    _write_json_cache(cache_path, to_write)
                    return jsonify({
                        'status': 'success',
                        'dynamic': True,
                        'source_url': ANSSI_GUIDE_URL,
                        'document_url': document_urls[0] if document_urls else None,
                        'fetched_at': fetched_at,
                        'recommendations': recos_legacy,
                        'cache': {'used': False, 'updated': True, 'checked_at': checked_at},
                    })

                same_data = cache.get('data') if isinstance(cache.get('data'), dict) else live_payload
                to_write = {
                    'checked_at': checked_at,
                    'fetched_at': cache.get('fetched_at') or fetched_at,
                    'payload_hash': payload_hash,
                    'data': same_data,
                }
                _write_json_cache(cache_path, to_write)
                return jsonify(_cached_anssi_response(to_write))

            fallback_payload = {
                'dynamic': False,
                'source_url': ANSSI_GUIDE_URL,
                'recommendations': _fallback_recommendations(),
            }
            payload_hash = _payload_hash(fallback_payload)
            prev_hash = cache.get('payload_hash') if isinstance(cache, dict) else None
            if payload_hash != prev_hash:
                _write_json_cache(cache_path, {
                    'checked_at': fetched_at,
                    'fetched_at': fetched_at,
                    'payload_hash': payload_hash,
                    'data': fallback_payload,
                })

            return jsonify({
                'status': 'success',
                'dynamic': False,
                'source_url': ANSSI_GUIDE_URL,
                'fetched_at': fetched_at,
                'recommendations': _fallback_recommendations(),
                'note': 'API ANSSI joignable mais extraction vide; fallback local appliqué.',
                'cache': {'used': False, 'updated': payload_hash != prev_hash, 'checked_at': fetched_at},
            })
        except Exception as e:
            log.warning(f'ANSSI fetch failed: {e}')
            if isinstance(cache, dict) and isinstance(cache.get('data'), dict):
                cache['checked_at'] = fetched_at
                _write_json_cache(cache_path, cache)
                return jsonify(_cached_anssi_response(cache, note='Erreur réseau ANSSI; cache local utilisé.'))
            return jsonify({
                'status': 'success',
                'dynamic': False,
                'source_url': ANSSI_GUIDE_URL,
                'fetched_at': fetched_at,
                'recommendations': _fallback_recommendations(),
                'note': 'Erreur réseau ANSSI; fallback local appliqué.'
            })
