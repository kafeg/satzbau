"""Правила грамматики (docs/rules.md): у каждого — два источника и проверка на словаре.

Не собирается правило без двух разных источников, без раздела и строки в каждом, с источником
не из списка, без выписки evidence/rules.jsonl или с пометкой LLM. Доля и исключения не пишутся
руками — их считают import_rules.py (весь словарь) и эта проверка (слова базы).
"""
import collections, json, urllib.parse

import hints

ALLOWED = ('wikipedia.org', 'wikibooks.org', 'wiktionary.org')
WHEN = {'suffix', 'list', 'head'}


def check_rules(words, errors, warnings):
    rules, stats, heads, sources = hints.load()
    for k, s in sources.items():
        host = urllib.parse.urlparse(s['url']).netloc
        if not host.endswith(ALLOWED) or not s.get('license'):
            errors['rule-source'].append(f'{k}: {host} не из списка свободных источников или нет лицензии')
    seen = collections.Counter(r['id'] for r in rules)
    for r in rules:
        rid = r.get('id')
        if seen[rid] > 1:
            errors['rule-id'].append(f'{rid}: повторяется')
        if 'llm' in json.dumps(r, ensure_ascii=False).lower():
            errors['rule-llm'].append(f'{rid}: правило или его источник от LLM')
        if set(r.get('when', {})) - WHEN or len(r.get('when', {})) != 1:
            errors['rule-schema'].append(f'{rid}: условие {r.get("when")} — нужно одно из {sorted(WHEN)}')
        then = r.get('then', {})
        f, v = next(iter(then.items()), (None, None))
        if len(then) != 1 or f not in hints.FIELDS or v not in hints.FIELDS[f]:
            errors['rule-schema'].append(f'{rid}: then {then} — одно поле из {sorted(hints.FIELDS)} с допустимым значением')
        elif (v == 'head') != ('head' in r.get('when', {})):
            errors['rule-schema'].append(f'{rid}: «как у последней части» — только с условием head')
        if 'list' in r.get('when', {}) and not r.get('title'):
            errors['rule-schema'].append(f'{rid}: у списка нужен title')
        srcs_ = r.get('sources', [])
        if len({s.get('src') for s in srcs_}) < 2:
            errors['rule-sources'].append(f'{rid}: источников {len({s.get("src") for s in srcs_})}, нужно минимум два разных')
        for s in srcs_:
            if s.get('src') not in sources or not s.get('at') or not s.get('find'):
                errors['rule-sources'].append(f'{rid}: источник {s} — нужны src из sources.yaml, at и find')
        if rid not in stats or not stats[rid]['n']:
            errors['rule-stats'].append(f'{rid}: нет выписки в evidence/rules.jsonl (tools/import_rules.py)')
    if any(errors.get(k) for k in ('rule-schema', 'rule-stats')):
        return 0
    # слова базы: подсказка согласована со значением слова; исключения — предупреждением, со списком
    n = 0
    for w in words:
        if not w.get('level') or w.get('number') == 'pl':
            continue
        for name in hints.FIELDS:
            h = hints.hint(w, name, rules, stats, heads)
            if not h:
                continue
            n += 1
            if not h['ok']:
                warnings['rule-exception'].append(f'{w["id"]}: {w["lemma"]} — исключение из {h["rule"]}')
    return n
