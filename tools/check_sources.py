#!/usr/bin/env python3
"""Источники правил говорят то, на что ссылаются: открыть страницу, найти раздел, найти строку.

  python3 -I tools/check_sources.py      нужна сеть; в CI не входит, запускать при правке rules/

Берёт вики-текст страницы (action=raw): раздел — от заголовка `at` до следующего заголовка того же
или более высокого уровня; строка `find` должна быть в нём дословно.
"""
import glob, os, re, sys, urllib.parse, urllib.request

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEAD = re.compile(r'^(=+)\s*(.*?)\s*\1\s*$', re.M)


def raw(url):
    p = urllib.parse.urlparse(url)
    title = urllib.parse.unquote(p.path.split('/wiki/', 1)[1])
    q = urllib.parse.urlencode({'title': title, 'action': 'raw'})
    req = urllib.request.Request(f'{p.scheme}://{p.netloc}/w/index.php?{q}', headers={'User-Agent': 'satzbau-check-sources/1'})
    return urllib.request.urlopen(req, timeout=30).read().decode('utf-8')


def section(text, at):
    hs = list(HEAD.finditer(text))
    for i, h in enumerate(hs):
        if re.sub(r'\{\{[^}]*\}\}', '', h.group(2)).strip() == at:
            end = next((x.start() for x in hs[i + 1:] if len(x.group(1)) <= len(h.group(1))), len(text))
            return text[h.end():end]
    return None


def main():
    sources = yaml.safe_load(open(os.path.join(ROOT, 'rules', 'sources.yaml'), encoding='utf-8'))
    pages, bad, n = {}, [], 0
    for path in sorted(glob.glob(os.path.join(ROOT, 'rules', '*.yaml'))):
        if path.endswith('sources.yaml'):
            continue
        for r in yaml.safe_load(open(path, encoding='utf-8')):
            for s in r['sources']:
                n += 1
                url = sources[s['src']]['url']
                if url not in pages:
                    pages[url] = raw(url)
                sec = section(pages[url], s['at'])
                if sec is None:
                    bad.append(f'{r["id"]}: {s["src"]} — нет раздела «{s["at"]}»')
                elif s['find'] not in sec:
                    bad.append(f'{r["id"]}: {s["src"]} — в разделе «{s["at"]}» нет «{s["find"]}»')
    print(f'ссылок проверено: {n}, страниц: {len(pages)}')
    for b in bad:
        print('  ' + b)
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
