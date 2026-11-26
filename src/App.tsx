import { useEffect, useMemo, useState } from 'react'
import { type Data, LEVELS, type Level, load } from './db.ts'
import { Full, GenderLesson } from './Gender.tsx'
import { type Lesson, SIZE, firstTry, start } from './gender.ts'

const KEY = 'satzbau.level'

function savedLevel(): Level {
  try {
    const v = localStorage.getItem(KEY)
    return LEVELS.includes(v as Level) ? (v as Level) : 'A1'
  } catch {
    return 'A1'
  }
}

type Screen = { k: 'home' } | { k: 'lesson'; lesson: Lesson } | { k: 'result'; lesson: Lesson }

export function App() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState<Level>(savedLevel)
  const [screen, setScreen] = useState<Screen>({ k: 'home' })

  useEffect(() => {
    load().then(setData, (e: unknown) => setError(String(e)))
  }, [])

  const counts = useMemo(
    () => Object.fromEntries(LEVELS.map((l) => [l, data ? data.genderWords(l).length : 0])) as Record<Level, number>,
    [data],
  )

  const choose = (l: Level) => {
    setLevel(l)
    try {
      localStorage.setItem(KEY, l)
    } catch {
      // уровень просто не запомнится
    }
  }
  const lesson = () => data && setScreen({ k: 'lesson', lesson: start(data.genderWords(level)) })

  if (error) return <main className="home"><h1>satzbau</h1><p className="sub">Не удалось открыть базу: {error}</p></main>
  if (!data) return <main className="home"><h1>satzbau</h1><p className="sub">Загружаю базу…</p></main>

  if (screen.k === 'lesson')
    return (
      <GenderLesson
        key={screen.lesson.steps.map((s) => s.word.id).join()}
        data={data}
        lesson={screen.lesson}
        onDone={(l) => setScreen({ k: 'result', lesson: l })}
        onClose={() => setScreen({ k: 'home' })}
      />
    )

  if (screen.k === 'result') {
    const l = screen.lesson
    const n = l.steps.filter((s) => !s.retry).length
    return (
      <main className="home result">
        <h1>Урок готов</h1>
        <p className="score">
          <b>{firstTry(l)}</b> из {n} <span className="sub">с первого раза</span>
        </p>
        {l.wrong.length > 0 && (
          <>
            <div className="section">Ошибки</div>
            <ul className="list">
              {l.wrong.map((w) => (
                <li key={w.id}>
                  <Full word={w} />
                  {w.ru && <span className="sub">{w.ru}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="row">
          <button className="primary" onClick={lesson} autoFocus>
            Ещё урок
          </button>
          <button className="secondary" onClick={() => setScreen({ k: 'home' })}>
            Готово
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="home">
      <header className="head">
        <h1>satzbau</h1>
        <span className="caption">{__VERSION__}</span>
      </header>

      <div>
        <div className="section">Уровень</div>
        <div className="chips" role="radiogroup" aria-label="Уровень">
          {LEVELS.map((l) => (
            <button key={l} role="radio" aria-checked={l === level} className={`chip ${l === level ? 'on' : ''}`} onClick={() => choose(l)}>
              {l}
            </button>
          ))}
        </div>
        <p className="sub">Слова уровня и всех ниже: {counts[level]}</p>
      </div>

      <button className="cta" onClick={lesson}>
        <span className="cta-title">
          Род: <span className="mono">der, die, das</span>
        </span>
        <span className="cta-sub">
          {SIZE} слов · ошибки вернутся в конце урока
        </span>
      </button>

      <footer className="about">
        Данные: {data.meta.attribution}. Код MIT, данные CC BY-SA 4.0 —{' '}
        <a href="https://github.com/kafeg/satzbau">github.com/kafeg/satzbau</a>
      </footer>
    </main>
  )
}
