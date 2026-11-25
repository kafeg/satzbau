#!/usr/bin/env python3
"""Эталон форм из UniMorph для скриптов аудита — ОДИН файл на всех.

Пишет в `data/audit/unimorph.json`: каталог `data/` в .gitignore, потому что это
выгрузка источника, а сырые дампы в репозиторий не кладутся (CLAUDE.md, лицензии).
Постоянные тесты ядра берут свои эталоны через `tools/make_fixture.py`; здесь
отдельный файл, потому что аудиту нужны клетки, которых в тех фикстурах нет.

  .venv/bin/python -I tools/audit/unimorph.py
"""
import collections, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = f'{ROOT}/data/raw/unimorph-deu.tsv'
OUT = f'{ROOT}/data/audit/unimorph.json'

CASE = {'NOM': 'nom', 'ACC': 'akk', 'DAT': 'dat', 'GEN': 'gen'}
VERB = {'V;IND;SG;1;PRS': '1sg', 'V;IND;SG;2;PRS': '2sg', 'V;IND;SG;3;PRS': '3sg',
        'V;IND;PL;1;PRS': '1pl', 'V;IND;PL;2;PRS': '2pl', 'V;IND;PL;3;PRS': '3pl',
        'V;IND;SG;1;PST': 'pt1', 'V;IND;SG;3;PST': 'pt3', 'V.PTCP;PST': 'pp', 'V;IMP;SG;2': 'imp'}


def main():
    build = f'{ROOT}/content/build'
    nouns = {n['w'] for n in json.load(open(f'{build}/nouns.json', encoding='utf-8'))}
    verbs = {v['w'] for v in json.load(open(f'{build}/verbs.json', encoding='utf-8'))}
    adjs = {a['w'] for a in json.load(open(f'{build}/adjs.json', encoding='utf-8'))}
    out = collections.defaultdict(lambda: collections.defaultdict(set))
    for line in open(SRC, encoding='utf-8'):
        p = line.rstrip('\n').split('\t')
        if len(p) != 3:
            continue
        lemma, form, tag = p[0], ' '.join(p[1].split()), p[2]
        t = tag.split(';')
        if lemma in nouns and t[0] == 'N' and len(t) == 4 and t[1] in CASE:
            out[lemma][f'n_{CASE[t[1]]}_{t[3].lower()}'].add(form)
        elif lemma in adjs and t[0] == 'ADJ':
            if tag == 'ADJ;CMPR':
                out[lemma]['a_cmpr'].add(form)
            elif tag == 'ADJ;SPRL':
                out[lemma]['a_sprl'].add(form)
            # сильное склонение: ADJ;<падеж>;<род>;SG и ADJ;<падеж>;PL
            elif len(t) == 4 and t[1] in CASE:
                out[lemma][f'astrong_{CASE[t[1]]}_{t[2].lower()}'].add(form)
            elif len(t) == 3 and t[1] in CASE and t[2] == 'PL':
                out[lemma][f'astrong_{CASE[t[1]]}_pl'].add(form)
        elif lemma in verbs and tag in VERB:
            out[lemma][f'v_{VERB[tag]}'].add(form)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({k: {kk: sorted(vv) for kk, vv in v.items()} for k, v in sorted(out.items())},
              open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{len(out)} лемм → {os.path.relpath(OUT, ROOT)}')


if __name__ == '__main__':
    main()
