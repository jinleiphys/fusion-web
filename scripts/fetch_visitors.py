#!/usr/bin/env python3
"""Regenerate assets/visitors-data.js from the GoatCounter API.

Runs in the Pages deploy workflow every few hours with GOATCOUNTER_TOKEN set
(an API key with "Read statistics"), so visitors.html stays a static page with
no key in it and no request to any service but the site itself.

Everything written here is already aggregated by GoatCounter: countries and
regions, referring sites, pages, browsers. No IP address or individual visit
is ever available through the API. Referrers are cut to their host name, so
a path copied from somebody's private link cannot end up on a public page.

    GOATCOUNTER_TOKEN=... python3 scripts/fetch_visitors.py [--since 2026-09-24]
"""
import argparse, datetime as dt, json, os, sys, time, urllib.error, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://jinleiphys.goatcounter.com'


def get(path, token, optional=False, **params):
    url = SITE + '/api/v0/' + path + '?' + urllib.parse.urlencode(params, doseq=True)
    req = urllib.request.Request(url, headers={
        'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            # The hosted API can transiently return 404 as well as 5xx.
            if e.code in (404, 429, 500, 502, 503, 504) and attempt < 4:
                delay = min(30, max(1, float(e.headers.get('X-Rate-Limit-Reset', 2 ** attempt))))
                print('retrying %s after HTTP %d' % (path, e.code), file=sys.stderr)
                time.sleep(delay)
                continue
            if optional and e.code == 400:
                print('skipping %s: HTTP %d' % (path, e.code), file=sys.stderr)
                return {}
            raise RuntimeError('GoatCounter %s -> HTTP %d' % (path, e.code)) from e
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt == 4:
                raise RuntimeError('GoatCounter %s: connection failed' % path) from e
            time.sleep(2 ** attempt)


def host(name):
    """'github.com/jinleiphys/FUSION' -> 'github.com'; generated names pass through."""
    return name.split('/')[0] if '.' in name.split('/')[0] else name


def fetch_counts(since, token):
    now = dt.datetime.now(dt.timezone.utc).replace(minute=0, second=0, microsecond=0) + dt.timedelta(hours=1)
    span = {'start': since + 'T00:00:00Z', 'end': now.strftime('%Y-%m-%dT%H:%M:%SZ')}

    total = get('stats/total', token, **span)
    hits = get('stats/hits', token, limit=30, **span)
    stat = lambda page, n: get('stats/' + page, token, optional=True, limit=n, **span).get('stats') or []
    # screen sizes come back with an empty name and the class in id ('phone', 'desktop', ...)
    named = lambda page, n: [[s.get('name') or s.get('id') or '', s['count']] for s in stat(page, n) if s['count']]

    # Taiwan, Hong Kong and Macao are counted under China, and appear inside
    # it as regions with the marker codes '@TW', '@HK', '@MO' that the page
    # renders as 中国台湾 / Taiwan, China and so on.
    FOLD = ('TW', 'HK', 'MO')
    raw = stat('locations', 60)
    folded = [['@' + c['id'], c['count']] for c in raw if c.get('id') in FOLD]
    countries = []
    for c in raw:
        if c.get('id') in FOLD:
            continue
        regions = []
        if len(countries) < 8 and c.get('id'):
            regions = [[r['name'], r['count']]
                       for r in get('stats/locations/' + c['id'], token, optional=True, limit=12, **span).get('stats') or []
                       if r.get('name')]
        countries.append([c.get('id') or '', c['name'], c['count'], regions])
    if folded:
        cn = next((c for c in countries if c[0] == 'CN'), None)
        if cn is None:
            cn = ['CN', 'China', 0, []]
            countries.append(cn)
        cn[2] += sum(n for _, n in folded)
        cn[3] = sorted(cn[3] + folded, key=lambda r: -r[1])
        countries.sort(key=lambda c: -c[2])

    refs = {}
    for r in stat('toprefs', 40):
        name = host(r.get('name') or '')
        if name == 'vibeinscience.com':  # moving between our own pages is not an arrival
            continue
        refs[name] = refs.get(name, 0) + r['count']

    data = {
        'updated': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'),
        'since': since,
        'total': total['total'],
        'daily': [[d['day'], d.get('daily', 0)] for d in total['stats'] or []],
        'pages': [[h['path'], h['count']] for h in hits['hits'] or [] if not h.get('event')],
        'countries': countries,
        'refs': sorted(([k, v] for k, v in refs.items()), key=lambda kv: -kv[1]),
        'browsers': named('browsers', 8),
        'systems': named('systems', 8),
        'sizes': named('sizes', 6),
        'languages': named('languages', 10),
    }
    validate(data)
    return data


def validate(data):
    """Reject placeholders and incomplete snapshots before replacing good data."""
    if not isinstance(data, dict):
        raise ValueError('visitor snapshot is empty')
    dt.datetime.fromisoformat(data['updated'].replace('Z', '+00:00'))
    dt.date.fromisoformat(data['since'])
    if not isinstance(data['total'], (int, float)) or data['total'] < 0:
        raise ValueError('invalid visitor total')
    for key in ('daily', 'pages', 'countries', 'refs', 'browsers', 'systems', 'sizes', 'languages'):
        if not isinstance(data[key], list):
            raise ValueError('invalid visitor breakdown: ' + key)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--since', default='2026-09-24', help='first day counted (UTC)')
    ap.add_argument('--fallback-url', help='last published aggregate snapshot, used only if the API fails')
    args = ap.parse_args()
    out = os.path.join(HERE, 'assets', 'visitors-data.js')
    try:
        token = os.environ.get('GOATCOUNTER_TOKEN')
        if not token:
            raise RuntimeError('GOATCOUNTER_TOKEN is not set')
        data = fetch_counts(args.since, token)
    except (RuntimeError, ValueError, KeyError, TypeError) as error:
        print('::warning::Visitor refresh failed: %s' % error, file=sys.stderr)
        data = None
        # Prefer the newest valid snapshot from the cache or the live site.
        for source in (out, args.fallback_url):
            if not source:
                continue
            try:
                if source == out:
                    with open(source) as f:
                        text = f.read()
                else:
                    with urllib.request.urlopen(source, timeout=30) as r:
                        text = r.read().decode('utf-8')
                candidate = json.loads(text.split('const VISITORS=', 1)[1].strip().removesuffix(';'))
                validate(candidate)
                if candidate['since'] != args.since:
                    raise ValueError('snapshot covers a different date range')
                if data is None or candidate['updated'] > data['updated']:
                    data = candidate
            except (OSError, ValueError, KeyError, IndexError, TypeError):
                continue
        if data is None:
            sys.exit('No valid visitor snapshot; refusing to deploy empty data')
        print('::warning::Keeping visitor counts last updated ' + data['updated'], file=sys.stderr)
    # Only replace the file after a complete response or validated fallback.
    with open(out + '.tmp', 'w') as f:
        f.write('/* generated by scripts/fetch_visitors.py; aggregate counts only */\n')
        f.write('const VISITORS=%s;\n' % json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    os.replace(out + '.tmp', out)
    print('%s: %d visitors, %d countries, %d referrers'
          % (out, data['total'], len(data['countries']), len(data['refs'])))


if __name__ == '__main__':
    main()
