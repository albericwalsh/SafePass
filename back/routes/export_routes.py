import os
import json
import ast
from datetime import datetime, timezone
from io import StringIO, BytesIO
import csv
from flask import jsonify, request, Response, send_file
import requests

from werkzeug.security import check_password_hash
from back.app import log, SETTINGS, get_data_paths, verify_session_token
from back import app as app_module
from back.crypting.decrypt_file import decryptByPath
from back.crypting.crypt_file import cryptData


def _utc_now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def _first_non_empty(row, keys):
    for k in keys:
        v = row.get(k)
        if v is not None:
            s = str(v).strip()
            if s:
                return s
    return ''


def _parse_list_like_cell(raw_value):
    if raw_value is None:
        return []
    txt = str(raw_value).strip()
    if not txt:
        return []

    if len(txt) >= 2 and txt[0] == txt[-1] and txt[0] in ('"', "'"):
        txt = txt[1:-1].strip()

    parsed = None
    try:
        parsed = json.loads(txt)
    except Exception:
        try:
            parsed = ast.literal_eval(txt)
        except Exception:
            return []

    if isinstance(parsed, list):
        return [x for x in parsed if isinstance(x, dict)]
    if isinstance(parsed, dict):
        return [parsed]
    return []


def register(app):
    @app.route('/brand-icon', methods=['GET'])
    def brand_icon():
        try:
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
            icon_path = os.path.join(base_dir, 'res', 'icon.svg')
            if not os.path.exists(icon_path):
                log.warning(f"Brand icon not found at {icon_path}")
                return jsonify({'error': 'icon not found'}), 404
            return send_file(icon_path, mimetype='image/svg+xml')
        except Exception as e:
            log.error('brand_icon error: ' + str(e))
            return jsonify({'error': str(e)}), 500

    @app.route('/exportCSV', methods=['POST'])
    def export_csv():
        try:
            payload = request.get_json(force=True) or {}

            security = {}
            if isinstance(SETTINGS, dict):
                sec_raw = SETTINGS.get('security')
                if isinstance(sec_raw, dict):
                    security = sec_raw
            require_password = SETTINGS.get('require_password_on_export')
            if require_password is None:
                require_password = security.get('require_password_on_export', False)

            if require_password:
                provided = None
                if isinstance(payload, dict):
                    provided = payload.get('password') or payload.get('export_password')
                if not provided:
                    provided = request.headers.get('X-Export-Password')

                expected_hash = SETTINGS.get('export_password_hash')
                if expected_hash is None:
                    expected_hash = security.get('export_password_hash')

                if expected_hash is None:
                    return jsonify({'error': 'export password not configured on server'}), 400
                if not provided or not check_password_hash(expected_hash, provided):
                    return jsonify({'error': 'unauthorized'}), 401

            data = payload.get('data') if isinstance(payload, dict) else None
            if data is None:
                data_paths = get_data_paths() or []
                data_val = None
                for data_path in data_paths:
                    try:
                        data_val = decryptByPath(app_module.key, data_path)
                        break
                    except Exception:
                        log.warning(f"Failed to decrypt data at {data_path} during export, trying next path if available")
                        continue
                if data_val is None:
                    data_list = []
                else:
                    if isinstance(data_val, dict):
                        data_list = [data_val]
                    elif isinstance(data_val, list):
                        data_list = data_val
                    else:
                        data_list = [data_val]
            else:
                data_list = data if isinstance(data, list) else (json.loads(data) if isinstance(data, str) else [])
            output = StringIO()
            if len(data_list) > 0 and isinstance(data_list[0], dict):
                headers = list(data_list[0].keys())
                writer = csv.DictWriter(output, fieldnames=headers)
                writer.writeheader()
                for item in data_list:
                    writer.writerow({k: item.get(k, '') for k in headers})
            else:
                writer = csv.writer(output)
                for row in data_list:
                    if isinstance(row, list):
                        writer.writerow(row)
                    elif isinstance(row, dict):
                        writer.writerow([str(v) for v in row.values()])
                    else:
                        writer.writerow([str(row)])
            csv_bytes = output.getvalue().encode('utf-8')
            log.info(f"CSV export prepared with {len(data_list)} records, sending file response")
            return send_file(BytesIO(csv_bytes), mimetype='text/csv', as_attachment=True, download_name='SafePass_export.csv')
        except Exception as e:
            log.error('export_csv error: ' + str(e))
            return jsonify({'error': str(e)}), 500

    @app.route('/importCSV', methods=['POST'])
    def import_csv():
        try:
            token = request.headers.get('X-Auth-Token') or request.args.get('token')
            if SETTINGS.get('master_password_enabled'):
                if not token or not verify_session_token(token):
                    provided_pw = request.headers.get('X-Master-Password') or request.form.get('password')
                    stored_hash = SETTINGS.get('master_password_hash')
                    if not (provided_pw and stored_hash and check_password_hash(stored_hash, provided_pw)):
                        return jsonify({'error': 'unauthorized'}), 401

            csv_text = None
            uploaded = request.files.get('file')
            if uploaded is not None:
                raw = uploaded.read() or b''
                try:
                    csv_text = raw.decode('utf-8-sig')
                except Exception:
                    csv_text = raw.decode('latin-1', errors='replace')
            else:
                payload = request.get_json(silent=True) or {}
                if isinstance(payload, dict):
                    csv_path = payload.get('csv_path')
                    if csv_path:
                        abs_csv_path = os.path.normpath(os.path.abspath(str(csv_path)))
                        if not os.path.isfile(abs_csv_path):
                            return jsonify({'error': 'csv file not found'}), 400
                        if not abs_csv_path.lower().endswith('.csv'):
                            return jsonify({'error': 'selected file is not a csv'}), 400
                        with open(abs_csv_path, 'rb') as f:
                            raw = f.read() or b''
                        try:
                            csv_text = raw.decode('utf-8-sig')
                        except Exception:
                            csv_text = raw.decode('latin-1', errors='replace')
                    else:
                        csv_text = payload.get('csv')

            if not csv_text or not str(csv_text).strip():
                return jsonify({'error': 'missing csv file'}), 400

            reader = csv.DictReader(StringIO(csv_text))
            if not reader.fieldnames:
                return jsonify({'error': 'invalid csv header'}), 400

            lower_fieldnames = [str(h or '').strip().lower() for h in reader.fieldnames]

            parsed_rows = []
            for row in reader:
                if isinstance(row, dict):
                    parsed_rows.append(row)

            imported_sites = []
            imported_apps = []
            imported_autres = []

            has_category_columns = any(h in ('sites', 'applications', 'autres') for h in lower_fieldnames)
            if has_category_columns:
                for raw_row in parsed_rows:
                    lowered_row = {str(k).strip().lower(): v for k, v in raw_row.items()}
                    imported_sites.extend(_parse_list_like_cell(lowered_row.get('sites')))
                    imported_apps.extend(_parse_list_like_cell(lowered_row.get('applications')))
                    imported_autres.extend(_parse_list_like_cell(lowered_row.get('autres')))

            if not has_category_columns:
                for row in parsed_rows:
                    lowered = {str(k).strip().lower(): (v if v is not None else '') for k, v in row.items()}
                    name = _first_non_empty(lowered, ['name', 'nom', 'title', 'label'])
                    url = _first_non_empty(lowered, ['url', 'site', 'website', 'domain', 'lien'])
                    username = _first_non_empty(lowered, ['username', 'user', 'login', 'identifiant', 'email'])
                    password = _first_non_empty(lowered, ['password', 'pass', 'motdepasse', 'mot_de_passe', 'mdp'])

                    if not (name or url or username or password):
                        continue

                    imported_sites.append({
                        'name': name,
                        'url': url,
                        'username': username,
                        'password': password,
                        'password_history': [],
                        'created_at': _utc_now_iso()
                    })

            if not imported_sites and not imported_apps and not imported_autres:
                return jsonify({'error': 'no valid row found in csv'}), 400

            data_paths = get_data_paths() or []
            existing_path = data_paths[0] if data_paths else None
            if not existing_path:
                return jsonify({'error': 'no configured data path'}), 400

            existing = None
            for p in data_paths:
                try:
                    existing = decryptByPath(app_module.key, p)
                    existing_path = p
                    break
                except Exception:
                    existing = None
                    log.warning(f"Failed to decrypt existing data at {p} during CSV import, trying next path if available")

            if isinstance(existing, list) and len(existing) > 0 and isinstance(existing[0], dict):
                base = existing
            elif isinstance(existing, dict):
                base = [existing]
            else:
                base = [{'sites': [], 'applications': [], 'autres': []}]

            target = base[0]
            if 'sites' not in target or not isinstance(target.get('sites'), list):
                target['sites'] = []
            if 'applications' not in target or not isinstance(target.get('applications'), list):
                target['applications'] = []
            if 'autres' not in target or not isinstance(target.get('autres'), list):
                target['autres'] = []

            before_count = len(target['sites'])
            before_apps_count = len(target['applications'])
            before_autres_count = len(target['autres'])

            for item in imported_sites:
                if not isinstance(item, dict):
                    continue
                item.setdefault('name', '')
                item.setdefault('url', '')
                item.setdefault('username', '')
                item.setdefault('password', '')
                item.setdefault('password_history', [])
                item.setdefault('created_at', _utc_now_iso())

            target['sites'].extend(imported_sites)
            target['applications'].extend([x for x in imported_apps if isinstance(x, dict)])
            target['autres'].extend([x for x in imported_autres if isinstance(x, dict)])

            after_count = len(target['sites'])
            after_apps_count = len(target['applications'])
            after_autres_count = len(target['autres'])

            raw_json = json.dumps(base, indent=2).encode('utf-8')
            if app_module.key is None:
                raise ValueError('Encryption key is not initialized')
            encrypted = cryptData(app_module.key, raw_json)

            tmp_path = existing_path + '.tmp'
            with open(tmp_path, 'wb') as f:
                f.write(encrypted)
            os.replace(tmp_path, existing_path)

            log.info(
                f"CSV import completed: +{len(imported_sites)} sites, +{len(imported_apps)} applications, +{len(imported_autres)} autres"
            )
            return jsonify({
                'status': 'ok',
                'imported': len(imported_sites) + len(imported_apps) + len(imported_autres),
                'imported_sites': len(imported_sites),
                'imported_applications': len(imported_apps),
                'imported_autres': len(imported_autres),
                'sites_count': after_count,
                'applications_count': after_apps_count,
                'autres_count': after_autres_count,
                'sites_before': before_count,
                'applications_before': before_apps_count,
                'autres_before': before_autres_count,
            })
        except Exception as e:
            log.error('import_csv error: ' + str(e))
            return jsonify({'error': str(e)}), 500


    @app.route('/favicon', methods=['GET'])
    def favicon_proxy():
        domain = request.args.get('domain', '')
        def svg_for_domain(d):
            letter = (d[0].upper() if d else '?')
            bg = '#6c757d'
            svg = f"""<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'>"""
            svg += f"<rect width='100%' height='100%' fill='{bg}'/>"
            svg += f"<text x='50%' y='50%' dy='.35em' text-anchor='middle' fill='white' font-family='Arial' font-size='14'>{letter}</text>"
            svg += "</svg>"
            return svg
        if not domain:
            svg = svg_for_domain('')
            return Response(svg, mimetype='image/svg+xml')
        try:
            gurl = f'https://www.google.com/s2/favicons?domain={domain}&sz=64'
            r = requests.get(gurl, timeout=6)
            if r.status_code == 200 and r.content:
                content_type = r.headers.get('Content-Type', 'image/png')
                return Response(r.content, mimetype=content_type)
        except Exception as e:
            log.debug('favicon proxy fetch failed: ' + str(e))
        svg = svg_for_domain(domain)
        log.info(f"Returning generated SVG favicon for domain '{domain}'")
        return Response(svg, mimetype='image/svg+xml')
