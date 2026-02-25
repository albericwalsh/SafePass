# -*- mode: python ; coding: utf-8 -*-

import sys
from pathlib import Path

block_cipher = None

# Chemins des données
data_files = [
    ('data', 'data'),
    ('public', 'public'),
    ('res', 'res'),
    ('back', 'back'),
    ('index.js', '.'),
]

if Path('node_modules').exists():
    data_files.append(('node_modules', 'node_modules'))

if Path('package.json').exists():
    data_files.append(('package.json', '.'))

common_hiddenimports = [
    'flask',
    'flask_cors',
    'cryptography',
    'gevent',
    'back.log',
    'back.detect',
    'csv',
    'back.routes',
    'back.routes.router',
    'back.routes.settings_admin',
    'back.routes.anssi_routes',
    'back.routes.auth_routes',
    'back.routes.crypting_routes',
    'back.routes.data_routes',
    'back.routes.export_routes',
    'back.routes.extension_routes',
    'back.routes.leaks_routes',
    'back.routes.logs_routes',
    'back.routes.path_routes',
    'back.routes.url_routes',
]

a_main = Analysis(
    ['SafePass.py'],
    pathex=[],
    binaries=[],
    datas=data_files,
    hiddenimports=common_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz_main = PYZ(a_main.pure, a_main.zipped_data, cipher=block_cipher)

exe_main = EXE(
    pyz_main,
    a_main.scripts,
    a_main.binaries,
    a_main.zipfiles,
    a_main.datas,
    [],
    name='SafePass',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    icon='res/icon.ico' if Path('res/icon.ico').exists() else None,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    onefile=False,  # Use one-dir mode instead to allow dynamic imports
)

a_backend = Analysis(
    ['SafePassBackend.py'],
    pathex=[],
    binaries=[],
    datas=data_files,
    hiddenimports=common_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz_backend = PYZ(a_backend.pure, a_backend.zipped_data, cipher=block_cipher)

exe_backend = EXE(
    pyz_backend,
    a_backend.scripts,
    a_backend.binaries,
    a_backend.zipfiles,
    a_backend.datas,
    [],
    name='SafePassBackend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    icon='res/icon.ico' if Path('res/icon.ico').exists() else None,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    onefile=False,
)

coll = COLLECT(
    exe_main,
    exe_backend,
    a_main.binaries,
    a_main.zipfiles,
    a_main.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='SafePass',
)