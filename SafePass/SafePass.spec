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
]

a = Analysis(
    ['SafePass.py'],
    pathex=[],
    binaries=[],
    datas=data_files,
    hiddenimports=[
        'flask',
        'flask_cors', 
        'cryptography',
        'gevent',
        'log',
        'back.detect',
        'csv',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
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

coll = COLLECT(exe,
               a.binaries,
               a.zipfiles,
               a.datas,
               strip=False,
               upx=True,
               upx_exclude=[],
               name='SafePass')