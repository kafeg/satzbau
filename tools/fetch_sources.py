#!/usr/bin/env python3
"""Скачивает источники данных в data/raw/ и пишет content/build/sources.lock.

Зачем отдельный шаг: дампы перегенерируются (kaikki — еженедельно), и схема полей
между версиями меняется. Лок фиксирует дату, размер и SHA-256 того, на чём собрано.

  python3 tools/fetch_sources.py            лёгкие источники (~210 МБ)
  python3 tools/fetch_sources.py --all      вместе с kaikki (+2 ГБ)
  python3 tools/fetch_sources.py kaikki_de  только названные
  python3 tools/fetch_sources.py --force …  перекачать, даже если файл на месте
"""
import hashlib, json, os, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'raw')
LOCK = os.path.join(ROOT, 'content', 'build', 'sources.lock')
UA = 'satzbau-fetch/1 (+https://github.com/kafeg/satzbau)'

# big=True — не качается без --all
SOURCES = {
    'nouns_csv': dict(
        url='https://raw.githubusercontent.com/gambolputty/german-nouns/main/german_nouns/nouns.csv',
        file='nouns.csv', license='CC BY-SA 4.0',
        gives='род и 4 падежа в двух числах, 102 тыс. существительных'),
    'unimorph_deu': dict(
        url='https://raw.githubusercontent.com/unimorph/deu/master/deu',
        file='unimorph-deu.tsv', license='CC BY-SA 3.0',
        gives='словоформы; нужен для фильтра предложений'),
    'freq_de50k': dict(
        url='https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt',
        file='de_50k.txt', license='CC BY-SA 4.0',
        gives='частотность по субтитрам; задаёт порядок внутри темы'),
    'freedict_deu_rus': dict(
        url='https://download.freedict.org/dictionaries/deu-rus/2025.11.23/freedict-deu-rus-2025.11.23.src.tar.xz',
        file='freedict-deu-rus.src.tar.xz', license='CC BY-SA 3.0',
        gives='короткие русские переводы, подстраховка к Викисловарю'),
    'tatoeba_deu': dict(
        url='https://downloads.tatoeba.org/exports/per_language/deu/deu_sentences.tsv.bz2',
        file='deu_sentences.tsv.bz2', license='CC BY 2.0 FR',
        gives='немецкие предложения'),
    'tatoeba_rus': dict(
        url='https://downloads.tatoeba.org/exports/per_language/rus/rus_sentences.tsv.bz2',
        file='rus_sentences.tsv.bz2', license='CC BY 2.0 FR',
        gives='русские предложения'),
    'tatoeba_links': dict(
        url='https://downloads.tatoeba.org/exports/links.tar.bz2',
        file='links.tar.bz2', license='CC BY 2.0 FR',
        gives='связки переводов между предложениями'),
    'kaikki_de': dict(
        url='https://kaikki.org/dictionary/German/kaikki.org-dictionary-German.jsonl',
        file='kaikki-de.jsonl', license='CC BY-SA', big=True,
        gives='род, падежи, спряжение, aux, Partizip II, управление в raw_glosses'),
    'kaikki_ru_de': dict(
        url='https://kaikki.org/ruwiktionary/%D0%9D%D0%B5%D0%BC%D0%B5%D1%86%D0%BA%D0%B8%D0%B9/'
            'kaikki.org-dictionary-%D0%9D%D0%B5%D0%BC%D0%B5%D1%86%D0%BA%D0%B8%D0%B9.jsonl',
        file='kaikki-ru-de.jsonl', license='CC BY-SA', big=True,
        gives='русские толкования, часто с управлением'),
}


def human(n):
    for u in ('Б', 'КиБ', 'МиБ', 'ГиБ'):
        if n < 1024 or u == 'ГиБ':
            return f'{n:.0f} {u}' if u == 'Б' else f'{n:.1f} {u}'
        n /= 1024


def fetch(name, src, force=False):
    dest = os.path.join(RAW, src['file'])
    if os.path.exists(dest) and not force:
        print(f'{name}: уже на месте ({human(os.path.getsize(dest))}), считаю хэш')
    else:
        req = urllib.request.Request(src['url'], headers={'User-Agent': UA})
        t0 = time.time()
        with urllib.request.urlopen(req, timeout=120) as r:
            total = int(r.headers.get('content-length') or 0)
            tmp = dest + '.part'
            got = 0
            with open(tmp, 'wb') as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
                    got += len(chunk)
                    if total and got % (50 << 20) < (1 << 20):
                        print(f'  {name}: {human(got)} / {human(total)}', flush=True)
            os.replace(tmp, dest)
        print(f'{name}: {human(got)} за {time.time()-t0:.0f} c')
    h = hashlib.sha256()
    with open(dest, 'rb') as f:
        while chunk := f.read(1 << 22):
            h.update(chunk)
    return dict(url=src['url'], file=src['file'], license=src['license'],
                gives=src['gives'], size=os.path.getsize(dest),
                sha256=h.hexdigest(), fetched=time.strftime('%Y-%m-%d'))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = {a for a in sys.argv[1:] if a.startswith('--')}
    os.makedirs(RAW, exist_ok=True)
    os.makedirs(os.path.dirname(LOCK), exist_ok=True)
    lock = json.load(open(LOCK, encoding='utf-8')) if os.path.exists(LOCK) else {}
    want = args or [k for k, v in SOURCES.items() if '--all' in flags or not v.get('big')]
    bad = [w for w in want if w not in SOURCES]
    if bad:
        sys.exit(f'нет такого источника: {bad}; есть: {list(SOURCES)}')
    for name in want:
        try:
            lock[name] = fetch(name, SOURCES[name], '--force' in flags)
        except Exception as e:
            print(f'{name}: ОШИБКА {e.__class__.__name__}: {e}', file=sys.stderr)
    json.dump(dict(sorted(lock.items())), open(LOCK, 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    open(LOCK, 'a', encoding='utf-8').write('\n')
    print(f'\nлок: {LOCK}')
    print(f'всего на диске: {human(sum(v["size"] for v in lock.values()))} в {RAW}')


if __name__ == '__main__':
    main()
