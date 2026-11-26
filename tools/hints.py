"""Подсказка правила для поля слова (docs/rules.md). Общая для verify.py и build.py.

Правило утверждает значение поля слова (`then: {gender: f}`) при условии (`when`). Подсказка для
поля — самое надёжное из подходящих правил, которое даёт значение слова (доля на всём словаре);
если ни одно не даёт — исключение из самого надёжного. Поля — род и тип множественного; новое
поле (вспомогательный глагол) — строка в FIELDS и функция в TRUTH.
"""
import glob, json, os

import yaml

from srcs import ROOT

ARTICLE = {'m': 'der', 'f': 'die', 'n': 'das'}
# тип множественного, как в src/core/exercises/plural.ts: окончание и умлаут основы
PLURAL = ('-e', '¨-e', '-er', '¨-er', '-(e)n', '-s', '—', '¨')
UML = {'a': 'ä', 'o': 'ö', 'u': 'ü', 'A': 'Ä', 'O': 'Ö', 'U': 'Ü'}


def _ending(stem, form):
    if not form.startswith(stem):
        return None
    t = form[len(stem):]
    if t == '':
        return '—'
    if t == 'e' or (t == 'se' and stem.endswith('s')):
        return '-e'
    if t == 'er':
        return '-er'
    if t in ('n', 'en') or (t == 'nen' and stem.endswith('in')):
        return '-(e)n'
    if t == 's':
        return '-s'
    return None


def plural_type(lemma, form):
    """Тип пары «лемма → форма множественного» или None, если форма вне типов (Museum → Museen)."""
    e = _ending(lemma, form)
    if e:
        return e
    for i, c in enumerate(lemma):
        if c not in UML or (i > 0 and lemma[i - 1] == 'a' and c == 'u'):
            continue
        e = _ending(lemma[:i] + UML[c] + lemma[i + 1:], form)
        if e in ('-e', '-er', '—'):
            return {'-e': '¨-e', '-er': '¨-er', '—': '¨'}[e]
    return None


def _plural(w):
    if not w.get('plural') or 'plural' in (w.get('skip') or {}):
        return None
    return plural_type(w['lemma'], w['plural'][0])


# поле → значения, которые правило может утверждать; head — «как у последней части сложного слова»
FIELDS = {'gender': {'m', 'f', 'n', 'head'}, 'plural': {*PLURAL, 'head'}}
# поле → значение у слова (то, что учим); у множественного — тип первой формы
TRUTH = {'gender': lambda w: (w.get('gender') or [None])[0], 'plural': _plural}
HEAD_TEXT = {'gender': 'род последней части', 'plural': 'множественное как у последней части'}


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


def applies(rule, word):
    """word — lemma и gender. Условие gender (род слова из списка) — само или добавка к suffix или list."""
    w, lemma = rule['when'], word['lemma']
    if 'gender' in w and TRUTH['gender'](word) not in w['gender']:
        return False
    if 'suffix' in w:
        return lemma.lower().endswith(w['suffix']) and len(lemma) > len(w['suffix']) + 1
    if 'list' in w:
        return lemma in w['list']
    return 'gender' in w and 'head' not in w


def head_of(lemma, name, value, heads):
    """Последняя часть сложного слова, у которой значение поля совпадает со значением слова; иначе None."""
    h = heads.get(lemma)
    if not h:
        return None
    for src in ('dewikt', 'enwikt'):
        part = h[src]
        if part and value in h.get(name, {}).get(part, []):
            return part
    return None


def text(rule):
    f, v = field(rule)
    w = rule['when']
    if v == 'head':
        return HEAD_TEXT[f]
    shown = ARTICLE[v] if f == 'gender' else v
    cond = f'-{w["suffix"]}' if 'suffix' in w else rule.get('title', '')
    if 'gender' in w:
        art = ', '.join(ARTICLE[g] for g in w['gender'])
        cond = f'{cond} ({art})' if cond else art
    return f'{cond} → {shown}'


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
            part = word.get('compound') or head_of(word['lemma'], name, value, heads)
            if part:
                cands.append((share(stats, r['id']), r, True, part))
        elif applies(r, word):
            cands.append((share(stats, r['id']), r, claim == value, None))
    if not cands:
        return None
    ok = [c for c in cands if c[2]]
    s, r, good, part = max(ok or cands, key=lambda c: c[0])
    return {'rule': r['id'], 'ok': good, 'head': part}
