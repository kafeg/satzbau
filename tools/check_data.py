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
FLAGS = {name: (lambda n: lambda r: bool(r.get(n)))(name)
         for name in ('pl_only', 'plu', 'npl', 'mass', 'nd', 'adjdecl', 'g2')}
FLAGS['aux_hs'] = lambda r: r.get('aux') == 'hs'
FLAGS['sep'] = lambda r: ' ' in (r.get('p3') or '')
FLAGS['aux_s'] = lambda r: r.get('aux') == 's'
FLAGS['reflexive'] = lambda r: bool(r.get('refl'))
FLAGS['govex2'] = lambda r: len(r.get('govex') or ()) >= 2
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
    # has принимает и поле записи, и признак: has: [sep] — «отделяемый»
    for k in need.get('has') or []:
        if (not FLAGS[k](rec)) if k in FLAGS else (k not in rec):
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
        # {Slot} — тот же пропуск с заглавной буквы: слот стоит первым словом фразы
        if '{slot}' not in t['frame'] and '{Slot}' not in t['frame']:
            errors.append(f'шаблон {t["id"]}: в рамке нет {{slot}}')
        if t['kind'] == 'choice' and not t.get('options'):
            errors.append(f'шаблон {t["id"]}: kind choice без options')
        bad = set(t['need']) - NEED_KEYS
        if bad:
            errors.append(f'шаблон {t["id"]}: условия вне закрытого списка: {", ".join(sorted(bad))}')
        # второе слово: та же проверка условий плюс «есть ли вообще из чего выбирать»
        f2 = (t.get('fill2') or {}).get('need')
        if f2 is not None:
            bad2 = set(f2) - NEED_KEYS
            if bad2:
                errors.append(f'шаблон {t["id"]}: fill2, условия вне списка: {", ".join(sorted(bad2))}')
            for tag in (f2.get('tags') or []) + [x for x in (f2.get('not') or []) if x not in FLAGS]:
                if tag not in vocab:
                    errors.append(f'шаблон {t["id"]}: fill2, тег {tag!r} вне словаря README.md')
            if not [w for w in words if w['w'] in rec and fits(f2, w, rec[w['w']])]:
                errors.append(f'шаблон {t["id"]}: fill2 не находит ни одного слова')
        if '{w2}' in t['frame'] and not t.get('fill2'):
            errors.append(f'шаблон {t["id"]}: в рамке {{w2}}, а fill2 не задан')
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
        # ⚠ Слово рамки, написанное буквально, не должно приходить ещё и наполнением:
        # «Das Problem ist ein Problem», «In der Stadt gibt es eine Stadt». Машинно
        # это ловится только здесь — у генератора рамка уже склеена со словом.
        literal = set(re.findall(r'\b[A-ZÄÖÜ][a-zäöüß]+\b', re.sub(r'\{\w+\}', ' ', t['frame'])))
        clash = sorted(literal & set(fill))
        if clash:
            warns.append(f'шаблон {t["id"]}: слово рамки приходит и наполнением '
                         f'({", ".join(clash)}) — фраза говорит о себе самой')
    # Слово, которое не берёт ни один шаблон, человек увидит только на карточке:
    # спросить его нечем. Это главный показатель того, чего не хватает — шаблонов.
    for th in src_themes:
        ws = [w for w in words if w['theme'] == th and w['w'] in rec]
        used = {w['w'] for w in ws for t in templates if fits(t['need'], w, rec[w['w']])}
        share = 100 * len(used) // max(len(ws), 1)
        line = f'тема {th}: в заданиях {len(used)} слов из {len(ws)} ({share}%)'
        (warns if share < 25 else notes).append(
            line + (' — шаблонов на эту тему почти нет' if share < 25 else ''))

    groups = {'падеж', 'артикль', 'существительное', 'прилагательное', 'глагол'}
    for r in rules:
        for k in ('name', 'group', 'title', 'short', 'ru_contrast', 'steps'):
            if k not in (explain.get(r) or {}):
                errors.append(f'объяснение {r}: нет поля {k}')
        e = explain.get(r) or {}
        # name и title показываются вне задания — подставлять там нечего
        for k in ('name', 'title'):
            if '{' in e.get(k, ''):
                errors.append(f'объяснение {r}: в {k} есть подстановка — он виден вне задания')
        if e.get('group') and e['group'] not in groups:
            errors.append(f'объяснение {r}: группа {e["group"]!r} вне списка {sorted(groups)}')
        if len((e.get('name') or '').split()) > 4:
            warns.append(f'объяснение {r}: имя из {len(e["name"].split())} слов — в списке не поместится')
    # --- ⚠ Текст объяснения не называет предлог буквально, если у правила их несколько.
    # На `merge-prep-article` шаг «in + dem = im» стоял буквально, а рамка бывает и на `zu`:
    # «Ich gehe zum Weg» разбирался через предлог, которого в задании нет. Поля `short`,
    # `title` и `steps` человек видит ПОД СВОИМ заданием, поэтому пример в них обязан быть
    # из него же — подстановкой. В `ru_contrast` буквальный пример допустим: это общая
    # мысль про язык, а не разбор этой фразы.
    PREPS = {'in', 'an', 'auf', 'über', 'unter', 'vor', 'hinter', 'neben', 'zwischen', 'zu',
             'mit', 'bei', 'von', 'nach', 'seit', 'aus', 'für', 'um', 'durch', 'ohne', 'gegen'}
    preps_of = {}
    for t in templates:
        preps_of.setdefault(t['why'], set()).add(
            (t['slot'].get('prep') or (t.get('options') or {}).get('prep') or ''))
    for r, e in sorted(explain.items()):
        if len(preps_of.get(r, set())) < 2:
            continue
        text = ' '.join([e.get('short', ''), e.get('title', ''), *(e.get('steps') or [])])
        named = {w for w in re.findall(r'[a-zäöüß]+', text.lower()) if w in PREPS}
        if named:
            errors.append(f'объяснение {r}: называет предлог {sorted(named)} буквально, '
                          f'а рамки бывают на {sorted(p for p in preps_of[r] if p)} — '
                          'нужна подстановка')

    # --- граф предпосылок: он задаёт порядок обучения, и врать ему нельзя
    lvl_of = {}
    for t in templates:
        r = t['why']
        lvl_of[r] = min(lvl_of.get(r, 'B1'), t['level'])
    for r, e in sorted(explain.items()):
        for a in (e.get('after') or []):
            if a not in explain:
                errors.append(f'объяснение {r}: after ссылается на {a!r}, такого правила нет')
            elif a == r:
                errors.append(f'объяснение {r}: after ссылается на себя')
            elif LEVELS.get(lvl_of.get(a, 'A1'), 1) > LEVELS.get(lvl_of.get(r, 'A1'), 1):
                errors.append(f'объяснение {r} ({lvl_of.get(r)}): предпосылка {a} '
                              f'уровнем выше ({lvl_of.get(a)})')
    # цикл в графе означал бы, что порядок обучения не существует
    seen, stack = set(), set()

    def walk(r, path):
        if r in stack:
            errors.append(f'граф предпосылок: цикл {" → ".join(path + [r])}')
            return
        if r in seen:
            return
        stack.add(r)
        for a in (explain.get(r, {}).get('after') or []):
            if a in explain:
                walk(a, path + [r])
        stack.discard(r)
        seen.add(r)

    for r in explain:
        walk(r, [])
    no_after = sorted(r for r in explain if not (explain[r].get('after') or []))
    if len(no_after) > 3:
        notes.append(f'правил без предпосылок ({len(no_after)}) — это точки входа '
                     f'в обучение: {", ".join(no_after)}')

    unused = set(explain) - {t['why'] for t in templates}
    if unused:
        notes.append(f'объяснения без шаблона: {", ".join(sorted(unused))}')

    # --- пример дополнения к управлению: он попадает в задание как есть, проверять
    # его может только человек, а вот согласованность с gov проверяется здесь.
    gov_ex = fixes.get('government_example') or {}
    gov_all = fixes.get('government') or {}
    parsed = []
    for v, ex in sorted(gov_ex.items()):
        gov = gov_all.get(v)
        if not gov:
            errors.append(f'fixes.yaml:government_example — у {v} нет управления в government')
            continue
        preps = {g.split()[0]: g.split()[1] for g in gov if ' ' in g}
        exs = [ex] if isinstance(ex, str) else list(ex)
        if not preps:
            errors.append(f'fixes.yaml:government_example — у {v} управление {gov} '
                          f'без предлога: пропуску нечего показывать')
            continue
        if len(exs) > len(preps):
            errors.append(f'fixes.yaml:government_example — у {v} примеров {len(exs)}, '
                          f'а предложных связок {len(preps)}')
        seen = []
        for e in exs:
            hit = [(i, w) for i, w in enumerate(e.split()) if w in preps]
            if not hit:
                errors.append(f'fixes.yaml:government_example — {v}: в {e!r} нет предлога '
                              f'из управления {sorted(preps)}')
                continue
            if len(hit) > 1:
                errors.append(f'fixes.yaml:government_example — {v}: в {e!r} предлогов '
                              f'управления несколько ({", ".join(w for _, w in hit)})')
                continue
            i, prep = hit[0]
            if prep in seen:
                errors.append(f'fixes.yaml:government_example — {v}: предлог {prep!r} '
                              f'в примерах дважды, второй связки у него нет')
            seen.append(prep)
            toks = e.split()
            parsed.append((v, ' '.join(toks[:i]) or '—', prep, preps[prep],
                           ' '.join(toks[i + 1:])))
    if parsed:
        notes.append('примеры управления, как их делит генератор '
                     '(до предлога | предлог | падеж | после) — прочитать глазами:')
        for v, pre, prep, c, obj in parsed:
            notes.append(f'    {v:14} {pre:18} {prep:7} {c:3} {obj}')
    # обратная сторона: глагол с предлогом и без примера в правило не попадёт
    no_ex = sorted(v for v, g in gov_all.items()
                   if any(' ' in x for x in g) and v not in gov_ex
                   and v in {w['w'] for w in words})
    if no_ex:
        notes.append(f'управление с предлогом, но без примера ({len(no_ex)}) — '
                     f'в правило о предлоге не попадут: {", ".join(no_ex)}')

    # --- ручное множественное не должно спорить с «множественного нет»
    both = sorted(set(fixes.get('plural') or {}) & set(fixes.get('no_plural') or ()))
    if both:
        errors.append(f'fixes.yaml — {", ".join(both)}: и в plural, и в no_plural')

    # --- правки, которые ни на что не ложатся
    lemmas = {w['w'] for w in words}
    for block in ('government', 'government_example', 'gender', 'plural', 'translations',
                  'aux_ambiguous'):
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
    # Собрать с --no-sents поверх полной сборки — и meta не знает про лежащий рядом файл,
    # а версия данных посчитана без него. Service worker отдаст старое.
    on_disk = {f for f in os.listdir(BUILD) if f.endswith('.json') and f != 'meta.json'}
    for name in sorted(on_disk - set(meta['counts'])):
        errors.append(f'meta.json: про {name} не знает, а файл лежит — пересобрать целиком')
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
