#!/usr/bin/env python3
"""Проверка базы слов по выпискам evidence/: каждый факт подтверждён источниками или `decided`.

  python3 -I tools/verify.py          проверка, код 1 при ошибке
  python3 -I tools/verify.py -v       со списком всех ошибок, а не первых по 10 на вид
"""
import collections, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from checks import nouns, rules, sentences, themes  # noqa: E402


def main():
    verbose = '-v' in sys.argv
    errors, warnings = collections.defaultdict(list), collections.defaultdict(list)
    def err(kind, w, msg):
        errors[kind].append(f'{w["id"]}: {msg}')
    def warn(kind, w, msg):
        warnings[kind].append(f'{w["id"]}: {msg}')
    words = nouns.load_words('nouns')
    ev = nouns.load_evidence('nouns')
    seen = nouns.phrase_plurals()
    ids = collections.Counter(w.get('id') for w in words)
    for i, n in ids.items():
        if n > 1:
            errors['id-dup'].append(f'{i}: {n} раз')
    for w in words:
        # вне курса (level: null) — справочные значения из dewikt: строгая проверка только у курса
        soft = w.get('level') is None
        nouns.check_noun(w, ev.get(w.get('lemma')), warn if soft else err, warn, seen)
    n = sentences.check_sentences(set(ids), errors)
    n_themes = themes.check_themes(words, errors)
    n_hints = rules.check_rules(words, errors, warnings)
    levels = collections.Counter(w.get('level') for w in words)
    print(f'существительных: {len(words)} (A1 {levels["A1"]}, A2 {levels["A2"]}, B1 {levels["B1"]}, '
          f'вне курса {levels[None]}); тем: {n_themes}; фраз: {n}; подсказок: {n_hints}')
    total = sum(map(len, errors.values()))
    for kind, xs in sorted(warnings.items()):
        print(f'предупреждение {kind}: {len(xs)}')
        for x in xs if verbose else xs[:3]:
            print('  ' + x)
    for kind, xs in sorted(errors.items()):
        print(f'\n{kind}: {len(xs)}')
        for x in xs if verbose else xs[:10]:
            print('  ' + x)
    print(f'\nошибок: {total}' if total else '\nвсё подтверждено')
    sys.exit(1 if total else 0)


if __name__ == '__main__':
    main()
