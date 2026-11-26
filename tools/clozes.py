"""Фраза для пропуска (docs/app.md, «Подача»): подача «во фразе» спрашивает поле слова пропуском в настоящей фразе.

Род: слово стоит первым с определённым артиклем в единственном числе. Тогда артикль равен роду,
и проверка однозначна без разметки падежа: «Der Frau» (дательный) и «Die Tische» (множественное)
отсекаются сами. Фраза не должна выдавать род: без er, sie, es, sein, ihr, без местоимений с родом
в разметке (meiner, keiner, относительные der, die, das) и без того же слова ещё раз.
Фраза Tatoeba — первой, потом с переводом человека, потом короче.
"""
ART = {'m': 'Der', 'f': 'Die', 'n': 'Das'}
GIVES = {'er', 'ihn', 'ihm', 'sie', 'es', 'sein', 'seine', 'seinen', 'seinem', 'seiner', 'seines',
         'ihr', 'ihre', 'ihren', 'ihrem', 'ihrer', 'ihres', 'dessen', 'deren'}
RELATIVE = {'der', 'die', 'das', 'dem', 'den', 'des'}


def gender_gap(word, s):
    """Номер токена-пропуска во фразе s для рода слова word или None."""
    tok = s['tok']
    if len(word['gender']) != 1 or len(tok) < 3:
        return None
    art, noun = tok[0], tok[1]
    if art[0] != ART[word['gender'][0]] or noun[4] != word['id'] or noun[0] != word['lemma'] or 'Number=Plur' in noun[3]:
        return None
    for text, _, upos, morph, ref in tok[2:]:
        low = text.lower()
        if low in GIVES or ref == word['id'] or text == word['lemma'] or (upos == 'PRON' and (low in RELATIVE or 'Gender=' in morph)):
            return None
    return 0


def rank(s):
    """Чем меньше, тем лучше: фраза Tatoeba, перевод человека, любой русский, короче."""
    ru = s.get('ru')
    return (not str(s.get('id', '')).startswith('t:'), not (ru and str(s.get('ru_by', '')).startswith('tatoeba:')), not ru, len(s['tok']))
