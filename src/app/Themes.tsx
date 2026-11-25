// Раздел «Темы»: о чём говорим. Начатые сверху — по доле увиденных слов,
// нетронутые ниже в порядке themes.yaml.

import { getBundle } from '../core/bundle.ts'
import type { Level } from '../core/types.ts'
import { go } from './route.ts'
import { rules } from './session.ts'
import { wordKey, type Cards } from './srs.ts'

export function Themes({
  level,
  cards,
  current,
}: {
  level?: Level
  cards: Cards
  current?: string
}) {
  const list = Object.entries(getBundle().themes).map(([key, t]) => ({
    key,
    title: t.title,
    words: t.words.length,
    seen: t.words.filter((w) => cards.has(wordKey(w.w))).length,
    live: rules({ level, theme: key }).filter((r) => r.count > 0).length,
  }))
  const started = list.filter((t) => t.seen > 0).sort((a, b) => b.seen / b.words - a.seen / a.words)
  const rest = list.filter((t) => t.seen === 0)

  return (
    <main className="home">
      <h1>Темы</h1>
      <p className="lead">
        Тема — лексика, а не отдельный курс: она подмешивается в очередь как приоритет.
        Текущая переживает сессию, пока её не сменить.
      </p>

      {[
        ['В работе', started],
        [started.length ? 'Остальные' : 'Все темы', rest],
      ].map(([title, group]) =>
        (group as typeof list).length === 0 ? null : (
          <section key={title as string}>
            <h2 className="section">
              <span>{title as string}</span>
              <span>{(group as typeof list).length}</span>
            </h2>
            <div className="tiles">
              {(group as typeof list).map((t) => (
                <button
                  key={t.key}
                  className={`tile${t.key === current ? ' on' : ''}`}
                  onClick={() => go({ screen: 'theme', theme: t.key })}
                >
                  <span className="tname">{t.title}</span>
                  <span className="tsub">
                    {t.seen ? `${t.seen} из ${t.words} слов` : `${t.words} слов · ${t.live} правил`}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ),
      )}
    </main>
  )
}
