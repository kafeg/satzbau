import { useEffect, useState } from 'react'
import type { Item, Level } from '../core/types.ts'
import { Drill } from './Drill.tsx'
import { Home } from './Home.tsx'
import { Theme } from './Theme.tsx'
import { loadBundle } from './load.ts'
import { go, useRoute } from './route.ts'
import { newSession } from './session.ts'

interface Answer {
  item: Item
  given: string
  correct: boolean
}

const LEVEL_KEY = 'satzbau.level'

// Тема и уровень — удобство, а не прогресс: приватный просмотр их не сохранит, и ладно.
function read(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined
  } catch {
    return undefined
  }
}

function write(key: string, value?: string): void {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    // приватный просмотр: выбор просто не запомнится
  }
}

export function App() {
  const route = useRoute()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState<Level | undefined>(() => read(LEVEL_KEY) as Level | undefined)
  const [items, setItems] = useState<Item[]>([])
  const [at, setAt] = useState(0)
  const [log, setLog] = useState<Answer[]>([])
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    loadBundle().then(
      () => setReady(true),
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    )
  }, [])

  useEffect(() => {
    if (!ready || route.screen !== 'drill') return
    setItems(newSession({ rule: route.rule, theme: route.theme, level }))
    setAt(0)
    setLog([])
  }, [ready, route.screen, route.rule, route.theme, level, nonce])

  const pickLevel = (l?: Level) => {
    setLevel(l)
    write(LEVEL_KEY, l)
  }

  if (error) return <p className="note">Данные не загрузились: {error}</p>
  if (!ready) return <p className="note">Загрузка…</p>
  if (route.screen === 'home') return <Home level={level} onLevel={pickLevel} />
  if (route.screen === 'theme')
    return <Theme theme={route.theme as string} level={level} />

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
                <span className="mono bad">{a.given}</span> →{' '}
                <span className="mono ok">{a.item.answer}</span>{' '}
                <span className="ru">{a.item.full}</span>
              </li>
            ))}
        </ul>
        <button className="primary wide" onClick={() => setNonce((n) => n + 1)}>
          Ещё
        </button>
        <button
          className="ghost"
          onClick={() =>
            go(route.theme ? { screen: 'theme', theme: route.theme } : { screen: 'home' })
          }
        >
          {route.theme ? 'к теме' : 'к списку правил'}
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
      rule={route.rule}
      back={route.theme ? { screen: 'theme', theme: route.theme } : { screen: 'home' }}
      onNext={(correct, given) => {
        setLog((l) => [...l, { item, given, correct }])
        setAt((i) => i + 1)
      }}
    />
  )
}
