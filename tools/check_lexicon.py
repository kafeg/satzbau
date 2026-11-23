#!/usr/bin/env python3
"""Проверяет, что слова из content/manual/themes.yaml есть в источниках.

Отвечает на вопрос «не выбросит ли сборка часть лексикона молча».

  .venv/bin/python tools/check_lexicon.py            сводка
  .venv/bin/python tools/check_lexicon.py --missing   только проблемные слова
"""
import collections, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import srclib, yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'raw')
POS_NAME = {'n': 'сущ.', 'v': 'глаг.', 'a': 'прил.'}
KPOS = {'n': 'noun', 'v': 'verb', 'a': 'adj'}


def p(f):
    q = os.path.join(RAW, f)
    return q if os.path.exists(q) else None


def main():
    only_missing = '--missing' in sys.argv
    words = []
    for theme, v in yaml.safe_load(
            open(os.path.join(ROOT, 'content', 'manual', 'themes.yaml'), encoding='utf-8')).items():
        for w in v['words']:
            words.append(dict(w, theme=theme))
    fixes = yaml.safe_load(open(os.path.join(ROOT, 'content', 'manual', 'fixes.yaml'),
                                encoding='utf-8'))
    lemmas = {w['w'] for w in words}

    GN = srclib.read_nouns_csv(p('nouns.csv')) if p('nouns.csv') else None
    FQ = srclib.read_freq(p('de_50k.txt')) if p('de_50k.txt') else None
    FD = (srclib.read_freedict_tei(p('freedict-deu-rus.src.tar.xz'))
          if p('freedict-deu-rus.src.tar.xz') else None)
    K = srclib.scan_jsonl(p('kaikki-de.jsonl'), lemmas) if p('kaikki-de.jsonl') else None
    KR = srclib.scan_jsonl(p('kaikki-ru-de.jsonl'), lemmas) if p('kaikki-ru-de.jsonl') else None

    print('источники:', ', '.join(
        f'{k}={"да" if v is not None else "НЕТ"}'
        for k, v in (('nouns.csv', GN), ('de_50k', FQ), ('freedict', FD),
                     ('kaikki-de', K), ('kaikki-ru', KR))))
    print(f'слов в themes.yaml: {len(words)}\n')

    rows, auto = [], collections.Counter()
    for w in words:
        lemma, pos = w['w'], w['pos']
        r = dict(w=lemma, pos=pos, theme=w['theme'], miss=[], note=[])
        if pos == 'n' and GN is not None:
            e = GN.get(lemma)
            if not e:
                r['miss'].append('нет в nouns.csv')
            else:
                if e['pl_only']:
                    r['note'].append('pl_only'); auto['pl_only'] += 1
                elif not e['g']:
                    r['miss'].append('род')
                if e['adj_decl']:
                    r['note'].append('склоняется как прилагательное'); auto['adj_decl'] += 1
                if e['g_alt']:
                    r['note'].append(f"род спорный: {e['g']}/{'/'.join(e['g_alt'])}")
                    auto['род спорный'] += 1
                if not e['pl'] and not e['pl_only']:
                    r['miss'].append('мн.ч.')
                if e['akk'] and e['akk'] != lemma:
                    r['note'].append('n-Deklination'); auto['n-Deklination'] += 1
                if len(e['pl_variants']) > 1:
                    r['note'].append(f"мн.ч. вариантов {len(e['pl_variants'])}")
                    auto['мн.ч. вариативно'] += 1
        if K is not None:
            ke = K.get((lemma, KPOS[pos])) or K.get((lemma, None))
            if not ke:
                r['miss'].append('нет в kaikki')
            elif pos == 'v':
                e = ke[0]
                forms = e.get('forms') or []
                if not forms:
                    r['miss'].append('нет форм глагола')
                aux = [f['form'] for f in forms if 'auxiliary' in (f.get('tags') or [])]
                if not aux:
                    r['miss'].append('нет aux')
                elif len(set(aux)) > 1 or any(' or ' in a for a in aux):
                    r['note'].append(f'aux спорный: {"/".join(sorted(set(aux)))}')
                    auto['aux спорный'] += 1
                gov = [g for s in e.get('senses', []) for g in s.get('raw_glosses', [])
                       if '[with ' in g]
                if gov:
                    r['note'].append('есть управление'); auto['управление найдено'] += 1
        ru = list((FD or {}).get(lemma, []))[:2]
        if KR is not None:
            for e in KR.get((lemma, KPOS[pos])) or []:
                for s in e.get('senses', []):
                    if 'form_of' not in s:
                        ru += s.get('glosses', [])[:1]
        if (FD is not None or KR is not None) and not ru:
            r['miss'].append('перевод')
        r['freq'] = (FQ or {}).get(lemma.lower())
        rows.append(r)

    problems = [r for r in rows if r['miss']]
    print(f'=== не хватает данных: {len(problems)} из {len(words)} ===')
    for r in problems:
        print(f"  {r['w']:18} {POS_NAME[r['pos']]:6} {r['theme']:10} {', '.join(r['miss'])}")
    agg = collections.Counter(m for r in rows for m in r['miss'])
    if agg:
        print('\nпо видам:', ', '.join(f'{k} — {n}' for k, n in agg.most_common()))

    if not only_missing:
        print('\n=== распознано из данных, руками помечать не нужно ===')
        for k, n in auto.most_common():
            print(f'  {k:28} {n}')
        noted = [r for r in rows if r['note']]
        print(f'\n=== слова с особенностями: {len(noted)} ===')
        for r in noted:
            print(f"  {r['w']:18} {'; '.join(r['note'])}")
        ranked = [r for r in rows if r['freq']]
        print(f'\n=== частотность: в топ-50k {len(ranked)}/{len(rows)} ===')
        for lo, hi, name in ((1, 3000, 'топ-3000'), (3001, 10000, '3k–10k'), (10001, 50000, '10k–50k')):
            print(f'  {name:10} {sum(1 for r in ranked if lo <= r["freq"] <= hi)}')


if __name__ == '__main__':
    main()
