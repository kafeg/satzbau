// Экран темы: что внутри неё. Сильные правила — те, у которых много слов этой темы;
// слабые — те, где их пара штук. Правила без слов темы сюда не попадают, но и не исчезают:
// они на главной, и сессия темы всё равно доберёт их лексикой из других тем.

import { getBundle } from '../core/bundle.ts'
import type { Level } from '../core/types.ts'
import { go } from './route.ts'
import { rules, SIZE, tasks } from './session.ts'

const STRONG = 10

export function Theme({ theme, level }: { theme: string; level?: Level }) {
  const t = getBundle().themes[theme]
  if (!t) return <p className="note">Такой темы нет.</p>
  const mine = rules({ theme, level })
  const total = new Map(rules({ level }).map((r) => [r.rule, r.count]))
  const strong = mine.filter((r) => r.count >= STRONG)
  const weak = mine.filter((r) => r.count > 0 && r.count < STRONG)
  const empty = mine.length - strong.length - weak.length

  const row = (r: (typeof mine)[number]) => (
    <button
      key={r.rule}
      className="grule"
      onClick={() => go({ screen: 'drill', rule: r.rule, theme })}
    >
      <span className="rname">
        {r.name}
        <span className="rtheme">
          {r.count} из {total.get(r.rule) ?? r.count} заданий на словах темы
        </span>
      </span>
      <span className="rlv mono">{r.level}</span>
    </button>
  )

  return (
    <main className="home">
      <button className="back wide-back" onClick={() => go({ screen: 'home' })}>
        ← темы
      </button>
      <h1>{t.title}</h1>
      <p className="lead">
        {t.words.length} слов. Эти правила тренируются на её словах — остальные доберут
        лексику из других тем.
      </p>

      <button className="mix" onClick={() => go({ screen: 'drill', theme })}>
        <span className="mix-title">Заниматься по теме</span>
        <span className="mix-sub">
          {tasks(SIZE)} · слова «{t.title}» в приоритете
        </span>
      </button>

      {strong.length > 0 && (
        <>
          <h2 className="section">
            <span>Сильные правила темы</span>
          </h2>
          <div className="group">{strong.map(row)}</div>
        </>
      )}
      {weak.length > 0 && (
        <>
          <h2 className="section">
            <span>Слабые на этой теме</span>
          </h2>
          <div className="group">{weak.map(row)}</div>
        </>
      )}
      {empty > 0 && (
        <p className="note small">
          Ещё {empty} правил на словах этой темы не тренируются — они в списке на главной.
        </p>
      )}
    </main>
  )
}
