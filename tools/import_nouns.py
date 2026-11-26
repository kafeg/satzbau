#!/usr/bin/env python3
"""Импорт существительных: words/nouns/*.yaml и evidence/nouns.jsonl из data/raw.

Импорт разовый: дальше правда — words/, их правят руками. Повторный прогон перезаписывает
words/nouns, поэтому после ручных правок его не запускают (или сверяют diff).

Список лемм — существительные ручного отбора v1 (`git show v1:content/build/nouns.json`).
Таблица «форма → леммы» для частотности и разметки фраз — data/work/forms.json.gz.
"""
import collections, gzip, json, os, subprocess, sys

import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import srcs  # noqa: E402

ROOT = srcs.ROOT


def seed():
    out = subprocess.run(['git', '-C', ROOT, 'show', 'v1:content/build/nouns.json'],
                         capture_output=True, text=True, check=True).stdout
    return {n['w']: n for n in json.loads(out)}


WORD_POS = {'noun', 'verb', 'adj', 'adv', 'pron', 'det', 'article', 'num', 'prep', 'conj', 'intj', 'particle'}
SKIP_TAGS = {'auxiliary', 'table-tags', 'inflection-template', 'class', 'obsolete', 'archaic', 'abbreviation'}


def pass_dewikt(lemmas):
    """Записи-существительные наших лемм по порядку дампа и таблица «форма → (лемма, часть речи)»."""
    entries, forms = collections.defaultdict(list), collections.defaultdict(set)
    for r in srcs.jsonl(srcs.raw('dewikt.jsonl.gz')):
        w, pos, tags = r['word'], r.get('pos'), r.get('tags') or []
        if pos not in WORD_POS:
            if pos == 'name' and w in lemmas:
                pass
            else:
                continue
        if 'form-of' in tags:
            for s in r.get('senses', []):
                for fo in s.get('form_of') or []:
                    if fo.get('word'):
                        forms[w].add((fo['word'], pos))
            continue
        forms[w].add((w, pos))
        for f in r.get('forms', []):
            x = (f.get('form') or '').strip()
            # вспомогательный глагол в таблице спряжения — не форма самого глагола
            t = set(f.get('tags') or [])
            # у существительного «feminine»/«diminutive» — это другое слово (Ärztin, Bänkchen)
            if pos == 'noun' and t & {'feminine', 'masculine', 'neuter', 'diminutive', 'augmentative'}:
                continue
            if x and ' ' not in x and x not in srcs.ARTICLES and not t & SKIP_TAGS:
                forms[x].add((w, pos))
        # страны и моря у dewikt — имена собственные (pos name), но род у них есть
        if pos in ('noun', 'name') and w in lemmas:
            facts = srcs.noun_forms(r)
            facts['pos'] = pos
            facts['number'] = 'pl' if not facts['gender'] and facts['plural'] and not any(
                'singular' in (f.get('tags') or []) for f in r.get('forms', [])) else 'sg'
            tr = collections.defaultdict(lambda: collections.defaultdict(list))
            for t in r.get('translations', []):
                if t.get('lang_code') in ('ru', 'en') and t.get('word'):
                    lst = tr[t['lang_code']][t.get('sense_index') or '?']
                    for x in srcs.ru_items(t['word']) if t['lang_code'] == 'ru' else [t['word'].strip()]:
                        if x not in lst:
                            lst.append(x)
            facts['ru'] = {k: v for k, v in tr['ru'].items()}
            facts['en'] = {k: v for k, v in tr['en'].items()}
            facts['de_gloss'] = [g for s in r.get('senses', [])[:3] for g in (s.get('glosses') or [])[:1]]
            entries[w].append(facts)
    for w, es in entries.items():
        nouns = [e for e in es if e['pos'] == 'noun']
        entries[w] = nouns or es
    return entries, forms


