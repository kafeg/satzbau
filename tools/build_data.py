#!/usr/bin/env python3
"""Сборка данных: скачанные источники + ручные списки → content/build/*.json.

  .venv/bin/python -I tools/build_data.py              всё
  .venv/bin/python -I tools/build_data.py --no-sents    без предложений Tatoeba (быстро)

Что делает: читает `content/manual/*.yaml` как единственный источник лексикона, достаёт формы
и переводы из источников, накладывает решения из `fixes.yaml`, пишет компактный JSON и отчёт.
Слово из themes.yaml, которому не хватило данных, попадает в отчёт, а не исчезает молча.
"""
import collections, gzip, hashlib, json, os, re, resource, sys, time, unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import govparse, srclib, yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'raw')
MANUAL = os.path.join(ROOT, 'content', 'manual')
OUT = os.path.join(ROOT, 'content', 'build')
KPOS = {'n': 'noun', 'v': 'verb', 'a': 'adj'}
# Помета источника, из-за которой форму брать нельзя: целимся в de-DE
BAD_TAGS = {'obsolete', 'archaic', 'alternative', 'regional', 'Austria', 'Switzerland', 'dialectal'}
T0 = time.time()


# Что даст правило в ядре (`genitiveSg` в morph.ts). Дубль намеренный: сюда кладём
# только то, что правилом НЕ выводится, иначе каждое слово тащило бы лишнее поле.
# Раньше условие выбрасывало и формы на -es, и ядро выдавало «des Bescheids».
def gen_default(lemma, g):
    if g == 'f':
        return lemma
    return lemma + ('es' if lemma.endswith(('s', 'ß', 'x', 'z', 'sch')) else 's')


def log(*a):
    print(f'[{time.time() - T0:5.1f}s]', *a, flush=True)


def raw(name):
    p = os.path.join(RAW, name)
    if not os.path.exists(p):
        sys.exit(f'нет источника {p}\nсначала: python3 -I tools/fetch_sources.py --all')
    return p


def yload(name):
    return yaml.safe_load(open(os.path.join(MANUAL, name), encoding='utf-8'))


# ---------------------------------------------------------------- формы из kaikki

def head_forms(entry):
    """Формы из заголовка статьи (source отсутствует): ровно то, что нужно, без таблиц."""
    return [f for f in (entry.get('forms') or [])
            if f.get('source') is None and not (BAD_TAGS & set(f.get('tags') or []))]


def kform(entry, *tags):
    """Первая форма заголовка, у которой теги ровно эти. Точное равенство, не включение:
    у 'past' и ['past','subjunctive'] иначе совпал бы первый же."""
    want = set(tags)
    for f in head_forms(entry):
        if set(f.get('tags') or []) == want:
            return f['form']
    return None


def pick_entry(entries):
    """Из нескольких статей на лемму берём ту, где есть формы."""
    for e in entries:
        if head_forms(e):
            return e
    return entries[0] if entries else None


# ---------------------------------------------------------------- русский перевод

RU_SKIP = ('рег.', 'устар.', 'прост.')
RU_LABEL = re.compile(r'^(?:[а-я]+\.(?:-[а-я]+\.)?,?\s+)+')  # «юр.», «ж.-д.», «мед., фарм.»
RU_REFL = re.compile(r'^sich\s*~?\s*')
RU_PAREN = re.compile(r'\s*\([^)]*\)')        # пометы и управление: (auf A), (в разн. знач.), (кого-л.)
RU_TAIL = re.compile(r'\s*(во всех значениях|в разн\. знач\.)|\s*в знач\..*$')


