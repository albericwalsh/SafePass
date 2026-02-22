from back.app import log

from flask import request, jsonify
from flask_cors import cross_origin
import os
import subprocess
from back import app as app_module
import json
from back.crypting.crypt_file import cryptData


def register(app):
    @app.route('/select-path', methods=['POST', 'OPTIONS'])
    @cross_origin()
    def select_path():
        # Respond to preflight
        if request.method == 'OPTIONS':
            return jsonify({'status': 'ok'}), 200
        try:
            payload = request.get_json(force=True) or {}
            mode = payload.get('mode', 'file')
            only_csv = bool(payload.get('only_csv', False))
            only_sfpss = bool(payload.get('only_sfpss', False))
            # Use tkinter filedialog to prompt native dialog and return absolute path
            try:
                import tkinter as tk
                from tkinter import filedialog
                root = tk.Tk()
                root.withdraw()
                # try to bring dialog to front on some platforms
                try:
                    root.attributes('-topmost', True)
                except Exception:
                    pass
                if mode == 'directory':
                    path = filedialog.askdirectory()
                else:
                    if only_csv:
                        path = filedialog.askopenfilename(filetypes=[('CSV files', '*.csv'), ('All files', '*.*')])
                    elif only_sfpss:
                        path = filedialog.askopenfilename(filetypes=[('SafePass files', '*.sfpss'), ('All files', '*.*')])
                    else:
                        path = filedialog.askopenfilename()
                try:
                    root.destroy()
                except Exception:
                    log.warning('Could not destroy tkinter root window')
                    pass
            except Exception as e:
                log.warning('Tk native dialog failed, trying PowerShell fallback: ' + str(e))
                try:
                    if mode == 'directory':
                        ps_script = (
                            "Add-Type -AssemblyName System.Windows.Forms;"
                            "$f = New-Object System.Windows.Forms.FolderBrowserDialog;"
                            "$res = $f.ShowDialog();"
                            "if ($res -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }"
                        )
                    else:
                        if only_csv:
                            ps_script = (
                                "Add-Type -AssemblyName System.Windows.Forms;"
                                "$f = New-Object System.Windows.Forms.OpenFileDialog;"
                                "$f.Filter = 'CSV files (*.csv)|*.csv|All files (*.*)|*.*';"
                                "$res = $f.ShowDialog();"
                                "if ($res -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.FileName }"
                            )
                        elif only_sfpss:
                            ps_script = (
                                "Add-Type -AssemblyName System.Windows.Forms;"
                                "$f = New-Object System.Windows.Forms.OpenFileDialog;"
                                "$f.Filter = 'SafePass files (*.sfpss)|*.sfpss|All files (*.*)|*.*';"
                                "$res = $f.ShowDialog();"
                                "if ($res -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.FileName }"
                            )
                        else:
                            ps_script = (
                                "Add-Type -AssemblyName System.Windows.Forms;"
                                "$f = New-Object System.Windows.Forms.OpenFileDialog;"
                                "$res = $f.ShowDialog();"
                                "if ($res -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.FileName }"
                            )

                    proc = subprocess.run(
                        ['powershell', '-NoProfile', '-STA', '-Command', ps_script],
                        capture_output=True,
                        text=True,
                        timeout=60,
                    )
                    path = (proc.stdout or '').strip()
                    if proc.returncode != 0:
                        raise RuntimeError((proc.stderr or 'PowerShell dialog failed').strip())
                except Exception as e2:
                    log.error('Error opening native dialog (tk + powershell fallback): ' + str(e2))
                    return jsonify({'status': 'error', 'error': 'Could not open native dialog: ' + str(e2)}), 500

            if not path:
                log.info('No path selected')
                return jsonify({'status': 'cancelled', 'path': None}), 200
            return jsonify({'status': 'ok', 'path': path}), 200
        except Exception as e:
            log.error('Error in select_path: ' + str(e))
            return jsonify({'status': 'error', 'error': str(e)}), 500
        
    @app.route('/validate-path', methods=['POST', 'OPTIONS'])
    @cross_origin()
    def validate_path():
        # Respond to preflight
        if request.method == 'OPTIONS':
            return jsonify({'status': 'ok'}), 200
        try:
            payload = request.get_json(force=True) or {}
            p = payload.get('path')
            mode = payload.get('mode', 'file')
            only_sfpss = bool(payload.get('only_sfpss', False))
            if not p:
                log.info('No path provided for validation')
                return jsonify({'status': 'error', 'message': 'no path provided', 'path': None}), 400
            # normalize and return absolute path
            try:
                abs_path = os.path.normpath(os.path.abspath(p))
            except Exception as e:
                log.error('Error normalizing path: ' + str(e))
                abs_path = p
            exists = os.path.exists(abs_path)
            is_file = os.path.isfile(abs_path)
            is_dir = os.path.isdir(abs_path)
            valid = False
            if mode == 'directory':
                valid = exists and is_dir
            else:
                # file mode: accept existing file OR a valid file path (may not exist yet) - but prefer existing
                valid = exists and is_file
                if valid and only_sfpss:
                    valid = str(abs_path).lower().endswith('.sfpss')
            log.info(f"validate_path: path='{p}', abs_path='{abs_path}', exists={exists}, is_file={is_file}, is_dir={is_dir}, valid={valid}")
            return jsonify({'status': 'ok', 'path': abs_path, 'exists': exists, 'is_file': is_file, 'is_dir': is_dir, 'valid': valid}), 200
        except Exception as e:
            log.error('Error in validate_path: ' + str(e))
            return jsonify({'status': 'error', 'error': str(e)}), 500

    @app.route('/ensure-token', methods=['POST', 'OPTIONS'])
    @cross_origin()
    def ensure_token():
        if request.method == 'OPTIONS':
            return jsonify({'status': 'ok'}), 200
        try:
            payload = request.get_json(force=True) or {}
            token_path = payload.get('token_path')
            overwrite = bool(payload.get('overwrite', False))
            if not token_path:
                return jsonify({'status': 'error', 'error': 'token_path is required'}), 400

            abs_path = os.path.normpath(os.path.abspath(str(token_path)))
            parent = os.path.dirname(abs_path)
            if parent:
                os.makedirs(parent, exist_ok=True)

            from cryptography.fernet import Fernet

            if os.path.exists(abs_path) and not overwrite:
                try:
                    with open(abs_path, 'rb') as f:
                        raw = f.read().strip()
                    Fernet(raw)
                    try:
                        app_module.load_encryption_key()
                    except Exception:
                        pass
                    return jsonify({'status': 'ok', 'path': abs_path, 'created': False}), 200
                except Exception:
                    return jsonify({'status': 'error', 'error': 'existing token file is invalid'}), 400

            key = Fernet.generate_key()
            with open(abs_path, 'wb') as f:
                f.write(key)

            try:
                app_module.load_encryption_key()
            except Exception:
                pass

            return jsonify({'status': 'ok', 'path': abs_path, 'created': True}), 200
        except Exception as e:
            log.error('Error in ensure_token: ' + str(e))
            return jsonify({'status': 'error', 'error': str(e)}), 500

    @app.route('/initialize-data-file', methods=['POST', 'OPTIONS'])
    @cross_origin()
    def initialize_data_file():
        if request.method == 'OPTIONS':
            return jsonify({'status': 'ok'}), 200
        try:
            payload = request.get_json(force=True) or {}
            data_path = payload.get('data_path')
            overwrite = bool(payload.get('overwrite', False))
            if not data_path:
                return jsonify({'status': 'error', 'error': 'data_path is required'}), 400

            abs_path = os.path.normpath(os.path.abspath(str(data_path)))
            parent = os.path.dirname(abs_path)
            if parent:
                os.makedirs(parent, exist_ok=True)

            if os.path.exists(abs_path) and not overwrite:
                return jsonify({'status': 'ok', 'path': abs_path, 'created': False}), 200

            try:
                app_module.load_encryption_key()
            except Exception:
                pass

            if app_module.key is None:
                return jsonify({'status': 'error', 'error': 'encryption key is not initialized'}), 400

            initial_data = {
                'sites': [],
                'applications': [],
                'autres': []
            }
            raw = json.dumps(initial_data, ensure_ascii=False, indent=2).encode('utf-8')
            encrypted = cryptData(app_module.key, raw)
            with open(abs_path, 'wb') as f:
                f.write(encrypted)

            return jsonify({'status': 'ok', 'path': abs_path, 'created': True}), 200
        except Exception as e:
            log.error('Error in initialize_data_file: ' + str(e))
            return jsonify({'status': 'error', 'error': str(e)}), 500