def pass_other(path, lemmas, kind):
    out = collections.defaultdict(list)
    for r in srcs.jsonl(srcs.raw(path)):
        if r.get('pos') != 'noun' or r['word'] not in lemmas or 'form-of' in (r.get('tags') or []):
            continue
        facts = srcs.noun_forms(r)
        if kind == 'enwikt':
            facts['gender'] = srcs.enwikt_gender(r) or facts['gender']
            facts['en'] = [g for s in r.get('senses', [])[:3] for g in (s.get('glosses') or [])[:1]]
        else:
            facts['ru'] = [x for s in r.get('senses', [])[:3] for g in (s.get('glosses') or [])[:1]
                           for x in srcs.ru_items(g)]
        if facts['gender'] or facts['plural'] or facts.get('ru') or facts.get('en'):
            out[r['word']].append(facts)
    return out


def votes(field, value, lemma, other):
    return sum(any(value in e.get(field, []) for e in other[src].get(lemma, [])) for src in other)


def ordered(field, entry, lemma, other):
    """Значения поля из dewikt, самое подтверждённое первым; при равенстве — порядок dewikt."""
    xs = entry[field]
    return sorted(xs, key=lambda x: -votes(field, x, lemma, other))


def align(entry, cands):
    """Запись другого источника, которая описывает то же значение: род и множественное."""
    def score(c):
        return (len(set(c['gender']) & set(entry['gender'])) * 2
                + len(set(c['plural']) & set(entry['plural'])))
    best = max(cands, key=score, default=None)
    return best if best and (len(cands) == 1 or score(best) > 0) else None


def ru_sources(entry, lemma, ruw, fd):
    al = align(entry, ruw.get(lemma, []))
    pool = [x for v in entry['ru'].values() for x in v] + (al['ru'] if al else []) + fd.get(lemma, [])
    return pool, al


def ranked(cands, confirm):
    """Кандидаты без скобок, подтверждённые вторым источником — первыми."""
    xs = []
    for c in cands:
        for x in srcs.ru_items(c):
            if x not in xs:
                xs.append(x)
    ok = {srcs.norm(x) for c in confirm for x in srcs.ru_items(c)}
    return sorted(xs, key=lambda x: srcs.norm(x) not in ok)


def pick_ru(entry, lemma, v1ru, ruw, fd, own):
    if own:
        return ', '.join(ranked(entry['ru'].get('1') or next(iter(entry['ru'].values()), []), [])[:2]) or None
    pool, al = ru_sources(entry, lemma, ruw, fd)
    known = {srcs.norm(x) for x in pool}
    mine = srcs.ru_items(v1ru or '')
    if mine and all(srcs.norm(x) in known for x in mine):
        return ', '.join(mine)
    first = entry['ru'].get('1') or next(iter(entry['ru'].values()), [])
    xs = ranked(first, al['ru'] if al else []) or ranked(al['ru'] if al else [], []) or ranked(fd.get(lemma, []), [])
    return ', '.join(xs[:2]) or None


def pick_en(entry, lemma, enw, own):
    first = entry['en'].get('1') or next(iter(entry['en'].values()), [])
    if own:
        return ', '.join(ranked(first, [])[:2]) or None
    al = align(entry, enw.get(lemma, []))
    gl = al['en'] if al else []
    xs = ranked(first, gl) or ranked(gl[:1], [])
    return ', '.join(xs[:2]) or None


def match_v1(entries, lemma, v1ru, ruw, fd):
    """Какую запись имел в виду ручной отбор v1: по совпадению его перевода с переводами самой
    записи; выровненная запись ruwikt — только при равенстве (она не различает значения)."""
    mine = {srcs.norm(x) for x in srcs.ru_items(v1ru or '')}
    def score(e):
        own = {srcs.norm(x) for v in e['ru'].values() for x in v}
        al = align(e, ruw.get(lemma, []))
        return len(mine & own), len(mine & {srcs.norm(x) for x in (al['ru'] if al else [])})
    return max(range(len(entries)), key=lambda i: (score(entries[i]), -i))


