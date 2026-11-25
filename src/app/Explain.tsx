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
  possessive,
  type FormMatch,
} from '../core/paradigms.ts'
import type { Case, Gender, Item, Num, Template, Verb } from '../core/types.ts'

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

/** «Nominativ или Akkusativ женского рода»: одинаковые роды сливаем, иначе читается как список. */
function readable(ms: FormMatch[]): string {
  const byGender = new Map<Gender | 'pl', Case[]>()
  for (const m of ms.slice(0, 4)) {
    const got = byGender.get(m.gender)
    if (got) got.push(m.case)
    else byGender.set(m.gender, [m.case])
  }
  return [...byGender]
    .map(([g, cs]) => `${cs.map((c) => CASE_NAME[c]).join(' или ')} ${OF[g]}`)
    .join(', ')
}

/** Примечание про второй вспомогательный глагол — только там, где его и тренируют. */
function auxNote(item: Item): string | undefined {
  if (item.rule !== 'perfekt-aux') return undefined
  const v = getWords().find((w) => w.w === item.word)?.entry as Verb | undefined
  return v?.auxn
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

  return (
    <section className="explain">
      <h2>{e.title}</h2>
      <p className="mono short">{e.short}</p>
      <ol className="steps">
        {e.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>

      {wrong && matches.length > 0 && (
        <p className="yours">
          <span className="mono">{ending ? `-${given}` : given}</span> — это {readable(matches)}
        </p>
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
      {/* ⚠ Второе значение глагола: «ist gefahren — поехал; hat gefahren — вёл машину».
          Поле auxn собиралось в бандл с самого начала, а показать его забыли —
          и fixes.yaml, и src/CLAUDE.md всё это время обещали, что оно видно в разборе. */}
      {auxNote(item) && <p className="more">{auxNote(item)}</p>}
    </section>
  )
}
