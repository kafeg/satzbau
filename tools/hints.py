"""Подсказка правила для поля слова (docs/rules.md). Общая для verify.py и build.py.

Правило утверждает значение поля слова (`then: {gender: f}`) при условии (`when`). Подсказка для
поля — самое надёжное из подходящих правил, которое даёт значение слова (доля на всём словаре);
если ни одно не даёт — исключение из самого надёжного. Сейчас поле одно — род; новое поле
(тип множественного, вспомогательный глагол) — строка в FIELDS и функция в TRUTH.
"""
import glob, json, os

import yaml

from srcs import ROOT

ARTICLE = {'m': 'der', 'f': 'die', 'n': 'das'}
# поле → значения, которые правило может утверждать; head — «как у последней части сложного слова»
FIELDS = {'gender': {'m', 'f', 'n', 'head'}}
# поле → значение у слова (то, что учим)
TRUTH = {'gender': lambda w: (w.get('gender') or [None])[0]}


def load():
    rules = []
    for p in sorted(glob.glob(os.path.join(ROOT, 'rules', '*.yaml'))):
        if not p.endswith('sources.yaml'):
            rules += yaml.safe_load(open(p, encoding='utf-8'))
    stats = {x['id']: x for x in map(json.loads, open(os.path.join(ROOT, 'evidence', 'rules.jsonl'), encoding='utf-8'))}
    heads = {x['lemma']: x for x in map(json.loads, open(os.path.join(ROOT, 'evidence', 'heads.jsonl'), encoding='utf-8'))}
    sources = yaml.safe_load(open(os.path.join(ROOT, 'rules', 'sources.yaml'), encoding='utf-8'))
    return rules, stats, heads, sources


def field(rule):
    (f, v), = rule['then'].items()
    return f, v


def share(stats, rid):
    s = stats[rid]
    return s['ok'] / s['n'] if s['n'] else 0


def applies(rule, lemma):
    w = rule['when']
    if 'suffix' in w:
        return lemma.lower().endswith(w['suffix']) and len(lemma) > len(w['suffix']) + 1
    if 'list' in w:
        return lemma in w['list']
    return False


def head_of(lemma, value, heads):
    """Последняя часть сложного слова, у которой значение поля совпадает со значением слова; иначе None."""
    h = heads.get(lemma)
    if not h:
        return None
    for src in ('dewikt', 'enwikt'):
        part = h[src]
        if part and value in h['gender'].get(part, []):
            return part
    return None


def text(rule):
    f, v = field(rule)
    w = rule['when']
    if v == 'head':
        return 'род последней части'
    shown = ARTICLE[v] if f == 'gender' else v
    if 'suffix' in w:
        return f'-{w["suffix"]} → {shown}'
    return f'{rule["title"]} → {shown}'


def hint(word, name, rules, stats, heads):
    """{rule, ok, head} или None. word — запись слова (lemma, поля, compound — у слова без своей статьи
    в словарях: его род и формы и так взяты от последней части)."""
    value = TRUTH[name](word)
    if value is None:
        return None
    cands = []
    for r in rules:
        f, claim = field(r)
        if f != name:
            continue
        if 'head' in r['when']:
            part = word.get('compound') or head_of(word['lemma'], value, heads)
            if part:
                cands.append((share(stats, r['id']), r, True, part))
        elif applies(r, word['lemma']):
            cands.append((share(stats, r['id']), r, claim == value, None))
    if not cands:
        return None
    ok = [c for c in cands if c[2]]
    s, r, good, part = max(ok or cands, key=lambda c: c[0])
    return {'rule': r['id'], 'ok': good, 'head': part}
