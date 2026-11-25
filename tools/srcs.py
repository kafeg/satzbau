"""Чтение источников из data/raw: только то, что в них написано, без догадок."""
import collections, gzip, json, math, os, re, tarfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'raw')
WORK = os.path.join(ROOT, 'data', 'work')

GENDER = {'masculine': 'm', 'feminine': 'f', 'neuter': 'n'}
ARTICLES = {'der', 'die', 'das', 'den', 'dem', 'des', '—', '-', ''}
STRESS = re.compile('[̀́]')


def raw(name):
    return os.path.join(RAW, name)


def jsonl(path, lang='de'):
    opener = gzip.open if path.endswith('.gz') else open
    needle = f'"lang_code": "{lang}"'
    with opener(path, 'rt', encoding='utf-8') as f:
        for line in f:
            if needle in line:
                r = json.loads(line)
                if r.get('lang_code') == lang:
                    yield r


def _add(xs, x):
    if x and x not in ARTICLES and x not in xs:
        xs.append(x)


def noun_forms(r):
    """Род, множественное и родительный ед. ч. из записи Викисловаря (любого из трёх)."""
    plural, gen = [], []
    for f in r.get('forms', []):
        t, x = set(f.get('tags') or []), (f.get('form') or '').strip()
        if t & {'obsolete', 'archaic', 'dialectal', 'rare', 'table-tags', 'inflection-template',
                'diminutive', 'feminine', 'masculine', 'neuter'} or ' ' in x:
            continue
        if 'plural' in t and ('nominative' in t or t == {'plural'}):
            _add(plural, x)
        if 'genitive' in t and ('singular' in t or t == {'genitive'}):
            _add(gen, x)
    return dict(gender=[GENDER[t] for t in r.get('tags', []) if t in GENDER], plural=plural, gen_sg=gen)


def enwikt_gender(r):
    """У английского Викисловаря род — в заголовке: «Bank f (genitive …, plural …)»."""
    out = []
    for h in r.get('head_templates', []):
        m = re.match(r'^\S+ ((?:[mfn]|pl)(?: (?:or|,) (?:[mfn]|pl))*)\b', h.get('expansion', ''))
        if m:
            for g in re.findall(r'\b([mfn])\b', m.group(1)):
                if g not in out:
                    out.append(g)
    return out


def ru_items(text):
    """«скамья, скамейка; парта» → ['скамья', 'скамейка', 'парта']: только короткие слова."""
    text = STRESS.sub('', re.sub(r'\([^)]*\)|\[[^]]*\]', '', text or ''))
    return [x.strip() for x in re.split(r'[,;]', text) if x.strip() and len(x.split()) <= 3]


def norm(s):
    return STRESS.sub('', s).lower().replace('ё', 'е').strip()


def freedict():
    """lemma → [русские переводы]; .tei читается прямо из tar.xz."""
    out = collections.defaultdict(list)
    with tarfile.open(raw('freedict-deu-rus.src.tar.xz'), 'r:xz') as t:
        for m in t.getmembers():
            if m.name.endswith('.tei'):
                tei = t.extractfile(m).read().decode('utf-8')
                break
    for m in re.finditer(r'<entry.*?</entry>', tei, re.S):
        e = m.group(0)
        o = re.search(r'<orth>([^<]+)</orth>', e)
        if o:
            for q in re.findall(r'<quote>([^<]+)</quote>', e):
                for x in ru_items(q):
                    if x not in out[o.group(1)]:
                        out[o.group(1)].append(x)
    return out


def freq_ranks(form_lemmas):
    """Ранг леммы (lower) по сумме частот её форм. Форма нескольких лемм засчитывается каждой."""
    counts = collections.Counter()
    with open(raw('de_full.txt'), encoding='utf-8') as f:
        for line in f:
            w, _, n = line.rstrip('\n').rpartition(' ')
            if not w or not n.isdigit():
                continue
            ls = form_lemmas.get(w) or (w,)
            for lemma in ls:
                counts[lemma] += int(n) / len(ls)
    return {l: i + 1 for i, (l, _) in enumerate(counts.most_common())}


def bucket(rank):
    """Ранг вверх до сотни в первой тысяче, до тысячи дальше, до 50 000; ниже — None."""
    if not rank or rank > 50000:
        return None
    return math.ceil(rank / 100) * 100 if rank <= 1000 else math.ceil(rank / 1000) * 1000
