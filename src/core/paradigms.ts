// Закрытые парадигмы. В данных их нет и быть не должно: это таблицы, а не лексика.
//
// У каждой парадигмы две функции: форма по параметрам и ИНВЕНТАРЬ всех различных форм.
// Инвентарь нужен для вариантов ответа: брать «то же слово в других падежах» нельзя,
// у женского рода такой набор вырождается (Nom die, Akk die, Dat der, Gen der).

import type { Case, Decl, Gender, Num, Person } from './types.ts'

type ByGender = Record<Gender | 'pl', string>

export const DEF_ARTICLE: Record<Case, ByGender> = {
  nom: { m: 'der', f: 'die', n: 'das', pl: 'die' },
  akk: { m: 'den', f: 'die', n: 'das', pl: 'die' },
  dat: { m: 'dem', f: 'der', n: 'dem', pl: 'den' },
  gen: { m: 'des', f: 'der', n: 'des', pl: 'der' },
}

// Склонение ein-слов: ein, kein, mein/dein/sein. Таблица одна на всех, различается
// только основа — и это ровно то, что человеку надо понять один раз.
// У `ein` множественного числа не бывает, у `kein` и `mein` бывает.
const EIN_ENDING: Record<Case, ByGender> = {
  nom: { m: '', f: 'e', n: '', pl: 'e' },
  akk: { m: 'en', f: 'e', n: '', pl: 'e' },
  dat: { m: 'em', f: 'er', n: 'em', pl: 'en' },
  gen: { m: 'es', f: 'er', n: 'es', pl: 'er' },
}

const CASES: Case[] = ['nom', 'akk', 'dat', 'gen']
const GENDERS: Gender[] = ['m', 'f', 'n']

export function einWord(stem: string, c: Case, g: Gender, num: Num = 'sg'): string {
  return stem + EIN_ENDING[c][num === 'pl' ? 'pl' : g]
}

/** Обязательные слияния. Их восемь, разговорные aufs/fürs/ums не тренируем. */
const MERGES: Record<string, Partial<Record<Case, Partial<Record<Gender, string>>>>> = {
  in: { dat: { m: 'im', n: 'im' }, akk: { n: 'ins' } },
  an: { dat: { m: 'am', n: 'am' }, akk: { n: 'ans' } },
  zu: { dat: { m: 'zum', f: 'zur', n: 'zum' } },
  von: { dat: { m: 'vom', n: 'vom' } },
  bei: { dat: { m: 'beim', n: 'beim' } },
}

/**
 * Модальные глаголы. Их нет в лексиконе и быть не может: они не принадлежат ни одной
 * теме, это грамматика. Таблица закрытая, как артикли.
 *
 * ⚠ Главное в ней — то, чего НЕТ: в единственном числе у модальных нет -t в третьем
 * лице (er kann, не «er kannt») и гласная там другая, чем в инфинитиве.
 */
export const MODALS = {
  können: ['kann', 'kannst', 'kann', 'können', 'könnt', 'können'],
  müssen: ['muss', 'musst', 'muss', 'müssen', 'müsst', 'müssen'],
  wollen: ['will', 'willst', 'will', 'wollen', 'wollt', 'wollen'],
  dürfen: ['darf', 'darfst', 'darf', 'dürfen', 'dürft', 'dürfen'],
  sollen: ['soll', 'sollst', 'soll', 'sollen', 'sollt', 'sollen'],
  mögen: ['mag', 'magst', 'mag', 'mögen', 'mögt', 'mögen'],
} as const satisfies Record<string, readonly string[]>

export type Modal = keyof typeof MODALS
const PERSONS: Person[] = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl']

export function modal(m: Modal, person: Person): string {
  return MODALS[m][PERSONS.indexOf(person)] as string
}

/** Личные местоимения третьего лица. Род берётся у предмета, а не у человека. */
const PRONOUN: Record<'akk' | 'dat', ByGender> = {
  akk: { m: 'ihn', f: 'sie', n: 'es', pl: 'sie' },
  dat: { m: 'ihm', f: 'ihr', n: 'ihm', pl: 'ihnen' },
}

