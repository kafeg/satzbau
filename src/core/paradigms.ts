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

// Неопределённый артикль во множественном не существует — отсюда отдельный тип.
export const INDEF_ARTICLE: Record<Case, Record<Gender, string>> = {
  nom: { m: 'ein', f: 'eine', n: 'ein' },
  akk: { m: 'einen', f: 'eine', n: 'ein' },
  dat: { m: 'einem', f: 'einer', n: 'einem' },
  gen: { m: 'eines', f: 'einer', n: 'eines' },
}

/** Обязательные слияния. Их восемь, разговорные aufs/fürs/ums не тренируем. */
const MERGES: Record<string, Partial<Record<Case, Partial<Record<Gender, string>>>>> = {
  in: { dat: { m: 'im', n: 'im' }, akk: { n: 'ins' } },
  an: { dat: { m: 'am', n: 'am' }, akk: { n: 'ans' } },
  zu: { dat: { m: 'zum', f: 'zur', n: 'zum' } },
  von: { dat: { m: 'vom', n: 'vom' } },
  bei: { dat: { m: 'beim', n: 'beim' } },
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
  return INDEF_ARTICLE[c][g]
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
export function inventory(paradigm: string, p: { prep?: string; person?: Person } = {}): string[] {
  switch (paradigm) {
    case 'def_article':
      return uniq(Object.values(DEF_ARTICLE).flatMap((row) => Object.values(row)))
    case 'indef_article':
      return uniq(Object.values(INDEF_ARTICLE).flatMap((row) => Object.values(row)))
    case 'aux_present': {
      const row = AUX_PRESENT[p.person ?? '3sg']
      return [row.haben, row.sein]
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
