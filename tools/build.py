#!/usr/bin/env python3
"""База приложения build/satzbau.sqlite из words/, themes/ и sentences/. Пересобирается целиком.

  python3 -I tools/build.py

Нужен только PyYAML: источники из data/raw не читаются, поэтому скрипт работает и в CI.
"""
import glob, gzip, json, os, shutil, sqlite3, subprocess, sys

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'build', 'satzbau.sqlite')
POS = {'nouns': 'noun'}
LISTS = ('gender', 'plural', 'gen_sg')

SCHEMA = '''
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE words (
  id TEXT PRIMARY KEY, pos TEXT NOT NULL, lemma TEXT NOT NULL, sense TEXT, compound TEXT,
  gender TEXT, plural TEXT, gen_sg TEXT, number TEXT,
  ru TEXT, ru_llm INTEGER NOT NULL, en TEXT, en_llm INTEGER NOT NULL,
  freq INTEGER, level TEXT, skip TEXT NOT NULL);
CREATE TABLE sentences (n INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE, de TEXT NOT NULL,
  ru TEXT, ru_by TEXT, en TEXT, en_by TEXT, len INTEGER NOT NULL);
CREATE TABLE morphs (n INTEGER PRIMARY KEY, upos TEXT NOT NULL, morph TEXT NOT NULL, UNIQUE (upos, morph));
-- lemma — NULL, если совпадает с текстом токена
CREATE TABLE tokens (sentence INTEGER NOT NULL, i INTEGER NOT NULL, text TEXT NOT NULL, lemma TEXT,
  morph INTEGER NOT NULL, word_id TEXT, PRIMARY KEY (sentence, i)) WITHOUT ROWID;
CREATE INDEX tokens_word ON tokens (word_id) WHERE word_id IS NOT NULL;
CREATE TABLE themes (id TEXT PRIMARY KEY, title TEXT NOT NULL, n INTEGER NOT NULL);
CREATE TABLE theme_words (theme TEXT NOT NULL, i INTEGER NOT NULL, word_id TEXT NOT NULL, PRIMARY KEY (theme, i));
CREATE INDEX theme_words_word ON theme_words (word_id);
'''


def git(*args):
    return subprocess.run(['git', '-C', ROOT, *args], capture_output=True, text=True, check=True).stdout.strip()


NAMES = {'dewikt': 'немецкий Викисловарь', 'enwikt': 'английский Викисловарь', 'ruwikt': 'русский Викисловарь',
         'freedict': 'FreeDict', 'freq': 'FrequencyWords', 'tatoeba': 'Tatoeba'}


def attribution():
    """«немецкий Викисловарь, … (CC BY-SA); Tatoeba (CC BY 2.0 FR)» — по sources.lock."""
    lock = json.load(open(os.path.join(ROOT, 'sources.lock'), encoding='utf-8'))
    by = {}
    for k, v in lock.items():
        name = NAMES[k.split('_')[0]]
        if name not in by.setdefault(v['license'], []):
            by[v['license']].append(name)
    return '; '.join(f'{", ".join(ns)} ({lic})' for lic, ns in by.items())


def words():
    for d, pos in POS.items():
        for p in sorted(glob.glob(os.path.join(ROOT, 'words', d, '*.yaml'))):
            for w in yaml.safe_load(open(p, encoding='utf-8')) or []:
                yield pos, w


def sentences():
    for p in sorted(glob.glob(os.path.join(ROOT, 'sentences', 'tatoeba', '*.jsonl'))):
        for line in open(p, encoding='utf-8'):
            yield json.loads(line)


def llm(w, lang):
    return int(str(w.get('decided', {}).get(lang, '')).startswith('llm:'))


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    tmp = OUT + '.tmp'
    if os.path.exists(tmp):
        os.remove(tmp)
    db = sqlite3.connect(tmp)
    db.executescript(SCHEMA)
    tag, n, _ = git('describe', '--tags', '--match', 'v[0-9]*.[0-9]*', '--long').split('-')
    version = f'{tag[1:]}.{n}'
    db.executemany('INSERT INTO meta VALUES (?, ?)', [
        ('version', version), ('built', git('log', '-1', '--format=%cI')),
        ('license', 'CC BY-SA 4.0'), ('attribution', attribution())])
    ids = set()
    for pos, w in words():
        ids.add(w['id'])
        db.execute('INSERT INTO words VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', (
            w['id'], pos, w['lemma'], w.get('sense'), w.get('compound'),
            *(json.dumps(w.get(k, []), ensure_ascii=False) for k in LISTS), w.get('number', 'sg'),
            w['ru'], llm(w, 'ru'), w['en'], llm(w, 'en'), w['freq'], w['level'],
            json.dumps(w.get('skip', {}), ensure_ascii=False)))
    for p in sorted(glob.glob(os.path.join(ROOT, 'themes', '*.yaml'))):
        t = yaml.safe_load(open(p, encoding='utf-8'))
        db.execute('INSERT INTO themes VALUES (?,?,?)', (t['id'], t['title'], t['order']))
        for i, ref in enumerate(t['words']):
            if ref not in ids:
                sys.exit(f'тема {t["id"]}: {ref}, такого слова нет (сначала verify.py)')
            db.execute('INSERT INTO theme_words VALUES (?,?,?)', (t['id'], i, ref))
    n, morphs = 0, {}
    for s in sentences():
        n += 1
        db.execute('INSERT INTO sentences VALUES (?,?,?,?,?,?,?,?)', (
            n, s['id'], s['de'], s.get('ru'), s.get('ru_by'), s.get('en'), s.get('en_by'), len(s['tok'])))
        for i, (text, lemma, upos, morph, ref) in enumerate(s['tok']):
            if ref not in (None, '?') and ref not in ids:
                sys.exit(f'{s["id"]}: токен {text} → {ref}, такого слова нет (сначала verify.py)')
            m = morphs.setdefault((upos, morph), len(morphs) + 1)
            db.execute('INSERT INTO tokens VALUES (?,?,?,?,?,?)',
                       (n, i, text, None if lemma == text else lemma, m, ref if ref != '?' else None))
    db.executemany('INSERT INTO morphs VALUES (?,?,?)', [(m, u, x) for (u, x), m in morphs.items()])
    db.commit()
    db.execute('VACUUM')
    db.close()
    os.replace(tmp, OUT)
    # приложение качает сжатую копию и распаковывает её DecompressionStream
    with open(OUT, 'rb') as f, open(OUT + '.gz', 'wb') as raw, \
            gzip.GzipFile(fileobj=raw, mode='wb', compresslevel=9, mtime=0) as g:
        shutil.copyfileobj(f, g)
    print(f'{os.path.relpath(OUT, ROOT)}: {version}, слов {len(ids)}, фраз {n}, '
          f'{os.path.getsize(OUT) / 1e6:.1f} МБ, сжатая {os.path.getsize(OUT + ".gz") / 1e6:.1f} МБ')


if __name__ == '__main__':
    main()
