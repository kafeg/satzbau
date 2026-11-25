// Морфология: формы слова из того, что лежит в записи. Всё, что выводится правилом,
// в данных не хранится (docs/data.md), поэтому выводится здесь.

import { adjEnding, auxPresent } from './paradigms.ts'
import type { Adj, Case, Decl, Gender, Noun, Num, Person, Verb } from './types.ts'

const endsAny = (s: string, ends: string[]) => ends.some((e) => s.endsWith(e))

/**
 * Косвенная форма n-Deklination: Automat → Automaten, Junge → Jungen.
 *
 * ⚠ Родительный почти всегда совпадает с винительным (des Nachbarn — den Nachbarn),
 * но не у типа Name: des Namens, а den Namen. Поэтому у родительного на -ns конечное -s
 * снимается, иначе выходит «Ich sehe den Namens». Косвенная форма n-склонения
 * кончается на -n или -en и на -ns не бывает, так что проверка однозначна.
 */
function oblique(n: Noun): string {
  if (n.gen) return n.gen.endsWith('ns') ? n.gen.slice(0, -1) : n.gen
  return n.w.endsWith('e') ? `${n.w}n` : `${n.w}en`
}

/** Слогов в слове: гласные группы. Нужно только чтобы отличить книжное -es источника. */
const syllables = (w: string) => (w.toLowerCase().match(/[aeiouyäöü]+/g) ?? []).length

function genitiveSg(n: Noun): string {
  // ⚠ РОД решает раньше источника. У омонимов значение выбираем мы (`fixes.yaml`:
  // die Leiter — стремянка, а не der Leiter — руководитель), а поле `gen` приезжает
  // из той же строки источника, что и чужой род, — отсюда «der Leiters», «der Steuers»,
  // «der Butters». Женский род в родительном не меняется вовсе.
  if (n.g === 'f') return n.w
  // ⚠ Источник часто даёт книжное -es там, где говорят -s: «des Monates», «des Alarmes».
  // Переспариваем его ТОЛЬКО когда он просто дописал -es к многосложному слову:
  // настоящие особые формы (Herzens, Busses) так не выглядят и остаются как есть.
  if (n.gen) {
    const plainEs = n.gen === `${n.w}es` && !endsAny(n.w, ['s', 'ß', 'x', 'z', 'sch'])
    return plainEs && syllables(n.w) > 1 ? `${n.w}s` : n.gen
  }
  if (n.nd) return oblique(n)
  // ⚠ Здесь НЕТ правила «односложное → -es», хотя оно просится. Проверено на лексиконе:
  // оно чинит Monat и Alarm, но ломает заимствования — Team, Fan, Café, Feuer получают
  // «Teames», «Fanes», «Cafées». Односложность немецкого слова по гласным не считается,
  // а список заимствований — это данные, а не правило. Пока источник молчит, -s.
  return endsAny(n.w, ['s', 'ß', 'x', 'z', 'sch']) ? `${n.w}es` : `${n.w}s`
}

/**
 * Дательный множественного на -n, кроме уже готовых форм.
 *
 * ⚠ Не берут -n не только множественные на -n и -s, но и заимствованные на гласную:
 * «den Visa», «den Praktika», «den Ski», «den Kilo». Правило «-n всему, что не на n/s»
 * давало «Mit guten Visan» и «Mit guten Skin» — ошибка жила латентно, пока не появился
 * первый шаблон на дательный множественного, и тогда уехала прямо в приложение.
 * Немецкие множественные на гласную кончаются только на -e, а она -n как раз берёт
 * («die Tage» → «den Tagen»), поэтому исключение безопасно.
 */
