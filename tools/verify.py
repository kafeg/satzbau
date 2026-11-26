#!/usr/bin/env python3
"""Проверка базы слов по выпискам evidence/: каждый факт подтверждён источниками или `decided`.

  python3 -I tools/verify.py          проверка, код 1 при ошибке
  python3 -I tools/verify.py -v       со списком всех ошибок, а не первых по 10 на вид
"""
import collections, glob, json, os, re, sys

import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import srcs  # noqa: E402

ROOT = srcs.ROOT
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


BY = re.compile(r'tatoeba:\d+|llm:[\w.-]+:\d{4}-\d{2}-\d{2}')


# откуда немецкий текст фразы: по папке и префиксу id; у Викисловаря и LLM — ещё и de_by
SENTENCE_DIRS = {'tatoeba': ('t:', None), 'wikt': ('w:', re.compile('dewikt')), 'gen': ('g:', BY)}


def check_sentences(ids, errors):
    """Фраза: есть перевод, у каждого перевода — откуда он; токены ссылаются на существующие записи.
    У примеров Викисловаря и LLM слово, ради которого фраза взята, должно быть привязано."""
    n, seen = 0, set()
    for d, (prefix, de_by) in SENTENCE_DIRS.items():
        for p in sorted(glob.glob(os.path.join(ROOT, 'sentences', d, '*.jsonl'))):
            for line in open(p, encoding='utf-8'):
                s, n = json.loads(line), n + 1
                check_sentence(s, ids, prefix, de_by, seen, errors)
    return n


def check_sentence(s, ids, prefix, de_by, seen, errors):
    sid = s.get('id', '')
    if not sid.startswith(prefix) or sid in seen:
        errors['sentence-id'].append(f'{sid}: id не «{prefix}…» или повторяется')
    seen.add(sid)
    if de_by and not de_by.fullmatch(s.get('de_by', '')):
        errors['sentence'].append(f'{sid}: de_by «{s.get("de_by")}»')
    if prefix != 't:':
        word = sid[2:].rsplit(':', 1)[0]
        if word not in {t[4] for t in s.get('tok', [])}:
            errors['sentence-ref'].append(f'{sid}: слово {word} не привязано')
    if not s.get('de') or not (s.get('ru') or s.get('en')):
        errors['sentence'].append(f'{sid}: нет текста или перевода')
    for lang in ('ru', 'en'):
        if lang in s and not BY.fullmatch(s.get(f'{lang}_by', '')):
            errors['sentence'].append(f'{sid}: {lang}_by «{s.get(f"{lang}_by")}»')
    for t in s.get('tok', []):
        if t[4] not in (None, '?') and t[4] not in ids:
            errors['sentence-ref'].append(f'{sid}: {t[0]} → {t[4]}')


THEME_KEYS = ['id', 'title', 'order', 'words']


def check_themes(nouns, errors):
    """Темы — решения (docs/data-model.md, «Тема»): проверяем только ссылки и полноту."""
    course = {w['id'] for w in nouns if w.get('level')}
    seen, orders = set(), collections.Counter()
    paths = sorted(glob.glob(os.path.join(ROOT, 'themes', '*.yaml')))
    for p in paths:
        t = yaml.safe_load(open(p, encoding='utf-8'))
        name = os.path.basename(p)
        if list(t) != THEME_KEYS:
            errors['theme-schema'].append(f'{name}: поля {list(t)}, нужно {THEME_KEYS}')
            continue
        if f'{t["id"]}.yaml' != name or not re.fullmatch(r'[a-z]+', t['id']):
            errors['theme-id'].append(f'{name}: id {t["id"]}')
        orders[t['order']] += 1
        dup = [i for i, n in collections.Counter(t['words']).items() if n > 1]
        if dup:
            errors['theme-dup'].append(f'{t["id"]}: {", ".join(dup)}')
        for i in t['words']:
            if i not in course:
                errors['theme-ref'].append(f'{t["id"]}: {i} — не запись курса')
        seen |= set(t['words'])
    for o, n in orders.items():
        if n > 1:
            errors['theme-order'].append(f'order {o}: {n} тем')
    for i in sorted(course - seen):
        errors['theme-none'].append(f'{i}: ни в одной теме')
    return len(paths)


def main():
    verbose = '-v' in sys.argv
    errors, warnings = collections.defaultdict(list), collections.defaultdict(list)
    def err(kind, w, msg):
        errors[kind].append(f'{w["id"]}: {msg}')
    def warn(kind, w, msg):
        warnings[kind].append(f'{w["id"]}: {msg}')
    nouns = load_words('nouns')
    ev = load_evidence('nouns')
    ids = collections.Counter(w.get('id') for w in nouns)
    for i, n in ids.items():
        if n > 1:
            errors['id-dup'].append(f'{i}: {n} раз')
    for w in nouns:
        # вне курса (level: null) — справочные значения из dewikt: строгая проверка только у курса
        soft = w.get('level') is None
        check_noun(w, ev.get(w.get('lemma')), warn if soft else err, warn)
    n = check_sentences(set(ids), errors)
    themes = check_themes(nouns, errors)
    levels = collections.Counter(w.get('level') for w in nouns)
    print(f'существительных: {len(nouns)} (A1 {levels["A1"]}, A2 {levels["A2"]}, B1 {levels["B1"]}, '
          f'вне курса {levels[None]}); тем: {themes}; фраз: {n}')
    total = sum(map(len, errors.values()))
    for kind, xs in sorted(warnings.items()):
        print(f'предупреждение {kind}: {len(xs)}')
        for x in xs if verbose else xs[:3]:
            print('  ' + x)
    for kind, xs in sorted(errors.items()):
        print(f'\n{kind}: {len(xs)}')
        for x in xs if verbose else xs[:10]:
            print('  ' + x)
    print(f'\nошибок: {total}' if total else '\nвсё подтверждено')
    sys.exit(1 if total else 0)


if __name__ == '__main__':
    main()
