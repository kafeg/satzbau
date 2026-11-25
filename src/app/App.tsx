import { useEffect, useState, type ReactNode } from 'react'
import { getBundle } from '../core/bundle.ts'
import type { Item, Level } from '../core/types.ts'
import { Drill } from './Drill.tsx'
import { Grammar } from './Grammar.tsx'
import { Home } from './Home.tsx'
import { loadBundle } from './load.ts'
import { Progress } from './Progress.tsx'
import { go, useRoute } from './route.ts'
import { newSession } from './session.ts'
import { init as initSrs, replay, type Cards } from './srs.ts'
import { Settings } from './Settings.tsx'
import { addAnswer, allAnswers, clearAnswers, persist, type Answer } from './store.ts'
import { Tables } from './Tables.tsx'
import { Tabs } from './Tabs.tsx'
import { Theme } from './Theme.tsx'
import { Themes } from './Themes.tsx'
import { Words } from './Words.tsx'
import { download, upload } from './transfer.ts'

const LEVEL_KEY = 'satzbau.level'
const THEME_KEY = 'satzbau.theme'

// ⚠ «всё подряд» — это отсутствие потолка, то есть undefined, и его приходится хранить
// словом: иначе стёртый ключ не отличить от невыбранного уровня, и выбор откатывался
// к A1 при каждой перезагрузке. Новый профиль начинает с A1, а не с B1.
const ALL = 'all'
const readLevel = (): Level | undefined => {
  const v = read(LEVEL_KEY)
  return v === ALL ? undefined : ((v as Level | undefined) ?? 'A1')
}

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
  const [level, setLevel] = useState<Level | undefined>(readLevel)
  // текущая тема — постоянный приоритет очереди, а не выбор на каждый заход (docs/ia.md)
  const [theme, setTheme] = useState<string | undefined>(() => read(THEME_KEY))
  const [answers, setAnswers] = useState<Answer[]>([])
  const [cards, setCards] = useState<Cards>(new Map())
  const [items, setItems] = useState<Item[]>([])
  const [at, setAt] = useState(0)
  // ⚠ `right` — верный ответ задания. В журнале его нет и не будет (там пара
  // «шаблон + слово», из которой задание пересобирается), но итогу сессии он нужен:
  // без него строка «den → Koffer» показывала лемму вместо ответа.
  const [log, setLog] = useState<(Answer & { right: string })[]>([])
  const [nonce, setNonce] = useState(0)
  const [asked, setAsked] = useState(false)
  // ⚠ Запись в журнал может не пройти (приватный просмотр, переполненное хранилище).
  // Молча это терять нельзя: человек занимается час и обнаруживает пустой прогресс.
  const [lost, setLost] = useState(false)
  // какие слова тренировать: приходит с карточек новых слов, живёт до ухода с дрилла
  const [only, setOnly] = useState<string[] | undefined>(undefined)

  useEffect(() => {
    Promise.all([loadBundle(), initSrs()])
      .then(async () => {
        // ⚠ Журнал не обязателен для старта: не прочитался — начинаем с пустого
        // и говорим об этом, а не висим на «Загрузка…»
        const saved = await allAnswers().catch(() => {
          setLost(true)
          return [] as Answer[]
        })
        setAnswers(saved)
        setCards(replay(saved))
        // тему могли переименовать между версиями: сохранённый ключ проверяем по бандлу
        setTheme((t) => (t && getBundle().themes[t] ? t : undefined))
        setReady(true)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(() => {
    if (!ready || route.screen !== 'drill') {
      if (route.screen !== 'words') setOnly(undefined)
      return
    }
    // ⚠ Тема очереди: из маршрута, а иначе текущая. Поэтому «Заниматься» с главной идёт
    // на словах текущей темы, а назад возвращается на главную, а не на экран темы.
    setItems(newSession({ rule: route.rule, theme: route.theme ?? theme, level, cards, only }))
    setAt(0)
    setLog([])
    // cards нарочно не в зависимостях: иначе ответ пересобирал бы текущую сессию
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, route.screen, route.rule, route.theme, level, theme, only, nonce])

  const pickLevel = (l?: Level) => {
    setLevel(l)
    write(LEVEL_KEY, l ?? ALL)
  }

  const pickTheme = (t?: string) => {
    setTheme(t)
    write(THEME_KEY, t)
  }

  /** Ответ: в журнал, затем состояние пересчитывается из него целиком. */
  const remember = async (a: Answer) => {
    const next = [...answers, a]
    setAnswers(next)
    setCards(replay(next))
    try {
      await addAnswer(a)
    } catch {
      // сессия продолжается: ответы живут в памяти и работают до перезагрузки,
      // но на диск не лягут — об этом сказано на экране итога и в «Прогрессе»
      setLost(true)
    }
    // просим постоянное хранилище после первого ответа, а не на старте
    if (!asked) {
      setAsked(true)
      void persist()
    }
  }

  if (error) return <p className="note">Данные не загрузились: {error}</p>
  if (!ready) return <p className="note">Загрузка…</p>

  // панель разделов есть везде, кроме дрилла и онбординга: там экран занят одним делом
  const shell = (body: ReactNode) => (
    <>
      {body}
      <Tabs screen={route.screen} />
    </>
  )

  if (route.screen === 'home')
    return shell(<Home level={level} cards={cards} theme={theme} />)
  if (route.screen === 'themes')
    return shell(<Themes level={level} cards={cards} current={theme} />)
  if (route.screen === 'grammar') return shell(<Grammar level={level} cards={cards} />)
  if (route.screen === 'theme')
    return shell(
      <Theme theme={route.theme as string} level={level} current={theme} onPick={pickTheme} />,
    )
  if (route.screen === 'words')
    return shell(
      <Words
        theme={route.theme as string}
        level={level}
        cards={cards}
        onTrain={(ws) => {
          setOnly(ws)
          go({ screen: 'drill', theme: route.theme })
        }}
      />,
    )
  if (route.screen === 'tables') return shell(<Tables />)
  if (route.screen === 'settings')
    return shell(
      <Settings
        answers={answers}
        level={level}
        onLevel={pickLevel}
        onReset={async () => {
          await clearAnswers()
          setAnswers([])
          setCards(new Map())
        }}
      />,
    )
  if (route.screen === 'progress')
    return shell(
      <Progress
        answers={answers}
        cards={cards}
        level={level}
        lost={lost}
        onExport={() => download(answers)}
        onImport={async (file) => {
          const { answers: next, dropped } = await upload(file)
          setAnswers(next)
          setCards(replay(next))
          return dropped
        }}
      />,
    )

  const item = items[at]

  // ⚠ Пустая очередь — это не «готово». Так бывает, когда у правила нет заданий
  // на нынешнем уровне: все рамки слияния, например, A2, а новый профиль идёт по A1.
  // Экран «Готово 0 / 0» в этом случае врал, что человек что-то прошёл, и выхода не давал.
  if (!item && log.length === 0)
    return shell(
      <main className="home">
        <h1>Пока нечего тренировать</h1>
        <p className="lead">
          {route.rule
            ? 'У этого правила нет заданий на вашем уровне. Поднимите потолок в настройках или выберите другое правило.'
            : 'Заданий под этот выбор не нашлось. Попробуйте другую тему или поднимите уровень в настройках.'}
        </p>
        <div className="row-buttons">
          <button className="primary" onClick={() => go({ screen: 'settings' })}>
            Настройки
          </button>
          <button className="ghost" onClick={() => go({ screen: 'grammar' })}>
            к правилам
          </button>
        </div>
      </main>,
    )

  if (!item) {
    const right = log.filter((a) => a.ok).length
    return (
      <main className="done">
        <h1>Готово</h1>
        <p className="score mono">
          {right} / {log.length}
        </p>
        {lost && (
          <p className="panel note small warn">
            ⚠ Ответы не сохраняются на этом устройстве: приватный просмотр или
            переполненное хранилище. Пока вкладка открыта, занятие идёт, но после
            перезагрузки прогресс пропадёт.
          </p>
        )}
        {/* ⚠ Слово обязательно: без него строки «der → die» повторяются по три раза
            и не различаются, а по одной форме не вспомнить, о чём было задание. */}
        <ul className="recap">
          {log
            .filter((a) => !a.ok)
            .map((a, i) => (
              <li key={`${a.tpl}/${a.word}/${i}`}>
                <span className="rword">{a.word}</span>
                <span>
                  <span className="mono bad">{a.given}</span> →{' '}
                  <span className="mono ok">{a.right}</span>
                </span>
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
        setLog((l) => [...l, { ...a, right: item.answer }])
        void remember(a)
        setAt((i) => i + 1)
      }}
    />
  )
}