function dativePl(n: Noun): string | null {
  if (n.dpl) return n.dpl
  if (!n.pl) return null
  return endsAny(n.pl, ['n', 's', 'a', 'i', 'o', 'u']) ? n.pl : `${n.pl}n`
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
  // ⚠ Слияние бывает только у основ на -t: halten → hält, и это «halt» плюс слившееся
  // окончание. У основ на -d окончание отдельное: laden → lädt, то есть «läd» плюс -t,
  // и второе лицо — lädst. Пока здесь стояло ['t', 'd'], выходило «du lädtst»
  // у laden, einladen, aufladen, hochladen и herunterladen.
  if (istem.endsWith('t')) return core
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
export function presentForms(v: Verb, person: Person): string[] {
  const part = particle(v)
  const w = v.w.startsWith('sich ') ? v.w.slice(5) : v.w
  const inf = part ? w.slice(part.length) : w        // abholen → holen
  const istem = infStem(inf)                         // hol
  const e = endsAny(istem, ['t', 'd', 'chn', 'ffn', 'gn', 'tm']) ? 'e' : ''
  const du = p3Stem(v, istem)
  // -e- во втором лице появляется только там, где основа не менялась: du wartest,
  // но du hältst и du brätst. Перегласовка сильного глагола съедает беглую e.
  const duE = du === istem ? e : ''
  const forms: Record<Person, string[]> = {
    '1sg': firstSg(inf, istem),
    // после s/ß/z/x второе лицо получает только -t: du isst, du heißt
    '2sg': [`${du}${endsAny(du, ['s', 'ß', 'z', 'x']) ? 't' : `${duE}st`}`],
    '3sg': [v.p3.split(' ')[0] as string],
    '1pl': [inf],
    '2pl': [`${istem}${e}t`],
    '3pl': [inf],
  }
  const fs = forms[person]
  return part ? fs.map((f) => `${f} ${part}`) : fs
}

/**
 * Первое лицо единственного. Форм бывает три, и все три в UniMorph:
 * «ich sammle», «ich sammele», «ich sammel».
 *
 * ⚠ У основ на -el/-er беглая -e выпадает, и словарная форма у -eln именно стянутая
 * (sammle), а у -ern полная (wandere) — так же, как в императиве. Засчитывать одну
 * значило бы считать ошибкой верный ответ: человек пишет то, что слышал.
 * Проверять окончание ОСНОВЫ нельзя — у spielen она тоже на -el, а «spile» не форма.
 */
function firstSg(inf: string, istem: string): string[] {
  const short = `${istem.slice(0, -2)}${istem.slice(-1)}e`   // sammel → sammle
  if (inf.endsWith('eln')) return [short, `${istem}e`, istem]
  if (inf.endsWith('ern')) return [`${istem}e`, short, istem]
  return [`${istem}e`]
}

export function present(v: Verb, person: Person): string {
  return presentForms(v, person)[0] as string
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
  // -e- вставляется после t, d, шипящих, после дифтонга и после гласной с -h: am frühesten.
  // ⚠ Именно ГЛАСНАЯ с h: pünktlich тоже кончается на h, но даёт am pünktlichsten.
  // ⚠ Причастия на -end -e- НЕ получают: am anstrengendsten, не «anstrengendesten».
  // Правило «после t и d» слишком широкое, и это давало «am ansteckendesten»
  // ⚠ -isch — исключение среди шипящих: am typischsten, am stürmischsten, но am hübschesten.
  // Исключение МНОГОСЛОЖНОЕ: односложное frisch ведёт себя как hübsch — am frischesten.
  // ⚠ Ударный дифтонг на конце требует -e-: am neuesten, am genauesten, am blauesten,
  // am barrierefreiesten. Без него выходило «am neusten» — форма принятая, но не словарная.
  const sch = w.endsWith('sch') && !(w.endsWith('isch') && syllables(w) > 1)
  const esten =
    !w.endsWith('end') &&
    (sch || endsAny(w, ['t', 'd', 's', 'ß', 'z']) || /(au|eu|äu|ei|ai|oi|[aeiouäöü]h)$/.test(w))
  return esten ? `am ${w}esten` : `am ${w}sten`
}
