"""Темы: решения, проверяются ссылки и полнота."""
import collections, glob, os, re

import yaml

from srcs import ROOT

THEME_KEYS = ['id', 'title', 'order', 'words']


def check_themes(nouns, errors):
    """Темы — решения (docs/data-model.md, «Тема»): проверяем только ссылки и полноту."""
    course = {w['id'] for w in nouns if w.get('level')}
    seen, orders = set(), collections.Counter()
    paths = sorted(glob.glob(os.path.join(ROOT, 'themes', '*.yaml')))
    for p in paths:
        t = yaml.safe_load(open(p, encoding='utf-8'))
        name = os.path.basename(p)
        if list(t) != THEME_KEYS:
            errors['theme-schema'].append(f'{name}: поля {list(t)}, нужно {THEME_KEYS}')
            continue
        if f'{t["id"]}.yaml' != name or not re.fullmatch(r'[a-z]+', t['id']):
            errors['theme-id'].append(f'{name}: id {t["id"]}')
        orders[t['order']] += 1
        dup = [i for i, n in collections.Counter(t['words']).items() if n > 1]
        if dup:
            errors['theme-dup'].append(f'{t["id"]}: {", ".join(dup)}')
        for i in t['words']:
            if i not in course:
                errors['theme-ref'].append(f'{t["id"]}: {i} — не запись курса')
        seen |= set(t['words'])
    for o, n in orders.items():
        if n > 1:
            errors['theme-order'].append(f'order {o}: {n} тем')
    for i in sorted(course - seen):
        errors['theme-none'].append(f'{i}: ни в одной теме')
    return len(paths)
