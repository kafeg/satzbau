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
    """Качает, если нужно, и возвращает запись для лока. Докачивает с обрыва."""
    dest = os.path.join(RAW, src['file'])
    tmp = dest + '.part'
    if os.path.exists(dest) and not force:
        print(f'{name}: уже на месте ({human(os.path.getsize(dest))}), считаю хэш')
    else:
        # Докачка: у источников размером в гигабайт обрыв неизбежен, а скорость
        # бывает 200 КБ/с. Если сервер не умеет Range — качаем заново.
        have = os.path.getsize(tmp) if os.path.exists(tmp) and not force else 0
        headers = {'User-Agent': UA}
        if have:
            headers['Range'] = f'bytes={have}-'
        req = urllib.request.Request(src['url'], headers=headers)
        t0 = time.time()
        with urllib.request.urlopen(req, timeout=120) as r:
            resumed = r.status == 206
            if have and not resumed:
                print(f'  {name}: сервер не умеет докачку, качаю заново')
                have = 0
            total = int(r.headers.get('content-length') or 0) + have
            got = have
            if have:
                print(f'  {name}: докачиваю с {human(have)}', flush=True)
            with open(tmp, 'ab' if have else 'wb') as f:
                mark = got
                while chunk := r.read(1 << 20):
                    f.write(chunk)
                    got += len(chunk)
                    if got - mark >= (50 << 20):
                        mark = got
                        print(f'  {name}: {human(got)}'
                              + (f' / {human(total)}' if total else ''), flush=True)
            os.replace(tmp, dest)
        print(f'{name}: {human(got)} за {time.time()-t0:.0f} c', flush=True)
    h = hashlib.sha256()
    with open(dest, 'rb') as f:
        while chunk := f.read(1 << 22):
            h.update(chunk)
    return dict(url=src['url'], file=src['file'], license=src['license'],
                gives=src['gives'], size=os.path.getsize(dest),
                sha256=h.hexdigest(), fetched=time.strftime('%Y-%m-%d'))


def write_lock(entry_name, entry):
    """Пишет лок сразу после каждого источника, перечитав его перед записью.

    Два правила, оба выучены на ошибках: писать по одному — потому что прогон
    могут прервать (у меня его убил SIGPIPE от `| head`), и тогда записи о скачанном
    не остаётся вовсе; перечитывать перед записью — потому что два прогона рядом
    (лёгкий набор и kaikki) иначе затирают записи друг друга.
    """
    os.makedirs(os.path.dirname(LOCK), exist_ok=True)
    lock = {}
    if os.path.exists(LOCK):
        try:
            lock = json.load(open(LOCK, encoding='utf-8'))
        except ValueError:
            pass
    lock[entry_name] = entry
    tmp = LOCK + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(lock.items())), f, ensure_ascii=False, indent=1)
        f.write('\n')
    os.replace(tmp, LOCK)
    return lock


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = {a for a in sys.argv[1:] if a.startswith('--')}
    os.makedirs(RAW, exist_ok=True)
    want = args or [k for k, v in SOURCES.items() if '--all' in flags or not v.get('big')]
    bad = [w for w in want if w not in SOURCES]
    if bad:
        sys.exit(f'нет такого источника: {bad}; есть: {list(SOURCES)}')
    lock = {}
    for name in want:
        try:
            lock = write_lock(name, fetch(name, SOURCES[name], '--force' in flags))
        except Exception as e:
            print(f'{name}: ОШИБКА {e.__class__.__name__}: {e}', file=sys.stderr, flush=True)
    print(f'\nлок: {LOCK}')
    if lock:
        print(f'всего на диске: {human(sum(v["size"] for v in lock.values()))} в {RAW}')


if __name__ == '__main__':
    main()
