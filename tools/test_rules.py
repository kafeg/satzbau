#!/usr/bin/env python3
"""Тесты правил: проверка не пропускает выдуманное, подсказка выбирается по данным.

  python3 -I tools/test_rules.py
"""
import collections, copy, os, sys, unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hints  # noqa: E402
from checks import rules as check  # noqa: E402

REAL = hints.load()


def run(mutate):
    rules, stats, heads, sources = copy.deepcopy(REAL)
    mutate(rules, stats, sources)
    errors, warnings = collections.defaultdict(list), collections.defaultdict(list)
    with mock.patch.object(hints, 'load', return_value=(rules, stats, heads, sources)):
        check.check_rules([], errors, warnings)
    return {k: v for k, v in errors.items() if v}


def rule(rules, rid):
    return next(r for r in rules if r['id'] == rid)


class Guard(unittest.TestCase):
    def test_real_rules_pass(self):
        self.assertEqual(run(lambda *_: None), {})

    def test_one_source_is_not_enough(self):
        def m(rules, stats, sources):
            rule(rules, 'suffix-ung')['sources'] = rule(rules, 'suffix-ung')['sources'][:1]
        self.assertIn('rule-sources', run(m))

    def test_same_source_twice_is_one_source(self):
        def m(rules, stats, sources):
            r = rule(rules, 'suffix-tum')
            r['sources'] = [r['sources'][0], dict(r['sources'][0], find='-um')]
        self.assertIn('rule-sources', run(m))

    def test_source_without_section_or_quote(self):
        def m(rules, stats, sources):
            del rule(rules, 'suffix-ling')['sources'][0]['find']
        self.assertIn('rule-sources', run(m))

    def test_unknown_site_is_rejected(self):
        def m(rules, stats, sources):
            sources['en-wp-gender']['url'] = 'https://example.com/german-genders'
        self.assertIn('rule-source', run(m))

    def test_llm_origin_is_rejected(self):
        def m(rules, stats, sources):
            rule(rules, 'ending-e')['sources'][0]['at'] = 'llm:claude-opus-5-5:2026-11-26'
        self.assertIn('rule-llm', run(m))

    def test_rule_without_dictionary_check(self):
        def m(rules, stats, sources):
            rules.append({'id': 'suffix-xyz', 'when': {'suffix': 'xyz'}, 'then': {'gender': 'n'},
                          'sources': copy.deepcopy(rule(rules, 'suffix-ung')['sources'])})
        self.assertIn('rule-stats', run(m))

    def test_claim_about_unknown_field(self):
        def m(rules, stats, sources):
            rule(rules, 'suffix-ung')['then'] = {'plural': 'en'}
        self.assertIn('rule-schema', run(m))

    def test_head_value_without_head_condition(self):
        def m(rules, stats, sources):
            rule(rules, 'suffix-ung')['then'] = {'gender': 'head'}
        self.assertIn('rule-schema', run(m))

    def test_two_conditions_in_one_rule(self):
        def m(rules, stats, sources):
            rule(rules, 'suffix-in')['when']['list'] = ['Bein']
        self.assertIn('rule-schema', run(m))

    def test_gender_condition_on_a_gender_rule(self):
        def m(rules, stats, sources):
            rule(rules, 'suffix-ung')['when']['gender'] = ['f']
        self.assertIn('rule-schema', run(m))

    def test_gender_condition_must_be_a_gender(self):
        def m(rules, stats, sources):
            rule(rules, 'pl-in')['when']['gender'] = ['x']
        self.assertIn('rule-schema', run(m))

    def test_unknown_plural_type(self):
        def m(rules, stats, sources):
            rule(rules, 'pl-ung')['then'] = {'plural': '-en'}
        self.assertIn('rule-schema', run(m))


