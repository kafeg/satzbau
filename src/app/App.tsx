import { useEffect, useState } from 'react'
import type { Item } from '../core/types.ts'
import { Drill } from './Drill.tsx'
import { loadBundle } from './load.ts'
import { newSession } from './session.ts'

interface Answer {
  item: Item
  given: string
  correct: boolean
}

export function App() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [at, setAt] = useState(0)
  const [log, setLog] = useState<Answer[]>([])

  useEffect(() => {
    loadBundle().then(
      () => setItems(newSession()),
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    )
  }, [])

  const again = () => {
    setLog([])
    setAt(0)
    setItems(newSession())
  }

  if (error) return <p className="note">Данные не загрузились: {error}</p>
  if (!items) return <p className="note">Загрузка…</p>

  const item = items[at]
  if (!item) {
    const right = log.filter((a) => a.correct).length
    return (
      <main className="done">
        <h1>Готово</h1>
        <p className="score mono">
          {right} / {log.length}
        </p>
        <ul className="recap">
          {log
            .filter((a) => !a.correct)
            .map((a) => (
              <li key={a.item.templateId + a.item.word}>
                <span className="mono bad">{a.given}</span> → <span className="mono ok">{a.item.answer}</span>{' '}
                <span className="ru">{a.item.full}</span>
              </li>
            ))}
        </ul>
        <button className="primary wide" onClick={again}>
          Ещё
        </button>
      </main>
    )
  }

  return (
    <Drill
      key={item.templateId + item.word}
      item={item}
      n={at + 1}
      total={items.length}
      onNext={(correct, given) => {
        setLog((l) => [...l, { item, given, correct }])
        setAt((i) => i + 1)
      }}
    />
  )
}
