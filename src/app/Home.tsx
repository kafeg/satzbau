// Главная: что тренировать. Правило — единица обучения, тема — вторая ось: она даёт слова.
// Карточка сверху — всё вперемешку; на Э5 её место займёт повторение ошибок по FSRS.

import { getBundle } from '../core/bundle.ts'
import { go } from './route.ts'
import { countFor, rules, SIZE } from './session.ts'

/** «1 задание, 2 задания, 5 заданий» — иначе цифры в списке читаются как опечатка. */
function tasks(n: number): string {
  const ten = n % 100
  if (ten > 10 && ten < 20) return `${n} заданий`
  const one = n % 10
  if (one === 1) return `${n} задание`
  if (one >= 2 && one <= 4) return `${n} задания`
  return `${n} заданий`
}

export function Home({
  theme,
  onTheme,
}: {
  theme?: string
  onTheme: (t?: string) => void
}) {
  const themes = Object.entries(getBundle().themes)
  const list = rules(theme)
  const total = countFor({ theme })

  return (
    <main className="home">
      <h1>satzbau</h1>

      <button className="mix" onClick={() => go({ screen: 'drill' })}>
        <span className="mix-title">Всё вперемешку</span>
        <span className="mix-sub">
          {tasks(SIZE)} · из {total} возможных
        </span>
      </button>

      <h2 className="section">Лексика</h2>
      <div className="chips">
        <button
          className={`chip${theme ? '' : ' on'}`}
          onClick={() => onTheme(undefined)}
        >
          все темы
        </button>
        {themes.map(([key, t]) => (
          <button
            key={key}
            className={`chip${theme === key ? ' on' : ''}`}
            onClick={() => onTheme(theme === key ? undefined : key)}
          >
            {t.title}
          </button>
        ))}
      </div>

      <h2 className="section">Грамматика</h2>
      <ul className="rules">
        {list.map((r) => (
          <li key={r.rule}>
            <button
              className="rule"
              disabled={r.count === 0}
              onClick={() => go({ screen: 'drill', rule: r.rule })}
            >
              <span className="rule-title">{r.title}</span>
              <span className="rule-sub">
                {r.level} · {r.count === 0 ? 'нет слов в этой теме' : tasks(r.count)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
