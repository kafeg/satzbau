// Раздел «Грамматика»: все правила по группам плюс таблицы форм. Состояние правила
// считается из карточки FSRS (srs.ts), а не рисуется долей увиденных слов.

import { useState } from 'react'
import type { Level } from '../core/types.ts'
import { go } from './route.ts'
import { GROUPS, rules } from './session.ts'
import type { Cards, State } from './srs.ts'

const STATE: Record<State, string> = {
  new: '',
  due: 'пора',
  learning: 'в работе',
  solid: 'держится',
}

const GROUP_TITLE: Record<string, string> = {
  падеж: 'Падежи и предлоги',
  артикль: 'Артикль и его родня',
  существительное: 'Существительное',
  прилагательное: 'Прилагательное',
  глагол: 'Глагол',
}

export function Grammar({ level, cards }: { level?: Level; cards: Cards }) {
  const [open, setOpen] = useState<string | null>(null)
  const all = rules({ level, cards })
  const solid = all.filter((r) => r.state === 'solid').length

  return (
    <main className="home">
      <h1>Грамматика</h1>

      <h2 className="section">
        <span>Правила</span>
        <span>
          {all.length} · держится {solid}
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
                {/* ⚠ Метка повтора ДОБАВЛЯЕТСЯ к числу правил, а не заменяет его: пока
                    она его съедала, «сколько тут правил» пропадало ровно в тот день,
                    когда человек заходит сюда чаще всего. */}
                {rs.some((r) => r.state === 'due') && (
                  <span className="rstate due">
                    {rs.filter((r) => r.state === 'due').length} пора
                  </span>
                )}
                <span className="gcount mono">{rs.length}</span>
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
                    {STATE[r.state] && <span className={`rstate ${r.state}`}>{STATE[r.state]}</span>}
                    <span className="rlv mono">{r.level}</span>
                  </button>
                ))}
            </li>
          )
        })}
      </ul>

      <h2 className="section">
        <span>Справка</span>
      </h2>
      <ul className="group">
        <li>
          <button className="grule" onClick={() => go({ screen: 'tables' })}>
            <span className="rname">Таблицы форм</span>
            <span className="arrow" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </main>
  )
}
