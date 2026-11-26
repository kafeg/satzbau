#!/usr/bin/env python3
"""Тесты фразы для пропуска рода (tools/clozes.py).

  python3 -I tools/test_clozes.py
"""
import os, sys, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import clozes  # noqa: E402

LAMPE = {'id': 'n:Lampe', 'lemma': 'Lampe', 'gender': ['f']}
TISCH = {'id': 'n:Tisch', 'lemma': 'Tisch', 'gender': ['m']}


def s(*tok, ru='Лампа погасла.', ru_by='tatoeba:1'):
    return {'tok': [list(t) for t in tok], 'ru': ru, 'ru_by': ru_by}


ART = ('Die', 'der', 'DET', 'Case=Nom|Gender=Fem|Number=Sing', None)
NOUN = ('Lampe', 'Lampe', 'NOUN', 'Case=Nom|Gender=Fem|Number=Sing', 'n:Lampe')
END = ('.', '--', 'PUNCT', '', None)


class Gap(unittest.TestCase):
    def test_article_first(self):
        self.assertEqual(clozes.gender_gap(LAMPE, s(ART, NOUN, ('ging', 'gehen', 'VERB', '', None), END)), 0)

    def test_wrong_article_is_not_gender(self):
        # «Der Lampe» — дательный: артикль не равен роду
        der = ('Der', 'der', 'DET', 'Case=Dat|Gender=Fem|Number=Sing', None)
        self.assertIsNone(clozes.gender_gap(LAMPE, s(der, NOUN, END, END)))

    def test_plural_is_not_gender(self):
        tische = ('Tische', 'Tisch', 'NOUN', 'Case=Nom|Gender=Masc|Number=Plur', 'n:Tisch')
        self.assertIsNone(clozes.gender_gap(TISCH, s(('Die', 'der', 'DET', '', None), tische, END)))

    def test_pronoun_gives_gender_away(self):
        sie = ('sie', 'sie', 'PRON', '', None)
        self.assertIsNone(clozes.gender_gap(LAMPE, s(ART, NOUN, ('ist', 'sein', 'AUX', '', None), ('alt', 'alt', 'ADJ', '', None), (',', '--', 'PUNCT', '', None), sie, END)))

    def test_relative_pronoun_gives_gender_away(self):
        die = ('die', 'der', 'PRON', 'PronType=Rel', None)
        self.assertIsNone(clozes.gender_gap(LAMPE, s(ART, NOUN, (',', '--', 'PUNCT', '', None), die, END)))

    def test_word_again_gives_gender_away(self):
        self.assertIsNone(clozes.gender_gap(LAMPE, s(ART, NOUN, ('und', 'und', 'CCONJ', '', None), ART, NOUN, END)))

    def test_two_genders_skip(self):
        kilo = {'id': 'n:Kilo', 'lemma': 'Kilo', 'gender': ['n', 'm']}
        self.assertIsNone(clozes.gender_gap(kilo, s(('Das', 'der', 'DET', '', None), ('Kilo', 'Kilo', 'NOUN', '', 'n:Kilo'), END)))

    def test_human_translation_first(self):
        short_llm = s(ART, NOUN, END, ru_by='llm:x')
        long_human = s(ART, NOUN, ('ging', 'gehen', 'VERB', '', None), ('aus', 'aus', 'ADP', '', None), END)
        self.assertLess(clozes.rank(long_human), clozes.rank(short_llm))


if __name__ == '__main__':
    unittest.main()
