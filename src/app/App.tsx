import { useEffect, useState } from 'react'
import type { Item, Level } from '../core/types.ts'
import { Drill } from './Drill.tsx'
import { Home } from './Home.tsx'
import { loadBundle } from './load.ts'
import { Mistakes } from './Mistakes.tsx'
import { go, useRoute } from './route.ts'
import { newSession } from './session.ts'
import { init as initSrs, replay, type Cards } from './srs.ts'
import { addAnswer, allAnswers, persist, type Answer } from './store.ts'
import { Theme } from './Theme.tsx'
import { download, upload } from './transfer.ts'

const LEVEL_KEY = 'satzbau.level'

// Уровень — удобство, а не прогресс: приватный просмотр его не сохранит, и ладно.
// Прогресс живёт в IndexedDB и выгружается файлом.
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
  const [answers, setAnswers] = useState<Answer[]>([])
  const [cards, setCards] = useState<Cards>(new Map())
  const [items, setItems] = useState<Item[]>([])
  const [at, setAt] = useState(0)
  const [log, setLog] = useState<Answer[]>([])
  const [nonce, setNonce] = useState(0)
  const [asked, setAsked] = useState(false)

  useEffect(() => {
    Promise.all([loadBundle(), initSrs()])
      .then(async () => {
        const saved = await allAnswers().catch(() => [] as Answer[])
        setAnswers(saved)
        setCards(replay(saved))
        setReady(true)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(() => {
    if (!ready || route.screen !== 'drill') return
    setItems(newSession({ rule: route.rule, theme: route.theme, level, cards }))
    setAt(0)
    setLog([])
    // cards нарочно не в зависимостях: иначе ответ пересобирал бы текущую сессию
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, route.screen, route.rule, route.theme, level, nonce])

  const pickLevel = (l?: Level) => {
    setLevel(l)
    write(LEVEL_KEY, l)
  }

  /** Ответ: в журнал, затем состояние пересчитывается из него целиком. */
  const remember = async (a: Answer) => {
    const next = [...answers, a]
    setAnswers(next)
    setCards(replay(next))
    try {
      await addAnswer(a)
    } catch {
      // приватный просмотр или переполненное хранилище: сессия продолжается,
      // но прогресс не сохранится — об этом честно сказано на экране ошибок
    }
    // просим постоянное хранилище после первого ответа, а не на старте
    if (!asked) {
      setAsked(true)
      void persist()
    }
  }

  if (error) return <p className="note">Данные не загрузились: {error}</p>
  if (!ready) return <p className="note">Загрузка…</p>

  if (route.screen === 'home')
    return <Home level={level} cards={cards} onLevel={pickLevel} />
  if (route.screen === 'theme') return <Theme theme={route.theme as string} level={level} />
  if (route.screen === 'mistakes')
    return (
      <Mistakes
        answers={answers}
        cards={cards}
        onExport={() => download(answers)}
        onImport={async (file) => {
          const next = await upload(file)
          setAnswers(next)
          setCards(replay(next))
        }}
      />
    )

  const item = items[at]
  if (!item) {
    const right = log.filter((a) => a.ok).length
    return (
      <main className="done">
        <h1>Готово</h1>
        <p className="score mono">
          {right} / {log.length}
        </p>
        <ul className="recap">
          {log
            .filter((a) => !a.ok)
            .map((a) => (
              <li key={a.tpl + a.word}>
                <span className="mono bad">{a.given}</span> → <span className="mono ok">{a.word}</span>
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
          {route.theme ? 'к теме' : 'на главную'}
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
      onNext={(correct, given, hinted) => {
        const a: Answer = {
          t: Date.now(),
          tpl: item.templateId,
          word: item.word,
          rule: item.rule,
          ok: correct ? 1 : 0,
          given,
          ...(hinted ? { hint: 1 as const } : {}),
        }
        setLog((l) => [...l, a])
        void remember(a)
        setAt((i) => i + 1)
      }}
    />
  )
}
