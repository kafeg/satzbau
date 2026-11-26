"""Подсказка рода для слова по правилам rules/ (docs/rules.md). Общая для verify.py и build.py.

Подсказка — самое надёжное из правил, которые подходят слову (доля на всём словаре). Если ни
одно подходящее правило не даёт род слова, подсказка — исключение из самого надёжного.
"""
import glob, json, os

import yaml

from srcs import ROOT

ARTICLE = {'m': 'der', 'f': 'die', 'n': 'das'}


def load():
    rules = []
    for p in sorted(glob.glob(os.path.join(ROOT, 'rules', '*.yaml'))):
        if not p.endswith('sources.yaml'):
            rules += yaml.safe_load(open(p, encoding='utf-8'))
    stats = {x['id']: x for x in map(json.loads, open(os.path.join(ROOT, 'evidence', 'rules.jsonl'), encoding='utf-8'))}
    heads = {x['lemma']: x for x in map(json.loads, open(os.path.join(ROOT, 'evidence', 'heads.jsonl'), encoding='utf-8'))}
    sources = yaml.safe_load(open(os.path.join(ROOT, 'rules', 'sources.yaml'), encoding='utf-8'))
    return rules, stats, heads, sources


def share(stats, rid):
    s = stats[rid]
    return s['ok'] / s['n'] if s['n'] else 0


def head_of(lemma, gender, heads):
    """Последняя часть сложного слова, у которой род совпадает с родом слова; иначе None."""
    h = heads.get(lemma)
    if not h:
        return None
    for src in ('dewikt', 'enwikt'):
        part = h[src]
        if part and gender in h['gender'].get(part, []):
            return part
    return None


def text(rule):
    w = rule['when']
    if 'suffix' in w:
        return f'-{w["suffix"]} → {ARTICLE[rule["gender"]]}'
    if 'list' in w:
        return f'{rule["title"]} → {ARTICLE[rule["gender"]]}'
    return 'род последней части'


def hint(lemma, gender, rules, stats, heads, compound=None):
    """{rule, ok, head} или None. gender — первый род слова (тот, что учим); compound — поле записи
    слова без своей статьи в словарях (её род и формы и так взяты от последней части)."""
    cands = []
    for r in rules:
        w = r['when']
        if 'head' in w:
            part = compound or head_of(lemma, gender, heads)
            if part:
                cands.append((share(stats, r['id']), r, True, part))
        elif ('suffix' in w and lemma.lower().endswith(w['suffix']) and len(lemma) > len(w['suffix']) + 1) \
                or ('list' in w and lemma in w['list']):
            cands.append((share(stats, r['id']), r, r['gender'] == gender, None))
    if not cands:
        return None
    ok = [c for c in cands if c[2]]
    s, r, good, part = max(ok or cands, key=lambda c: c[0])
    return {'rule': r['id'], 'ok': good, 'head': part}
