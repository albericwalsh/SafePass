#!/usr/bin/env python3
import json
import os
import sys
try:
    import requests
except Exception:
    requests = None

DEFAULTS = {
    "strength_threshold_red": 10,
    "strength_threshold_orange": 30,
    "strength_threshold_yellow": 60
}

BASE = 'http://127.0.0.1:5000'

def update_via_api(new_settings):
    if requests is None:
        print('requests not available')
        return False
    try:
        url = BASE + '/settings'
        r = requests.get(url, timeout=2)
        if r.status_code != 200:
            print('GET /settings returned', r.status_code)
            return False
        cur = r.json().get('settings') if r.headers.get('content-type','').lower().find('json')!=-1 else r.json()
        if not isinstance(cur, dict): cur = {}
        cur.update(new_settings)
        pr = requests.post(url, json=cur, timeout=2)
        print('POST /settings ->', pr.status_code)
        return pr.status_code == 200
    except Exception as e:
        print('API update failed:', e)
        return False


def update_local(new_settings):
    path = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'data', 'settings.json'))
    print('Local settings path:', path)
    try:
        data = {}
        if os.path.exists(path):
            with open(path,'r',encoding='utf-8') as f: data = json.load(f) or {}
        before = {k: data.get(k) for k in new_settings.keys()}
        data.update(new_settings)
        with open(path,'w',encoding='utf-8') as f: json.dump(data, f, ensure_ascii=False, indent=2)
        after = {k: data.get(k) for k in new_settings.keys()}
        print('Updated local settings:')
        print(' before:', before)
        print(' after :', after)
        return True
    except Exception as e:
        print('Local update failed:', e)
        return False


def main():
    new = DEFAULTS
    print('Attempting to update via API if available...')
    ok = False
    if requests:
        ok = update_via_api(new)
    else:
        print('requests not installed, skipping API attempt.')
    if not ok:
        print('Falling back to local file update...')
        ok = update_local(new)
    if ok:
        print('Done.')
    else:
        print('Failed to apply settings.')

if __name__ == '__main__':
    main()