class Choice(unittest.TestCase):
    def hint(self, lemma, gender, compound=None):
        rules, stats, heads, _ = REAL
        return hints.hint({'lemma': lemma, 'gender': [gender], 'compound': compound}, 'gender', rules, stats, heads)

    def test_suffix(self):
        self.assertEqual(self.hint('Zeitung', 'f'), {'rule': 'suffix-ung', 'ok': True, 'head': None})

    def test_compound_beats_ending(self):
        # Kinderzimmer кончается на -er (обычно der), но это das Zimmer
        self.assertEqual(self.hint('Kinderzimmer', 'n'), {'rule': 'compound', 'ok': True, 'head': 'Zimmer'})

    def test_compound_field_of_the_word(self):
        self.assertEqual(self.hint('Liniennummer', 'f', 'Nummer')['head'], 'Nummer')

    def test_exception_is_named(self):
        self.assertEqual(self.hint('Auge', 'n'), {'rule': 'ending-e', 'ok': False, 'head': None})
        self.assertEqual(self.hint('Kuchen', 'm'), {'rule': 'suffix-chen', 'ok': False, 'head': None})

    def test_no_rule_no_hint(self):
        self.assertIsNone(self.hint('Tisch', 'm'))

    def test_word_that_is_not_a_compound(self):
        # die Antwort кончается на «Wort», но словари не называют её сложным словом
        h = self.hint('Antwort', 'f')
        self.assertTrue(h is None or h['rule'] != 'compound')


class PluralType(unittest.TestCase):
    def test_types_like_the_exercise(self):
        pairs = {('Tisch', 'Tische'): '-e', ('Bus', 'Busse'): '-e', ('Ergebnis', 'Ergebnisse'): '-e',
                 ('Zahn', 'Zähne'): '¨-e', ('Baum', 'Bäume'): '¨-e', ('Kind', 'Kinder'): '-er',
                 ('Haus', 'Häuser'): '¨-er', ('Lampe', 'Lampen'): '-(e)n', ('Frau', 'Frauen'): '-(e)n',
                 ('Lehrerin', 'Lehrerinnen'): '-(e)n', ('Auto', 'Autos'): '-s', ('Lehrer', 'Lehrer'): '—',
                 ('Apfel', 'Äpfel'): '¨', ('Museum', 'Museen'): None, ('Werkstatt', 'Werkstätten'): None}
        for (lemma, form), t in pairs.items():
            self.assertEqual(hints.plural_type(lemma, form), t, lemma)


class PluralChoice(unittest.TestCase):
    def hint(self, lemma, gender, plural, compound=None):
        rules, stats, heads, _ = REAL
        w = {'lemma': lemma, 'gender': [gender], 'plural': [plural], 'compound': compound}
        return hints.hint(w, 'plural', rules, stats, heads)

    def test_suffix(self):
        self.assertEqual(self.hint('Zeitung', 'f', 'Zeitungen'), {'rule': 'pl-ung', 'ok': True, 'head': None})
        self.assertEqual(self.hint('Mädchen', 'n', 'Mädchen'), {'rule': 'pl-chen', 'ok': True, 'head': None})

    def test_gender_and_ending(self):
        # die Lampe: -e у женского рода надёжнее, чем -e вообще и чем «die → -(e)n»
        self.assertEqual(self.hint('Lampe', 'f', 'Lampen'), {'rule': 'pl-e-f', 'ok': True, 'head': None})
        self.assertEqual(self.hint('Lehrerin', 'f', 'Lehrerinnen')['rule'], 'pl-in')
        self.assertEqual(self.hint('Lehrer', 'm', 'Lehrer'), {'rule': 'pl-er-mn', 'ok': True, 'head': None})
        self.assertEqual(self.hint('Kartoffel', 'f', 'Kartoffeln')['rule'], 'pl-el-f')

    def test_compound(self):
        self.assertEqual(self.hint('Kinderzimmer', 'n', 'Kinderzimmer'), {'rule': 'pl-compound', 'ok': True, 'head': 'Zimmer'})

    def test_exception_is_named(self):
        self.assertEqual(self.hint('Hand', 'f', 'Hände'), {'rule': 'pl-f', 'ok': False, 'head': None})
        self.assertEqual(self.hint('Käse', 'm', 'Käse'), {'rule': 'pl-e', 'ok': False, 'head': None})
        self.assertEqual(self.hint('Garten', 'm', 'Gärten'), {'rule': 'pl-en', 'ok': False, 'head': None})

    def test_no_rule_no_hint(self):
        self.assertIsNone(self.hint('Tisch', 'm', 'Tische'))

    def test_form_outside_types_has_no_hint(self):
        self.assertIsNone(self.hint('Museum', 'n', 'Museen'))


if __name__ == '__main__':
    unittest.main()
