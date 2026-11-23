#!/usr/bin/env python3
"""Инварианты собранных данных. Запускать после build_data.py, до коммита.

  .venv/bin/python -I tools/check_data.py        → список проблем, код 1 если есть ошибки

Проверяет не «валидный ли JSON», а то, от чего зависит генератор: у каждого существительного
есть род или `pl_only`, спряжение выводимо, у каждого шаблона есть объяснение и непустое
наполнение. Условия `need` здесь реализованы второй раз, отдельно от будущего ядра: это
не дубль логики, а проверка — шаблон без наполнения должен падать до появления приложения.
"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, 'content', 'build')
MANUAL = os.path.join(ROOT, 'content', 'manual')
LEVELS = {'A1': 1, 'A2': 2, 'B1': 3}
NEED_KEYS = {'pos', 'theme', 'tags', 'g', 'lv_max', 'has', 'not'}
# Флаги для `not`: имя в шаблоне → когда оно поднято у записи лексикона
FLAGS = {'pl_only': lambda r: r.get('pl_only'), 'plu': lambda r: r.get('plu'),
         'nd': lambda r: r.get('nd'), 'adjdecl': lambda r: r.get('adjdecl'),
         'aux_hs': lambda r: r.get('aux') == 'hs'}
errors, warns, notes = [], [], []


def jload(name):
    return json.load(open(os.path.join(BUILD, name), encoding='utf-8'))


def yload(name):
    return yaml.safe_load(open(os.path.join(MANUAL, name), encoding='utf-8'))


def tag_vocabulary():
    """Закрытый словарь тегов живёт в content/manual/README.md — один факт в одном месте."""
    md = open(os.path.join(MANUAL, 'README.md'), encoding='utf-8').read()
    return set(re.findall(r'^\| `(\w+)` \|', md, re.M))


def fits(need, w, rec):
    if 'pos' in need and need['pos'] != w['pos']:
        return False
    if 'theme' in need and need['theme'] != w['theme']:
        return False
    if 'tags' in need and not set(need['tags']) & set(w.get('tags') or []):
        return False
    if 'g' in need and rec.get('g') not in need['g']:
        return False
    if 'lv_max' in need and LEVELS[w['lv']] > LEVELS[need['lv_max']]:
        return False
    if any(k not in rec for k in need.get('has') or []):
        return False
    for f in need.get('not') or []:
        if f in FLAGS:
            if FLAGS[f](rec):
                return False
        elif f in (w.get('tags') or []):
            return False
    return True


def main():
    nouns, verbs, adjs = jload('nouns.json'), jload('verbs.json'), jload('adjs.json')
    meta, themes = jload('meta.json'), jload('themes.json')
    templates, explain = yload('templates.yaml'), yload('explain.yaml')
    src_themes, fixes = yload('themes.yaml'), yload('fixes.yaml')
    sents = jload('sentences.json') if os.path.exists(os.path.join(BUILD, 'sentences.json')) else None
    rec = {x['w']: x for x in nouns + verbs + adjs}
    words = [dict(w, theme=th) for th, v in src_themes.items() for w in v['words']]

    # --- лексикон
    for n in nouns:
        if not n.get('g') and not n.get('pl_only'):
            errors.append(f'существительное {n["w"]}: нет ни рода, ни pl_only')
        if n.get('g') and n.get('pl_only'):
            errors.append(f'существительное {n["w"]}: род и pl_only одновременно')
        if n.get('g') not in (None, 'm', 'f', 'n'):
            errors.append(f'существительное {n["w"]}: род {n["g"]!r}')
        if not n.get('pl') and not n.get('pl_only') and not n.get('npl'):
            warns.append(f'существительное {n["w"]}: нет множественного — часть шаблонов его не возьмёт')
    for v in verbs:
        for k in ('p3', 'pt', 'pp', 'aux'):
            if not v.get(k):
                errors.append(f'глагол {v["w"]}: нет {k}, спряжение не вывести')
        if v.get('aux') not in ('h', 's', 'hs'):
            errors.append(f'глагол {v["w"]}: aux {v.get("aux")!r}')
        if ' ' in (v.get('p3') or '') and not (v.get('pp') or '').startswith(
                v['p3'].split()[-1]):
            notes.append(f'глагол {v["w"]}: отделяемая приставка {v["p3"].split()[-1]!r}, '
                         f'причастие {v.get("pp")} — проверить')
    for a in adjs:
        if a.get('sup') and not a['sup'].startswith('am '):
            errors.append(f'прилагательное {a["w"]}: превосходная степень без «am»: {a["sup"]}')
    for x in nouns + verbs + adjs:
        if x['lv'] not in LEVELS:
            errors.append(f'{x["w"]}: уровень {x["lv"]!r}')
        if not x.get('ru'):
            warns.append(f'{x["w"]}: нет русского перевода')

    # --- лексикон против ручных списков
    seen = {}
    for w in words:
        if w['w'] in seen:
            errors.append(f'{w["w"]}: повторяется в темах {seen[w["w"]]} и {w["theme"]}')
        seen[w['w']] = w['theme']
    lost = [w['w'] for w in words if w['w'] not in rec]
    if lost:
        report = open(os.path.join(BUILD, 'report.txt'), encoding='utf-8').read()
        for lemma in lost:
            (notes if lemma in report else errors).append(
                f'{lemma}: нет в сборке' + (' (объяснено в report.txt)' if lemma in report
                                            else ' и не объяснено в отчёте'))
    vocab = tag_vocabulary()
    for w in words:
        extra = set(w.get('tags') or []) - vocab
        if extra:
            errors.append(f'{w["w"]}: теги вне словаря README.md: {", ".join(sorted(extra))}')

    # --- шаблоны
    rules = set()
    for t in templates:
        rules.add(t['rule'])
        if t['why'] not in explain:
            errors.append(f'шаблон {t["id"]}: нет объяснения {t["why"]!r} в explain.yaml')
        if t['rule'] != t['why']:
            notes.append(f'шаблон {t["id"]}: rule {t["rule"]} и why {t["why"]} различаются')
        if '{slot}' not in t['frame']:
            errors.append(f'шаблон {t["id"]}: в рамке нет {{slot}}')
        if t['kind'] == 'choice' and not t.get('options'):
            errors.append(f'шаблон {t["id"]}: kind choice без options')
        bad = set(t['need']) - NEED_KEYS
        if bad:
            errors.append(f'шаблон {t["id"]}: условия вне закрытого списка: {", ".join(sorted(bad))}')
        for tag in (t['need'].get('tags') or []) + (
                [x for x in (t['need'].get('not') or []) if x not in FLAGS]):
            if tag not in vocab:
                errors.append(f'шаблон {t["id"]}: тег {tag!r} вне словаря README.md')
        if 'theme' in t['need'] and t['need']['theme'] not in src_themes:
            errors.append(f'шаблон {t["id"]}: темы {t["need"]["theme"]!r} нет в themes.yaml')
        fill = [w['w'] for w in words if w['w'] in rec and fits(t['need'], w, rec[w['w']])]
        if not fill:
            errors.append(f'шаблон {t["id"]}: наполнения нет вообще — задание не соберётся')
        elif len(fill) < 5:
            warns.append(f'шаблон {t["id"]}: наполнение {len(fill)} слов ({", ".join(fill)}) — '
                         f'задание быстро повторится')
        else:
            notes.append(f'шаблон {t["id"]}: наполнение {len(fill)} слов')
    # Слово, которое не берёт ни один шаблон, человек увидит только на карточке:
    # спросить его нечем. Это главный показатель того, чего не хватает — шаблонов.
    for th in src_themes:
        ws = [w for w in words if w['theme'] == th and w['w'] in rec]
        used = {w['w'] for w in ws for t in templates if fits(t['need'], w, rec[w['w']])}
        share = 100 * len(used) // max(len(ws), 1)
        line = f'тема {th}: в заданиях {len(used)} слов из {len(ws)} ({share}%)'
        (warns if share < 25 else notes).append(
            line + (' — шаблонов на эту тему почти нет' if share < 25 else ''))

    for r in rules:
        for k in ('title', 'short', 'ru_contrast', 'steps'):
            if k not in (explain.get(r) or {}):
                errors.append(f'объяснение {r}: нет поля {k}')
    unused = set(explain) - {t['why'] for t in templates}
    if unused:
        notes.append(f'объяснения без шаблона: {", ".join(sorted(unused))}')

    # --- правки, которые ни на что не ложатся
    lemmas = {w['w'] for w in words}
    for block in ('government', 'gender', 'translations', 'aux_ambiguous'):
        idle = sorted(set(fixes.get(block) or {}) - lemmas)
        if idle:
            notes.append(f'fixes.yaml:{block} — записи для слов вне тем ({len(idle)}): '
                         f'{", ".join(idle)}')

    # --- предложения
    if sents is not None:
        ids = [s['i'] for s in sents]
        if len(ids) != len(set(ids)):
            errors.append('предложения: идентификаторы Tatoeba повторяются')
        for s in sents[:0] or sents:
            if not s.get('de') or not s.get('ru'):
                errors.append(f'предложение {s["i"]}: пустая сторона')
                break
            n = len(re.findall(r'[A-Za-zÄÖÜäöüß]+', s['de']))
            if not 3 <= n <= 8:
                errors.append(f'предложение {s["i"]}: {n} словоформ, фильтр обещал 3–8')
                break
            if not s.get('l'):
                errors.append(f'предложение {s["i"]}: нет привязки к леммам')
                break
            unknown = [x for x in s['l'] if x not in rec]
            if unknown:
                errors.append(f'предложение {s["i"]}: ссылается на {unknown}, которых нет в лексиконе')
                break
        with_ex = {x for s in sents for x in s['l']}
        notes.append(f'примеры есть у {len(with_ex)} слов из {len(rec)}')

    # --- мета
    counts = {'nouns.json': len(nouns), 'verbs.json': len(verbs), 'adjs.json': len(adjs)}
    for name, n in counts.items():
        if meta['counts'].get(name) != n:
            errors.append(f'meta.json: {name} обещает {meta["counts"].get(name)}, в файле {n}')
    if set(themes) != set(src_themes):
        errors.append('themes.json и themes.yaml разошлись по набору тем')

    for group, items in (('ОШИБКИ', errors), ('предупреждения', warns), ('заметки', notes)):
        if items:
            print(f'=== {group}: {len(items)} ===')
            for x in items:
                print(' ', x)
            print()
    print('данных:', ', '.join(f'{k} {v}' for k, v in sorted(meta['counts'].items())),
          f'| версия {meta["version"]}')
    print('ОШИБКИ ЕСТЬ' if errors else 'инварианты держатся')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
