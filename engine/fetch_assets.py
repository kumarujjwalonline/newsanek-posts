#!/usr/bin/env python3
"""News Anek asset helper: Wikimedia Commons search -> relay payload -> licence manifest.

The container cannot reach Commons, news sites or NASA directly, so every download goes through the
n8n "Asset Relay" workflow (WgsX8NctB1VTalvX), which fetches a URL and commits the file to this repo.
This script only builds the payloads and the licence records; run the relay with the printed JSON body.

  search  <content_id> <key> "<query>"        -> relay body that saves q_<key>.json (Commons API results)
  pick    <content_id> <key> "<File:Title>" <name.jpg> [...]  -> relay body that downloads those files (1920px)
  shot    <content_id> <name.png> <article_url>  -> relay body for a 2400x3000 article screenshot (microlink)
  manifest <content_id>                        -> assets/<id>/licences.json + rows for the ASSET LIBRARY sheet

Picks are recorded in assets/<id>/picks.json so `manifest` can match each file to its Commons metadata.
Screenshots are logged as "Editorial reference (credited screenshot)"; never crop in an embedded press photo.
"""
import json, re, sys, os, html, urllib.parse as up

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = 'https://commons.wikimedia.org/w/api.php?'
OK_LICENCES = re.compile(r'^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+|CC BY [0-9.]+|Attribution|GODL-India|NASA)', re.I)


def adir(cid):
    d = os.path.join(ROOT, 'assets', cid); os.makedirs(d, exist_ok=True); return d


def search_url(q, width=1920, n=12):
    return API + up.urlencode({'action': 'query', 'format': 'json', 'generator': 'search', 'gsrnamespace': 6, 'gsrlimit': n,
                               'gsrsearch': q, 'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata', 'iiurlwidth': width})


def strip(s):
    return html.unescape(re.sub(r'<[^>]+>', '', s or '')).strip()


def commons_index(cid):
    idx = {}
    for sub in ('search', 'raw'):
        d = os.path.join(adir(cid), sub)
        for f in (os.listdir(d) if os.path.isdir(d) else []):
            if f.startswith('q_') and f.endswith('.json'):
                for p in json.load(open(os.path.join(d, f))).get('query', {}).get('pages', {}).values():
                    ii = p['imageinfo'][0]; m = ii.get('extmetadata', {})
                    idx[p['title']] = {'title': p['title'], 'page': ii.get('descriptionurl'), 'thumb': ii.get('thumburl') or ii['url'],
                                       'licence': strip(m.get('LicenseShortName', {}).get('value')), 'author': strip(m.get('Artist', {}).get('value'))[:120],
                                       'description': strip(m.get('ImageDescription', {}).get('value'))[:200], 'w': ii.get('width'), 'h': ii.get('height')}
    return idx


def relay(folder, files):
    print(json.dumps({'folder': folder, 'files': files}, ensure_ascii=False, indent=1))


def main(a):
    cmd, cid = a[0], a[1]
    folder = f'assets/{cid}/raw'
    if cmd == 'search':
        relay(folder, [{'name': f'q_{a[2]}.json', 'url': search_url(a[3])}])
    elif cmd == 'pick':
        idx = commons_index(cid); picks_f = os.path.join(adir(cid), 'picks.json')
        picks = json.load(open(picks_f)) if os.path.exists(picks_f) else {}
        files = []
        for title, name in zip(a[3::2], a[4::2]):
            m = idx.get(title)
            if not m: sys.exit(f'not in any q_*.json: {title}')
            if not OK_LICENCES.match(m['licence'] or ''): sys.exit(f'licence not allowed ({m["licence"]}): {title}')
            picks[name] = {'kind': 'commons', 'title': title}; files.append({'name': name, 'url': m['thumb']})
        json.dump(picks, open(picks_f, 'w'), ensure_ascii=False, indent=1); relay(folder, files)
    elif cmd == 'shot':
        name, url = a[2], a[3]
        shot = 'https://api.microlink.io/?' + up.urlencode({'url': url, 'screenshot': 'true', 'meta': 'false', 'embed': 'screenshot.url', 'waitForTimeout': 1500,
                                                           'viewport.width': 1200, 'viewport.height': 1500, 'viewport.deviceScaleFactor': 2})
        picks_f = os.path.join(adir(cid), 'picks.json'); picks = json.load(open(picks_f)) if os.path.exists(picks_f) else {}
        picks[name] = {'kind': 'screenshot', 'url': url}; json.dump(picks, open(picks_f, 'w'), ensure_ascii=False, indent=1)
        relay(folder, [{'name': name, 'url': shot}])
    elif cmd == 'manifest':
        idx = commons_index(cid); picks = json.load(open(os.path.join(adir(cid), 'picks.json')))
        out, rows = [], []
        for i, (name, p) in enumerate(sorted(picks.items()), 1):
            if p['kind'] == 'commons':
                m = idx[p['title']]; lic = m['licence']; author = m['author'] or 'unknown'
                credit = f"Photo: {author} / {lic}" if not lic.lower().startswith(('public', 'pd', 'cc0')) else f"Photo: {author} ({lic})"
                rec = {'file': name, 'type': 'photo', 'source': m['page'], 'licence': f'{lic} · Wikimedia Commons · {m["title"]}', 'author': author, 'credit': credit, 'description': m['description']}
            elif p['kind'] == 'screenshot':
                host = up.urlparse(p['url']).netloc.replace('www.', '')
                rec = {'file': name, 'type': 'screenshot', 'source': p['url'], 'licence': 'Editorial reference (credited screenshot of headline/text only; embedded press photos excluded)',
                       'author': host, 'credit': f'स्क्रीनशॉट: {host}', 'description': p.get('note', '')}
            else:
                rec = {'file': name, 'type': p.get('type', 'map'), 'source': p.get('source', ''), 'licence': p.get('licence', ''), 'author': p.get('author', ''), 'credit': p.get('credit', ''), 'description': p.get('note', '')}
            rec['asset_id'] = f'{cid}-AS{i:02d}'; out.append(rec)
            rows.append([cid, rec['asset_id'], rec['type'], rec['description'][:120] or name, 'https://github.com/kumarujjwalonline/newsanek-posts/blob/main/' + (f'engine/maps/{name}' if p['kind'] == 'map' else f'assets/{cid}/raw/{name}'),
                         rec['source'], rec['licence'], 'Real image (not AI)' if rec['type'] != 'screenshot' else 'Screenshot via microlink.io', 'v2', 'On-screen credit: ' + rec['credit']])
        json.dump(out, open(os.path.join(adir(cid), 'licences.json'), 'w'), ensure_ascii=False, indent=1)
        json.dump(rows, open(os.path.join(adir(cid), 'asset_library_rows.json'), 'w'), ensure_ascii=False, indent=1)
        print(f'{len(out)} assets -> assets/{cid}/licences.json, asset_library_rows.json')
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main(sys.argv[1:]) if len(sys.argv) > 2 else sys.exit(__doc__)
