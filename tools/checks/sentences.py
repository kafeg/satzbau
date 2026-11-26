"""Фразы: перевод и его происхождение, ссылки токенов на записи слов."""
import glob, json, os, re

from srcs import ROOT

BY = re.compile(r'tatoeba:\d+|llm:[\w.-]+:\d{4}-\d{2}-\d{2}')


# откуда немецкий текст фразы: по папке и префиксу id; у Викисловаря и LLM — ещё и de_by
SENTENCE_DIRS = {'tatoeba': ('t:', None), 'wikt': ('w:', re.compile('dewikt')), 'gen': ('g:', BY)}


def check_sentences(ids, errors):
    """Фраза: есть перевод, у каждого перевода — откуда он; токены ссылаются на существующие записи.
    У примеров Викисловаря и LLM слово, ради которого фраза взята, должно быть привязано."""
    n, seen = 0, set()
    for d, (prefix, de_by) in SENTENCE_DIRS.items():
        for p in sorted(glob.glob(os.path.join(ROOT, 'sentences', d, '*.jsonl'))):
            for line in open(p, encoding='utf-8'):
                s, n = json.loads(line), n + 1
                check_sentence(s, ids, prefix, de_by, seen, errors)
    return n


def check_sentence(s, ids, prefix, de_by, seen, errors):
    sid = s.get('id', '')
    if not sid.startswith(prefix) or sid in seen:
        errors['sentence-id'].append(f'{sid}: id не «{prefix}…» или повторяется')
    seen.add(sid)
    if de_by and not de_by.fullmatch(s.get('de_by', '')):
        errors['sentence'].append(f'{sid}: de_by «{s.get("de_by")}»')
    if prefix != 't:':
        word = sid[2:].rsplit(':', 1)[0]
        if word not in {t[4] for t in s.get('tok', [])}:
            errors['sentence-ref'].append(f'{sid}: слово {word} не привязано')
    if not s.get('de') or not (s.get('ru') or s.get('en')):
        errors['sentence'].append(f'{sid}: нет текста или перевода')
    for lang in ('ru', 'en'):
        if lang in s and not BY.fullmatch(s.get(f'{lang}_by', '')):
            errors['sentence'].append(f'{sid}: {lang}_by «{s.get(f"{lang}_by")}»')
    for t in s.get('tok', []):
        if t[4] not in (None, '?') and t[4] not in ids:
            errors['sentence-ref'].append(f'{sid}: {t[0]} → {t[4]}')
