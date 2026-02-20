import os
import json
from io import StringIO, BytesIO
import csv
from flask import jsonify, request, Response, send_file
import requests

from werkzeug.security import check_password_hash
from app import log, SETTINGS, key, get_data_paths
from back.crypting.decrypt_file import decryptByPath


def register(app):
    @app.route('/exportCSV', methods=['POST'])
    def export_csv():
        try:
            payload = request.get_json(force=True)
            try:
                if SETTINGS.get('require_password_on_export'):
                    provided = None
                    if isinstance(payload, dict):
                        provided = payload.get('export_password')
                    if not provided:
                        provided = request.headers.get('X-Export-Password')
                    expected_hash = SETTINGS.get('export_password_hash')
                    if expected_hash is None:
                        return jsonify({'error': 'export password not configured on server'}), 400
                    if not provided or not check_password_hash(expected_hash, provided):
                        return jsonify({'error': 'unauthorized'}), 401
            except Exception:
                pass
            data = payload.get('data') if isinstance(payload, dict) else None
            if data is None:
                data_paths = get_data_paths() or []
                data_val = None
                for data_path in data_paths:
                    try:
                        data_val = decryptByPath(key, data_path)
                        break
                    except Exception:
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
            return send_file(BytesIO(csv_bytes), mimetype='text/csv', as_attachment=True, download_name='SafePass_export.csv')
        except Exception as e:
            log.error('export_csv error: ' + str(e))
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
        return Response(svg, mimetype='image/svg+xml')