/**
 * Предлоги, которые встречаются в управлении глаголов на A1–B1. Закрытый список:
 * из него берутся дистракторы, и «не тот предлог» — это и есть тренируемая ошибка.
 */
export const GOV_PREPS = [
  'an', 'auf', 'aus', 'bei', 'für', 'gegen', 'in', 'mit', 'nach', 'über', 'um', 'von', 'zu',
] as const

/** Запись управления в предлог и падеж: «auf A» → auf + винительный. */
/**
 * Разбор примера дополнения на части: «das Geld auf das Konto» → до предлога, предлог,
 * после. Предлог ищется по управлению самого глагола, поэтому прямое дополнение перед
 * ним предлогом не считается. Падеж приходит из управления, не из предлога: auf бывает
 * и с Dativ, а в связке он зафиксирован.
 */
export function govexParts(
  gov: string[],
  ex: string,
): { pre: string; prep: string; obj: string; case: Case } | null {
  const preps = new Map<string, Case>()
  for (const g of gov) {
    const p = govOf(g)
    if (p) preps.set(p.prep, p.case)
  }
  const toks = ex.split(' ')
  const i = toks.findIndex((t) => preps.has(t))
  if (i < 0) return null
  const prep = toks[i] as string
  return {
    pre: toks.slice(0, i).join(' '),
    prep,
    obj: toks.slice(i + 1).join(' '),
    case: preps.get(prep) as Case,
  }
}

export function govOf(gov: string): { prep: string; case: Case } | null {
  const [prep, c] = gov.split(' ')
  if (!prep || !c || !GOV_PREPS.includes(prep as (typeof GOV_PREPS)[number])) return null
  return { prep, case: c === 'A' ? 'akk' : c === 'D' ? 'dat' : 'gen' }
}

export function pronoun(c: 'akk' | 'dat', g: Gender, num: Num = 'sg'): string {
  return PRONOUN[c][num === 'pl' ? 'pl' : g]
}

/** Возвратное местоимение: закрытая таблица, выводить нечего. */
export const REFLEXIVE: Record<Person, string> = {
  '1sg': 'mich',
  '2sg': 'dich',
  '3sg': 'sich',
  '1pl': 'uns',
  '2pl': 'euch',
  '3pl': 'sich',
}

/**
 * werden и würde — закрытые таблицы. На них стоят сразу три правила: Futur I
 * (werden + инфинитив), Konjunktiv II (würde + инфинитив) и Passiv (werden + Partizip II).
 * Сам глагол werden в лексиконе не нужен: он служебный и ни одной теме не принадлежит.
 */
export const WERDEN: Record<Person, string> = {
  '1sg': 'werde',
  '2sg': 'wirst',
  '3sg': 'wird',
  '1pl': 'werden',
  '2pl': 'werdet',
  '3pl': 'werden',
}

export const WUERDE: Record<Person, string> = {
  '1sg': 'würde',
  '2sg': 'würdest',
  '3sg': 'würde',
  '1pl': 'würden',
  '2pl': 'würdet',
  '3pl': 'würden',
}

export const AUX_PRESENT: Record<Person, { haben: string; sein: string }> = {
  '1sg': { haben: 'habe', sein: 'bin' },
  '2sg': { haben: 'hast', sein: 'bist' },
  '3sg': { haben: 'hat', sein: 'ist' },
  '1pl': { haben: 'haben', sein: 'sind' },
  '2pl': { haben: 'habt', sein: 'seid' },
  '3pl': { haben: 'haben', sein: 'sind' },
}

