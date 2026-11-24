// Главная: тема — вход, грамматика — список ниже. Человек приходит с «в среду врач»,
// а не с «хочу Dativ», поэтому сетка тем стоит первой.

import { useState } from 'react'
import { getBundle } from '../core/bundle.ts'
import type { Level } from '../core/types.ts'
import { go } from './route.ts'
import { countFor, GROUPS, rules, SIZE, tasks } from './session.ts'

const LEVELS: { key: Level | undefined; label: string }[] = [
  { key: 'A1', label: 'A1' },
  { key: 'A2', label: 'A1–A2' },
  { key: undefined, label: 'всё' },
]

export function Home({ level, onLevel }: { level?: Level; onLevel: (l?: Level) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const bundle = getBundle()
  const all = rules({ level })
  const themes = Object.entries(bundle.themes).map(([key, t]) => ({
    key,
    title: t.title,
    words: t.words.length,
    live: rules({ level, theme: key }).filter((r) => r.count > 0).length,
  }))

  return (
    <main className="home">
      <div className="top">
        <h1>satzbau</h1>
        <div className="chips">
          {LEVELS.map((l) => (
            <button
              key={l.label}
              className={`chip${level === l.key ? ' on' : ''}`}
              onClick={() => onLevel(l.key)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <h2 className="section">
        <span>О чём говорим</span>
        <span>{themes.length} тем</span>
      </h2>
      <div className="tiles">
        {themes.map((t) => (
          <button key={t.key} className="tile" onClick={() => go({ screen: 'theme', theme: t.key })}>
            <span className="tname">{t.title}</span>
            <span className="tsub">
              {t.words} слов · {t.live} правил
            </span>
          </button>
        ))}
      </div>

      <h2 className="section">
        <span>Или просто</span>
      </h2>
      <button className="mix" onClick={() => go({ screen: 'drill' })}>
        <span className="mix-title">Всё вперемешку</span>
        <span className="mix-sub">
          {tasks(SIZE)} из {countFor({ level })}
        </span>
      </button>

      <h2 className="section">
        <span>Грамматика целиком</span>
        <span>{all.length} правил</span>
      </h2>
      <ul className="groups">
        {GROUPS.map((g) => {
          const rs = all.filter((r) => r.group === g)
          if (!rs.length) return null
          const shown = open === g
          return (
            <li key={g} className="group">
              <button className="ghead" onClick={() => setOpen(shown ? null : g)}>
                <span className="arrow">{shown ? '▾' : '▸'}</span>
                <span className="gname">{GROUP_TITLE[g] ?? g}</span>
                <span className="gcount">
                  {rs.length} · {rs.reduce((n, r) => n + r.count, 0)}
                </span>
              </button>
              {shown &&
                rs.map((r) => (
                  <button
                    key={r.rule}
                    className="grule"
                    disabled={r.count === 0}
                    onClick={() => go({ screen: 'drill', rule: r.rule })}
                  >
                    <span className="rname">{r.name}</span>
                    <span className="rn mono">{r.count}</span>
                    <span className="rlv mono">{r.level}</span>
                  </button>
                ))}
            </li>
          )
        })}
      </ul>
    </main>
  )
}

const GROUP_TITLE: Record<string, string> = {
  падеж: 'Падежи и предлоги',
  артикль: 'Артикль и его родня',
  существительное: 'Существительное',
  прилагательное: 'Прилагательное',
  глагол: 'Глагол',
}