def ru_clean(gloss):
    """Одно толкование русского Викисловаря → короткий перевод или None.

    Поля чистки взяты из замеров: служебные значения ловятся полем form_of (выше),
    а здесь текстовые случаи. `мн. ч.` и `ед. ч.` — не мусор, это помета числа,
    поэтому в RU_SKIP их нет.
    """
    g = gloss.strip()
    if any(m in g for m in RU_SKIP):
        return None
    if g.startswith(('женск. к', 'то же, что')):
        if '; ' not in g:
            return None
        g = g.split('; ', 1)[1]
    g = RU_PAREN.sub('', g)
    g = RU_LABEL.sub('', g)
    g = RU_REFL.sub('', g)
    g = RU_TAIL.sub('', g)
    g = re.sub(r'\s+', ' ', g.split(';')[0]).strip(' ,.')
    g = re.sub(r',\s*,', ',', g)
    g = re.sub(r',(?=\S)', ', ', g)
    if len(g) > 60:                      # режем по запятой, а не посередине слова
        g = g[:60].rsplit(',', 1)[0]
    return g.strip(' ,.') or None


def ru_for(lemma, pos, KR, FD):
    for e in KR.get((lemma, KPOS[pos])) or []:
        for s in e.get('senses', []):
            if 'form_of' in s:
                continue
            for g in s.get('glosses', []):
                r = ru_clean(g)
                if r:
                    return r
    fd = FD.get(lemma) or []
    return ', '.join(fd[:2])[:60] or None


# ---------------------------------------------------------------- записи лексикона

def build_noun(w, lemma, GN, K, ru, fixes, rep):
    e = GN.get(lemma)
    ke = pick_entry(K.get((lemma, 'noun')) or [])
    if not e and not ke:
        rep.append((lemma, 'нет ни в nouns.csv, ни в kaikki'))
        return None
    g = (e or {}).get('g') or ''
    g_alt = (e or {}).get('g_alt') or []
    fix = fixes['gender'].get(lemma)
    if fix:
        g = fix['g']
    elif g_alt:
        rep.append((lemma, f'род спорный {g}/{"/".join(g_alt)} — решение в fixes.yaml:gender'))
    pl_only = bool((e or {}).get('pl_only')) or lemma in fixes['pl_only_extra']
    if not g and not pl_only:
        if ke:
            g = {'masculine': 'm', 'feminine': 'f', 'neuter': 'n'}.get(
                next((t for f in head_forms(ke) for t in (f.get('tags') or [])
                      if t in ('masculine', 'feminine', 'neuter')), ''), '')
        if not g:
            rep.append((lemma, 'нет рода'))
            return None
    n = {'w': lemma, 'lv': w['lv']}
    if not pl_only:
        n['g'] = g
    else:
        n['pl_only'] = 1
    # no_plural главнее источника: у Polizei и Post форма в словаре есть, но это
    # либо другое слово (Posten), либо форма, которой в речи не бывает
    pl = fixes['plural'].get(lemma) or (e or {}).get('pl') or (ke and kform(ke, 'plural'))
    if lemma in fixes['no_plural']:
        n['npl'] = 1                      # множественного нет и не должно быть: Hunger, Obst
    elif pl:
        n['pl'] = pl
    elif not pl_only:
        rep.append((lemma, 'нет множественного'))
    gen = (e or {}).get('gen') or (ke and kform(ke, 'genitive'))
    akk = (e or {}).get('akk') or lemma
    manual_nd = fixes['n_declension'].get(lemma)
    if manual_nd:
        akk, gen = manual_nd, manual_nd
    nd = bool(akk and akk != lemma)
    if nd:
        n['nd'] = 1
    # У n-Deklination родительный пишем всегда: вывести его правилом нельзя.
    # Nachbar даёт Nachbarn, а не Nachbaren, и «der Nachbaren» выглядело в заданиях.
    if nd and gen:
        n['gen'] = gen
    # ⚠ Источник иногда даёт родительный, равный лемме, у мужского и среднего:
    # «des Eis» вместо «des Eises». Там правило надёжнее источника
    elif gen and gen != gen_default(lemma, g) and not (g != 'f' and gen == lemma):
        n['gen'] = gen
    # ⚠ Ручное множественное главнее: у Bank источник даёт Bänke от скамьи, и дательное
    # Bänken оставалось от неё же, хотя слово у нас — банк
    dpl = None if lemma in fixes['plural'] else (e or {}).get('dpl')
    if dpl and pl and dpl not in (pl, pl + 'n'):
        n['dpl'] = dpl
    if (e or {}).get('adj_decl') or lemma in fixes['adj_decl_extra']:
        n['adjdecl'] = 1
    if lemma in fixes['plural_in_use']:
        n['plu'] = 1
    if lemma in fixes['mass']:
        n['mass'] = 1
    if ru:
        n['ru'] = ru
    else:
        rep.append((lemma, 'нет перевода'))
    return n


