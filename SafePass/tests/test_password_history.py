import os
import json
import shutil
import tempfile
from datetime import datetime

import pytest

from back import app as _app
from back.crypting.crypt_file import cryptData
from back.crypting.decrypt_file import decryptByPath


def setup_module(module):
    # ensure token exists
    os.makedirs(os.path.join(os.path.dirname(__file__), '..', 'data'), exist_ok=True)
    token_path = os.path.join(os.path.dirname(__file__), '..', 'data', '.token')
    try:
        from cryptography.fernet import Fernet
        if not os.path.exists(token_path):
            with open(token_path, 'wb') as f:
                f.write(Fernet.generate_key())
    except Exception:
        pass


def teardown_module(module):
    # nothing special
    pass


def write_encrypted(path, key, data_obj):
    raw = json.dumps(data_obj, indent=2).encode('utf-8')
    enc = cryptData(key, raw)
    with open(path, 'wb') as f:
        f.write(enc)


def test_save_data_appends_password_history_and_respects_length(tmp_path):
    # Prepare test encrypted data file
    data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
    os.makedirs(data_dir, exist_ok=True)
    test_path = str(tmp_path / 'data_encrypted_test.sfpss')

    # initial data: one site with an old password and an existing history
    initial = [{
        'sites': [
            {
                'name': 'Example',
                'url': 'https://sub.example.com/path',
                'username': 'alice',
                'password': 'oldpw',
                'created_at': '2020-01-01T00:00:00Z',
                'password_history': ['olderpw']
            }
        ],
        'applications': [],
        'autres': []
    }]

    # ensure key available
    key = _app.key
    assert key is not None, "Encryption key must be initialized for test"

    write_encrypted(test_path, key, initial)

    # configure app to use this path
    _app.SETTINGS['storage'] = _app.SETTINGS.get('storage', {})
    _app.SETTINGS['storage']['data_path'] = test_path

    # set password_history_length to 2
    _app.SETTINGS['security'] = _app.SETTINGS.get('security', {})
    _app.SETTINGS['security']['password_history_length'] = 2

    client = _app.app.test_client()

    # update entry: change password from 'oldpw' to 'newpw'
    entry = {
        'url': 'https://example.com',
        'username': 'alice',
        'password': 'newpw'
    }

    resp = client.post('/saveData', json={'extension_entry': entry})
    assert resp.status_code == 200
    j = resp.get_json()
    assert j and j.get('status') == 'success'

    # read back and assert history
    data = decryptByPath(key, test_path)
    assert isinstance(data, list)
    sites = data[0].get('sites', [])
    assert len(sites) == 1
    s = sites[0]
    assert s.get('password') == 'newpw'
    hist = s.get('password_history')
    assert isinstance(hist, list)
    # history should have oldpw at front and be trimmed to length 2
    assert hist[0] == 'oldpw'
    assert len(hist) <= 2
    assert isinstance(s.get('created_at'), str)
    assert s.get('created_at').endswith('Z')
    assert s.get('created_at') != '2020-01-01T00:00:00Z'
    datetime.fromisoformat(s.get('created_at').replace('Z', '+00:00'))


def test_save_data_sets_created_at_for_new_entry(tmp_path):
    test_path = str(tmp_path / 'data_encrypted_test_new_entry.sfpss')

    initial = [{
        'sites': [],
        'applications': [],
        'autres': []
    }]

    key = _app.key
    assert key is not None, "Encryption key must be initialized for test"

    write_encrypted(test_path, key, initial)

    _app.SETTINGS['storage'] = _app.SETTINGS.get('storage', {})
    _app.SETTINGS['storage']['data_path'] = test_path

    client = _app.app.test_client()

    entry = {
        'url': 'https://new.example.com',
        'username': 'bob',
        'password': 'secretpw'
    }

    resp = client.post('/saveData', json={'extension_entry': entry})
    assert resp.status_code == 200
    j = resp.get_json()
    assert j and j.get('status') == 'success'

    data = decryptByPath(key, test_path)
    assert isinstance(data, list)
    sites = data[0].get('sites', [])
    assert len(sites) == 1
    saved = sites[0]
    assert isinstance(saved.get('created_at'), str)
    assert saved.get('created_at').endswith('Z')
    datetime.fromisoformat(saved.get('created_at').replace('Z', '+00:00'))
