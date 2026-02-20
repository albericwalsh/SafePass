import os
import shutil
import json
import time
import importlib


def setup_module(module):
    # backup settings.json
    os.makedirs('data', exist_ok=True)
    if os.path.exists('data/settings.json'):
        shutil.copy('data/settings.json', 'data/settings.json.bak')
    # backup master password files if any
    for p in ('.master_password.json', 'master_password.json'):
        path = os.path.join('data', p)
        if os.path.exists(path):
            shutil.copy(path, path + '.bak')
            try:
                os.remove(path)
            except Exception:
                pass
    # ensure a Fernet token exists so app import doesn't exit
    try:
        from cryptography.fernet import Fernet
        token_path = os.path.join('data', '.token')
        if not os.path.exists(token_path):
            with open(token_path, 'wb') as f:
                f.write(Fernet.generate_key())
    except Exception:
        pass


def teardown_module(module):
    # restore settings.json
    if os.path.exists('data/settings.json.bak'):
        shutil.move('data/settings.json.bak', 'data/settings.json')
    # restore master password backups
    for p in ('.master_password.json', 'master_password.json'):
        bak = os.path.join('data', p + '.bak')
        dest = os.path.join('data', p)
        if os.path.exists(bak):
            shutil.move(bak, dest)
        else:
            if os.path.exists(dest):
                try:
                    os.remove(dest)
                except Exception:
                    pass


def test_master_change_flow():
    # import app after token created
    import app as _app_module
    client = _app_module.app.test_client()

    # ensure no master password configured initially
    # attempt change -> should return 400 with error
    resp = client.post('/admin/master_password/change', json={'old_password': 'x', 'new_password': 'y'})
    assert resp.status_code == 400
    j = resp.get_json()
    assert j and ('error' in j)

    # set a new master password
    resp2 = client.post('/admin/master_password', json={'password': 'abc123'})
    assert resp2.status_code == 200
    j2 = resp2.get_json()
    assert j2 and j2.get('status') == 'ok'

    # now change it with correct old password
    resp3 = client.post('/admin/master_password/change', json={'old_password': 'abc123', 'new_password': 'def456'})
    assert resp3.status_code == 200
    j3 = resp3.get_json()
    assert j3 and j3.get('status') == 'ok'

    # attempt change with wrong old password should return 401
    resp4 = client.post('/admin/master_password/change', json={'old_password': 'wrong', 'new_password': 'x'})
    assert resp4.status_code == 401
