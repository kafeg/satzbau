// Разбор ошибки: шаги правила, таблица по родам и строка «чем был твой вариант».
// Текст приходит из данных, таблица считается по парадигме — в данных её нет.

import { getBundle, getWords } from '../core/bundle.ts'
import { explainItem } from '../core/explain.ts'
import {
  adjEnding,
  defArticle,
  formMatches,
  indefArticle,
  keinArticle,
  merged,
  personMatches,
  possessive,
  type FormMatch,
} from '../core/paradigms.ts'
import { imperativeForms, present } from '../core/morph.ts'
import type { Modal } from '../core/paradigms.ts'
import type { Case, Gender, Item, Num, Person, Template, Verb } from '../core/types.ts'

const CASES: Case[] = ['nom', 'akk', 'dat', 'gen']
const COLS: (Gender | 'pl')[] = ['m', 'f', 'n', 'pl']
const CASE_NAME: Record<Case, string> = {
  nom: 'Nominativ',
  akk: 'Akkusativ',
  dat: 'Dativ',
  gen: 'Genitiv',
}
const COL_NAME: Record<Gender | 'pl', string> = { m: 'der', f: 'die', n: 'das', pl: 'мн. ч.' }
const OF: Record<Gender | 'pl', string> = {
  m: 'мужского рода',
  f: 'женского рода',
  n: 'среднего рода',
  pl: 'множественного числа',
}
export const CASE_CLASS: Record<Case, string> = { nom: '', akk: 'akk', dat: 'dat', gen: 'gen' }

// Таблица по родам есть только у склонений. У форм самого слова (множественное,
// причастие, спряжение) рода нет, и строить из них таблицу нечего.
const TABLE = new Set([
  'def_article',
  'indef_article',
  'adj_ending',
  'merged_prep_article',
  'possessive',
  'kein_article',
])

function cell(t: Template, c: Case, g: Gender | 'pl'): string {
  const num: Num = g === 'pl' ? 'pl' : 'sg'
  const gg = (g === 'pl' ? 'm' : g) as Gender
  switch (t.slot.paradigm) {
    case 'def_article':
      return defArticle(c, gg, num)
    case 'indef_article':
      return num === 'pl' ? '—' : indefArticle(c, gg)
    case 'possessive':
      return possessive(c, gg, num)
    case 'kein_article':
      return keinArticle(c, gg, num)
    case 'adj_ending':
      return `-${adjEnding(t.slot.decl ?? 'weak', c, gg, num)}`
    case 'merged_prep_article': {
      const p = t.slot.prep ?? ''
      return merged(p, c, gg) ?? `${p} ${defArticle(c, gg, num)}`
    }
    default:
      return ''
  }
}

/** Колонка таблицы, в которой стоит слово задания. */
function columnOf(item: Item, t: Template): Gender | 'pl' | null {
  if (t.slot.num === 'pl') return 'pl'
  const a = item.ctx.nom_article
  return a === 'der' ? 'm' : a === 'die' ? 'f' : a === 'das' ? 'n' : null
}

const SHORT: Record<Gender | 'pl', string> = {
  m: 'мужского',
  f: 'женского',
  n: 'среднего',
  pl: 'множественного числа',
}

/** «мужского или среднего рода», но «женского рода или множественного числа». */
function genderList(gs: (Gender | 'pl')[]): string {
  if (gs.length === 1) return OF[gs[0] as Gender | 'pl']
  // множественное — не род, и общее слово «рода» на него не натягивается
  if (gs.includes('pl')) return gs.map((g) => OF[g]).join(' или ')
  return `${gs.map((g) => SHORT[g]).join(' или ')} рода`
}

/**
 * «Dativ мужского или среднего рода»: группируем по ПАДЕЖУ, он здесь главная ось.
 * ⚠ С группировкой по роду выходило «Dativ мужского рода, Dativ среднего рода» —
 * одно и то же сказано дважды.
 */
function readable(ms: FormMatch[]): string {
  const byCase = new Map<Case, (Gender | 'pl')[]>()
  for (const m of ms.slice(0, 4)) {
    const got = byCase.get(m.case)
    if (got) got.push(m.gender)
    else byCase.set(m.case, [m.gender])
  }
  return [...byCase].map(([c, gs]) => `${CASE_NAME[c]} ${genderList(gs)}`).join(', ')
}

const PERSON_RU: Record<Person, string> = {
  '1sg': 'я',
  '2sg': 'ты',
  '3sg': 'он, она, оно',
  '1pl': 'мы',
  '2pl': 'вы',
  '3pl': 'они',
}

const PERSONS: Person[] = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl']

/**
 * Лица, в которых стоит введённая форма. Закрытые таблицы знает `personMatches`,
 * а спряжение обычного глагола считается по слову задания.
 *
 * ⚠ Строка «чем был твой вариант» молчала везде, где нет склонения по родам:
 * человек писал «müssen» вместо «muss» или инфинитив вместо третьего лица
 * и получал минус без единого слова о том, что он написал.
 */
function personsOf(item: Item, t: Template, given: string): Person[] {
  return personMatches(t.slot.paradigm, given, { modal: t.slot.modal as Modal | undefined })
}