// Окончания прилагательных: три склонения. Ключ — падеж, затем род или множественное.
const ADJ: Record<Decl, Record<Case, ByGender>> = {
  // после определённого артикля: der gute Mann
  weak: {
    nom: { m: 'e', f: 'e', n: 'e', pl: 'en' },
    akk: { m: 'en', f: 'e', n: 'e', pl: 'en' },
    dat: { m: 'en', f: 'en', n: 'en', pl: 'en' },
    gen: { m: 'en', f: 'en', n: 'en', pl: 'en' },
  },
  // без артикля: guter Wein
  strong: {
    nom: { m: 'er', f: 'e', n: 'es', pl: 'e' },
    akk: { m: 'en', f: 'e', n: 'es', pl: 'e' },
    dat: { m: 'em', f: 'er', n: 'em', pl: 'en' },
    gen: { m: 'en', f: 'er', n: 'en', pl: 'er' },
  },
  // после ein/kein/mein: ein guter Mann
  mixed: {
    nom: { m: 'er', f: 'e', n: 'es', pl: 'en' },
    akk: { m: 'en', f: 'e', n: 'es', pl: 'en' },
    dat: { m: 'en', f: 'en', n: 'en', pl: 'en' },
    gen: { m: 'en', f: 'en', n: 'en', pl: 'en' },
  },
}

const uniq = (xs: string[]): string[] => [...new Set(xs)]

export function defArticle(c: Case, g: Gender, num: Num = 'sg'): string {
  return DEF_ARTICLE[c][num === 'pl' ? 'pl' : g]
}

export function indefArticle(c: Case, g: Gender): string {
  return einWord('ein', c, g)
}

/** Притяжательное `mein`. Остальные (dein, sein…) — та же таблица, другая основа. */
export function possessive(c: Case, g: Gender, num: Num = 'sg'): string {
  return einWord('mein', c, g, num)
}

export function keinArticle(c: Case, g: Gender, num: Num = 'sg'): string {
  return einWord('kein', c, g, num)
}

function einInventory(stem: string, plural: boolean): string[] {
  const out = CASES.flatMap((c) => GENDERS.map((g) => einWord(stem, c, g)))
  if (plural) out.push(...CASES.map((c) => einWord(stem, c, 'm', 'pl')))
  return uniq(out)
}

export function adjEnding(decl: Decl, c: Case, g: Gender, num: Num = 'sg'): string {
  return ADJ[decl][c][num === 'pl' ? 'pl' : g]
}

/** Склеенная форма предлога с артиклем или null, если это сочетание не склеивается. */
export function merged(prep: string, c: Case, g: Gender): string | null {
  return MERGES[prep]?.[c]?.[g] ?? null
}

export function auxPresent(person: Person, aux: 'h' | 's'): string {
  const row = AUX_PRESENT[person]
  return aux === 'h' ? row.haben : row.sein
}

/**
 * Инвентарь форм парадигмы: все различные формы, из которых берутся варианты ответа.
 * Для слияний инвентарь включает и НЕСКЛЕЕННЫЕ формы (`in dem`, `in das`): это самый
 * полезный дистрактор, потому что ошибка «не склеил» и есть то, что тренируется.
 */
export function inventory(
  paradigm: string,
  p: { prep?: string; person?: Person; modal?: Modal; word?: string } = {},
): string[] {
  switch (paradigm) {
    case 'def_article':
      return uniq(Object.values(DEF_ARTICLE).flatMap((row) => Object.values(row)))
    // ⚠ Единственная парадигма, зависящая от слова: в предикативе верное — само
    // прилагательное, а ошибки — это окончания, которые рука дописывает по привычке.
    case 'adj_predicative': {
      const w = p.word
      if (!w) throw new Error('adj_predicative: нужно слово')
      // ⚠ У прилагательных на -e окончание приходит вместо неё: müde → müden,
      // а не «müdeen». Иначе дистракторы не похожи на настоящую ошибку.
      const base = w.endsWith('e') ? w.slice(0, -1) : w
      return uniq([w, `${base}e`, `${base}en`, `${base}es`, `${base}er`])
    }
    case 'indef_article':
      return einInventory('ein', false)
    case 'pronoun':
      return uniq([...Object.values(PRONOUN.akk), ...Object.values(PRONOUN.dat)])
    case 'verb_prep':
      return [...GOV_PREPS]
    case 'possessive':
      return einInventory('mein', true)
    case 'kein_article':
      return einInventory('kein', true)
    case 'reflexive_pronoun':
      return uniq(Object.values(REFLEXIVE))
    // варианты — формы того же werden в других лицах: ошибка в лице, а не в выборе глагола
    case 'werden_present':
      return uniq(Object.values(WERDEN))
    case 'wuerde':
      return uniq(Object.values(WUERDE))
    // выбор «nicht или kein» — это один инвентарь на оба: иначе по виду вариантов
    // видно, какой ответ нужен, и думать не о чем
    case 'negation':
      return uniq(['nicht', ...einInventory('kein', true)])
    case 'aux_present': {
      const row = AUX_PRESENT[p.person ?? '3sg']
      return [row.haben, row.sein]
    }
    // варианты — формы ТОГО ЖЕ модального в других лицах: ошибка в лице, а не в выборе
    // глагола. Какой модальный нужен по смыслу, задание не спрашивает.
    case 'modal_present': {
      if (!p.modal) throw new Error('modal_present: нужен modal')
      return uniq([...MODALS[p.modal]])
    }
    case 'merged_prep_article': {
      const prep = p.prep
      if (!prep) throw new Error('merged_prep_article: нужен prep')
      const table = MERGES[prep] ?? {}
      const out: string[] = []
      for (const [c, byGender] of Object.entries(table)) {
        for (const [g, form] of Object.entries(byGender ?? {})) {
          if (!form || out.includes(form)) continue
          out.push(form)
          out.push(`${prep} ${DEF_ARTICLE[c as Case][g as Gender]}`)
        }
      }
      return uniq(out)
    }
    default:
      throw new Error(`неизвестная парадигма: ${paradigm}`)
  }
}

