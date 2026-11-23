"""Чтение источников. Здесь живёт знание о том, как устроены их форматы.

Главное, что выяснилось про nouns.csv (79 колонок): данные раскладываются по группам,
и чтение одной колонки `genus` теряет пятую часть слов молча.

  genus / <падеж> <число>              одна схема словоизменения
  genus 1..4 / <падеж> <число> 1..4    несколько схем: Streik → Streiks и Streike
  <падеж> <число>*                     вариант внутри схемы: Zug → Zuges и Zugs
  <падеж> <число> stark|schwach|gemischt   существительные, склоняемые как прилагательные
  несколько строк на лемму             омонимы, различаются колонкой pos (Zug / Zug,Toponym)
"""
import collections, csv, os, re

CASES = ('nominativ', 'genitiv', 'dativ', 'akkusativ')


def _pick(row, base):
    """Форма по базовому имени колонки: сначала точная, потом нумерованная, потом склонения."""
    for key in (base, f'{base} 1', f'{base} stark', f'{base} gemischt', f'{base} schwach'):
        v = row.get(key)
        if v:
            return v
    return ''


def _variants(row, base):
    """Все различные формы для этой клетки: нумерованные схемы плюс звёздочка."""
    out = []
    for key in (base, f'{base}*', f'{base} 1', f'{base} 2', f'{base} 3', f'{base} 4',
                f'{base} stark', f'{base} gemischt', f'{base} schwach'):
        v = row.get(key)
        if v and v not in out:
            out.append(v)
    return out


def read_nouns_csv(path):
    """lemma -> dict(g, g_alt, pl, gen, dpl, akk, pl_only, adj_decl, homonym)

    Формы берутся из ОДНОЙ выбранной строки, а род собирается по ВСЕМ строкам леммы:
    у омонимов на каждое значение своя строка (das Schild — табличка, der Schild — щит),
    и выбор одной строки прячет второй род. Такие слова попадают в g_alt с homonym=True,
    и решение «какое значение нам нужно» принимается руками в fixes.yaml.
    """
    best, all_g = {}, collections.defaultdict(list)
    with open(path, encoding='utf-8') as f:
        for row in csv.DictReader(f):
            lemma, pos = row['lemma'], row.get('pos') or ''
            if 'Substantiv' not in pos:
                continue
            for g in [row.get('genus')] + [row.get(f'genus {i}') for i in range(1, 5)]:
                if g and g not in all_g[lemma]:
                    all_g[lemma].append(g)
            # Порядок предпочтения строк, по убыванию важности:
            #  1. pos ровно Substantiv — «Zug,Toponym» это другой Zug;
            #  2. род указан прямо в `genus`, а не только в `genus 1..4`. У Bus четыре
            #     строки, и самая заполненная даёт genus 1=f — то есть «die Bus».
            #     Прямой `genus` надёжнее числа заполненных колонок;
            #  3. при равенстве — где заполнено больше клеток.
            rank = (0 if pos.strip() == 'Substantiv' else 1,
                    0 if row.get('genus') else 1,
                    -sum(1 for v in row.values() if v))
            if lemma in best and best[lemma][0] <= rank:
                continue
            best[lemma] = (rank, row)

    out = {}
    for lemma, (_, row) in best.items():
        genders = [row.get('genus')] + [row.get(f'genus {i}') for i in range(1, 5)]
        genders = [g for g in genders if g]
        uniq = list(dict.fromkeys(genders))
        has_sg = any(_pick(row, f'{c} singular') for c in CASES)
        adj_decl = any(row.get(f'{c} singular stark') for c in CASES)
        across = [g for g in all_g[lemma] if g not in uniq]
        out[lemma] = dict(
            g=uniq[0] if uniq else (all_g[lemma][0] if all_g[lemma] else ''),
            g_alt=uniq[1:] + across,              # Taxi n/m в одной строке; Schild — в разных
            homonym=bool(across),                 # род встретился в другой строке леммы
            pl=_pick(row, 'nominativ plural'),
            gen=_pick(row, 'genitiv singular'),
            dpl=_pick(row, 'dativ plural'),
            akk=_pick(row, 'akkusativ singular'),
            pl_variants=_variants(row, 'nominativ plural'),
            pl_only=not has_sg and bool(_pick(row, 'nominativ plural')),
            adj_decl=adj_decl,
        )
    return out


def read_freq(path):
    """lemma.lower() -> ранг в топ-50k (1 = самое частое)"""
    out = {}
    for i, line in enumerate(open(path, encoding='utf-8'), 1):
        out.setdefault(line.split(' ', 1)[0].lower(), i)
    return out


def read_freedict_tei(path):
    """lemma -> [русские переводы]; .tei читается прямо из tar.xz"""
    import tarfile
    tei = None
    with tarfile.open(path, 'r:xz') as t:
        for m in t.getmembers():
            if m.name.endswith('.tei'):
                tei = t.extractfile(m).read().decode('utf-8')
                break
    out = collections.defaultdict(list)
    if not tei:
        return out
    for m in re.finditer(r'<entry.*?</entry>', tei, re.S):
        e = m.group(0)
        o = re.search(r'<orth>([^<]+)</orth>', e)
        if o:
            for q in re.findall(r'<quote>([^<]+)</quote>', e):
                if q not in out[o.group(1)]:
                    out[o.group(1)].append(q)
    return out


def scan_jsonl(path, lemmas, poses=None):
    """Один проход по большому jsonl: только нужные леммы. (word, pos) -> [записи]"""
    import json
    want = set(lemmas)
    out = collections.defaultdict(list)
    with open(path, encoding='utf-8') as f:
        for line in f:
            i = line.find('"word":')
            if i < 0:
                continue
            j = line.find('"', i + 7)
            k = line.find('"', j + 1)
            if line[j + 1:k] not in want:
                continue
            d = json.loads(line)
            if poses and d.get('pos') not in poses:
                continue
            out[(d['word'], d.get('pos'))].append(d)
    return out
