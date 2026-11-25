// Главная — одно действие и его контекст. Темы, грамматика и прогресс уехали
// в свои разделы (docs/ia.md): главная росла вместе с данными, и кнопка занятия
// тонула между плитками тем и списком правил.

import { getBundle } from '../core/bundle.ts'
import type { Level } from '../core/types.ts'
import { go } from './route.ts'
import { wordKey, type Cards, type State } from './srs.ts'
import { nextNew, plural, rules, SIZE, tasks, wordsOf } from './session.ts'

function Gear() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

const SUMMARY: [State, string][] = [
  ['due', 'пора'],
  ['learning', 'в работе'],
  ['solid', 'держится'],
  ['new', 'не начато'],
]

export function Home({ level, cards, theme }: { level?: Level; cards: Cards; theme?: string }) {
  const bundle = getBundle()
  const all = rules({ level, cards })
  const t = theme ? bundle.themes[theme] : undefined
  // слова темы В ПРЕДЕЛАХ уровня: показываем ту же выборку, по которой идёт занятие
  const mine = theme ? wordsOf({ theme, level }) : []

  const due = all.filter((r) => r.state === 'due' && r.count > 0)
  const repeat = due.length
  const fresh = nextNew({ level, cards })
  const sub = [
    `${tasks(SIZE)}`,
    repeat ? `${plural(repeat, ['повтор', 'повтора', 'повторов'])}` : null,
    fresh ? `новое — ${fresh.name}` : null,
  ].filter(Boolean)

  return (
    <main className="home">
      <div className="top">
        <h1>satzbau</h1>
        <button className="iconbtn" title="настройки" onClick={() => go({ screen: 'settings' })}>
          <Gear />
        </button>
      </div>

      <button className="mix" onClick={() => go({ screen: 'drill' })}>
        <span className="mix-title">Заниматься</span>
        <span className="mix-sub">{sub.join(' · ')}</span>
      </button>

      {/* тема — постоянный приоритет лексики, поэтому её видно рядом с кнопкой,
          а не только в разделе «Темы» */}
      <p className="now">
        <span className="nlabel">Тема</span>
        {t && theme ? (
          <button className="nlink" onClick={() => go({ screen: 'theme', theme })}>
            {t.title} · {mine.filter((w) => cards.has(wordKey(w.w))).length} из {mine.length}{' '}
            слов
          </button>
        ) : (
          <button className="nlink" onClick={() => go({ screen: 'themes' })}>
            любая — выбрать
          </button>
        )}
      </p>

      {/* где я одной строкой: четыре числа не растут вместе с числом правил,
          а списки за ними лежат в разделе «Прогресс» */}
      <ul className="stats">
        {SUMMARY.map(([key, label]) => (
          <li key={key} className={`stat ${key}`}>
            <span className="sn mono">{all.filter((r) => r.state === key).length}</span>
            <span className="slabel">{label}</span>
          </li>
        ))}
      </ul>

      {/* что ждёт сегодня. Список ограничен расписанием, а не числом правил,
          поэтому главная не растёт вместе с данными */}
      <h2 className="section">
        <span>Пора повторить</span>
        {due.length > 0 && <span>{due.length}</span>}
      </h2>
      {due.length === 0 ? (
        <p className="panel note small">
          {fresh
            ? `Повторов на сегодня нет. «Заниматься» возьмёт новое правило — ${fresh.name} — и то, что в работе.`
            : 'Повторов на сегодня нет.'}
        </p>
      ) : (
        <ul className="group">
          {due.map((r) => (
            <li key={r.rule}>
              <button className="grule" onClick={() => go({ screen: 'drill', rule: r.rule })}>
                <span className="rname">{r.name}</span>
                <span className="rlv mono">{r.level}</span>
                <span className="arrow" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
