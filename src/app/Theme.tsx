// Экран темы: что внутри неё. Деление — по числу заданий, которые правило получает
// на словах ИМЕННО этой темы, а не по тому, насколько человек им владеет: заголовки
// списков говорят то же, что подпись у строки.
// Правила без слов темы сюда не попадают, но и не исчезают:
// они на главной, и сессия темы всё равно доберёт их лексикой из других тем.

import { getBundle } from '../core/bundle.ts'
import type { Level } from '../core/types.ts'
import { go } from './route.ts'
import { plural, rules, SIZE, tasks, wordsOf } from './session.ts'

const STRONG = 10

export function Theme({
  theme,
  level,
  current,
  onPick,
}: {
  theme: string
  level?: Level
  current?: string
  onPick: (t?: string) => void
}) {
  const t = getBundle().themes[theme]
  if (!t) return <p className="note">Такой темы нет.</p>
  // ⚠ Слова считаются в пределах уровня, тем же `wordsOf`, что и в разделе «Темы»:
  // иначе один экран обещает сто слов, а соседний — пятьдесят, и оба про одну тему.
  const words = wordsOf({ theme, level }).length
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
          {r.count} из {tasks(total.get(r.rule) ?? r.count)} на словах темы
        </span>
      </span>
      <span className="rlv mono">{r.level}</span>
    </button>
  )

  return (
    <main className="home">
      <button className="back wide-back" onClick={() => go({ screen: 'themes' })}>
        ← темы
      </button>
      <h1>{t.title}</h1>
      <p className="lead">
        {plural(words, ['слово', 'слова', 'слов'])}. Эти правила тренируются на её словах —
        остальные доберут лексику из других тем.
      </p>

      {/* тема становится текущей: приоритет переживает сессию, и «Заниматься» с главной
          дальше идёт на её словах. Иначе выбор темы приходится повторять каждый заход */}
      <button
        className="mix"
        onClick={() => {
          onPick(theme)
          go({ screen: 'drill', theme })
        }}
      >
        <span className="mix-title">Заниматься по теме</span>
        <span className="mix-sub">
          {tasks(SIZE)} · {current === theme ? 'это текущая тема' : 'тема станет текущей'}
        </span>
      </button>

      <button className="ghost" onClick={() => go({ screen: 'words', theme })}>
        новые слова темы
      </button>

      {strong.length > 0 && (
        <>
          <h2 className="section">
            <span>Много заданий на словах темы</span>
          </h2>
          <div className="group theme-rules">{strong.map(row)}</div>
        </>
      )}
      {weak.length > 0 && (
        <>
          <h2 className="section">
            <span>Мало заданий на словах темы</span>
          </h2>
          <div className="group theme-rules">{weak.map(row)}</div>
        </>
      )}
      {empty > 0 && (
        <p className="note small">
          Ещё {plural(empty, ['правило', 'правила', 'правил'])} на словах этой темы{' '}
          {empty === 1 ? 'не тренируется' : 'не тренируются'} — ищите в списке на главной.
        </p>
      )}
    </main>
  )
}
