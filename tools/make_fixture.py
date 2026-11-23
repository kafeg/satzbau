#!/usr/bin/env python3
"""Эталон спряжения для тестов ядра: Präsens Indikativ из UniMorph.

Правило вывода форм из `p3` проверять на глаз нельзя, поэтому проверяем сравнением
с источником. Фикстура маленькая и лежит в репозитории, чтобы тесты не требовали дампов.

  .venv/bin/python -I tools/make_fixture.py
"""
import collections, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAGS = {'V;IND;SG;1;PRS': '1sg', 'V;IND;SG;2;PRS': '2sg', 'V;IND;SG;3;PRS': '3sg',
        'V;IND;PL;1;PRS': '1pl', 'V;IND;PL;2;PRS': '2pl', 'V;IND;PL;3;PRS': '3pl'}

verbs = {v['w'] for v in json.load(open(f'{ROOT}/content/build/verbs.json', encoding='utf-8'))}
out = collections.defaultdict(dict)
for line in open(f'{ROOT}/data/raw/unimorph-deu.tsv', encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    if len(p) == 3 and p[0] in verbs and p[2] in TAGS:
        out[p[0]][TAGS[p[2]]] = p[1].strip()   # в дампе попадаются хвостовые пробелы
path = f'{ROOT}/src/core/__fixtures__/present.json'
json.dump({k: out[k] for k in sorted(out)}, open(path, 'w', encoding='utf-8'),
          ensure_ascii=False, indent=0, sort_keys=True)
open(path, 'a').write('\n')
print(f'{len(out)} глаголов из {len(verbs)} → {os.path.relpath(path, ROOT)}')
print('нет в UniMorph:', ', '.join(sorted(verbs - set(out))) or 'нет')