def record(i, e, lemma, n_entries, seed_w, taught, other, ruw, enw, fd, rank):
    rid = f'n:{lemma}' + (f':{i + 1}' if i else '')
    # ruwikt, FreeDict и глоссы enwikt не говорят, какое из значений dewikt переводят:
    # они доказывают только изучаемую запись, у остальных — лишь таблица перевода самой записи
    own = n_entries > 1 and not taught
    ru = pick_ru(e, lemma, seed_w.get('ru') if taught else None, ruw, fd, own)
    rec = {'id': rid, 'lemma': lemma}
    if n_entries > 1 and ru:
        rec['sense'] = srcs.ru_items(ru)[0]
    rec['gender'] = ordered('gender', e, lemma, other)
    rec['plural'] = ordered('plural', e, lemma, other)
    rec['gen_sg'] = ordered('gen_sg', e, lemma, other)
    if e['number'] == 'pl':
        rec['number'] = 'pl'
    rec['ru'] = ru
    rec['en'] = pick_en(e, lemma, enw, own)
    rec['freq'] = srcs.bucket(rank)
    rec['level'] = seed_w.get('lv') if taught else None
    rec['themes'] = []
    rec['decided'] = {}
    rec['skip'] = {}
    return rec


def dump_words(records):
    by_letter = collections.defaultdict(list)
    for r in records:
        first = r['lemma'][0].lower().translate(str.maketrans('äöü', 'aou'))
        by_letter[first if first.isalpha() else '_'].append(r)
    d = os.path.join(ROOT, 'words', 'nouns')
    os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        os.remove(os.path.join(d, f))
    for letter, rs in sorted(by_letter.items()):
        rs.sort(key=lambda r: (r['lemma'].lower(), r['id']))
        with open(os.path.join(d, f'{letter}.yaml'), 'w', encoding='utf-8') as f:
            yaml.safe_dump(rs, f, allow_unicode=True, sort_keys=False, default_flow_style=None, width=200)


def main():
    S = seed()
    lemmas = set(S)
    print(f'лемм в отборе v1: {len(lemmas)}', flush=True)
    dew, forms = pass_dewikt(lemmas)
    print(f'dewikt: записей {sum(map(len, dew.values()))} у {len(dew)} лемм; форм {len(forms)}', flush=True)
    os.makedirs(srcs.WORK, exist_ok=True)
    with gzip.open(os.path.join(srcs.WORK, 'forms.json.gz'), 'wt', encoding='utf-8') as f:
        json.dump({k: sorted(v, key=str) for k, v in forms.items()}, f, ensure_ascii=False)
    enw = pass_other('kaikki-de.jsonl', lemmas, 'enwikt')
    print(f'enwikt: {len(enw)} лемм', flush=True)
    ruw = pass_other('kaikki-ru-de.jsonl', lemmas, 'ruwikt')
    print(f'ruwikt: {len(ruw)} лемм', flush=True)
    fd = srcs.freedict()
    lower = collections.defaultdict(set)
    for form, ls in forms.items():
        for lemma, _ in ls:
            lower[form.lower()].add(lemma.lower())
    ranks = srcs.freq_ranks(lower)
    with gzip.open(os.path.join(srcs.WORK, 'ranks.json.gz'), 'wt', encoding='utf-8') as f:
        json.dump(ranks, f, ensure_ascii=False)

    other = {'enwikt': enw, 'ruwikt': ruw}
    records, missing = [], []
    os.makedirs(os.path.join(ROOT, 'evidence'), exist_ok=True)
    ev = open(os.path.join(ROOT, 'evidence', 'nouns.jsonl'), 'w', encoding='utf-8')
    for lemma in sorted(lemmas, key=str.lower):
        es = dew.get(lemma, [])
        if not es:
            missing.append(lemma)
            continue
        taught = match_v1(es, lemma, S[lemma].get('ru'), ruw, fd)
        rank = ranks.get(lemma.lower())
        for i, e in enumerate(es):
            records.append(record(i, e, lemma, len(es), S[lemma], i == taught, other, ruw, enw, fd, rank))
        ev.write(json.dumps({'lemma': lemma,
                             'dewikt': [{k: e[k] for k in ('gender', 'plural', 'gen_sg', 'number', 'ru', 'en', 'de_gloss')} for e in es],
                             'enwikt': enw.get(lemma, []), 'ruwikt': ruw.get(lemma, []),
                             'freedict': fd.get(lemma, []), 'rank': rank}, ensure_ascii=False) + '\n')
    ev.close()
    dump_words(records)
    print(f'записей: {len(records)}; лемм без записи в dewikt: {len(missing)}')
    if missing:
        print('  ' + ', '.join(missing))


if __name__ == '__main__':
    main()
