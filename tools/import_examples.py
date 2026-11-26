#!/usr/bin/env python3
"""Примеры для слов курса, у которых нет ни одной фразы Tatoeba (docs/data-model.md, «Фраза»).

  python3 -I tools/import_examples.py todo   задание для LLM-сессии: sentences/todo/examples.jsonl
  python3 -I tools/import_examples.py        разметка готового: sentences/wikt/, sentences/gen/

Источники по порядку:
1. Примеры немецкого Викисловаря из записи этого же значения (без цитат из книг — у них есть `ref`).
   Их русский перевод делает LLM: sentences/llm/*.jsonl, строки {id, ru, ru_by}.
2. Нет и там — фразы пишет LLM: sentences/llm/generated.jsonl, строки
   {id, word, de, form, ru, ru_by, de_by}; form — как слово стоит во фразе.
Токен слова привязывается к записи прямо: значение известно по источнику. Остальные — как у Tatoeba.
"""
import collections, glob, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import srcs  # noqa: E402
from import_sentences import UPOS, candidates, link, load_words  # noqa: E402

ROOT = srcs.ROOT
PER_WORD = 3
MIN_W, MAX_W = 3, 12
# кавычки и скобки в примере — цитата или пометка источника («(Internetbeleg)»): не берём
QUOTED = re.compile(r'[„“”"«»()\[\]]')


def course_words():
    words = load_words()
    return words, {w['id']: w for xs in words.values() for w in xs if w.get('level')}


def linked():
    out = set()
    for p in glob.glob(os.path.join(ROOT, 'sentences', 'tatoeba', '*.jsonl')):
        for line in open(p, encoding='utf-8'):
            out |= {t[4] for t in json.loads(line)['tok'] if t[4]}
    return out


def wikt_examples(lemmas):
    """Лемма → по записям dewikt (в порядке дампа, как у импорта слов) → (примеры, переводы):
    примеры — {номер значения: [(текст, (начало, конец))]}, переводы — {номер значения: [ru]}."""
    out = collections.defaultdict(list)
    for r in srcs.jsonl(srcs.raw('dewikt.jsonl.gz')):
        w, pos, tags = r['word'], r.get('pos'), r.get('tags') or []
        if w not in lemmas or 'form-of' in tags:
            continue
        if pos == 'abbrev' and 'noun' in tags:
            pos = 'noun'
        if pos not in ('noun', 'name'):
            continue
        xs, ru = collections.defaultdict(list), collections.defaultdict(list)
        for s in r.get('senses', []):
            for e in s.get('examples', []):
                t, b = e.get('text', ''), e.get('bold_text_offsets') or []
                if t and not e.get('ref') and not QUOTED.search(t) and b and MIN_W <= len(t.split()) <= MAX_W:
                    xs[s.get('sense_index', '')].append((t, tuple(b[0])))
        for t in r.get('translations', []):
            if t.get('lang_code') == 'ru' and t.get('word'):
                ru[t.get('sense_index', '')] += srcs.ru_items(t['word'])
        out[w].append((xs, ru, len(r.get('senses', []))))
    return out


def own_examples(w, es):
    """Примеры значения, чей русский перевод совпал с переводом записи; без переводов в dewikt —
    только если значение у записи одно. Иначе фраза показала бы слово в другом значении, чем перевод
    на карточке (Kühler: «радиатор» и «ведёрко для шампанского» — одна запись dewikt)."""
    if entry_of(w['id']) >= len(es):
        return []
    xs, ru, n = es[entry_of(w['id'])]
    mine = set(srcs.ru_items(w.get('ru') or ''))
    senses = [i for i, tr in ru.items() if mine & set(tr)] if ru else (['1'] if n == 1 else [])
    return [x for i in senses for x in xs.get(i, [])][:PER_WORD]


def entry_of(wid):
    parts = wid.split(':')
    return int(parts[2]) - 1 if len(parts) > 2 else 0


