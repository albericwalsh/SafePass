import os
from datetime import datetime
from flask import jsonify, Response, request
from app import log


def register(app):
    def _resp_json(route, ok, message, data=None, status_code=200):
        body = {'route': route, 'status': 'ok' if ok else 'error', 'message': message}
        if data is not None:
            body['data'] = data
        try:
            if ok:
                log.info(f"{route} OK: {message}")
            else:
                log.error(f"{route} ERROR: {message}")
        except Exception:
            log.warning(f"Failed to log response for {route}")
        log.debug(f"Response body for {route}: {body}")
        return jsonify(body), status_code

    @app.route('/api/logs', methods=['GET'])
    def list_logs():
        try:
            root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'logs'))
            if not os.path.isdir(root):
                return _resp_json('/api/logs', True, 'logs directory not found, returning empty list', {'files': []})
            files = []
            for name in os.listdir(root):
                path = os.path.join(root, name)
                if os.path.isfile(path):
                    stat = os.stat(path)
                    files.append({
                        'name': name,
                        'size': stat.st_size,
                        'mtime': int(stat.st_mtime)
                    })
            files.sort(key=lambda x: x['mtime'], reverse=True)
            return _resp_json('/api/logs', True, f'returned {len(files)} log entries', {'files': files})
        except Exception as e:
            log.error('list_logs error: ' + str(e))
            return _resp_json('/api/logs', False, f'list_logs failed: {e}', None, 500)

    @app.route('/admin/logs/list', methods=['GET'])
    def admin_list_logs():
        try:
            root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'logs'))
            if not os.path.isdir(root):
                return _resp_json('/admin/logs/list', True, 'logs directory not found, returning empty list', {'logs': []})
            items = []
            for name in os.listdir(root):
                path = os.path.join(root, name)
                if os.path.isfile(path):
                    stat = os.stat(path)
                    try:
                        items.append({'name': name, 'mtime': int(stat.st_mtime)})
                    except Exception:
                        items.append({'name': name, 'mtime': 0})
            items.sort(key=lambda x: x.get('mtime', 0), reverse=True)
            return _resp_json('/admin/logs/list', True, f'returned {len(items)} logs', {'logs': items})
        except Exception as e:
            log.error('admin_list_logs error: ' + str(e))
            return _resp_json('/admin/logs/list', False, f'Unable to list logs: {e}', None, 500)

    @app.route('/api/logs/<path:filename>', methods=['GET'])
    def get_log(filename):
        try:
            safe_name = os.path.basename(filename)
            root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'logs'))
            path = os.path.join(root, safe_name)
            if not path.startswith(root):
                log.error(f"/api/logs/<filename> attempted traversal: {filename}")
                return _resp_json('/api/logs/<filename>', False, 'invalid filename', None, 400)
            if not os.path.isfile(path):
                return _resp_json('/api/logs/<filename>', False, 'file not found', None, 404)
            with open(path, 'rb') as f:
                data = f.read()
            resp = Response(data, mimetype='text/plain; charset=utf-8')
            resp.headers['X-Route'] = '/api/logs/<filename>'
            resp.headers['X-Status'] = 'ok'
            resp.headers['X-Message'] = f"returned log {safe_name}"
            log.info(f"/api/logs/<filename> returned {safe_name}")
            return resp
        except Exception as e:
            log.error('get_log error: ' + str(e))
            return _resp_json('/api/logs/<filename>', False, f'get_log failed: {e}', None, 500)

    @app.route('/api/logs/all', methods=['GET'])
    def get_all_logs():
        """Return concatenated logs. Optional query params: from, to (unix seconds or ISO datetime).
        If neither provided, return all logs in the logs folder.
        """
        log.info(f"/api/logs/all called with query params: {request.args}")
        try:
            def parse_ts(val):
                if not val:
                    log.debug("parse_ts: no value provided, returning None")
                    return None
                try:
                    log.debug(f"parse_ts: trying to parse '{val}' as integer timestamp")
                    return int(val)
                except Exception:
                    log.debug(f"parse_ts: '{val}' is not an integer timestamp, trying ISO format")
                    try:
                        dt = datetime.fromisoformat(val)
                        return int(dt.timestamp())
                    except Exception:
                        log.debug(f"parse_ts: '{val}' is not a valid ISO datetime, returning None")
                        return None

            root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'logs'))
            if not os.path.isdir(root):
                return _resp_json('/api/logs/all', True, 'logs directory not found, returning empty content', {'content': ''})

            qfrom = request.args.get('from')
            qto = request.args.get('to')
            ts_from = parse_ts(qfrom)
            ts_to = parse_ts(qto)

            files = []
            for name in os.listdir(root):
                path = os.path.join(root, name)
                if os.path.isfile(path):
                    stat = os.stat(path)
                    mtime = int(stat.st_mtime)
                    if ts_from is not None and mtime < ts_from:
                        continue
                    if ts_to is not None and mtime > ts_to:
                        continue
                    files.append((mtime, name, path))

            files.sort(key=lambda x: x[0])

            out_parts = []
            for mtime, name, path in files:
                try:
                    with open(path, 'r', encoding='utf-8', errors='replace') as f:
                        txt = f.read()
                except Exception:
                    try:
                        with open(path, 'rb') as f:
                            txt = f.read().decode('utf-8', errors='replace')
                    except Exception:
                        txt = ''
                header = f"=== {name} ({datetime.fromtimestamp(mtime).isoformat()}) ===\n\n"
                out_parts.append(header + txt + '\n\n')

            combined = ''.join(out_parts)
            resp = Response(combined, mimetype='text/plain; charset=utf-8')
            resp.headers['X-Route'] = '/api/logs/all'
            resp.headers['X-Status'] = 'ok'
            resp.headers['X-Message'] = f"returned combined logs ({len(files)} files)"
            log.info(f"/api/logs/all returned combined logs ({len(files)} files)")
            return resp
        except Exception as e:
            log.error('get_all_logs error')
            return _resp_json('/api/logs/all', False, 'get_all_logs failed', None, 500)

    @app.route('/api/logs/updates', methods=['GET'])
    def get_updates():
        """Return only logs modified after `since` (query param). If `since` missing, return all logs.
        Response: JSON { files: [ { name, mtime, content } ] }
        """
        try:
            def parse_ts(val):
                if not val:
                    return None
                try:
                    return int(val)
                except Exception:
                    try:
                        dt = datetime.fromisoformat(val)
                        return int(dt.timestamp())
                    except Exception:
                        return None

            root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'logs'))
            if not os.path.isdir(root):
                return _resp_json('/api/logs/updates', True, 'logs directory not found, returning empty list', {'files': []})

            qsince = request.args.get('since')
            ts_since = parse_ts(qsince)

            results = []
            for name in os.listdir(root):
                path = os.path.join(root, name)
                if not os.path.isfile(path):
                    continue
                stat = os.stat(path)
                mtime = int(stat.st_mtime)
                if ts_since is not None and mtime <= ts_since:
                    continue
                try:
                    with open(path, 'r', encoding='utf-8', errors='replace') as f:
                        txt = f.read()
                except Exception:
                    try:
                        with open(path, 'rb') as f:
                            txt = f.read().decode('utf-8', errors='replace')
                    except Exception:
                        txt = ''
                results.append({'name': name, 'mtime': mtime, 'content': txt})

            results.sort(key=lambda x: x['mtime'])
            return _resp_json('/api/logs/updates', True, f'returned {len(results)} updated files', {'files': results})
        except Exception as e:
            log.error('get_updates error')
            return _resp_json('/api/logs/updates', False, 'get_updates failed', {'files': []}, 500)

    @app.route('/admin/logs', methods=['GET'])
    def admin_get_logs():
        try:
            try:
                import log as app_log
                log_path = getattr(app_log, '_log_file', None)
            except Exception:
                log_path = None
            if not log_path:
                logs_dir = os.path.join(os.path.dirname(__file__), '..', 'logs')
                logs_dir = os.path.normpath(logs_dir)
                latest = None
                if os.path.exists(logs_dir):
                    for fn in os.listdir(logs_dir):
                        fp = os.path.join(logs_dir, fn)
                        if os.path.isfile(fp):
                            if latest is None or os.path.getmtime(fp) > os.path.getmtime(latest):
                                latest = fp
                log_path = latest
            if not log_path or not os.path.exists(log_path):
                return _resp_json('/admin/logs', False, 'No log file found', None, 404)
            with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            resp = Response(content, mimetype='text/plain')
            resp.headers['X-Route'] = '/admin/logs'
            resp.headers['X-Status'] = 'ok'
            resp.headers['X-Message'] = f"returned most recent log: {os.path.basename(log_path)}"
            log.info(f"/admin/logs returned {log_path}")
            return resp
        except Exception as e:
            log.error('admin_get_logs error')
            return _resp_json('/admin/logs', False, f'Unable to read log file: {e}', None, 500)

    @app.route('/admin/logs/file', methods=['GET'])
    def admin_get_log_file():
        try:
            name = request.args.get('name')
            if not name:
                return _resp_json('/admin/logs/file', False, 'missing name', None, 400)
            logs_dir = os.path.join(os.path.dirname(__file__), '..', 'logs')
            logs_dir = os.path.normpath(logs_dir)
            fp = os.path.normpath(os.path.join(logs_dir, name))
            if not fp.startswith(os.path.normpath(logs_dir)) or not os.path.exists(fp):
                return _resp_json('/admin/logs/file', False, 'not found', None, 404)
            with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            resp = Response(content, mimetype='text/plain')
            resp.headers['X-Route'] = '/admin/logs/file'
            resp.headers['X-Status'] = 'ok'
            resp.headers['X-Message'] = f"returned log file: {name}"
            log.info(f"/admin/logs/file returned {name}")
            return resp
        except Exception as e:
            log.error('admin_get_log_file error')
            return _resp_json('/admin/logs/file', False, f'Unable to read log file: {e}', None, 500)