GOV_SKIP_TAGS = {'figuratively', 'colloquial', 'dated', 'archaic', 'rare', 'obsolete',
                 'dialectal', 'regional', 'law', 'nautical', 'military', 'sports'}
GOV_SENSES = 4        # управление берём из первых значений: дальше идёт редкое и переносное


def verb_gov(entry):
    """Управление из raw_glosses. Голый аккузатив не пишем: это обычная переходность.

    Два ограничения, оба проверены на срезе. Голый падеж не берём: «stehen + D» существует
    (jemandem stehen — идти, быть к лицу), но в данных выглядит как правило уровня A2.
    И смотрим только первые значения: дальше в статье идут редкие и переносные,
    у schlafen так приезжало «über A» из «etwas überschlafen».
    """
    out = []
    for s in (entry.get('senses') or [])[:GOV_SENSES]:
        if GOV_SKIP_TAGS & set(s.get('tags') or []):
            continue
        for gl in s.get('raw_glosses') or []:
            for _, alts in govparse.find(gl):
                for alt in alts or []:
                    for sl in alt:
                        # только «предлог + падеж»: голый падеж из данных — шум
                        if sl['kind'] != 'prep_case':
                            continue
                        t = f"{sl['prep']} {sl['case']}"
                        if t not in out:
                            out.append(t)
    return out[:3]


def build_verb(w, lemma, K, ru, fixes, rep, gov_rep, imp=None):
    base = lemma[5:] if lemma.startswith('sich ') else lemma
    ke = pick_entry(K.get((base, 'verb')) or [])
    if not ke:
        rep.append((lemma, 'нет в kaikki — формы брать негде'))
        return None
    p3 = kform(ke, 'present', 'singular', 'third-person')
    pt = kform(ke, 'past')
    pp = kform(ke, 'participle', 'past')
    if not (p3 and pt and pp):
        miss = [n for n, v in (('p3', p3), ('pt', pt), ('pp', pp)) if not v]
        rep.append((lemma, 'нет форм: ' + ', '.join(miss)))
        return None
    aux = sorted({f['form'] for f in head_forms(ke)
                  if f.get('tags') == ['auxiliary'] and f['form'] in ('haben', 'sein')})
    if not aux:
        rep.append((lemma, 'нет aux'))
        return None
    v = {'w': lemma, 'lv': w['lv'], 'p3': p3, 'pt': pt, 'pp': pp,
         'aux': ''.join(a[0] for a in aux)}
    amb = fixes['aux_ambiguous'].get(base)
    if v['aux'] == 'hs':
        if not amb:
            rep.append((lemma, 'aux спорный (haben и sein), нет записи в fixes.yaml:aux_ambiguous'))
        elif amb.get('use'):
            v['aux'] = amb['use']
    if amb and amb.get('note'):
        v['auxn'] = amb['note']
    if base in fixes['reflexive']:
        v['refl'] = 1
    # Принятые формы императива: вывести правилом нельзя, см. read_imperatives.
    # ⚠ У unterschreiben и durchsetzen UniMorph знает ОБА разбора, отделяемый
    # и неотделяемый. Оставляем формы только того, который у нас в p3.
    part = p3.split(' ')[1] if ' ' in p3 else None
    forms = sorted({
        f[: -len(part) - 1] if part else f
        for f in (imp or {}).get(lemma, ())
        if (f.endswith(' ' + part) if part else ' ' not in f)
    })
    if forms:
        v['imp'] = forms
    k2 = kform(ke, 'past', 'subjunctive')
    if k2 and k2 != pt:
        v['k2'] = k2
    # В бандл идёт только подтверждённое руками: разобрать скобку автомат может,
    # а решить, что это управление уровня A1–B1, — нет. На срезе из 8 автоматических
    # пар верны 5: «schlafen über A» и «ankommen auf A» это другие значения.
    gov = fixes['government'].get(base)
    if gov:
        v['gov'] = gov
        # примеры дополнения: список, по одному на предлог. Порядок — порядок заданий
        ex = fixes['government_example'].get(base)
        if ex:
            v['govex'] = [ex] if isinstance(ex, str) else list(ex)
    auto = [g for g in verb_gov(ke) if g not in (gov or [])]
    if auto:
        gov_rep.append((lemma, auto))
    if ru:
        v['ru'] = ru
    else:
        rep.append((lemma, 'нет перевода'))
    return v


