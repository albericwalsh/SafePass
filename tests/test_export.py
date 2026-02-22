import requests
import sys

BASE = 'http://127.0.0.1:5000'

def set_password(pw):
    r = requests.post(BASE + '/admin/export_password', json={'password': pw})
    print('set password', r.status_code, r.text)
    return r

def test_export_with_password(pw):
    # try export without header (should fail if require_password_on_export true)
    r = requests.post(BASE + '/exportCSV', json={'data': []})
    print('export no pwd', r.status_code)
    # try with header
    r2 = requests.post(BASE + '/exportCSV', json={'data': []}, headers={'X-Export-Password': pw})
    print('export with pwd', r2.status_code, r2.headers.get('Content-Type'))
    return r2

if __name__ == '__main__':
    pw = 'testpass'
    set_password(pw)
    resp = test_export_with_password(pw)
    if resp.status_code == 200:
        print('EXPORT OK')
        sys.exit(0)
    else:
        print('EXPORT FAIL')
        sys.exit(2)
