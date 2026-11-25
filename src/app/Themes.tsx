// Раздел «Темы»: о чём говорим. Начатые сверху — по доле увиденных слов,
// нетронутые ниже в порядке themes.yaml.
//
// ⚠ Строками, а не плитками: в плитке шириной 167 px длинное название переносится
// («Люди и знакомство», «Город и ведомства»), и соседние плитки в ряду расходятся
// по высоте. Порог был записан в docs/ia.md как «около пятнадцати тем» — на двадцати
// он наступил.

import { getBundle } from '../core/bundle.ts'
import type { Level } from '../core/types.ts'
import { go } from './route.ts'
import { wordsOf } from './session.ts'
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
  // ⚠ Слова считаются в пределах уровня, тем же `wordsOf`, что отбирает их для занятия:
  // иначе строка обещает сотню слов, из которых на A1 доступны сорок.
  const list = Object.entries(getBundle().themes).map(([key, t]) => {
    const mine = wordsOf({ theme: key, level })
    return {
      key,
      title: t.title,
      words: mine.length,
      seen: mine.filter((w) => cards.has(wordKey(w.w))).length,
    }
  })
  const started = list
    .filter((t) => t.seen > 0)
    .sort((a, b) => b.seen / (b.words || 1) - a.seen / (a.words || 1))
  const rest = list.filter((t) => t.seen === 0)

  const rows = (group: typeof list) => (
    <ul className="group">
      {group.map((t) => (
        <li key={t.key}>
          <button className="grule" onClick={() => go({ screen: 'theme', theme: t.key })}>
            <span className="rname">
              {t.title}
              {t.seen > 0 && (
                <span className="bar">
                  <i style={{ width: `${Math.round((100 * t.seen) / t.words)}%` }} />
                </span>
              )}
            </span>
            {t.key === current && <span className="rstate cur">текущая</span>}
            <span className="rn mono">
              {t.seen ? `${t.seen}/${t.words}` : `${t.words} сл.`}
            </span>
            <span className="arrow" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )

  return (
    <main className="home">
      <h1>Темы</h1>
      <p className="lead">
        Тема — лексика, а не отдельный курс: она подмешивается в очередь как приоритет.
        Текущая переживает сессию, пока её не сменить.
      </p>

      {started.length > 0 && (
        <>
          <h2 className="section">
            <span>В работе</span>
            <span>{started.length}</span>
          </h2>
          {rows(started)}
        </>
      )}
      <h2 className="section">
        <span>{started.length ? 'Остальные' : 'Все темы'}</span>
        <span>{rest.length}</span>
      </h2>
      {rows(rest)}
    </main>
  )
}
