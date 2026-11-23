// Морфология: формы слова из того, что лежит в записи. Всё, что выводится правилом,
// в данных не хранится (docs/data.md), поэтому выводится здесь.

import { adjEnding, auxPresent } from './paradigms.ts'
import type { Adj, Case, Decl, Gender, Noun, Num, Person, Verb } from './types.ts'

const endsAny = (s: string, ends: string[]) => ends.some((e) => s.endsWith(e))

/** Косвенная форма существительного n-Deklination: Automat → Automaten, Junge → Jungen. */
function oblique(n: Noun): string {
  if (n.gen) return n.gen
  return n.w.endsWith('e') ? `${n.w}n` : `${n.w}en`
}

function genitiveSg(n: Noun): string {
  if (n.gen) return n.gen
  if (n.nd) return oblique(n)
  // -es у односложных и у основ на s/ß/x/z, иначе -s
  return endsAny(n.w, ['s', 'ß', 'x', 'z', 'sch']) ? `${n.w}es` : `${n.w}s`
}

/** Дательный множественного всегда на -n, кроме множественного на -s. */
function dativePl(n: Noun): string | null {
  if (n.dpl) return n.dpl
  if (!n.pl) return null
  return endsAny(n.pl, ['n', 's']) ? n.pl : `${n.pl}n`
}

export function nounForm(n: Noun, c: Case, num: Num = 'sg'): string | null {
  if (num === 'pl') {
    if (!n.pl) return null
    return c === 'dat' ? dativePl(n) : n.pl
  }
  if (n.pl_only) return null
  switch (c) {
    case 'nom':
      return n.w
    case 'akk':
    case 'dat':
      return n.nd ? oblique(n) : n.w
    case 'gen':
      return genitiveSg(n)
  }
}

/** Основа инфинитива: wohnen → wohn, sammeln → sammel, tun → tu. */
function infStem(w: string): string {
  if (w.endsWith('en')) return w.slice(0, -2)
  if (w.endsWith('n')) return w.slice(0, -1)
  return w
}

/** Отделяемая приставка видна по пробелу в p3: `holt ab` → ab. */
export function particle(v: Verb): string | null {
  const parts = v.p3.split(' ')
  return parts.length > 1 ? (parts.at(-1) as string) : null
}

/**
 * Основа второго лица единственного: та же, что у третьего, с перегласовкой (fährt → fähr).
 *
 * Три случая, и все три проверяются тестом против UniMorph:
 *   `wartet`  → `wart`   слабый глагол с -et: срезаем -et;
 *   `hält`    → `hält`   основа инфинитива уже на t/d, и t третьего лица с ней слилась;
 *   `holt`    → `hol`    обычный случай.
 */
function p3Stem(v: Verb, istem: string): string {
  const core = v.p3.split(' ')[0] as string
  if (core.endsWith('et')) return core.slice(0, -2)
  if (endsAny(istem, ['t', 'd'])) return core
  if (core.endsWith('t')) return core.slice(0, -1)
  return core
}

/**
 * Präsens Indikativ по правилу из `p3` и инфинитива.
 *
 * Перегласовка сильных глаголов есть только во 2 и 3 лице единственного (du fährst,
 * er fährt — но ich fahre, ihr fahrt), поэтому `ich`, `wir`, `ihr` считаются от инфинитива,
 * а `du` — от основы p3. Иначе выходило бы «ich fähre».
 */
export function present(v: Verb, person: Person): string {
  const part = particle(v)
  const w = v.w.startsWith('sich ') ? v.w.slice(5) : v.w
  const inf = part ? w.slice(part.length) : w        // abholen → holen
  const istem = infStem(inf)                         // hol
  const e = endsAny(istem, ['t', 'd', 'chn', 'ffn', 'gn', 'tm']) ? 'e' : ''
  const du = p3Stem(v, istem)
  // -e- во втором лице появляется только там, где основа не менялась: du wartest,
  // но du hältst и du brätst. Перегласовка сильного глагола съедает беглую e.
  const duE = du === istem ? e : ''
  const forms: Record<Person, string> = {
    '1sg': `${istem}e`,
    // после s/ß/z/x второе лицо получает только -t: du isst, du heißt
    '2sg': `${du}${endsAny(du, ['s', 'ß', 'z', 'x']) ? 't' : `${duE}st`}`,
    '3sg': v.p3.split(' ')[0] as string,
    '1pl': inf,
    '2pl': `${istem}${e}t`,
    '3pl': inf,
  }
  return part ? `${forms[person]} ${part}` : forms[person]
}

/** Perfekt: вспомогательный берём из таблицы, а не выводим правилом — он нерегулярный. */
export function perfekt(v: Verb, person: Person, aux?: 'h' | 's'): string {
  const use = aux ?? (v.aux === 'hs' ? 'h' : v.aux)
  return `${auxPresent(person, use)} ${v.pp}`
}

/** Основа прилагательного перед окончанием: hoch → hoh, dunkel → dunkl. */
export function adjStem(a: Adj): string {
  return a.st ?? a.w
}

export function adjForm(a: Adj, decl: Decl, c: Case, g: Gender, num: Num = 'sg'): string {
  return `${adjStem(a)}${adjEnding(decl, c, g, num)}`
}

export function comparative(a: Adj): string {
  return a.cmp ?? `${adjStem(a)}er`
}

export function superlative(a: Adj): string {
  if (a.sup) return a.sup
  const stem = adjStem(a)
  return endsAny(stem, ['t', 'd', 's', 'ß', 'z', 'sch']) ? `am ${stem}esten` : `am ${stem}sten`
}
