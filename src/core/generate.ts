// Генератор: шаблон × слово → задание. Задания не хранятся (docs/architecture.md).

import {
  adjEnding,
  auxPresent,
  defArticle,
  govOf,
  govexParts,
  REFLEXIVE,
  WERDEN,
  WUERDE,
  modal,
  type Modal,
  pronoun,
  indefArticle,
  inventory,
  keinArticle,
  merged,
  possessive,
} from './paradigms.ts'
import {
  adjStem,
  comparative,
  imperative,
  imperativeForms,
  nounForm,
  particle,
  present,
  presentForms,
  superlative,
} from './morph.ts'
import type { Word } from './bundle.ts'
import type {
  Adj,
  Case,
  Decl,
  Gender,
  Item,
  Need,
  Noun,
  Num,
  Person,
  Slot,
  Template,
  Verb,
} from './types.ts'

const LEVELS = { A1: 1, A2: 2, B1: 3 } as const
const CASES: Case[] = ['nom', 'akk', 'dat', 'gen']
const CASE_RU: Record<Case, string> = {
  nom: 'именительный',
  akk: 'винительный',
  dat: 'дательный',
  gen: 'родительный',
}
const GENDER_RU: Record<Gender, string> = { m: 'мужской', f: 'женский', n: 'средний' }

/** Признаки записи, по которым шаблон может отказаться от слова (`not` в `need`). */
const FLAGS: Record<string, (e: Noun & Verb & Adj) => boolean> = {
  pl_only: (e) => !!e.pl_only,
  plu: (e) => !!e.plu,
  npl: (e) => !!e.npl,
  nd: (e) => !!e.nd,
  // отделяемый глагол: приставка уедет в конец фразы, и рамка с хвостом сломается
  sep: (e) => !!e.p3?.includes(' '),
  aux_s: (e) => e.aux === 's',
  // только с sich: «Er bewirbt oft» — не немецкий язык
  reflexive: (e) => !!e.refl,
  adjdecl: (e) => !!e.adjdecl,
  mass: (e) => !!e.mass,
  aux_hs: (e) => e.aux === 'hs',
  // два предлога у одного глагола: какой из них нужен, выбирает смысл, а не глагол
  govex2: (e) => (e.govex?.length ?? 0) >= 2,
}

/**
 * Подходит ли слово шаблону. Условия — закрытый список, а не язык запросов.
 * `tags` — ЛЮБОЙ из перечисленных: слово помечено `document` или `thing`, но не обоими.
 */
export function fits(need: Need, w: Word): boolean {
  const e = w.entry as Noun & Verb & Adj
  if (need.pos && need.pos !== w.pos) return false
  if (need.theme && need.theme !== w.theme) return false
  if (need.tags && !need.tags.some((t) => w.tags?.includes(t))) return false
  if (need.g && !(e.g && need.g.includes(e.g))) return false
  if (need.lv_max && LEVELS[w.lv] > LEVELS[need.lv_max]) return false
  // has — и поле записи, и признак: `has: [sep]` это «отделяемый», а не «есть поле sep»
  if (need.has?.some((k) => (FLAGS[k] ? !FLAGS[k](e) : !(k in e)))) return false
  for (const f of need.not ?? []) {
    const flag = FLAGS[f]
    if (flag ? flag(e) : w.tags?.includes(f)) return false
  }
  return true
}

/**
 * ⚠ Разбор пишется ОДИН на правило, а правило охватывает разные ветки: у perfekt-aux
 * это haben и sein, у Partizip II — четыре способа. Текст «глагол движения» стоял
 * в шагах жёстко и врал на 73 заданиях из 85. Ветку считаем по самому заданию.
 */
function auxWhy(v: Verb): string {
  return v.aux === 's'
    ? 'глагол движения или смены состояния'
    : 'обычный глагол: ни движения, ни смены состояния'
}

function partizipWhy(v: Verb): string {
  const pp = v.pp
  if (pp.endsWith('iert')) return 'глагол на -ieren: ge- не ставится'
  // ⚠ Отделяемый проверяется ПЕРВЫМ: «ausgefüllt» не начинается с ge-, и проверка
  // на неотделяемую приставку объявляла его неотделяемым
  if (!pp.startsWith('ge') && pp.includes('ge')) {
    return 'отделяемый: ge- встаёт между приставкой и основой'
  }
  if (!pp.startsWith('ge')) return 'неотделяемая приставка: ge- не ставится'
  if (pp.endsWith('en')) return 'сильный глагол: окончание -en, а не -t'
  return 'обычный глагол: ge- + основа + -t'
}

