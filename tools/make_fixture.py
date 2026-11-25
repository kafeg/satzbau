#!/usr/bin/env python3
"""Эталон форм для тестов ядра: Präsens Indikativ и императив из UniMorph.

Правило вывода форм из `p3` проверять на глаз нельзя, поэтому проверяем сравнением
с источником. Фикстура маленькая и лежит в репозитории, чтобы тесты не требовали дампов.

  .venv/bin/python -I tools/make_fixture.py
"""
import collections, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAGS = {'V;IND;SG;1;PRS': '1sg', 'V;IND;SG;2;PRS': '2sg', 'V;IND;SG;3;PRS': '3sg',
        'V;IND;PL;1;PRS': '1pl', 'V;IND;PL;2;PRS': '2pl', 'V;IND;PL;3;PRS': '3pl'}

verbs = {v['w'] for v in json.load(open(f'{ROOT}/content/build/verbs.json', encoding='utf-8'))}
# ⚠ Эталон — СПИСОК форм, а не одна. У глаголов на -eln/-ern источник даёт обе
# («angel» и «angele» и «angle»), и присваивание оставляло последнюю, случайную.
# Из-за этого девять верных выводов висели в тесте как «известные расхождения».
out = collections.defaultdict(lambda: collections.defaultdict(set))
for line in open(f'{ROOT}/data/raw/unimorph-deu.tsv', encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    if len(p) == 3 and p[0] in verbs and p[2] in TAGS:
        out[p[0]][TAGS[p[2]]].add(p[1].strip())   # в дампе попадаются хвостовые пробелы
path = f'{ROOT}/src/core/__fixtures__/present.json'
json.dump({k: {t: sorted(v) for t, v in sorted(out[k].items())} for k in sorted(out)},
          open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=0, sort_keys=True)
open(path, 'a').write('\n')
print(f'{len(out)} глаголов из {len(verbs)} → {os.path.relpath(path, ROOT)}')
print('нет в UniMorph:', ', '.join(sorted(verbs - set(out))) or 'нет')

# Императив: у одного глагола бывает несколько принятых форм (fahr и fahre),
# поэтому в эталоне список, а тест требует попадания в него.
imp = collections.defaultdict(set)
for line in open(f'{ROOT}/data/raw/unimorph-deu.tsv', encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    if len(p) == 3 and p[0] in verbs and p[2] == 'V;IMP;SG;2':
        imp[p[0]].add(' '.join(p[1].split()))
path = f'{ROOT}/src/core/__fixtures__/imperative.json'
json.dump({k: sorted(imp[k]) for k in sorted(imp)}, open(path, 'w', encoding='utf-8'),
          ensure_ascii=False, indent=0, sort_keys=True)
open(path, 'a').write('\n')
print(f'императив: {len(imp)} глаголов из {len(verbs)} → {os.path.relpath(path, ROOT)}')

# Родительный единственного: у многих слов приняты обе формы (Arztes и Arzts),
# поэтому эталон — список, а тест требует попадания в него.
nouns = {n['w'] for n in json.load(open(f'{ROOT}/content/build/nouns.json', encoding='utf-8'))}
gen = collections.defaultdict(set)
for line in open(f'{ROOT}/data/raw/unimorph-deu.tsv', encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    if len(p) == 3 and p[0] in nouns and p[2].startswith('N;GEN;') and p[2].endswith(';SG'):
        gen[p[0]].add(p[1].strip())
path = f'{ROOT}/src/core/__fixtures__/genitive.json'
json.dump({k: sorted(gen[k]) for k in sorted(gen)}, open(path, 'w', encoding='utf-8'),
          ensure_ascii=False, indent=0, sort_keys=True)
open(path, 'a').write('\n')
print(f'родительный: {len(gen)} слов из {len(nouns)} → {os.path.relpath(path, ROOT)}')

# Склонение существительных. ⚠ Дательный ЕДИНСТВЕННОГО не сверяем: UniMorph даёт
# архаичное Dativ-e («dem Manne», «dem Hause»), это 465 расхождений из 533, и прав
# наш вывод, а не источник. Остальные семь клеток сверяемы.
NCASE = {'NOM': 'nom', 'ACC': 'akk', 'GEN': 'gen', 'DAT': 'dat'}
decl = collections.defaultdict(lambda: collections.defaultdict(set))
for line in open(f'{ROOT}/data/raw/unimorph-deu.tsv', encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    if len(p) != 3 or p[0] not in nouns or not p[2].startswith('N;'):
        continue
    bits = p[2].split(';')
    if len(bits) != 4:
        continue
    _, kase, _gender, num = bits
    if kase not in NCASE or num not in ('SG', 'PL'):
        continue
    cell = f'{NCASE[kase]}_{num.lower()}'
    if cell == 'dat_sg':
        continue
    decl[p[0]][cell].add(p[1].strip())
path = f'{ROOT}/src/core/__fixtures__/declension.json'
json.dump({k: {c: sorted(v) for c, v in sorted(decl[k].items())} for k in sorted(decl)},
          open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=0, sort_keys=True)
open(path, 'a').write('\n')
print(f'склонение: {len(decl)} слов из {len(nouns)} → {os.path.relpath(path, ROOT)}')

# Степени сравнения. В SPRL источник уже даёт форму с «am».
adjs = {a['w'] for a in json.load(open(f'{ROOT}/content/build/adjs.json', encoding='utf-8'))}
deg = collections.defaultdict(lambda: collections.defaultdict(set))
for line in open(f'{ROOT}/data/raw/unimorph-deu.tsv', encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    if len(p) == 3 and p[0] in adjs and p[2] in ('ADJ;CMPR', 'ADJ;SPRL'):
        deg[p[0]]['cmpr' if p[2].endswith('CMPR') else 'sprl'].add(' '.join(p[1].split()))
path = f'{ROOT}/src/core/__fixtures__/degrees.json'
json.dump({k: {c: sorted(v) for c, v in sorted(deg[k].items())} for k in sorted(deg)},
          open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=0, sort_keys=True)
open(path, 'a').write('\n')
print(f'степени: {len(deg)} прилагательных из {len(adjs)} → {os.path.relpath(path, ROOT)}')