def build_adj(w, lemma, K, ru, fixes, rep):
    """Прилагательному kaikki не обязателен: окончания — закрытая парадигма в коде,
    а `cmp`/`sup`/`st` хранятся только при отклонении от правила. У причастий в роли
    прилагательного (`befristet`, `qualifiziert`) отклонений не бывает — для них
    отсутствие статьи ничего не отнимает."""
    a = {'w': lemma, 'lv': w['lv']}
    ke = pick_entry(K.get((lemma, 'adj')) or [])
    if not ke:
        rep.append((lemma, 'нет в kaikki — степени сравнения выводятся правилом'))
    else:
        st = kform(ke, 'masculine', 'nominative', 'singular', 'strong')
        if st and st.endswith('er') and st[:-2] != lemma:
            a['st'] = st[:-2]
        cmp_, sup = kform(ke, 'comparative'), kform(ke, 'superlative')
        stem = a.get('st', lemma)
        if cmp_ and cmp_ != stem + 'er':
            a['cmp'] = cmp_
        if sup and sup not in (f'am {lemma}sten', f'am {lemma}esten', f'am {stem}sten'):
            a['sup'] = sup
    if ru:
        a['ru'] = ru
    else:
        rep.append((lemma, 'нет перевода'))
    return a


# ---------------------------------------------------------------- предложения Tatoeba

# Служебные слова: в лексиконе их нет, но в предложении они допустимы всегда.
FUNC = set((
    'ich du er sie es wir ihr Sie man mich dich ihn uns euch mir dir ihm ihnen sich '
    'der die das den dem des ein eine einen einem einer eines kein keine keinen keinem keiner '
    'mein meine meinen meinem meiner dein deine deinen sein seine seinen ihre ihren unser unsere '
    'nicht und oder aber auch so sehr ja nein noch schon nur sogar denn doch mal wieder immer '
    'was wer wen wem wo wohin woher wie wann warum dass ob wenn weil als obwohl damit '
    'im am zum zur vom beim ins ans in an auf aus bei mit nach seit von zu über unter vor '
    'durch für gegen ohne um hinter neben zwischen '
    'ist bin bist sind seid war waren wäre gewesen hat habe hast haben hatte hatten gehabt '
    'wird werde wirst werden wurde wurden geworden '
    'kann kannst können konnte muss musst müssen musste will willst wollen wollte '
    'soll sollst sollen sollte darf darfst dürfen durfte mag möchte möchten '
    'heute morgen gestern jetzt hier da dort dann oft nie gern viel mehr etwas nichts alles jemand'
).split())
# Имена, которые в немецком предложении выглядят естественно. Остальные отбрасываем:
# английские Mary/John/Ken делают предложение не немецким.
NAMES_OK = set('Tom Maria Anna Julia Lena Emma Peter Hans Klaus Paul Lukas Felix Thomas '
               'Michael Martin Sabine Petra Stefan Monika Berlin Deutschland München Hamburg '
               'Köln Wien Europa Januar Februar März April Mai Juni Juli August September '
               'Oktober November Dezember Montag Dienstag Mittwoch Donnerstag Freitag '
               'Samstag Sonntag'.split())