/** Предлоги с двумя падежами: у них падеж задаёт вопрос, а не сам предлог. */
const WECHSEL = ['in', 'an', 'auf', 'über', 'unter', 'vor', 'hinter', 'neben', 'zwischen']

/**
 * ⚠ Почему в задании Dativ — зависит от предлога РАМКИ, а не от правила: у `in` падеж
 * задаёт вопрос wo?, у `mit` — сам предлог, всегда. Текст стоял один на оба, и на рамке
 * «Ich fahre mit dem neuen Auto» разбор говорил про предлог in, которого в задании нет.
 */
function dativWhy(prep: string): string {
  if (!prep) return 'Dativ здесь требует глагол, а не предлог'
  return WECHSEL.includes(prep)
    ? `предлог ${prep} с вопросом wo? → Dativ`
    : `предлог ${prep} всегда требует Dativ`
}

/**
 * ⚠ Склонение выводится из артикля, который стоит в рамке, а не из имени правила:
 * на `adj-dat-en-neu` текст звал определённый `dem` неопределённым и объявлял
 * слабое склонение смешанным.
 */
function declWhy(decl: Decl | undefined, article: string): string {
  if (decl === 'mixed') return `${article} — неопределённый артикль, значит смешанное склонение`
  if (decl === 'strong') return 'артикля перед прилагательным нет, значит сильное склонение'
  return `${article} — определённый артикль, значит слабое склонение`
}

/**
 * ⚠ «Нет -t» верно только в единственном числе: во множественном модальный спрягается
 * как все, и подсказка «können, не „könnent“» выдумывала несуществующее слово.
 */
function modalHint(person: Person, answer: string): string {
  if (person === '1sg' || person === '3sg') return `${answer}, не «${answer}t»`
  if (person === '2sg') return `${answer} — окончание -st, как у обычных глаголов`
  return `во множественном модальный обычный: ${answer}`
}

/**
 * Подлежащее для выбранного лица: рамка его не фиксирует.
 *
 * ⚠ У третьего лица множественного здесь НЕ «sie». Местоимение `sie` читается и как
 * «она», и как «они», поэтому «Sie werden morgen gehen» допускает оба ответа — werden
 * и wird, — и оба лежат среди вариантов. Человек отвечал верно и получал минус:
 * 253 задания в одиннадцати шаблонах. «Die beiden» снимает двусмысленность, оставляя
 * форму третьего лица множественного на месте.
 */
const SUBJECT: Record<Person, string> = {
  '1sg': 'ich',
  '2sg': 'du',
  '3sg': 'er',
  '1pl': 'wir',
  '2pl': 'ihr',
  '3pl': 'die beiden',
}
const PERSONS = Object.keys(SUBJECT) as Person[]
const PERSON_RU: Record<Person, string> = {
  '1sg': 'первое лицо единственного',
  '2sg': 'второе лицо единственного',
  '3sg': 'третье лицо единственного',
  '1pl': 'первое лицо множественного',
  '2pl': 'второе лицо множественного',
  '3pl': 'третье лицо множественного',
}

/**
 * ⚠ Лицо ВЫВОДИТСЯ из пары «шаблон + слово», а не стоит в рамке. Иначе ответ один
 * на весь шаблон: «Ich ___ morgen arbeiten» всегда werde, и со второго задания
 * его дают не думая. Журнал по-прежнему хранит пару, и задание из неё восстановимо.
 */
