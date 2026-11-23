"""Разбор скобок управления из английского Викисловаря: `[with auf (+ accusative) ‘…’ and dative ‘…’]`.

Грамматика выведена по всему немецкому дампу: 1482 скобки, 229 различных форм, разбирается 91,5%.

  скобка  := 'with ' альтернативы
  альт    := слот ((' and ' | ', along with ') слот)*    всё перечисленное требуется вместе
  слот    := [помета] (ПАДЕЖ | ПРЕДЛОГ ' (+ ' ПАДЕЖ ')' | ПРЕДЛОГ ' ' ПАДЕЖ | ПРЕДЛОГ
             | ПРЕДЛОГ ' (+ infinitive|clause)' | 'infinitive') [‘глосса’]

Возвращает список альтернатив, в каждой список слотов {kind, prep?, case?, gloss?}; неразобранное — None.
Глоссы в кавычках ‘…’ сами содержат ' or ' и ' and ', поэтому экранируются до разбора альтернатив:
без этого 3–4% ложных отказов.
"""
import re

CASES = {'nominative': 'N', 'accusative': 'A', 'dative': 'D', 'genitive': 'G'}
PREPS = ('an auf aus bei durch für gegen in mit nach ohne seit über um unter von vor zu zwischen '
         'wegen trotz hinter neben gegenüber entlang statt während außer ab bis als wie').split()
P = '|'.join(PREPS)
QUAL = r'(?:\((?:higher register|archaic|rare|colloquial|less common|usually|optional|dated|formal)\) )?'
GL = r"(?: ‘(?P<gloss>[^’]*)’)?"
SLOT = [
    ('prep_case', re.compile(rf'^{QUAL}(?P<prep>{P}) \(\+ (?P<case>nominative|accusative|dative|genitive)\){GL}$')),
    ('prep_case', re.compile(rf'^{QUAL}(?P<prep>{P}) (?P<case>accusative|dative|genitive){GL}$')),
    ('prep_inf', re.compile(rf'^{QUAL}(?P<prep>{P}|zu|dass|ob) \(\+ (?:infinitive|clause)\){GL}$')),
    ('case', re.compile(rf'^{QUAL}(?:reflexive )?(?P<case>nominative|accusative|dative|genitive){GL}$')),
    ('prep_nocase', re.compile(rf'^{QUAL}(?P<prep>{P}){GL}$')),
    ('infinitive', re.compile(rf'^{QUAL}(?:bare )?infinitive{GL}$')),
]
BR = re.compile(r'\[with ([^\]]*)\]')


def parse_slot(s):
    s = s.strip()
    for kind, rx in SLOT:
        m = rx.match(s)
        if m:
            g = m.groupdict()
            out = {'kind': kind}
            if g.get('prep'): out['prep'] = g['prep']
            if g.get('case'): out['case'] = CASES[g['case']]
            if g.get('gloss'): out['gloss'] = g['gloss']
            return out
    return None


def parse(bracket_body):
    # protect ‘glosses’ (they may contain ' or ' / ' and ') before splitting
    gl = []
    body = re.sub(r"‘[^’]*’", lambda m: (gl.append(m.group(0)), f'‘\x00{len(gl)-1}’')[1], bracket_body)
    restore = lambda s: re.sub(r'‘\x00(\d+)’', lambda m: gl[int(m.group(1))], s)
    alts = []
    for alt in re.split(r' or ', body):
        slots = [parse_slot(restore(x)) for x in re.split(r' and |, along with ', alt)]
        if any(x is None for x in slots):
            return None
        alts.append(slots)
    return alts


def find(gloss):
    return [(m.group(0), parse(m.group(1))) for m in BR.finditer(gloss)]
