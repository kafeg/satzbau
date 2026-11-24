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
  // ⚠ Женский род в родительном НЕ меняется: der Reise, не «der Reises».
  // Окончание получают только мужской и средний. Это давало «das Auto der Bedienungs».
  if (n.g === 'f') return n.w
  // -es у основ на s/ß/x/z/sch, иначе -s. Где источник даёт другое, оно лежит в gen
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

const UMLAUT: Record<string, string> = { ä: 'a', ö: 'o', ü: 'u' }
const deumlaut = (x: string) => x.replace(/[äöü]/g, (c) => UMLAUT[c] as string)

/**
 * Императив второго лица: «Mach das!», «Gib das!», «Fahr!».
 *
 * Перегласовка в императив НЕ идёт (du fährst, но fahr!), а смена гласной e→i идёт
 * (du gibst → gib!). Отличить их можно так: если основа третьего лица — это основа
 * инфинитива с перегласовкой, берём инфинитив; иначе третье лицо и есть ответ.
 * Беглая -e остаётся только там, где основа не менялась: arbeite!, öffne!, но gib!
 * Проверяется против UniMorph, см. `src/core/__fixtures__/imperative.json`.
 */
export function imperativeForms(v: Verb): string[] {
  // ⚠ Какие формы приняты, знает только источник: у buchen это «buch» и «buche»,
  // у sitzen только «sitz», и признака, отличающего одно от другого, в слове нет.
  // Поэтому список приходит из UniMorph в данных, а правило ниже — запасной путь
  // для шести глаголов, которых в источнике нет.
  const part = particle(v)
  const w = v.w.startsWith('sich ') ? v.w.slice(5) : v.w
  const inf = part ? w.slice(part.length) : w
  const istem = infStem(inf)
  const du = p3Stem(v, istem)
  // ⚠ Сравниваем обе основы без умляутов: у öffnen и lüften умляут В САМОЙ основе,
  // и сравнение «основа 3 лица без умляута против инфинитива» теряло беглую -e.
  // Смена гласной e→i даёт ровно одну форму: gib, не «gibe».
  if (deumlaut(du) !== deumlaut(istem)) return v.imp?.length ? v.imp : [du]
  // ⚠ У основ на -el приняты все три формы: bastle (норма словаря), bastele, bastel.
  // Засчитывать одну значило бы считать ошибкой правильный ответ.
  // -eln и -ern: словарная форма с выпавшей -e (bastle). Проверять окончание основы
  // нельзя — spielen тоже даёт основу на -el, а «spile» не форма
  const byRule = inf.endsWith('eln')
    ? `${istem.slice(0, -2)}le`
    : inf.endsWith('ern')
      ? `${istem}e`
      : // беглая -e обязательна после t/d и стечения согласных, в остальном её нет
        `${istem}${endsAny(istem, ['t', 'd', 'chn', 'ffn', 'gn', 'tm']) ? 'e' : ''}`
  if (!v.imp?.length) return [byRule]
  // первой идёт та форма, которую показывает задание: правило выбирает словарную
  return v.imp.includes(byRule) ? [byRule, ...v.imp.filter((f) => f !== byRule)] : v.imp
}

/** Форма, которую показывает задание. Остальные принятые — в `imperativeForms`. */
export function imperative(v: Verb): string {
  return imperativeForms(v)[0] as string
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

/**
 * ⚠ Превосходная берёт ПОЛНОЕ слово, а не основу: сравнительная у teuer и dunkel
 * выбрасывает -e- (teurer, dunkler), а превосходная нет — am teuersten, am dunkelsten.
 */
export function superlative(a: Adj): string {
  if (a.sup) return a.sup
  const w = a.w
  // -e- вставляется после t, d, шипящих и после гласной с -h: am frühesten.
  // ⚠ Именно ГЛАСНАЯ с h: pünktlich тоже кончается на h, но даёт am pünktlichsten.
  // ⚠ Причастия на -end -e- НЕ получают: am anstrengendsten, не «anstrengendesten».
  // Правило «после t и d» слишком широкое, и это давало «am ansteckendesten»
  const esten =
    !w.endsWith('end') && (endsAny(w, ['t', 'd', 's', 'ß', 'z', 'sch']) || /[aeiouäöü]h$/.test(w))
  return esten ? `am ${w}esten` : `am ${w}sten`
}
