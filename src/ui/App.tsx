// Экраны и переходы. Состояние: база (только чтение), журнал и пересчитанные из него повторы.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { type AnyExercise, EXERCISES } from '../core/exercises/index.ts'
import { type Overview, build, overview } from '../core/lesson.ts'
import { pool } from '../core/pool.ts'
import { type Lesson as L, start } from '../core/run.ts'
import { type Memory, apply, empty, init, replay } from '../core/srs.ts'
import { type Answer, LEVELS, type Level } from '../core/types.ts'
import { type Data, load } from '../store/db.ts'
import * as journal from '../store/journal.ts'
import { download, parse } from '../store/transfer.ts'
import { Home } from './Home.tsx'
import { Lesson } from './Lesson.tsx'
import { Result } from './Result.tsx'
import { Themes } from './Themes.tsx'

// выбор пользователя — удобство, а не прогресс: не запомнился — значения по умолчанию
function saved(key: string): string | null {
  try {
    return localStorage.getItem(`satzbau.${key}`)
  } catch {
    return null
  }
}

function save(key: string, v: string) {
  try {
    localStorage.setItem(`satzbau.${key}`, v)
  } catch {
    // просто не запомнится
  }
}

const savedLevel = (): Level => {
  const v = saved('level')
  return LEVELS.includes(v as Level) ? (v as Level) : 'A1'
}

// only — урок одного упражнения; без него — все вперемешку
type Screen = { k: 'home' } | { k: 'themes' } | { k: 'lesson'; lesson: L; only?: string } | { k: 'result'; lesson: L; only?: string }

export function App() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState<Level>(savedLevel)
  const [themeId, setThemeId] = useState<string>(() => saved('theme') ?? '')
  const [screen, setScreen] = useState<Screen>({ k: 'home' })
  const [answers, setAnswers] = useState<Answer[]>([])
  const [mem, setMem] = useState<Memory | null>(null)
  const [stored, setStored] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const asked = useRef(false)
  // новая версия скачана — ждёт кнопки; проверка раз в час, пока приложение открыто
  const {
    needRefresh: [fresh],
    updateServiceWorker,
  } = useRegisterSW({ onRegisteredSW: (_, r) => r && setInterval(() => void r.update(), 3_600_000) })

  useEffect(() => {
    const saved = journal.all().catch(() => {
      setStored(false)
      return [] as Answer[]
    })
    Promise.all([load(), init().then(() => saved)]).then(([d, xs]) => {
      setData(d)
      setAnswers(xs)
      setMem(replay(xs))
    }, (e: unknown) => setError(String(e)))
  }, [])

  const theme = data?.themes.find((t) => t.id === themeId)
  const words = useMemo(() => (data ? pool(data.nouns, level, theme) : []), [data, level, theme])
  const where = useMemo(() => {
    const of = new Map(data?.themes.flatMap((t) => t.words.map((id) => [id, t.title] as const)))
    const lv = new Map(data?.nouns.map((w) => [w.id, w.level]))
    return (id: string) => [of.get(id), lv.get(id)].filter(Boolean).join(' · ')
  }, [data])
  // screen в зависимостях: «пора» пересчитывается при каждом возврате на главную
  const ov = useMemo(() => overview(words, EXERCISES, mem ?? empty(), Date.now()), [words, mem, screen])
  const each = useMemo(
    () => EXERCISES.map((ex) => [ex, overview(words, [ex], mem ?? empty(), Date.now())] as [AnyExercise, Overview]),
    [words, mem, screen],
  )

  const choose = (l: Level) => {
    setLevel(l)
    save('level', l)
  }

  const begin = (extra: number, only?: string) => {
    const cards = build(each.find(([ex]) => ex.id === only)?.[1] ?? ov, Math.random, extra)
    if (cards.length > 0) setScreen({ k: 'lesson', lesson: start(cards), only })
  }

  const record = useCallback(
    (a: Answer) => {
      setAnswers((xs) => [...xs, a])
      setMem((m) => apply(m ?? empty(), a))
      if (!stored) return
      journal.add(a).catch(() => setStored(false))
      if (!asked.current) {
        asked.current = true
        void journal.persist()
      }
    },
    [stored],
  )

  const restore = async (f: File) => {
    try {
      const xs = await parse(f)
      if (!window.confirm(`Заменить прогресс на этом устройстве прогрессом из файла (${xs.length} ответов)?`)) return
      if (stored) await journal.replace(xs)
      setAnswers(xs)
      setMem(replay(xs))
      setNotice(`Загружено ответов: ${xs.length}`)
    } catch (e) {
      setNotice(`Не загрузилось: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (error) return <main className="home"><h1>satzbau</h1><p className="sub">Не удалось открыть базу: {error}</p></main>
  if (!data || !mem) return <main className="home"><h1>satzbau</h1><p className="sub">Загружаю базу…</p></main>

  if (screen.k === 'themes')
    return (
      <Themes
        nouns={data.nouns}
        themes={data.themes}
        level={level}
        mem={mem}
        theme={theme ? themeId : ''}
        onPick={(id) => {
          setThemeId(id)
          save('theme', id)
          setScreen({ k: 'home' })
        }}
        onBack={() => setScreen({ k: 'home' })}
      />
    )

  if (screen.k === 'lesson')
    return (
      <Lesson
        key={screen.lesson.steps.map((s) => `${s.card.ex.id} ${s.card.word.id}`).join()}
        data={data}
        lesson={screen.lesson}
        where={where}
        onRecord={record}
        onDone={(l) => setScreen({ k: 'result', lesson: l, only: screen.only })}
        onClose={() => setScreen({ k: 'home' })}
      />
    )

  if (screen.k === 'result')
    return (
      <Result
        lesson={screen.lesson}
        mem={mem}
        now={Date.now()}
        onMore={() => {
          const exs = EXERCISES.filter((ex) => !screen.only || ex.id === screen.only)
          const cards = build(overview(words, exs, mem, Date.now()), Math.random)
          setScreen(cards.length > 0 ? { k: 'lesson', lesson: start(cards), only: screen.only } : { k: 'home' })
        }}
        onHome={() => setScreen({ k: 'home' })}
      />
    )

  return (
    <Home
      data={data}
      level={level}
      onLevel={choose}
      ov={ov}
      each={each}
      theme={theme?.title ?? 'Все темы'}
      onThemes={() => setScreen({ k: 'themes' })}
      onStart={begin}
      stored={stored}
      notice={notice}
      onUpdate={fresh ? () => void updateServiceWorker() : null}
      onExport={() => download(answers)}
      onImport={restore}
    />
  )
}
