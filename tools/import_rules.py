#!/usr/bin/env python3
"""Выписки для правил (docs/rules.md): насколько правило верно на всём словаре и разбор сложных слов.

  python3 -I tools/import_rules.py

Пишет:
  evidence/rules.jsonl — по правилу: сколько существительных `dewikt` оно касается и у скольких совпало
                         поле (род, тип множественного);
  evidence/heads.jsonl — у слов базы последняя часть сложного слова по `dewikt` и `enwikt`, её род и тип
                         множественного.
Нужны data/raw (tools/fetch.py). Выписки в git: verify.py и build.py работают по ним без сети.
"""
import collections, glob, json, os, re, sys

import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import srcs  # noqa: E402
from hints import FIELDS, TRUTH, applies, field, plural_type  # noqa: E402

ROOT = srcs.ROOT
# «Determinativkompositum aus … und X»: X — последняя часть; служебные слова разбора — не она
DE_HEAD = re.compile(r'Determinativkompositum[^.]*?\bund\s+(?:dem\s+|den\s+|der\s+)?(?:Substantiv(?:en)?\s+)?„?([A-ZÄÖÜ][a-zäöüß]+)')
NOT_HEAD = {'Nomen', 'Fugenelement', 'Konversion', 'Substantiv', 'Stamm', 'Verb', 'Adjektiv', 'Wort'}


def rules():
    out = []
    for p in sorted(glob.glob(os.path.join(ROOT, 'rules', '*.yaml'))):
        if not p.endswith('sources.yaml'):
            out += yaml.safe_load(open(p, encoding='utf-8'))
    return out


def de_head(entry):
    m = DE_HEAD.search(' '.join(entry.get('etymology_texts') or []))
    return m.group(1) if m and m.group(1) not in NOT_HEAD else None


def en_head(entry):
    for t in entry.get('etymology_templates', []):
        if t.get('name') in ('compound', 'com'):
            args = [v for k, v in sorted(t.get('args', {}).items(), key=lambda kv: (len(kv[0]), kv[0]))
                    if k.isdigit() and k != '1' and v and not v.startswith('-') and not v.endswith('-')]
            if args and args[-1][:1].isupper():
                return args[-1].split('<')[0]
    return None


def main():
    words = set()
    for p in glob.glob(os.path.join(ROOT, 'words', 'nouns', '*.yaml')):
        words |= {w['lemma'] for w in yaml.safe_load(open(p, encoding='utf-8')) or []}
    rs = rules()
    # значения полей у слов словаря: род — все записи, тип множественного — по первой форме каждой записи
    values = {'gender': {}, 'plural': {}}
    plurals, compounds, de_heads = {}, [], {}
    for r in srcs.jsonl(srcs.raw('dewikt.jsonl.gz')):
        if r.get('pos') != 'noun' or 'form-of' in (r.get('tags') or []):
            continue
        f = srcs.noun_forms(r)
        g, pl = f['gender'], f['plural']
        if g:
            values['gender'].setdefault(r['word'], set()).update(g)
        if pl:
            plurals.setdefault(r['word'], pl)
            t = plural_type(r['word'], pl[0])
            if t:
                values['plural'].setdefault(r['word'], set()).add(t)
        h = de_head(r)
        if h and len(set(g)) == 1:
            compounds.append(({'lemma': r['word'], 'gender': g[:1], 'plural': pl}, h))
        if r['word'] in words and r['word'] not in de_heads:
            de_heads[r['word']] = h
    en_heads = {}
    for r in srcs.jsonl(srcs.raw('kaikki-de.jsonl'), 'de'):
        if r.get('pos') == 'noun' and r['word'] in words and r['word'] not in en_heads:
            en_heads[r['word']] = en_head(r)
    # слова одного рода; для множественного — с формой множественного (у какой нет — факта нет)
    single = [{'lemma': w, 'gender': [next(iter(g))], 'plural': plurals.get(w, [])}
              for w, g in values['gender'].items() if len(g) == 1]
    facts = {'gender': single, 'plural': [w for w in single if w['plural']]}
    with open(os.path.join(ROOT, 'evidence', 'rules.jsonl'), 'w', encoding='utf-8') as f:
        for rule in rs:
            name, claim = field(rule)
            if 'head' in rule['when']:
                known = [(TRUTH[name](w), values[name][h]) for w, h in compounds
                         if h in values[name] and (name != 'plural' or w['plural'])]
                n, ok = len(known), sum(v in hv for v, hv in known)
            else:
                hit = [w for w in facts[name] if applies(rule, w)]
                n, ok = len(hit), sum(TRUTH[name](w) == claim for w in hit)
            f.write(json.dumps({'id': rule['id'], 'n': n, 'ok': ok}) + '\n')
            print(f'{rule["id"]:16} {ok:6} из {n:6}  {100 * ok / n if n else 0:5.1f}%')
    heads = 0
    with open(os.path.join(ROOT, 'evidence', 'heads.jsonl'), 'w', encoding='utf-8') as f:
        for w in sorted(words):
            d, e = de_heads.get(w), en_heads.get(w)
            if not d and not e:
                continue
            heads += 1
            parts = {d, e} - {None}
            rec = {'lemma': w, 'dewikt': d, 'enwikt': e}
            for name in FIELDS:
                rec[name] = {h: sorted(values[name][h]) for h in parts if h in values[name]}
            f.write(json.dumps(rec, ensure_ascii=False, sort_keys=False) + '\n')
    print(f'сложных слов в базе по двум источникам: {heads}')


if __name__ == '__main__':
    main()