def tasks(course):
    """Слова курса без фраз Tatoeba → что сделать: перевести примеры Викисловаря или написать фразы."""
    have = linked()
    miss = {i: w for i, w in course.items() if i not in have}
    ex = wikt_examples({w['lemma'] for w in miss.values()})
    out = []
    for i, w in sorted(miss.items()):
        own = own_examples(w, ex.get(w['lemma'], []))
        task = {'word': i, 'lemma': w['lemma'], 'gender': w['gender'], 'plural': w['plural'],
                'ru': w['ru'], 'level': w['level']}
        if own:
            task['translate'] = [{'id': f'w:{i}:{k + 1}', 'de': t} for k, (t, _) in enumerate(own)]
        else:
            task['generate'] = [f'g:{i}:1'] + ([f'g:{i}:2'] if w['plural'] and w.get('number', 'sg') == 'sg' else [])
        out.append(task)
    return out


def todo():
    _, course = course_words()
    tasks_ = tasks(course)
    d = os.path.join(ROOT, 'sentences', 'todo')
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, 'examples.jsonl'), 'w', encoding='utf-8') as f:
        for t in tasks_:
            f.write(json.dumps(t, ensure_ascii=False) + '\n')
    n = sum('translate' in t for t in tasks_)
    print(f'слов без фраз: {len(tasks_)}; с примером Викисловаря: {n}; писать фразы: {len(tasks_) - n}')


def llm_rows():
    out = {}
    for p in glob.glob(os.path.join(ROOT, 'sentences', 'llm', '*.jsonl')):
        for line in open(p, encoding='utf-8'):
            x = json.loads(line)
            if x['id'][:2] in ('w:', 'g:'):
                out[x['id']] = x
    return out


def annotate(items, words, forms):
    """items: (id, de, word id, (начало, конец) слова) → строки фраз с токенами, как у Tatoeba."""
    import spacy
    nlp = spacy.load('de_dep_news_trf')
    out = []
    for (sid, de, wid, (a, b), extra), doc in zip(items, nlp.pipe(x[1] for x in items)):
        toks, hit = [], False
        for t in doc:
            if t.is_space:
                continue
            p = UPOS.get(t.pos_)
            if a <= t.idx < b:
                ref, hit = wid, True
            else:
                # перевод здесь от LLM, а привязка верит только переводу людей — его нет
                ref = link(candidates(t.text, t.lemma_, p, words, forms), t.text, t.morph, {}) if p else None
            toks.append([t.text, t.lemma_, t.pos_, str(t.morph), ref])
        if not hit:
            print(f'  пропуск {sid}: слово не найдено во фразе «{de}»')
            continue
        out.append({'id': sid, 'de': de, **extra, 'tok': toks})
    return out


def write(name, rows):
    d = os.path.join(ROOT, 'sentences', name)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, '000.jsonl'), 'w', encoding='utf-8') as f:
        for s in sorted(rows, key=lambda s: s['id']):
            f.write(json.dumps(s, ensure_ascii=False, separators=(',', ':')) + '\n')


def main():
    if sys.argv[1:] == ['todo']:
        return todo()
    import gzip
    with gzip.open(os.path.join(srcs.WORK, 'forms.json.gz'), 'rt', encoding='utf-8') as f:
        forms = json.load(f)
    words, course = course_words()
    llm = llm_rows()
    todo_ = tasks(course)
    ex = wikt_examples({t['lemma'] for t in todo_ if 'translate' in t})
    wikt, gen = [], []
    for t in todo_:
        for x in t.get('translate', []):
            k = int(x['id'].rsplit(':', 1)[1]) - 1
            text, span = own_examples(course[t['word']], ex[t['lemma']])[k]
            tr = llm.get(x['id'])
            if text != x['de'] or not tr:
                print(f'  пропуск {x["id"]}: нет перевода или текст изменился')
                continue
            wikt.append((x['id'], text, t['word'], span, {'de_by': 'dewikt', 'ru': tr['ru'], 'ru_by': tr['ru_by']}))
        for sid in t.get('generate', []):
            g = llm.get(sid)
            if not g:
                print(f'  пропуск {sid}: фразы нет')
                continue
            a = g['de'].find(g['form'])
            if a < 0:
                print(f'  пропуск {sid}: формы «{g["form"]}» нет во фразе')
                continue
            gen.append((sid, g['de'], t['word'], (a, a + len(g['form'])),
                        {'de_by': g['de_by'], 'ru': g['ru'], 'ru_by': g['ru_by']}))
    write('wikt', annotate(wikt, words, forms))
    write('gen', annotate(gen, words, forms))
    print(f'Викисловарь: {len(wikt)}; написано LLM: {len(gen)}')


if __name__ == '__main__':
    main()
