import os
import json
from urllib.parse import urlparse
from flask import jsonify, request

from back.app import log, SETTINGS, key, EXT_TOKEN, get_data_paths
from back.detect import byUrl
from back.crypting.decrypt_file import decryptByPath

try:
    import tldextract
    _HAS_TLDEXTRACT = True
except Exception:
    tldextract = None
    _HAS_TLDEXTRACT = False


def _normalize_hostname(s):
    if not s or not isinstance(s, str):
        return None
    s = s.strip()
    try:
        # ensure scheme so urlparse fills hostname
        if '://' not in s:
            s2 = 'http://' + s
        else:
            s2 = s
        parsed = urlparse(s2)
        host = parsed.hostname or s
    except Exception:
        host = s
    return (host or '').lower()


def _primary_domain(hostname):
    if not hostname:
        return None
    h = hostname.lower().strip()
    # try tldextract if available to handle public suffixes (co.uk, etc.)
    if _HAS_TLDEXTRACT:
        try:
            ext = tldextract.extract(h)
            # ext.registered_domain preferred when available
            reg = getattr(ext, 'registered_domain', None)
            if reg:
                return reg.lower()
            if ext.domain and ext.suffix:
                return f"{ext.domain}.{ext.suffix}".lower()
        except Exception:
            pass
    # fallback heuristic: take last two labels
    parts = h.split('.')
    if len(parts) >= 2:
        return '.'.join(parts[-2:])
    return h


def register(app):
    @app.route('/url', methods=['POST'])
    def get_url():
        log.info("/url reçu (modular)")
        try:
            url = request.args.get('url')
            if not url:
                log.warning("Paramètre 'url' manquant")
                return jsonify({'error': 'no url'}), 400
            if not SETTINGS.get('detect_enabled'):
                log.info('Detection disabled by settings')
                return jsonify({'status': 'disabled'}), 200
            byUrl(url)
            log.info("Analyse terminée")
            return jsonify({'status': 'success'})
        except Exception as e:
            log.error("Erreur lors du traitement de l'URL", e)
            return jsonify({'error': 'Erreur interne'}), 500


    @app.route('/credentials', methods=['GET'])
    def get_credentials():
        log.info("/credentials reçu (modular)")
        try:
            url = request.args.get('url')
            if not url:
                return jsonify({'error': 'no url'}), 400

            try:
                token_header = request.headers.get('X-Ext-Auth')
            except Exception:
                token_header = None
            if EXT_TOKEN:
                if not token_header or token_header != EXT_TOKEN:
                    log.warning('/credentials unauthorized request')
                    return jsonify({'error': 'unauthorized'}), 401

            data_paths = get_data_paths() or []
            data = None
            for data_path in data_paths:
                try:
                    data = decryptByPath(key, data_path)
                    break
                except Exception:
                    log.warning(f"Failed to decrypt data at {data_path}, trying next path if available")
                    continue
            if data is None:
                return jsonify({'status': 'warning', 'message': 'no data'}), 404

            entries = data if isinstance(data, list) else ([data] if isinstance(data, dict) else [])
            matches = []
            incoming_host = _normalize_hostname(url)
            incoming_base = _primary_domain(incoming_host)
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                entry_url = entry.get('url')
                entry_host = _normalize_hostname(entry_url)
                entry_base = _primary_domain(entry_host)
                if entry_base and incoming_base and entry_base == incoming_base:
                    matches.append({'username': entry.get('username'), 'password': entry.get('password'), 'source': 'entry', 'url': entry_url, 'domain': entry_base})
                    continue
                sites = entry.get('sites') or []
                for s in sites:
                    s_url = s.get('url') if isinstance(s, dict) else None
                    site_host = _normalize_hostname(s_url)
                    site_base = _primary_domain(site_host)
                    if site_base and incoming_base and site_base == incoming_base:
                        matches.append({'username': s.get('username'), 'password': s.get('password'), 'source': 'site', 'url': s_url, 'domain': site_base})

            if len(matches) == 0:
                return jsonify({'status': 'not_found'}), 404
            log.info(f'/credentials returning {len(matches)} matches for url')
            return jsonify({'status': 'ok', 'matches': matches}), 200
        except Exception as e:
            import traceback
            log.error('get_credentials error: %s', e)
            log.debug(f'Traceback: {traceback.format_exc()}')
            return jsonify({'error': 'Unable to retrieve credentials'}), 500
