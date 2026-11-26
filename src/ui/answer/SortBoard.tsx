// Подача «разложи» (docs/app.md, «Подача»): слова сверху, полосы вариантов — заголовок цветом во всю ширину.
// Неверное слово краснеет сразу и остаётся, где положили; положено последнее — шаг отвечен.
// Место под две строки в полосе и под весь список слов заложено в стилях: экран не прыгает.
import { type ReactNode, useEffect, useState } from 'react'
import type { Card } from '../../core/lesson.ts'
import type { View } from '../exercises/index.ts'

type Props = { cards: Card[]; view: View<any>; tag: ReactNode; done: boolean; onAnswer: (as: unknown[]) => void }

export function SortBoard({ cards, view, tag, done, onAnswer }: Props) {
  const options = view.options(cards[0]!.word)
  const [placed, setPlaced] = useState<(number | null)[]>(() => cards.map(() => null))
  const [sel, setSel] = useState(0)
  const free = cards.map((_, k) => k).filter((k) => placed[k] === null)
  const cur = placed[sel] === null ? sel : free[0]
  const ok = (k: number) => cards[k]!.ex.check(cards[k]!.word, options[placed[k]!]!.a)

  const put = (b: number) => {
    if (done || cur === undefined) return
    const next = placed.map((x, k) => (k === cur ? b : x))
    setPlaced(next)
    const left = next.findIndex((x) => x === null)
    if (left < 0) onAnswer(next.map((x) => options[x!]!.a))
    else setSel(left)
  }

  useEffect(() => {
    if (done) return
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const b = Number(e.key) - 1
      if (Number.isInteger(b) && b >= 0 && b < options.length) put(b)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  const right = cards.filter((_, k) => placed[k] !== null && ok(k)).length
  return (
    <>
      <section className="word wide-tag">
        {tag}
        <div className="q">{view.sort}</div>
        {done ? (
          <div className="ru small">
            {right} из {cards.length} верно
          </div>
        ) : (
          <div className="pile">
            {free.map((k) => (
              <button key={cards[k]!.word.id} className={`chipw ${k === cur ? 'sel' : ''}`} onClick={() => setSel(k)}>
                {cards[k]!.word.lemma}
              </button>
            ))}
          </div>
        )}
      </section>
      <div className={`bins ${done ? 'done' : ''}`}>
        {options.map((o, b) => (
          <button key={o.label} className="bin" disabled={done} onClick={() => put(b)}>
            <span className={`bh ${o.tone ?? ''}`}>{o.label}</span>
            <span className="in">
              {cards.map((c, k) =>
                placed[k] === b ? (
                  <span key={c.word.id} className={`chipw ${ok(k) ? '' : 'err'}`}>
                    {c.word.lemma}
                  </span>
                ) : null,
              )}
            </span>
          </button>
        ))}
      </div>
      {!done && <p className="where">нажми слово, потом полосу · {options.map((_, b) => b + 1).join(' · ')}</p>}
    </>
  )
}