TOK = re.compile(r"[A-Za-zÄÖÜäöüß]+")
# Отделяемые приставки. Если такая стоит отдельным словом, форма глагола в предложении может
# принадлежать ДРУГОМУ глаголу: «Er stand auf» — это aufstehen (встал), а не stehen (стоял).
PARTICLES = set('auf ab an aus ein mit vor zu nach um weg los her hin bei über unter durch'.split())
NAME_CAP = 2000          # не больше столько примеров на одно имя: иначе весь корпус про Tom
PER_LEMMA = 5


def read_tsv_bz2(path):
    import bz2
    out = {}
    with bz2.open(path, 'rt', encoding='utf-8') as f:
        for line in f:
            p = line.rstrip('\n').split('\t', 2)
            if len(p) == 3:
                out[p[0]] = p[2]
    return out


def read_links(path, de_ids, ru_ids):
    """links.csv внутри tar.bz2 — все языки сразу, 25 млн строк. Читаем потоком."""
    import tarfile
    pairs = collections.defaultdict(list)
    with tarfile.open(path, 'r:bz2') as t:
        m = next(x for x in t.getmembers() if x.name.endswith('.csv'))
        for line in t.extractfile(m):
            a, b = line.decode().split()
            if a in de_ids and b in ru_ids:
                pairs[a].append(b)
    return pairs


def read_unimorph(path, vocab):
    """словоформа → леммы нашего лексикона, которым она принадлежит

    ⚠ Формы бывают из нескольких слов: `räumt auf` у aufräumen, `am ältesten` у alt.
    Резать их на токены целиком нельзя: тогда `auf` становится «формой» слова aufräumen,
    а `am` — формой каждого прилагательного, и предложение «Er kam am Bahnhof an»
    получает в примеры тридцать одну лемму. Служебную часть многословной формы отбрасываем.
    """
    out = collections.defaultdict(set)
    for line in open(path, encoding='utf-8'):
        p = line.rstrip('\n').split('\t')
        if len(p) != 3 or p[0] not in vocab:
            continue
        parts = p[1].split()
        for form in parts:
            if len(parts) > 1 and (form.lower() in PARTICLES or form.lower() in FUNC):
                continue
            out[form].add(p[0])
    return out


def read_imperatives(path, lemmas):
    """лемма → принятые формы императива 2 лица ед. ч., без отделяемой приставки

    Вывести их правилом нельзя: у buchen приняты и «buch», и «buche», а у sitzen
    только «sitz», и никакого признака, отличающего одно от другого, в слове нет.
    Приложение принимает ВСЕ формы из этого списка, иначе верный ответ считался бы
    ошибкой. Для шести глаголов, которых в UniMorph нет, остаётся правило в morph.ts.
    """
    out = collections.defaultdict(set)
    for line in open(path, encoding='utf-8'):
        p = line.rstrip('\n').split('\t')
        if len(p) != 3 or p[2] != 'V;IMP;SG;2' or p[0] not in lemmas:
            continue
        out[p[0]].add(' '.join(p[1].split()))
    return {k: sorted(v) for k, v in out.items()}