/** Обратный разбор окончания прилагательного: где такое окончание возможно. */
export function adjEndingMatches(ending: string): { decl: Decl; case: Case; gender: Gender | 'pl' }[] {
  const out: { decl: Decl; case: Case; gender: Gender | 'pl' }[] = []
  // порядок обхода — он же порядок ответа: слабое склонение и Nominativ первыми,
  // потому что `die kleine Wohnung` человек встречает раньше, чем `kleiner Wein`
  for (const decl of ['weak', 'mixed', 'strong'] as Decl[]) {
    for (const c of ['nom', 'akk', 'dat', 'gen'] as Case[]) {
      for (const g of ['f', 'm', 'n', 'pl'] as (Gender | 'pl')[]) {
        if (ADJ[decl][c][g] === ending) out.push({ decl, case: c, gender: g })
      }
    }
  }
  return out
}

export interface FormMatch {
  case: Case
  gender: Gender | 'pl'
  decl?: Decl
}

/**
 * Обратный разбор любой формы: где она возможна. Это строка «чем был твой вариант»
 * в разборе ошибки — `der` сам по себе не ошибка, он просто другой падеж и род.
 */
export function formMatches(
  paradigm: string,
  form: string,
  o: { decl?: Decl; prep?: string } = {},
): FormMatch[] {
  const out: FormMatch[] = []
  const cases = CASES
  const genders: (Gender | 'pl')[] = [...GENDERS, 'pl']
  switch (paradigm) {
    case 'def_article':
      for (const c of cases)
        for (const g of genders) if (DEF_ARTICLE[c][g] === form) out.push({ case: c, gender: g })
      return out
    case 'indef_article':
    case 'possessive':
    case 'kein_article': {
      const stem = paradigm === 'indef_article' ? 'ein' : paradigm === 'possessive' ? 'mein' : 'kein'
      const cols: (Gender | 'pl')[] = paradigm === 'indef_article' ? ['m', 'f', 'n'] : genders
      for (const c of cases)
        for (const g of cols)
          if (einWord(stem, c, g === 'pl' ? 'm' : g, g === 'pl' ? 'pl' : 'sg') === form)
            out.push({ case: c, gender: g })
      return out
    }
    case 'merged_prep_article': {
      const prep = o.prep ?? ''
      for (const c of cases)
        for (const g of ['m', 'f', 'n'] as Gender[])
          if (merged(prep, c, g) === form || `${prep} ${DEF_ARTICLE[c][g]}` === form)
            out.push({ case: c, gender: g })
      return out
    }
    case 'adj_ending':
      return adjEndingMatches(form).filter((m) => !o.decl || m.decl === o.decl)
    default:
      return out
  }
}
