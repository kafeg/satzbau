// Выбор темы: сколько слов уровня в теме, сколько пора повторить, доля выученных.
import { EXERCISES } from '../core/exercises/index.ts'
import { overview } from '../core/lesson.ts'
import { pool } from '../core/pool.ts'
import type { Memory } from '../core/srs.ts'
import type { Level, Noun, Theme } from '../core/types.ts'

type Props = { nouns: Noun[]; themes: Theme[]; level: Level; mem: Memory; theme: string; onPick: (id: string) => void; onBack: () => void }

export function Themes({ nouns, themes, level, mem, theme, onPick, onBack }: Props) {
  const now = Date.now()
  const row = (id: string, title: string, t?: Theme) => {
    const o = overview(pool(nouns, level, t), EXERCISES, mem, now)
    // слова, у которых есть хоть одно упражнение, — как на главной
    const n = o.words.learned + o.words.learning + o.words.untouched
    if (n === 0) return null
    const total = n
    return (
      <li key={id}>
        <button className={`theme ${id === theme ? 'on' : ''}`} onClick={() => onPick(id)}>
          <span className="name">
            {title} <span className="sub">· {n}</span>
          </span>
          <span className={`badge ${o.due.length ? '' : 'zero'}`}>{o.due.length || '—'}</span>
          <span className="meter" aria-hidden>
            <i style={{ width: `${(o.words.learned / total) * 100}%` }} />
            <i className="w" style={{ width: `${(o.words.learning / total) * 100}%` }} />
          </span>
        </button>
      </li>
    )
  }
  return (
    <main className="home themes">
      <header className="topbar">
        <button className="close" aria-label="Назад" onClick={onBack}>
          ‹
        </button>
        <h1>Тема</h1>
        <span className="caption">
          {level} · {themes.length} тем
        </span>
      </header>
      <ul className="list">
        {row('', 'Все темы')}
        {themes.map((t) => row(t.id, t.title, t))}
      </ul>
    </main>
  )
}