def build_sentences(vocab, verbs, rep):
    log('Tatoeba: читаю предложения')
    de = read_tsv_bz2(raw('deu_sentences.tsv.bz2'))
    ru = read_tsv_bz2(raw('rus_sentences.tsv.bz2'))
    log(f'  немецких {len(de)}, русских {len(ru)}; читаю связки')
    pairs = read_links(raw('links.tar.bz2'), set(de), set(ru))
    log(f'  связок de→ru {len(pairs)}; читаю словоформы UniMorph')
    f2l = read_unimorph(raw('unimorph-deu.tsv'), vocab)
    log(f'  словоформ, ведущих к нашим леммам: {len(f2l)}')

    def known(t):
        return (t in FUNC or t.lower() in FUNC or t in vocab or t.lower() in vocab
                or t in NAMES_OK or bool(f2l.get(t)) or bool(f2l.get(t.lower())))

    reasons, kept, seen, names = collections.Counter(), [], set(), collections.Counter()
    for a, bs in pairs.items():
        t = de[a]
        toks = TOK.findall(t)
        if not 3 <= len(toks) <= 8:
            r = 'длина не 3–8'
        elif not re.search(r'[.!?]$', t):
            r = 'нет точки в конце'
        elif t in seen:
            r = 'дубль'
        elif not all(known(x) for x in toks):
            # сюда же уходят чужие имена собственные: Mary, John, Ken в лексиконе не значатся
            r = 'незнакомая словоформа'
        else:
            used = [x for x in toks if x in NAMES_OK and x not in vocab]
            r = 'имя исчерпало квоту' if any(names[x] >= NAME_CAP for x in used) else None
            if not r:
                names.update(used)
        if r:
            reasons[r] += 1
            continue
        seen.add(t)
        kept.append({'i': int(a), 'de': t, 'ru': ru[bs[0]]})

    # Неотделяемые глаголы: у них в p3 нет пробела, значит приставка в предложении — чужая.
    # У отделяемых наоборот: без своей приставки предложение им не принадлежит
    # («Steigen Sie aus?» — это aussteigen, не einsteigen, хотя форма «steigen» общая).
    plain_verbs = {v['w'] for v in verbs if ' ' not in v['p3']}
    sep_particle = {v['w']: v['p3'].split()[-1] for v in verbs if ' ' in v['p3']}
    def lemmas_of(i, t):
        """Леммы, к которым может вести словоформа на позиции i.

        Орфография немецкого даёт здесь строгое правило, и без него привязка врёт
        систематически: слово с большой буквы в середине фразы — существительное,
        а не глагол (`Wein` не ведёт к weinen, `Buch` не ведёт к buchen, `Park`
        не ведёт к parken — это были 67 ошибок на срезе). Слово с маленькой буквы,
        наоборот, существительным быть не может. В начале фразы неоднозначно:
        `Putze deine Zähne` — это глагол, и там правило не применяем.
        Существительные лексикона пишутся с большой буквы, глаголы и прилагательные
        с маленькой, так что проверять часть речи отдельно не нужно.
        """
        cands = (f2l.get(t, set()) | f2l.get(t.lower(), set()) | {t, t.lower()}) & vocab
        if i == 0:
            return cands
        up = t[:1].isupper()
        return {c for c in cands if c[:1].isupper() == up}

    per, capped = collections.Counter(), []
    for s in sorted(kept, key=lambda s: len(s['de'])):
        toks = TOK.findall(s['de'])
        lems = {l for i, x in enumerate(toks) for l in lemmas_of(i, x)}
        low = {x.lower() for x in toks}
        if PARTICLES & low:
            lems -= plain_verbs
        lems -= {v for v, part in sep_particle.items() if v in lems and part not in low}
        if lems and any(per[l] < PER_LEMMA for l in lems):
            s['l'] = sorted(lems)
            capped.append(s)
            per.update(lems)
    capped.sort(key=lambda s: s['i'])
    log(f'  прошло фильтр {len(kept)}, после ограничения {PER_LEMMA} на лемму {len(capped)}')
    no_ex = sorted(vocab - set(per))
    rep['sent_reasons'] = reasons
    rep['sent_no_example'] = no_ex
    rep['sent_names'] = names
    return capped


