import type { Lesson } from '../core/run.ts'
import { cards as all, firstTry } from '../core/run.ts'
import { type Memory, dueIn } from '../core/srs.ts'
import { when } from '../core/text.ts'
import { viewOf } from './exercises/index.ts'

type Props = { lesson: Lesson; mem: Memory; now: number; onMore: () => void; onHome: () => void }

export function Result({ lesson, mem, now, onMore, onHome }: Props) {
  const cards = all(lesson)
  const days = (c: (typeof cards)[number]) => dueIn(mem, c.ex.id, c.word.id, now) ?? 0
  const plan = new Map<number, number>()
  for (const c of cards) plan.set(days(c), (plan.get(days(c)) ?? 0) + 1)
  return (
    <main className="home result">
      <h1>Урок готов</h1>
      <p className="score">
        <b>{firstTry(lesson)}</b> из {cards.length} <span className="sub">с первого раза</span>
      </p>
      {lesson.wrong.length > 0 && (
        <div>
          <div className="section">Ошибки</div>
          <ul className="list">
            {lesson.wrong.map((c) => {
              return (
                <li key={`${c.ex.id} ${c.word.id}`} className="mistake">
                  <span className="what">{viewOf(c.ex.id).summary(c.word)}</span>
                  <span className="when">{when(days(c))}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <div>
        <div className="section">Следующие повторы</div>
        <div className="plan">
          {[...plan].sort((a, b) => a[0] - b[0]).map(([d, n]) => (
            <div key={d}>
              <b>{n}</b>
              <span>{when(d)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="row">
        <button className="primary" onClick={onMore} autoFocus>
          Ещё урок
        </button>
        <button className="secondary" onClick={onHome}>
          Готово
        </button>
      </div>
    </main>
  )
}
