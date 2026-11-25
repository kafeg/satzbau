#!/usr/bin/env python3
"""Качает источники в data/raw/ и пишет sources.lock (url, размер, sha256, лицензия).

  python3 -I tools/fetch.py              все источники; что уже на месте — только хэш
  python3 -I tools/fetch.py dewikt       только названные
  python3 -I tools/fetch.py --force …    перекачать
"""
import hashlib, json, os, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'raw')
LOCK = os.path.join(ROOT, 'sources.lock')
UA = 'satzbau-fetch/2 (+https://github.com/kafeg/satzbau)'

SOURCES = {
    'dewikt': dict(
        url='https://kaikki.org/dewiktionary/raw-wiktextract-data.jsonl.gz',
        file='dewikt.jsonl.gz', license='CC BY-SA',
        gives='немецкий Викисловарь: записи по значениям, род, формы, переводы'),
    'enwikt': dict(
        url='https://kaikki.org/dictionary/German/kaikki.org-dictionary-German.jsonl',
        file='kaikki-de.jsonl', license='CC BY-SA',
        gives='английский Викисловарь, немецкие слова: род, формы, английская глосса'),
    'ruwikt': dict(
        url='https://kaikki.org/ruwiktionary/%D0%9D%D0%B5%D0%BC%D0%B5%D1%86%D0%BA%D0%B8%D0%B9/'
            'kaikki.org-dictionary-%D0%9D%D0%B5%D0%BC%D0%B5%D1%86%D0%BA%D0%B8%D0%B9.jsonl',
        file='kaikki-ru-de.jsonl', license='CC BY-SA',
        gives='русский Викисловарь, немецкие слова: русский перевод'),
    'freedict': dict(
        url='https://download.freedict.org/dictionaries/deu-rus/2025.11.23/freedict-deu-rus-2025.11.23.src.tar.xz',
        file='freedict-deu-rus.src.tar.xz', license='CC BY-SA 3.0',
        gives='русские переводы'),
    'freq': dict(
        url='https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_full.txt',
        file='de_full.txt', license='CC BY-SA 4.0',
        gives='частотность словоформ по субтитрам'),
    'tatoeba_deu': dict(
        url='https://downloads.tatoeba.org/exports/per_language/deu/deu_sentences.tsv.bz2',
        file='deu_sentences.tsv.bz2', license='CC BY 2.0 FR', gives='немецкие предложения'),
    'tatoeba_rus': dict(
        url='https://downloads.tatoeba.org/exports/per_language/rus/rus_sentences.tsv.bz2',
        file='rus_sentences.tsv.bz2', license='CC BY 2.0 FR', gives='русские предложения'),
    'tatoeba_eng': dict(
        url='https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2',
        file='eng_sentences.tsv.bz2', license='CC BY 2.0 FR', gives='английские предложения'),
    'tatoeba_links': dict(
        url='https://downloads.tatoeba.org/exports/links.tar.bz2',
        file='links.tar.bz2', license='CC BY 2.0 FR', gives='связи переводов'),
}


def human(n):
    for u in ('Б', 'КиБ', 'МиБ', 'ГиБ'):
        if n < 1024 or u == 'ГиБ':
            return f'{n:.0f} {u}' if u == 'Б' else f'{n:.1f} {u}'
        n /= 1024


PARTS = 8
BIG = 100 << 20


def get_range(url, path, start, end):
    """Кусок [start, end] в свой файл, с докачкой с места обрыва."""
    want = end - start + 1
    while (have := os.path.getsize(path) if os.path.exists(path) else 0) < want:
        req = urllib.request.Request(url, headers={'User-Agent': UA, 'Range': f'bytes={start + have}-{end}'})
        with urllib.request.urlopen(req, timeout=120) as r, open(path, 'ab') as f:
            while chunk := r.read(1 << 20):
                f.write(chunk)