# ---------------------------------------------------------------- запись

def dump(name, obj):
    """NFC нормализуем один раз здесь: в дампах нашлось нарушение, и ü из двух кодпоинтов
    не совпал бы со введённым с клавиатуры."""
    s = unicodedata.normalize(
        'NFC', json.dumps(obj, ensure_ascii=False, separators=(',', ':'))).encode()
    open(os.path.join(OUT, name), 'wb').write(s + b'\n')
    return len(s), len(gzip.compress(s, 9))


def main():
    no_sents = '--no-sents' in sys.argv
    os.makedirs(OUT, exist_ok=True)
    themes, templates, explain = yload('themes.yaml'), yload('templates.yaml'), yload('explain.yaml')
    fx = yload('fixes.yaml')
    fixes = dict(government=fx.get('government') or {}, gender=fx.get('gender') or {},
                 government_example=fx.get('government_example') or {},
                 plural_in_use=set(fx.get('plural_in_use') or []),
                 plural=fx.get('plural') or {},
                 n_declension=fx.get('n_declension') or {},
                 pl_only_extra=set(fx.get('pl_only_extra') or []),
                 no_plural=set(fx.get('no_plural') or []),
                 mass=set(fx.get('mass') or []),
                 adj_decl_extra=set(fx.get('adj_declined_extra') or []),
                 translations=fx.get('translations') or {},
                 aux_ambiguous=fx.get('aux_ambiguous') or {},
                 reflexive=set(fx.get('reflexive') or []))

    words = [dict(w, theme=th) for th, v in themes.items() for w in v['words']]
    lemmas = {w['w'] for w in words} | {w['w'][5:] for w in words if w['w'].startswith('sich ')}
    log(f'тем {len(themes)}, слов {len(words)}, шаблонов {len(templates)}')

    GN = srclib.read_nouns_csv(raw('nouns.csv'))
    log(f'nouns.csv: {len(GN)} лемм')
    FD = srclib.read_freedict_tei(raw('freedict-deu-rus.src.tar.xz'))
    FQ = srclib.read_freq(raw('de_50k.txt'))
    log('freedict и частотность прочитаны; иду по kaikki (это долго)')
    K = srclib.scan_jsonl(raw('kaikki-de.jsonl'), lemmas)
    log(f'kaikki-de: статей по нашим леммам {sum(len(v) for v in K.values())}')
    KR = srclib.scan_jsonl(raw('kaikki-ru-de.jsonl'), lemmas)
    log(f'kaikki-ru: статей {sum(len(v) for v in KR.values())}')

    IMP = read_imperatives(raw('unimorph-deu.tsv'), lemmas)
    log(f'UniMorph: императив известен у {len(IMP)} глаголов')

    out = {'n': [], 'v': [], 'a': []}
    rep, gov_rep = [], []
    for w in sorted(words, key=lambda w: (FQ.get(w['w'].lower()) or 10 ** 6)):
        lemma, pos = w['w'], w['pos']
        ru = fixes['translations'].get(lemma) or ru_for(
            lemma[5:] if lemma.startswith('sich ') else lemma, pos, KR, FD)
        rec = (build_noun(w, lemma, GN, K, ru, fixes, rep) if pos == 'n' else
               build_verb(w, lemma, K, ru, fixes, rep, gov_rep, IMP) if pos == 'v' else
               build_adj(w, lemma, K, ru, fixes, rep))
        if rec:
            out[pos].append(rec)

    built = {w['w'] for recs in out.values() for w in recs}
    lost = [w['w'] for w in words if w['w'] not in built]

    # Темы ссылаются на лексикон по лемме; порядок внутри темы — по частотности.
    tj = {th: {'title': v['title'],
               'words': [{k: x[k] for k in ('w', 'pos', 'lv', 'tags') if k in x}
                         for x in sorted(v['words'], key=lambda x: FQ.get(x['w'].lower()) or 10 ** 6)
                         if x['w'] in built]}
          for th, v in themes.items()}

    sizes = {}
    for name, obj in (('nouns.json', out['n']), ('verbs.json', out['v']), ('adjs.json', out['a']),
                      ('themes.json', tj), ('templates.json', templates), ('explain.json', explain)):
        sizes[name] = dump(name, obj) + (len(obj),)

    srep = {}
    if no_sents:
        log('предложения пропущены (--no-sents)')
    else:
        sents = build_sentences(built, out['v'], srep)
        sizes['sentences.json'] = dump('sentences.json', sents) + (len(sents),)

    version = hashlib.sha256()
    for name in sorted(sizes):
        version.update(open(os.path.join(OUT, name), 'rb').read())
    meta = {
        'version': version.hexdigest()[:12],
        'built': time.strftime('%Y-%m-%d'),
        'counts': {k: v[2] for k, v in sorted(sizes.items())},
        'license': 'CC BY-SA 4.0',
        'attribution': ['en.wiktionary / kaikki.org (CC BY-SA)',
                        'ru.wiktionary / kaikki.org (CC BY-SA)',
                        'gambolputty/german-nouns (CC BY-SA 4.0)',
                        'UniMorph deu (CC BY-SA 3.0)',
                        'FreeDict deu-rus (CC BY-SA 3.0)',
                        'Tatoeba (CC BY 2.0 FR)',
                        'hermitdave/FrequencyWords (CC BY-SA 4.0)'],
    }
    dump('meta.json', meta)

    # ---- отчёт
    lines = [f'сборка {meta["built"]}, версия данных {meta["version"]}', '',
             f'слов в themes.yaml: {len(words)}; собрано: {len(built)}; потеряно: {len(lost)}', '']
    if lost:
        lines += ['НЕ ПОПАЛИ В СБОРКУ:'] + [f'  {w}' for w in lost] + ['']
    if rep:
        lines += [f'замечания ({len(rep)}):'] + [f'  {w:22} {m}' for w, m in sorted(rep)] + ['']
    if gov_rep:
        lines += [f'управление, предложено источниками ({len(gov_rep)}) — проверить и внести',
                  'в fixes.yaml:government, иначе в бандл не попадёт:']
        lines += [f'  {w:22} {", ".join(g)}' for w, g in sorted(gov_rep)] + ['']
    lines += ['размеры:']
    for name, (s, gz, n) in sorted(sizes.items()):
        lines.append(f'  {name:17} n={n:<6} {s / 1024:8.1f} КиБ   gzip {gz / 1024:7.1f} КиБ')
    tot = sum(v[0] for v in sizes.values()), sum(v[1] for v in sizes.values())
    lines.append(f'  {"ИТОГО":17}        {tot[0] / 1024:8.1f} КиБ   gzip {tot[1] / 1024:7.1f} КиБ')
    if srep:
        lines += ['', 'предложения Tatoeba, отбраковка:']
        lines += [f'  {k:26} {v}' for k, v in srep['sent_reasons'].most_common()]
        lines.append(f'  примеров на имя: ' + ', '.join(
            f'{k} {v}' for k, v in srep['sent_names'].most_common(5)))
        no_ex = srep['sent_no_example']
        lines.append(f'  слов без примеров: {len(no_ex)} из {len(built)}')
        lines += [f'    {", ".join(no_ex[:40])}' + (' …' if len(no_ex) > 40 else '')] if no_ex else []
    text = '\n'.join(lines) + '\n'
    open(os.path.join(OUT, 'report.txt'), 'w', encoding='utf-8').write(text)
    print()
    print(text)
    mb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 2 ** 20
    log(f'готово: {OUT}; память в пике {mb:.0f} МиБ')


if __name__ == '__main__':
    main()
