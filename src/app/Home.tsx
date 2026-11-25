// Главная: одно действие сверху, разделы ниже. «Заниматься» собирает очередь сама —
// повторы по расписанию, одно новое правило, остальное в работе; выбор темы и правила
// остаётся входом для тех, кто пришёл с целью, но не требуется каждый заход.

import { useState } from 'react'
import { getBundle } from '../core/bundle.ts'
import type { Level } from '../core/types.ts'
import { go } from './route.ts'
import { wordKey, type Cards, type State } from './srs.ts'
import { GROUPS, nextNew, plural, rules, SIZE, tasks } from './session.ts'

const LEVELS: { key: Level | undefined; label: string }[] = [
  { key: 'A1', label: 'A1' },
  { key: 'A2', label: 'A1–A2' },
  { key: undefined, label: 'всё' },
]

// Состояние правила словами. «Не начато» не подписываем: это тридцать строк шума,
// и так видно по отсутствию метки.
const STATE: Record<State, string> = {
  new: '',
  due: 'пора',
  learning: 'в работе',
  solid: 'держится',
}

export function Home({
  level,
  cards,
  theme,
  onLevel,
  onTheme,
}: {
  level?: Level
  cards: Cards
  theme?: string
  onLevel: (l?: Level) => void
  onTheme: (t?: string) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  const bundle = getBundle()
  const all = rules({ level, cards })
  const themes = Object.entries(bundle.themes).map(([key, t]) => ({
    key,
    title: t.title,
    words: t.words.length,
    seen: t.words.filter((w) => cards.has(wordKey(w.w))).length,
    live: rules({ level, theme: key }).filter((r) => r.count > 0).length,
  }))
  const current = themes.find((t) => t.key === theme)

  const repeat = all.filter((r) => r.state === 'due' && r.count > 0).length
  const solid = all.filter((r) => r.state === 'solid').length
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

      <button className="mix" onClick={() => go({ screen: 'drill' })}>
        <span className="mix-title">Заниматься</span>
        <span className="mix-sub">{sub.join(' · ')}</span>
      </button>
      {/* строки «тема не выбрана» нет нарочно: пока темы нет, строка была бы подписью
          к пустоте. Тема появляется с экрана темы, а плитки стоят ниже */}
      {current && (
        <p className="now">
          <span className="nlabel">Тема</span>
          <button className="nlink" onClick={() => go({ screen: 'theme', theme: current.key })}>
            {current.title} · {current.seen} из {current.words} слов
          </button>
          <button className="ndrop" onClick={() => onTheme(undefined)}>
            убрать
          </button>
        </p>
      )}
      <div className="links">
        <button className="ghost" onClick={() => go({ screen: 'mistakes' })}>
          мои ошибки
        </button>
        <button className="ghost" onClick={() => go({ screen: 'tables' })}>
          таблицы
        </button>
        <button className="ghost" onClick={() => go({ screen: 'settings' })}>
          настройки
        </button>
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
        <span>Грамматика целиком</span>
        <span>
          {all.length} правил · держится {solid}
        </span>
      </h2>
      <ul className="groups">
        {GROUPS.map((g) => {
          const rs = all.filter((r) => r.group === g)
          if (!rs.length) return null
          const shown = open === g
          return (
            <li key={g} className="group">
              <button
                className={`ghead${shown ? ' open' : ''}`}
                onClick={() => setOpen(shown ? null : g)}
              >
                <span className="gname">{GROUP_TITLE[g] ?? g}</span>
                {/* сводка по группе: обычно просто сколько правил, а когда что-то
                    подошло к повтору — метка, потому что это единственное действие */}
                {rs.some((r) => r.state === 'due') ? (
                  <span className="rstate due">
                    {rs.filter((r) => r.state === 'due').length} пора
                  </span>
                ) : (
                  <span className="gcount mono">{rs.length}</span>
                )}
                <span className="arrow" aria-hidden="true" />
              </button>
              {shown &&
                rs.map((r) => (
                  <button
                    key={r.rule}
                    className="grule"
                    disabled={r.count === 0}
                    onClick={() => go({ screen: 'drill', rule: r.rule })}
                  >
                    <span className="rname">
                      {r.name}
                      {/* полоса остаётся только у лексического правила: там доля слов и есть
                          знание. У грамматического она стояла на месте при росте лексикона */}
                      {r.lex && (
                        <span className="bar">
                          <i
                            style={{ width: `${Math.round((100 * r.seen) / Math.max(r.words, 1))}%` }}
                          />
                        </span>
                      )}
                    </span>
                    {r.lex && (
                      <span className="rn mono">
                        {r.seen}/{r.words}
                      </span>
                    )}
                    {STATE[r.state] && (
                      <span className={`rstate ${r.state}`}>{STATE[r.state]}</span>
                    )}
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