function personOf(slot: Slot, w: Word, tid: string): Person {
  if (slot.person !== 'from_word') return slot.person ?? '3sg'
  let h = 2166136261
  for (const ch of `${tid}:${w.w}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return PERSONS[h % PERSONS.length] as Person
}

/** Слот с подставленным лицом: дальше по коду лицо уже конкретное. */
type Fixed = Omit<Slot, 'person'> & { person?: Person }
const fixSlot = (t: Template, w: Word): Fixed => {
  const { person, ...rest } = t.slot
  return person ? { ...rest, person: personOf(t.slot, w, t.id) } : rest
}

/**
 * ⚠ Возвращает null, а НЕ бросает. Род есть не у всех: у pl_only-слов (Leute, Eltern,
 * Schulden) его нет вовсе. Бросок отсюда уходил в `fillingFor`, то есть в `rules()`,
 * то есть на главный экран: одно новое слово без рода под подходящим тегом — и вместо
 * приложения показывался Boundary. Несобираемое сочетание должно просто выпадать
 * из наполнения, как любое другое.
 */
function genderOf(slot: Slot, w: Word, w2?: Word | null): Gender | null {
  if (slot.gender && slot.gender !== 'from_word' && slot.gender !== 'from_fill2') {
    return slot.gender
  }
  // прилагательное согласуется с существительным, а оно во втором слоте
  const from = slot.gender === 'from_fill2' ? w2 : w
  return from ? ((from.entry as Noun).g ?? null) : null
}

/** Применяет функцию к роду, если род известен. Нет рода — нет формы, а не исключение. */
const nn = (g: Gender | null, f: (g: Gender) => string | null): string | null => (g ? f(g) : null)

/** Форма в пропуске для заданного падежа. null — такого сочетания в парадигме нет. */
function slotForm(slot: Fixed, w: Word, c: Case, w2?: Word | null): string | null {
  const num: Num = slot.num ?? 'sg'
  if (slot.gender === 'from_fill2' && !w2) return null
  // Род нужен не всем парадигмам, поэтому спрашивается лениво. Во множественном
  // артикли и окончания у всех трёх родов одинаковы (`defArticle`, `adjEnding`),
  // так что слово без рода там собирается нормально.
  const gender = (): Gender | null => (num === 'pl' ? 'm' : genderOf(slot, w, w2))
  switch (slot.paradigm) {
    case 'def_article':
      return nn(gender(), (g) => defArticle(c, g, num))
    case 'indef_article':
      return num === 'pl' ? null : nn(gender(), (g) => indefArticle(c, g))
    case 'possessive':
      return nn(gender(), (g) => possessive(c, g, num))
    case 'kein_article':
      return nn(gender(), (g) => keinArticle(c, g, num))
    // формы самого слова: вариантов у них нет, это всегда ввод
    case 'noun_plural':
      return nounForm(w.entry as Noun, c, 'pl')
    // само существительное в падеже: нужно n-склонению, где форма отличается
    case 'noun_case':
      return nounForm(w.entry as Noun, c, num)
    case 'imperative':
      return imperative(w.entry as Verb)
    case 'reflexive_pronoun':
      return REFLEXIVE[slot.person ?? '3sg']
    case 'werden_present':
      return WERDEN[slot.person ?? '3sg']
    case 'wuerde':
      return WUERDE[slot.person ?? '3sg']
    // «nicht» рядом с kein: вариант один, а вот выбрать между ними — и есть задание
    case 'nicht':
      return 'nicht'
    case 'participle':
      return (w.entry as Verb).pp
    case 'modal_present':
      return modal(slot.modal as Modal, slot.person ?? '3sg')
    case 'verb_past':
      return (w.entry as Verb).pt
    // в предикативе прилагательное стоит в словарной форме, без всякого окончания
    case 'pronoun':
      return nn(gender(), (g) => pronoun(c === 'dat' ? 'dat' : 'akk', g, num))
    case 'adj_predicative':
      return (w.entry as Adj).w
    // пропуск — сам предлог, который требует глагол: свойство слова, а не шаблона.
    // Берётся из примера управления (их бывает два — какой, говорит nth), и этот
    // пример в данных написан руками (fixes.yaml)
    case 'verb_prep': {
      const v = w.entry as Verb
      const ex = v.govex?.[(slot.nth ?? 1) - 1]
      return ex ? (govexParts(v.gov ?? [], ex)?.prep ?? null) : null
    }
    case 'adj_comparative':
      return comparative(w.entry as Adj)
    case 'adj_superlative':
      return superlative(w.entry as Adj)
    case 'verb_present':
      return present(w.entry as Verb, slot.person ?? '3sg')
    // спрягаемая часть отделяемого глагола: приставка уезжает в конец фразы
    case 'verb_stem':
      return present(w.entry as Verb, slot.person ?? '3sg').split(' ')[0] ?? null
    case 'merged_prep_article':
      return nn(genderOf(slot, w), (g) => merged(slot.prep as string, c, g))
    case 'adj_ending':
      return nn(gender(), (g) => adjEnding(slot.decl ?? 'weak', c, g, num))
    case 'aux_present': {
      const v = w.entry as Verb
      // 'hs' — источник даёт оба вспомогательных, значение не выбрано: задания нет
      if (v.aux === 'hs') return null
      return auxPresent(slot.person ?? '3sg', v.aux)
    }
    default:
      throw new Error(`неизвестная парадигма: ${slot.paradigm}`)
  }
}

/**
 * Все формы, которые ввод обязан засчитать. Касается только `input`: у выбора вариант
 * один по построению.
 *
 * ⚠ «Hol das!» и «Hole das!» верны обе, «ich sammle» и «ich sammele» тоже. Засчитывать
 * одну значило бы считать ошибкой верный ответ — человек пишет то, что слышал.
 * Какие формы приняты, решает UniMorph, а не наше чувство языка: у императива они
 * приезжают полем `imp`, у Präsens считаются правилом и проверены против источника.
 */
function otherForms(t: Template, slot: Fixed, w: Word): string[] | null {
  if (t.kind !== 'input') return null
  const p = slot.paradigm
  const person = slot.person ?? '3sg'
  if (p === 'imperative') return imperativeForms(w.entry as Verb)
  if (p === 'verb_present') return presentForms(w.entry as Verb, person)
  // спрягаемая часть отделяемого: приставка уехала в конец фразы, в пропуске её нет
  if (p === 'verb_stem')
    return presentForms(w.entry as Verb, person).map((f) => f.split(' ')[0] as string)
  if (p === 'participle') {
    const v = w.entry as Verb
    return v.ppa ? [v.pp, ...v.ppa] : null
  }
  if (p === 'adj_comparative') return (w.entry as Adj).cmps ?? null
  if (p === 'adj_superlative') return (w.entry as Adj).sups ?? null
  // ⚠ Дательное множественное считается от показанной формы (`dativePl`), и у второго
  // множественного оно своё: «Saunen → Saunen», но «Saunas → Saunas». Поэтому варианты
  // отдаём только там, где в рамке стоит само множественное.
  if (p === 'noun_plural' && slot.case !== 'dat') {
    const n = w.entry as Noun
    return n.pla ? [n.pl as string, ...n.pla] : null
  }
  return null
}

/** Детерминированный порядок вариантов: одно и то же задание всегда выглядит одинаково. */
function shuffle<T>(xs: T[], seed: string): T[] {
  let h = 2166136261
  for (const ch of seed) h = (Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0)
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    h = (Math.imul(h, 48271) + 11) >>> 0
    const j = h % (i + 1)
    ;[out[i], out[j]] = [out[j] as T, out[i] as T]
  }
  return out
}

/**
 * Варианты ответа — из инвентаря форм парадигмы, а не «то же слово в других падежах»:
 * иначе у женского рода набор вырождается в два дубля и два верных ответа. Формы,
 * которые были бы верны для этого же слова в других падежах, идут первыми: именно они
 * и есть настоящая ошибка, а не случайная буква.
 */
function buildOptions(t: Template, w: Word, answer: string, slot: Fixed, w2?: Word | null): string[] {
  const count = t.options?.count ?? 4
  // у управления «близкая» форма — другой предлог ТОГО ЖЕ глагола: это ровно та ошибка,
  // которую надо поймать, поэтому он всегда среди вариантов
  const nearPrep =
    slot.paradigm === 'verb_prep'
      ? ((w.entry as Verb).gov ?? [])
          .map((g) => govOf(g)?.prep)
          .filter((p): p is string => !!p && p !== answer)
      : []
  // у «nicht или kein» противоположный вид обязан быть среди вариантов: иначе
  // выбирать не из чего, и правило не тренируется вовсе
  const nearNeg =
    t.options?.paradigm === 'negation'
      ? [
          slotForm(
            { ...slot, paradigm: slot.paradigm === 'nicht' ? 'kein_article' : 'nicht' },
            w,
            slot.case ?? 'nom',
            w2,
          ),
        ].filter((f): f is string => !!f && f !== answer)
      : []
  // ⚠ У задания про РОД близкая форма — другой род, а не другой падеж: иначе
  // вариантами шли den/dem/des, и выбор рода подменялся выбором падежа
  const near =
    t.options?.paradigm === 'genus'
      ? []
      : [
          ...nearNeg,
          ...nearPrep,
          ...CASES.filter((c) => c !== slot.case)
            .map((c) => slotForm(slot, w, c, w2))
            .filter((f): f is string => !!f && f !== answer),
        ]
  // ⚠ Дистрактор, с которым фраза тоже верна, — это второй правильный ответ.
  // У n-склонения и во множественном формы слова совпадают: «Ich helfe dem Kollegen»
  // и «den Kollegen» оба немецкие, а число рамка не задаёт. Падеж задаёт глагол,
  // поэтому опасно только другое ЧИСЛО при том же падеже.
  const kase = slot.case ?? 'nom'
  const other: Num = slot.num === 'pl' ? 'sg' : 'pl'
  // ⚠ В именительном число задаёт глагол рамки: «Die Koffer ist neu» не фраза, поэтому
  // там второго верного ответа не бывает. В остальных падежах рамка число не задаёт
  const written =
    w.pos === 'n' && kase !== 'nom' ? nounForm(w.entry as Noun, kase, slot.num ?? 'sg') : null
  const alsoRight =
    written && nounForm(w.entry as Noun, kase, other) === written
      ? slotForm({ ...slot, num: other }, w, kase, w2)
      : null
  const all = inventory(t.options?.paradigm ?? slot.paradigm, {
    prep: t.options?.prep ?? slot.prep,
    person: slot.person,
    modal: slot.modal as Modal | undefined,
    word: w.w,
  })
  // ⚠ Остаток инвентаря перемешивается, а не берётся по порядку: у парадигм с большим
  // инвентарём (тринадцать предлогов управления) первые три формы иначе становятся
  // дистракторами ВСЕГДА, и задание угадывается, не читая фразу. Порядок детерминирован.
  const rest = shuffle(
    all.filter((f) => f !== answer && f !== alsoRight && !near.includes(f)),
    `${t.id}${w.w}rest`,
  )
  const picked = [answer, ...new Set([...near, ...rest])]
    .filter((f) => f === answer || f !== alsoRight)
    .slice(0, count)
  return shuffle(picked, t.id + w.w)
}

function nounIn(w: Word, slot: Slot): string {
  const form = nounForm(w.entry as Noun, slot.case ?? 'nom', slot.num ?? 'sg')
  if (!form) throw new Error(`${w.w}: нет формы для ${slot.case} ${slot.num ?? 'sg'}`)
  return form
}

/** Слово в том виде, в каком оно стоит во фразе шаблона. */
function wordIn(w: Word, slot: Slot): string {
  if (w.pos === 'n') return nounIn(w, slot)
  if (w.pos === 'a') return adjStem(w.entry as Adj)
  return (w.entry as Verb).w
}

/**
 * Второе слово ВЫВОДИТСЯ из пары «шаблон + слово», а не выбирается случайно: иначе
 * задание перестало бы восстанавливаться из журнала, где хранится именно пара.
 * Слово той же темы в приоритете — тогда фраза остаётся про то, что человек выбрал.
 */
export function second(t: Template, w: Word, all: Word[]): Word | null {
  if (!t.fill2) return null
  const fits2 = all.filter((x) => x.w !== w.w && fits(t.fill2!.need, x))
  if (!fits2.length) return null
  const mine = fits2.filter((x) => x.theme === w.theme)
  const pool = mine.length ? mine : fits2
  let h = 2166136261
  for (const ch of t.id + w.w) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return pool[h % pool.length] as Word
}

export function generate(t: Template, w: Word, all: Word[] = []): Item {
  const w2 = second(t, w, all)
  const slot = fixSlot(t, w)
  const person = slot.person ?? '3sg'
  const answer = slotForm(slot, w, slot.case ?? 'nom', w2)
  if (answer === null) throw new Error(`${t.id} × ${w.w}: форма в пропуске не существует`)
  const g = w.pos === 'n' || slot.gender === 'from_fill2' ? genderOf(slot, w, w2) : null
  const word = wordIn(w, slot)
  // подлежащему нужен именительный, даже когда пропуск в другом падеже:
  // «Der Automaten ist weg» вылезало на n-склонении, где винительный другой
  const wordNom = wordIn(w, { ...slot, case: 'nom' })
  const pp = w.pos === 'v' ? (w.entry as Verb).pp : ''
  // {v1} и {v3} — спрягаемая часть без приставки, {pre} и {obj} — то, что в примере
  // управления стоит до предлога и после: предлог стоит в пропуске
  const vb = w.pos === 'v' ? (w.entry as Verb) : null
  const gx = vb?.govex?.[(slot.nth ?? 1) - 1]
  const parts = vb && gx ? govexParts(vb.gov ?? [], gx) : null
  const subj = SUBJECT[person] as string
  const vp = vb ? (present(vb, person).split(' ')[0] ?? '') : ''
  const v1 = vb ? (present(vb, '1sg').split(' ')[0] ?? '') : ''
  const v3 = vb ? (present(vb, '3sg').split(' ')[0] ?? '') : ''
  const pre = parts?.pre ?? ''
  const obj = parts?.obj ?? ''
  const mich = vb?.refl ? 'mich' : ''
  const preps = (vb?.gov ?? [])
    .map((g) => govOf(g)?.prep)
    .filter(Boolean)
    .join(' и ')
  const govCase = slot.paradigm === 'verb_prep' ? (parts?.case ?? null) : null
  const part = w.pos === 'v' ? (particle(w.entry as Verb) ?? '') : ''
  const g2 = w2?.pos === 'n' ? (w2.entry as Noun).g : undefined
  const case2 = t.fill2?.case ?? 'akk'
  const num2 = t.fill2?.num ?? 'sg'
  const word2 = w2 ? wordIn(w2, { paradigm: '', case: case2, num: num2 }) : ''
  const art2 = g2 ? defArticle(case2, g2, num2) : ''
  const ein2 = g2 && num2 !== 'pl' ? indefArticle(case2, g2) : ''
  const plain = g ? defArticle(slot.case ?? 'nom', g, slot.num ?? 'sg') : ''
  const nom = g ? defArticle('nom', g, slot.num ?? 'sg') : ''
  const ein = g && slot.num !== 'pl' ? indefArticle(slot.case ?? 'nom', g) : ''
  const article =
    g && slot.decl
      ? slot.decl === 'mixed'
        ? ein
        : slot.decl === 'weak'
          ? plain
          : ''
      : plain
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)
  const nomArticle = g ? defArticle('nom', g, slot.num ?? 'sg') : ''
  // {art} и {ein} — артикль, согласованный с родом слова и падежом слота. Без них артикль
  // приходится писать в рамку буквально, и шаблон вынужден фиксировать род условием.
  const fill = (s: string, slotText: string) =>
    s.replace('{slot}', slotText)
      .replace('{Slot}', cap(slotText))
      .replace('{art}', plain)
      .replace('{Art}', cap(plain))
      // {nom} — артикль в именительном: подлежащему он нужен независимо от падежа слота
      .replace('{nom}', nom)
      .replace('{Nom}', cap(nom))
      .replace('{ein}', ein)
      .replace('{Ein}', cap(ein))
      .replace('{w2}', word2)
      .replace('{art2}', art2)
      .replace('{Art2}', cap(art2))
      .replace('{ein2}', ein2)
      .replace('{Ein2}', cap(ein2))
      .replace('{wnom}', wordNom)
      .replace('{Wnom}', cap(wordNom))
      .replace('{w}', word)
      .replace('{W}', word.charAt(0).toUpperCase() + word.slice(1))
      .replace('{pp}', pp)
      .replace('{particle}', part)
      .replace('{subj}', subj)
      .replace('{Subj}', cap(subj))
      .replace('{vp}', vp)
      .replace('{v1}', v1)
      .replace('{v3}', v3)
      .replace('{mich}', mich)
      .replace('{pre}', pre)
      .replace('{obj}', obj)
      // пустые подстановки оставляют двойные пробелы: одна рамка управления служит
      // и отделяемому, и возвратному, и глаголу с прямым дополнением
      .replace(/\s+/g, ' ')
      .replace(/ ([.?!])/g, '$1')
  return {
    templateId: t.id,
    rule: t.rule,
    level: t.level,
    kind: t.kind,
    text: fill(t.frame, '___'),
    full: fill(t.frame, answer),
    answer,
    options: t.kind === 'choice' ? buildOptions(t, w, answer, slot, w2) : undefined,
    ...(() => {
      const fs = otherForms(t, slot, w)
      return fs && fs.length > 1 ? { answers: fs } : {}
    })(),
    word: w.w,
    ...(w2 ? { word2: w2.w } : {}),
    theme: w.theme,
    ru: (w.entry as Noun).ru,
    why: t.why,
    ctx: {
      w: w.w,
      // ⚠ Форма слова, какой она стоит В РАМКЕ, отдельно от леммы. Шаги разбора
      // делают две разные вещи: «{w} — средний род» требует словарную форму,
      // а «die guten {wform}» — ту, что человек видит во фразе. С одним {w}
      // разбор строил «die guten Auto» при задании «die guten Autos»;
      // {w2} в объяснении давал «teuere» там, где в рамке стоит «teure».
      wform: word,
      w2: w2?.w ?? '',
      w2form: word2,
      particle: part,
      answer,
      pp,
      prep: slot.prep ?? t.options?.prep ?? '',
      obj,
      preps,
      // у управления падеж задаёт не шаблон, а сама связка: «warten auf» это всегда Akkusativ
      case_ru: CASE_RU[govCase ?? slot.case ?? 'nom'],
      question: slot.case === 'akk' ? 'wohin?' : 'wo?',
      gender_ru: g ? GENDER_RU[g] : '',
      nom_article: nomArticle,
      // ⚠ Бейдж рода у слова в дрилле — подсказка, но когда ответ и ЕСТЬ артикль
      // в именительном, он называет ответ вслух: так было и в «der, die или das»,
      // и в «Nominativ: подлежащее». Условие структурное, а не по имени правила:
      // совпал с ответом — не показываем. Разбору тот же артикль нужен всегда
      // (он подсвечивает колонку таблицы), поэтому поля разные.
      badge: nomArticle.toLowerCase() === answer.toLowerCase() ? '' : nomArticle,
      plain_article: plain,
      ein,
      aux_why: vb ? auxWhy(vb) : '',
      pp_why: vb ? partizipWhy(vb) : '',
      person_ru: PERSON_RU[person],
      degree_ru: slot.paradigm === 'adj_superlative' ? 'превосходная' : 'сравнительная',
      // пример к шагу про умлаут обязан стоять в ТОЙ ЖЕ степени, что и задание
      degree_example: slot.paradigm === 'adj_superlative' ? 'alt → am ältesten' : 'alt → älter',
      dativ_why: dativWhy(slot.prep ?? ''),
      // ⚠ Артикль к СЛОВАРНОЙ форме: в рамке множественного `nom_article` это «die»,
      // и шаг «die Automat — мужской род» называл слово чужим артиклем
      lemma_article: g ? defArticle('nom', g, 'sg') : nomArticle,
      decl_why: declWhy(slot.decl, article),
      modal_hint: modalHint(person, answer),
      // ⚠ У женского рода и во множественном родительный окончания НЕ даёт:
      // «das Auto der Mutter». Сравниваем форму из рамки со словарной.
      gen_ending_why:
        word === w.w ? 'а само слово не меняется' : 'и у слова появляется окончание',
      article,
      ru: (w.entry as Noun).ru ?? '',
    },
  }
}

/**
 * Все слова, которые шаблон может взять.
 *
 * ⚠ `second()` зовётся РОВНО ОДИН раз на слово. Раньше их было два на каждое слово,
 * и на четырёх шаблонах с `fill2` это удваивало самую дорогую часть подбора.
 */
export function fillingFor(t: Template, all: Word[]): Word[] {
  return all.filter((w) => {
    if (!fits(t.need, w)) return false
    const w2 = second(t, w, all)
    if (t.fill2 && w2 === null) return false
    return slotForm(fixSlot(t, w), w, t.slot.case ?? 'nom', w2) !== null
  })
}

/** Все задания шаблона. Их столько, сколько подходящих слов. */
export function itemsFor(t: Template, all: Word[]): Item[] {
  return fillingFor(t, all).map((w) => generate(t, w, all))
}
