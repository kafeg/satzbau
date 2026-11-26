"""Существительные: каждый факт подтверждён источниками по выпискам evidence/ или `decided`."""
import glob, json, os, re

import yaml

import srcs
from srcs import ROOT

LEVELS = {'A1', 'A2', 'B1', None}
NOUN_KEYS = ['id', 'lemma', 'gender', 'plural', 'gen_sg', 'ru', 'en', 'freq', 'level', 'decided', 'skip']
NOUN_OPT = {'sense', 'number', 'compound'}
FORM_SOURCES = ('dewikt', 'enwikt', 'ruwikt')


def load_words(pos):
    out = []
    for p in sorted(glob.glob(os.path.join(ROOT, 'words', pos, '*.yaml'))):
        out += yaml.safe_load(open(p, encoding='utf-8')) or []
    return out


def load_evidence(name):
    path = os.path.join(ROOT, 'evidence', f'{name}.jsonl')
    return {e['lemma']: e for e in map(json.loads, open(path, encoding='utf-8'))}


def votes(ev, field, value):
    return sum(any(value in e.get(field, []) for e in ev.get(src, [])) for src in FORM_SOURCES)


def speaks(ev, field):
    """Сколько источников вообще что-то говорят об этом поле у леммы."""
    return sum(any(e.get(field) for e in ev.get(src, [])) for src in FORM_SOURCES)


def proof(ev, field, value, w, err, warn, first):
    v = votes(ev, field, value)
    if v >= (2 if first else 1):
        return
    if v == 1 and speaks(ev, field) == 1:
        warn(f'{field}-single', w, f'{value}: только один источник, остальные о слове молчат')
    else:
        err(f'{field}-disagree' if v else f'{field}-none', w,
            f'{value}: подтверждён {v} из {speaks(ev, field)} источников, которые знают слово')


def own_dewikt(w, ev):
    """Запись dewikt, из которой взята эта запись слова: n:Bank — первая, n:Bank:2 — вторая."""
    parts = w['id'].split(':')
    i = int(parts[2]) - 1 if len(parts) > 2 else 0
    de = ev.get('dewikt', [])
    return de[i] if i < len(de) else None


def check_forms(w, ev, field, err, warn):
    xs = w[field]
    if field in w['decided']:
        return
    de = own_dewikt(w, ev)
    # таблица склонения dewikt без множественного — «только ед. ч.»: dewikt сильнее формальных форм других
    if not xs and field == 'plural' and de and de['gen_sg'] and not de['plural']:
        if speaks(ev, field):
            warn('plural-sg-only', w, 'dewikt: только ед. ч., другие источники дают форму')
        return
    if not xs:
        if speaks(ev, field) > (1 if any(e.get(field) for e in ev.get('dewikt', [])) else 0):
            err(f'{field}-empty', w, 'пусто, а другие источники форму дают')
        return
    for i, x in enumerate(xs):
        proof(ev, field, x, w, err, warn, i == 0)


def pool(ev, lang):
    out = set()
    for e in ev.get('dewikt', []):
        out |= {srcs.norm(y) for v in e[lang].values() for x in v for y in srcs.ru_items(x)}
    if lang == 'ru':
        out |= {srcs.norm(x) for e in ev.get('ruwikt', []) for x in e.get('ru', [])}
        out |= {srcs.norm(x) for x in ev.get('freedict', [])}
    else:
        out |= {srcs.norm(x) for e in ev.get('enwikt', []) for g in e.get('en', []) for x in srcs.ru_items(g)}
    return out


def check_noun(w, ev, err, warn):
    keys = set(w)
    if missing := [k for k in NOUN_KEYS if k not in keys]:
        err('schema', w, f'нет полей {missing}')
        return
    if extra := keys - set(NOUN_KEYS) - NOUN_OPT:
        err('schema', w, f'лишние поля {sorted(extra)}')
    if not re.fullmatch(rf'n:{re.escape(w["lemma"])}(:\d+)?', w['id']):
        err('schema', w, 'id не по формату n:<лемма>[:n]')
    if not set(w['gender']) <= {'m', 'f', 'n'} or (not w['gender'] and w.get('number') != 'pl'):
        err('schema', w, f'род {w["gender"]}')
    if w['level'] not in LEVELS:
        err('schema', w, f'уровень {w["level"]}')
    for k in ('decided', 'skip'):
        if not isinstance(w[k], dict) or any(not isinstance(v, str) or not v.strip() for v in w[k].values()):
            err('schema', w, f'{k}: у каждой записи нужна причина')
    if ev is None:
        err('evidence', w, 'нет выписки из источников')
        return
    if w.get('compound') != ev.get('head') or (ev.get('head') and not w['lemma'].lower().endswith(ev['head'].lower())):
        err('compound', w, f'основное слово {w.get("compound")} ≠ выписке {ev.get("head")}')
    if 'gender' not in w['decided']:
        for i, g in enumerate(w['gender']):
            proof(ev, 'gender', g, w, err, warn, i == 0)
    if w.get('number') != 'pl':
        check_forms(w, ev, 'plural', err, warn)
    if w.get('number') != 'pl':
        check_forms(w, ev, 'gen_sg', err, warn)
    for lang in ('ru', 'en'):
        if lang in w['decided']:
            continue
        if not w[lang]:
            if w['level']:
                err(f'{lang}-none', w, 'нет перевода у слова с уровнем')
            continue
        known = pool(ev, lang)
        bad = [x for x in srcs.ru_items(w[lang]) if srcs.norm(x) not in known]
        if bad or not srcs.ru_items(w[lang]):
            err(f'{lang}-proof', w, f'нет в словарях: {bad or w[lang]}')
    if w['freq'] != srcs.bucket(ev.get('rank')):
        err('freq', w, f'{w["freq"]} ≠ {srcs.bucket(ev.get("rank"))} по рангу {ev.get("rank")}')
