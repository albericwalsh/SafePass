from flask import request, jsonify
from flask_cors import cross_origin
import os


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
                    path = filedialog.askopenfilename()
                try:
                    root.destroy()
                except Exception:
                    pass
            except Exception as e:
                return jsonify({'status': 'error', 'error': 'Could not open native dialog: ' + str(e)}), 500

            if not path:
                return jsonify({'status': 'cancelled', 'path': None}), 200
            return jsonify({'status': 'ok', 'path': path}), 200
        except Exception as e:
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
            if not p:
                return jsonify({'status': 'error', 'message': 'no path provided', 'path': None}), 400
            # normalize and return absolute path
            try:
                abs_path = os.path.normpath(os.path.abspath(p))
            except Exception:
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
            return jsonify({'status': 'ok', 'path': abs_path, 'exists': exists, 'is_file': is_file, 'is_dir': is_dir, 'valid': valid}), 200
        except Exception as e:
            return jsonify({'status': 'error', 'error': str(e)}), 500