/**
 * Как называется та форма слова, которую человек ввёл. Только для глагольных парадигм:
 * там пропуск — это форма целиком, и ошибка почти всегда не мусор, а соседняя форма
 * того же глагола — инфинитив вместо третьего лица, настоящее вместо Präteritum.
 */
function verbFormName(item: Item, t: Template, given: string): string | null {
  if (!VERB_SLOT.has(t.slot.paradigm)) return null
  const v = getWords().find((w) => w.w === item.word)?.entry as Verb | undefined
  if (!v || given === item.answer) return null
  const head = (x: string) => x.split(' ')[0] as string
  const ps = PERSONS.filter((x) => head(present(v, x)) === given)
  // ⚠ Инфинитив называем инфинитивом, хотя формально он же — «мы» и «они». Человек,
  // написавший словарную форму, сделал именно эту ошибку, и «это мы или они» её прячет.
  const inf = given === v.w || given === head(v.w) || given === head(v.w.replace(/^sich /, ''))
  if (inf) return ps.length ? 'инфинитив, он же форма для «мы» и «они»' : 'инфинитив'
  if (ps.length) return `настоящее время, ${readablePersons(ps)}`
  if (given === head(v.pp)) return 'причастие — форма для Perfekt'
  if (given === head(v.pt)) return 'Präteritum — прошедшее время'
  if (imperativeForms(v).some((f) => head(f) === given)) return 'повелительное наклонение'
  return null
}

const VERB_SLOT = new Set(['verb_present', 'verb_stem', 'verb_past', 'participle', 'imperative'])

/** «это ты» / «это мы или они»: лица одной строкой. */
function readablePersons(ps: Person[]): string {
  return ps.map((x) => PERSON_RU[x]).join(' или ')
}

export function Explain({ item, given }: { item: Item; given?: string }) {
  const e = explainItem(item)
  const t = getBundle().templates.find((x) => x.id === item.templateId)
  const wrong = given !== undefined && given !== item.answer
  const matches = wrong && t
    ? formMatches(t.slot.paradigm, given, { decl: t.slot.decl, prep: t.slot.prep })
    : []
  const col = t ? columnOf(item, t) : null
  const ending = t?.slot.paradigm === 'adj_ending'
  const row = t?.slot.case ?? 'nom'
  // лица считаем только там, где по родам ничего не нашлось: иначе две строки об одном
  const persons = wrong && t && !matches.length && given ? personsOf(item, t, given) : []
  const verbForm =
    wrong && t && !matches.length && !persons.length && given
      ? verbFormName(item, t, given)
      : null
  // ⚠ Предикатив — единственная парадигма, где ошибка это ЛИШНЕЕ окончание, а не чужая
  // форма: «das Auto ist kleines». Сказать про него нечего кроме того, что его не нужно.
  // ⚠ Обратная сторона «nicht или kein»: в задании на kein человек пишет nicht.
  // По таблице это не разбирается — отрицания две разные вещи, и сказать надо именно это.
  const nichtInstead = t?.slot.paradigm === 'kein_article' && given === 'nicht'
  const extraEnding =
    t?.slot.paradigm === 'adj_predicative' &&
    !matches.length &&
    !!given &&
    given.length > item.answer.length &&
    given.startsWith(item.answer.replace(/e$/, ''))

  return (
    <section className="explain">
      <h2>{e.title}</h2>
      <p className="mono short">{e.short}</p>
      <ol className="steps">
        {e.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>

      {wrong && matches.length > 0 ? (
        <p className="yours">
          <span className="mono">{ending ? `-${given}` : given}</span> — это {readable(matches)}
        </p>
      ) : (
        wrong &&
        (persons.length > 0 ? (
          <p className="yours">
            <span className="mono">{given}</span> — это {readablePersons(persons)}
          </p>
        ) : nichtInstead ? (
          <p className="yours">
            <span className="mono">nicht</span> отрицает глагол или прилагательное,
            а здесь отрицается существительное: нужен{' '}
            <span className="mono">{item.answer}</span>
          </p>
        ) : verbForm ? (
          <p className="yours">
            <span className="mono">{given}</span> — это {verbForm}
          </p>
        ) : (
          extraEnding && (
            <p className="yours">
              <span className="mono">{given}</span> — прилагательное с окончанием, а после
              ist оно стоит без него: {item.answer}
            </p>
          )
        ))
      )}

      {t && TABLE.has(t.slot.paradigm) && (
        <table className="forms">
          <thead>
            <tr>
              <th />
              {COLS.map((g) => (
                <th key={g} className="mono">
                  {COL_NAME[g]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CASES.map((c) => (
              <tr key={c} className={c === row ? `active ${CASE_CLASS[c]}` : undefined}>
                <th>{CASE_NAME[c]}</th>
                {COLS.map((g) => (
                  <td key={g} className={`mono${c === row && g === col ? ' here' : ''}`}>
                    {cell(t, c, g)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="contrast">{e.ru_contrast}</p>
      {e.more && <p className="more">{e.more}</p>}
    </section>
  )
}