def fetch_parallel(name, url, dest, size):
    # kaikki отдаёт ~40 КБ/с на соединение: 300 МБ в одно соединение — два часа
    from concurrent.futures import ThreadPoolExecutor
    step = -(-size // PARTS)
    spans = [(i * step, min(size, (i + 1) * step) - 1) for i in range(PARTS)]
    paths = [f'{dest}.part{i}' for i in range(PARTS)]
    t0 = time.time()
    with ThreadPoolExecutor(PARTS) as ex:
        list(ex.map(lambda a: get_range(url, a[0], *a[1]), zip(paths, spans)))
    with open(dest + '.part', 'wb') as out:
        for p in paths:
            with open(p, 'rb') as f:
                while chunk := f.read(1 << 22):
                    out.write(chunk)
    if os.path.getsize(dest + '.part') != size:
        raise IOError(f'собрано {os.path.getsize(dest + ".part")} байт из {size}')
    os.replace(dest + '.part', dest)
    for p in paths:
        os.remove(p)
    print(f'{name}: {human(size)} за {time.time() - t0:.0f} c, {PARTS} соединений', flush=True)


def remote_size(url):
    req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        ok = r.headers.get('accept-ranges') == 'bytes'
        return int(r.headers.get('content-length') or 0) if ok else 0


def fetch(name, src, force=False):
    dest = os.path.join(RAW, src['file'])
    tmp = dest + '.part'
    if os.path.exists(dest) and not force:
        print(f'{name}: на месте ({human(os.path.getsize(dest))}), считаю хэш', flush=True)
    elif (size := remote_size(src['url'])) >= BIG:
        if force:
            for i in range(PARTS):
                if os.path.exists(f'{dest}.part{i}'):
                    os.remove(f'{dest}.part{i}')
        fetch_parallel(name, src['url'], dest, size)
    else:
        have = os.path.getsize(tmp) if os.path.exists(tmp) and not force else 0
        headers = {'User-Agent': UA}
        if have:
            headers['Range'] = f'bytes={have}-'
        t0 = time.time()
        with urllib.request.urlopen(urllib.request.Request(src['url'], headers=headers), timeout=120) as r:
            if have and r.status != 206:
                have = 0
            got = have
            with open(tmp, 'ab' if have else 'wb') as f:
                mark = got
                while chunk := r.read(1 << 20):
                    f.write(chunk)
                    got += len(chunk)
                    if got - mark >= (100 << 20):
                        mark = got
                        print(f'  {name}: {human(got)}', flush=True)
        os.replace(tmp, dest)
        print(f'{name}: {human(got)} за {time.time() - t0:.0f} c', flush=True)
    h = hashlib.sha256()
    with open(dest, 'rb') as f:
        while chunk := f.read(1 << 22):
            h.update(chunk)
    return dict(url=src['url'], file=src['file'], license=src['license'], gives=src['gives'],
                size=os.path.getsize(dest), sha256=h.hexdigest(),
                fetched=time.strftime('%Y-%m-%d', time.gmtime(os.path.getmtime(dest))))


def write_lock(name, entry):
    # пишем после каждого источника и перечитываем: прогон могут прервать на середине
    lock = json.load(open(LOCK, encoding='utf-8')) if os.path.exists(LOCK) else {}
    lock[name] = entry
    with open(LOCK + '.tmp', 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(lock.items())), f, ensure_ascii=False, indent=1)
        f.write('\n')
    os.replace(LOCK + '.tmp', LOCK)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    force = '--force' in sys.argv
    bad = [a for a in args if a not in SOURCES]
    if bad:
        sys.exit(f'нет такого источника: {bad}; есть: {list(SOURCES)}')
    os.makedirs(RAW, exist_ok=True)
    failed = []
    for name in args or SOURCES:
        try:
            write_lock(name, fetch(name, SOURCES[name], force))
        except Exception as e:
            failed.append(name)
            print(f'{name}: ОШИБКА {e.__class__.__name__}: {e}', file=sys.stderr, flush=True)
    if failed:
        sys.exit(f'не скачались: {failed}')


if __name__ == '__main__':
    main()
