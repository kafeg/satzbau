// «Что учим»: уровень и тема на одном экране. Уровень берёт свои слова и все ниже, поэтому числа в темах
// зависят от уровня; выбор применяется сразу, тема возвращает к занятию.
import { EXERCISES } from '../core/exercises/index.ts'
import { overview } from '../core/lesson.ts'
import { pool } from '../core/pool.ts'
import type { Memory } from '../core/srs.ts'
import { plural } from '../core/text.ts'
import { LEVELS, type Level, type Noun, type Theme } from '../core/types.ts'

type Props = {
  nouns: Noun[]
  themes: Theme[]
  level: Level
  mem: Memory
  theme: string
  onLevel: (l: Level) => void
  onPick: (id: string) => void
  onBack: () => void
}

export function Pick({ nouns, themes, level, mem, theme, onLevel, onPick, onBack }: Props) {
  const now = Date.now()
  // слова, у которых есть хоть одно упражнение, — как на главной
  const words = (l: Level, t?: Theme) => overview(pool(nouns, l, t), EXERCISES, mem, now)
  const count = (o: ReturnType<typeof words>) => o.words.learned + o.words.learning + o.words.untouched
  const levels = LEVELS.map((l) => [l, words(l)] as const)
  const at = LEVELS.indexOf(level)
  const n = count(levels[at]![1])
  const added = at > 0 ? `слова ${LEVELS[at - 1]} и ещё ${n - count(levels[at - 1]![1])}` : `первый уровень, ${n} ${plural(n, ['слово', 'слова', 'слов'])}`

  const row = (id: string, title: string, t?: Theme) => {
    const o = words(level, t)
    const k = count(o)
    if (k === 0) return null
    return (
      <li key={id}>
        <button className={`theme ${id === theme ? 'on' : ''}`} onClick={() => onPick(id)}>
          <span className="name">
            {title} <span className="sub">· {k}</span>
          </span>
          <span className={`badge ${o.due.length ? '' : 'zero'}`}>{o.due.length || '—'}</span>
          <span className="meter" aria-hidden>
            <i style={{ width: `${(o.words.learned / k) * 100}%` }} />
            <i className="w" style={{ width: `${(o.words.learning / k) * 100}%` }} />
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
        <h1>Что учим</h1>
      </header>

      <div>
        <div className="section">Уровень</div>
        <div className="lvls" role="radiogroup" aria-label="Уровень">
          {levels.map(([l, o]) => {
            const k = count(o) || 1
            return (
              <button key={l} role="radio" aria-checked={l === level} className={`lvc ${l === level ? 'on' : ''}`} onClick={() => onLevel(l)}>
                <span className="code">{l}</span>
                <span className="s">
                  {count(o)} {plural(count(o), ['слово', 'слова', 'слов'])}
                </span>
                <span className="meter" aria-hidden>
                  <i style={{ width: `${(o.words.learned / k) * 100}%` }} />
                  <i className="w" style={{ width: `${(o.words.learning / k) * 100}%` }} />
                </span>
              </button>
            )
          })}
        </div>
        <p className="hintline">
          {level} — {added} · прогресс при смене уровня сохраняется
        </p>
      </div>

      <div>
        <div className="section">
          Тема · {level} · {themes.length} {plural(themes.length, ['тема', 'темы', 'тем'])}
        </div>
        <ul className="list">
          {row('', 'Все темы')}
          {themes.map((t) => row(t.id, t.title, t))}
        </ul>
      </div>
    </main>
  )
}
