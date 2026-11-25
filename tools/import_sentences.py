#!/usr/bin/env python3
"""Фразы Tatoeba для слов базы: отбор, перевод людей (ru, en), разметка spaCy.

Отбор: немецкая фраза с переводом хотя бы на один язык, 3–12 токенов; на каждую лемму базы —
до 20 самых простых (простота = худший ранг частотности среди слов фразы, потом длина).
Пишет sentences/tatoeba/<NNN>.jsonl (шард = id // 100 000) и sentences/todo/ — фразы,
которым не хватает перевода на один из языков (их переводит отдельная сессия).

  python3 -I tools/import_sentences.py            всё
  python3 -I tools/import_sentences.py --no-nlp   без разметки: только отбор (для замеров)
"""
import bz2, collections, glob, gzip, json, os, re, sys, tarfile

import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import srcs  # noqa: E402

ROOT = srcs.ROOT
PER_WORD = 20
MIN_TOK, MAX_TOK = 3, 12
UNKNOWN = 60000
TOKEN = re.compile(r"[A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)*")


def sentences(name):
    out = {}
    with bz2.open(srcs.raw(name), 'rt', encoding='utf-8') as f:
        for line in f:
            i, _, text = line.rstrip('\n').split('\t', 2)
            out[int(i)] = text
    return out


def links(de, ru, en):
    """Немецкая фраза → наименьший id прямого перевода на ru и на en."""
    best = {'ru': {}, 'en': {}}
    with tarfile.open(srcs.raw('links.tar.bz2'), 'r:bz2') as t:
        for m in t:
            f = t.extractfile(m)
            if not f:
                continue
            for line in f:
                a, b = map(int, line.split(b'\t')[:2])
                if a not in de:
                    continue
                for lang, pool in (('ru', ru), ('en', en)):
                    if b in pool and (a not in best[lang] or b < best[lang][a]):
                        best[lang][a] = b
    return best


def load_words():
    by_lemma = collections.defaultdict(list)
    for p in glob.glob(os.path.join(ROOT, 'words', '*', '*.yaml')):
        for w in yaml.safe_load(open(p, encoding='utf-8')) or []:
            by_lemma[(w['lemma'], w['id'].split(':')[0])].append(w)
    return by_lemma


UPOS = {'NOUN': 'n', 'PROPN': 'n', 'VERB': 'v', 'AUX': 'v', 'ADJ': 'a'}


def select(de, tr, forms, ranks, words):
    """Кандидаты по простой токенизации: какие леммы базы в них есть и насколько фраза проста."""
    lemma_pos = {lp for lp in words}
    per = collections.defaultdict(list)
    for sid, text in de.items():
        if sid not in tr['ru'] and sid not in tr['en']:
            continue
        toks = TOKEN.findall(text)
        if not MIN_TOK <= len(toks) <= MAX_TOK:
            continue
        hard, hits = 0, set()
        for t in toks:
            cands = forms.get(t) or forms.get(t.lower()) or forms.get(t.capitalize()) or []
            r = min((ranks.get(l.lower(), UNKNOWN) for l, _ in cands), default=UNKNOWN)
            hard = max(hard, r)
            for l, pos in cands:
                key = (l, {'noun': 'n', 'verb': 'v', 'adj': 'a'}.get(pos, ''))
                if key in lemma_pos:
                    hits.add(key)
        for key in hits:
            per[key].append((hard, len(toks), sid))
    chosen = set()
    for key, xs in per.items():
        chosen |= {sid for _, _, sid in sorted(xs)[:PER_WORD]}
    return chosen, per


GENDER = {'Masc': 'm', 'Fem': 'f', 'Neut': 'n'}


def link(cands, morph):
    """Запись слова для токена: одна запись курса, иначе та, чей род совпал с разметкой; нет — '?'."""
    if not cands:
        return None
    course = [w for w in cands if w.get('level')] or cands
    if len(course) > 1:
        g = GENDER.get((morph.get('Gender') or [''])[0])
        course = [w for w in course if g and g in w.get('gender', [])] or course
    return course[0]['id'] if len(course) == 1 else '?'


def annotate(de, ids, words):
    import spacy
    nlp = spacy.load('de_dep_news_trf')
    out = {}
    order = sorted(ids)
    for n, (sid, doc) in enumerate(zip(order, nlp.pipe((de[i] for i in order), batch_size=64))):
        toks = []
        for t in doc:
            if t.is_space:
                continue
            p = UPOS.get(t.pos_)
            ref = None
            if p:
                ref = link(words.get((t.lemma_, p)) or words.get((t.text, p)) or [], t.morph)
            toks.append([t.text, t.lemma_, t.pos_, str(t.morph), ref])
        out[sid] = toks
        if n % 2000 == 0:
            print(f'  разметка: {n}/{len(order)}', flush=True)
    return out


def main():
    nlp = '--no-nlp' not in sys.argv
    with gzip.open(os.path.join(srcs.WORK, 'forms.json.gz'), 'rt', encoding='utf-8') as f:
        forms = json.load(f)
    with gzip.open(os.path.join(srcs.WORK, 'ranks.json.gz'), 'rt', encoding='utf-8') as f:
        ranks = json.load(f)
    words = load_words()
    de, ru, en = sentences('deu_sentences.tsv.bz2'), sentences('rus_sentences.tsv.bz2'), sentences('eng_sentences.tsv.bz2')
    print(f'Tatoeba: de {len(de)}, ru {len(ru)}, en {len(en)}', flush=True)
    tr = links(de, ru, en)
    print(f'с переводом: ru {len(tr["ru"])}, en {len(tr["en"])}', flush=True)
    chosen, per = select(de, tr, forms, ranks, words)
    covered = sum(1 for k in words if per.get(k))
    print(f'отобрано фраз: {len(chosen)}; лемм базы с фразами: {covered} из {len(words)}', flush=True)
    if not nlp:
        return
    tok = annotate(de, chosen, words)
    out = collections.defaultdict(list)
    todo = []
    for sid in sorted(chosen):
        s = {'id': f't:{sid}', 'de': de[sid]}
        for lang, pool in (('ru', ru), ('en', en)):
            if sid in tr[lang]:
                s[lang], s[f'{lang}_by'] = pool[tr[lang][sid]], f'tatoeba:{tr[lang][sid]}'
        s['tok'] = tok[sid]
        out[f'{sid // 100000:03d}'].append(s)
        if 'ru' not in s or 'en' not in s:
            todo.append({k: s[k] for k in ('id', 'de', 'ru', 'en') if k in s})
    d = os.path.join(ROOT, 'sentences', 'tatoeba')
    os.makedirs(d, exist_ok=True)
    for p in glob.glob(os.path.join(d, '*.jsonl')):
        os.remove(p)
    for shard, xs in out.items():
        with open(os.path.join(d, f'{shard}.jsonl'), 'w', encoding='utf-8') as f:
            for s in xs:
                f.write(json.dumps(s, ensure_ascii=False, separators=(',', ':')) + '\n')
    t = os.path.join(ROOT, 'sentences', 'todo')
    os.makedirs(t, exist_ok=True)
    for p in glob.glob(os.path.join(t, '*.jsonl')):
        os.remove(p)
    for i in range(0, len(todo), 500):
        with open(os.path.join(t, f'{i // 500:03d}.jsonl'), 'w', encoding='utf-8') as f:
            for s in todo[i:i + 500]:
                f.write(json.dumps(s, ensure_ascii=False) + '\n')
    print(f'записано фраз: {len(chosen)}; без одного из переводов: {len(todo)}')


if __name__ == '__main__':
    main()
