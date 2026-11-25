// Таблицы: то же, что подсвечивается в разборе, но целиком и в одном месте.
// Данных тут нет — всё считается по парадигмам из ядра.
// Каждая таблица — отдельный блок на своей поверхности: заголовок, пояснение, сетка.
// Цветом помечен только падеж (первая колонка), иначе страница заливается тремя пятнами.

import { useState } from 'react'
import {
  adjEnding,
  auxPresent,
  defArticle,
  einWord,
  merged,
} from '../core/paradigms.ts'
import type { Case, Decl, Gender, Person } from '../core/types.ts'
import { go } from './route.ts'

const CASES: Case[] = ['nom', 'akk', 'dat', 'gen']
const CASE_NAME: Record<Case, string> = {
  nom: 'Nominativ',
  akk: 'Akkusativ',
  dat: 'Dativ',
  gen: 'Genitiv',
}
const CASE_CLASS: Record<Case, string> = { nom: '', akk: 'akk', dat: 'dat', gen: 'gen' }
const COLS: (Gender | 'pl')[] = ['m', 'f', 'n', 'pl']
const COL_NAME: Record<Gender | 'pl', string> = { m: 'der', f: 'die', n: 'das', pl: 'мн. ч.' }
const PERSONS: Person[] = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl']
const PERSON_NAME: Record<Person, string> = {
  '1sg': 'ich',
  '2sg': 'du',
  '3sg': 'er, sie, es',
  '1pl': 'wir',
  '2pl': 'ihr',
  '3pl': 'sie, Sie',
}

function CaseTable({ cell }: { cell: (c: Case, g: Gender | 'pl') => string }) {
  return (
    <div className="panel">
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
            <tr key={c} className={CASE_CLASS[c]}>
              <th>{CASE_NAME[c]}</th>
              {COLS.map((g) => (
                <td key={g} className="mono">
                  {cell(c, g)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Grid({
  title,
  note,
  cell,
}: {
  title: string
  note?: string
  cell: (c: Case, g: Gender | 'pl') => string
}) {
  return (
    <section className="tblock">
      <h2 className="section">
        <span>{title}</span>
      </h2>
      {note && <p className="note small">{note}</p>}
      <CaseTable cell={cell} />
    </section>
  )
}

const gg = (g: Gender | 'pl') => (g === 'pl' ? 'm' : g) as Gender
const num = (g: Gender | 'pl') => (g === 'pl' ? 'pl' : 'sg') as 'pl' | 'sg'

export function Tables() {
  const [decl, setDecl] = useState<Decl>('weak')
  return (
    <main className="home">
      <button className="back wide-back" onClick={() => go({ screen: 'grammar' })}>
        ← грамматика
      </button>
      <h1>Таблицы</h1>
      <p className="lead">Всё считается по парадигмам: эти же таблицы подсвечиваются в разборе.</p>

      <Grid title="Определённый артикль" cell={(c, g) => defArticle(c, gg(g), num(g))} />
      <Grid
        title="Неопределённый артикль"
        note="Во множественном числе его нет — там работает kein."
        cell={(c, g) => (g === 'pl' ? '—' : einWord('ein', c, gg(g)))}
      />
      <Grid
        title="kein и mein"
        note="Одна таблица на всю группу ein-слов: ein, kein, mein, dein, sein, ihr, unser."
        cell={(c, g) => einWord('kein', c, gg(g), num(g))}
      />
      <Grid
        title="Слияния с in"
        note="Обязательные слияния: im, ins, am, ans, zum, zur, vom, beim."
        cell={(c, g) => (g === 'pl' ? '—' : (merged('in', c, gg(g)) ?? '—'))}
      />

      <section className="tblock">
        <h2 className="section">
          <span>Окончания прилагательного</span>
        </h2>
        <div className="tswitch">
          {(['weak', 'mixed', 'strong'] as Decl[]).map((d) => (
            <button
              key={d}
              className={`chip${decl === d ? ' on' : ''}`}
              onClick={() => setDecl(d)}
            >
              {d === 'weak' ? 'der' : d === 'mixed' ? 'ein' : 'без артикля'}
            </button>
          ))}
        </div>
        <CaseTable cell={(c, g) => `-${adjEnding(decl, c, gg(g), num(g))}`} />
      </section>

      <section className="tblock">
        <h2 className="section">
          <span>haben и sein</span>
        </h2>
        <div className="panel">
          <table className="forms">
            <thead>
              <tr>
                <th />
                <th className="mono">haben</th>
                <th className="mono">sein</th>
              </tr>
            </thead>
            <tbody>
              {PERSONS.map((p) => (
                <tr key={p}>
                  <th>{PERSON_NAME[p]}</th>
                  <td className="mono">{auxPresent(p, 'h')}</td>
                  <td className="mono">{auxPresent(p, 's')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
