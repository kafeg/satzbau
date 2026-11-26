#!/usr/bin/env python3
"""Темы из ручного отбора v1 → themes/<id>.yaml (docs/data-model.md, «Тема»). Один раз.

  python3 -I tools/import_themes.py

⚠ Перезаписывает themes/: после ручных правок не запускать. Берёт существительные
v1:content/manual/themes.yaml в его порядке; лемма → запись курса этой леммы.
"""
import glob, os, subprocess, sys

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POS = {'n': 'nouns'}


def course():
    """лемма → id записи курса (level задан): у леммы она одна."""
    out = {}
    for d in POS.values():
        for p in glob.glob(os.path.join(ROOT, 'words', d, '*.yaml')):
            for w in yaml.safe_load(open(p, encoding='utf-8')) or []:
                if w.get('level'):
                    if w['lemma'] in out:
                        sys.exit(f'{w["lemma"]}: две записи курса')
                    out[w['lemma']] = w['id']
    return out


def main():
    src = subprocess.run(['git', '-C', ROOT, 'show', 'v1:content/manual/themes.yaml'],
                         capture_output=True, text=True, check=True).stdout
    ids = course()
    out = os.path.join(ROOT, 'themes')
    os.makedirs(out, exist_ok=True)
    for p in glob.glob(os.path.join(out, '*.yaml')):
        os.remove(p)
    missing = []
    for order, (key, t) in enumerate(yaml.safe_load(src).items(), 1):
        words = []
        for w in t['words']:
            if w['pos'] not in POS:
                continue
            if w['w'] not in ids:
                missing.append(f'{key}: {w["w"]}')
            elif ids[w['w']] not in words:
                words.append(ids[w['w']])
        with open(os.path.join(out, f'{key}.yaml'), 'w', encoding='utf-8') as f:
            f.write(f'id: {key}\ntitle: {t["title"]}\norder: {order}\nwords:\n')
            f.writelines(f'  - {i}\n' for i in words)
    if missing:
        sys.exit('нет записи курса: ' + ', '.join(missing))
    print(f'тем: {order}')


if __name__ == '__main__':
    main()
