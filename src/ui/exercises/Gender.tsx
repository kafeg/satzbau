import { useEffect, useMemo, useState } from 'react'
import { ARTICLE, ORDER, right } from '../../core/exercises/gender.ts'
import { type Lesson, answer, current, next } from '../../core/run.ts'
import { around } from '../../core/text.ts'
import type { Gender as G, Noun } from '../../core/types.ts'
import type { Data } from '../../store/db.ts'

export function Art({ g }: { g: G | 'pl' }) {
  return <span className={`art g-${g}`}>{g === 'pl' ? 'die' : ARTICLE[g]}</span>
}

export function Full({ word }: { word: Noun }) {
  const [g, ...also] = word.gender
  return (
    <span className="full">
      <Art g={g!} /> <span className="mono">{word.lemma}</span>
      {word.plural[0] && (
        <span className="pl">
          {' · '}
          <Art g="pl" /> <span className="mono">{word.plural[0]}</span>
        </span>
      )}
      {also.length > 0 && <span className="also"> · также {also.map((x) => ARTICLE[x]).join(', ')}</span>}
    </span>
  )
}

function Example({ data, word }: { data: Data; word: Noun }) {
  const ex = useMemo(() => data.example(word.id), [data, word.id])
  if (!ex) return null
  const [a, w, c] = around(ex.de, ex.word, ex.nth)
  return (
    <div className="example">
      <p className="de">
        {a}
        <mark className={`g-${word.gender[0]}`}>{w}</mark>
        {c}
      </p>
      <p className="tr">
        {ex.tr}
        {ex.llm && <span className="llm"> · машинный перевод</span>}
      </p>
    </div>
  )
}

// «3 / 10» по основным словам, потом «повтор 1 / 2» по вернувшимся ошибкам
function count(l: Lesson): string {
  const base = l.steps.filter((s) => !s.retry).length
  return l.i < base ? `${l.i + 1} / ${base}` : `повтор ${l.i - base + 1} / ${l.steps.length - base}`
}

type Props = { data: Data; lesson: Lesson; onDone: (l: Lesson) => void; onClose: () => void }

export function GenderLesson({ data, lesson: first, onDone, onClose }: Props) {
  const [lesson, setLesson] = useState(first)
  const [picked, setPicked] = useState<G | null>(null)
  const step = current(lesson)

  const pick = (g: G) => {
    if (picked || !step) return
    setPicked(g)
    setLesson(answer(lesson, g))
  }
  const go = () => {
    if (!picked) return
    const l = next(lesson)
    setPicked(null)
    if (l.i >= l.steps.length) onDone(l)
    else setLesson(l)
  }

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const g = ORDER[Number(e.key) - 1]
      if (g) pick(g)
      else if ((e.key === 'Enter' || e.key === ' ') && picked) {
        e.preventDefault()
        go()
      } else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  if (!step) return null
  const w = step.word
  const ok = picked ? right(w, picked) : false
  return (
    <div className="lesson">
      <header className="bar">
        <button className="close" aria-label="Закрыть урок" onClick={onClose}>
          ×
        </button>
        <div className="progress" aria-hidden>
          <i style={{ width: `${(lesson.i / lesson.steps.length) * 100}%` }} />
        </div>
        <span className="count">{count(lesson)}</span>
      </header>

      <section className="word">
        <div className="lemma mono">{w.lemma}</div>
        {w.ru && (
          <div className="ru">
            {w.ru}
            {w.ruLlm && <span className="llm"> · машинный перевод</span>}
          </div>
        )}
        {step.retry && <div className="retry">ещё раз</div>}
      </section>

      <div className="choices">
        {ORDER.map((g, i) => {
          const cls = !picked ? '' : right(w, g) ? `g-${g} shown` : g === picked ? 'struck' : 'dim'
          return (
            <button key={g} className={`choice mono ${cls}`} disabled={!!picked} onClick={() => pick(g)}>
              {ARTICLE[g]}
              <kbd>{i + 1}</kbd>
            </button>
          )
        })}
      </div>

      {picked && (
        <section className="answer" aria-live="polite">
          <div className={`verdict ${ok ? 'yes' : 'no'}`}>{ok ? 'Верно' : 'Неверно'}</div>
          <Full word={w} />
          <Example data={data} word={w} />
        </section>
      )}

      {picked && (
        <div className="next">
          <button className="primary" onClick={go} autoFocus>
            Дальше
          </button>
        </div>
      )}
    </div>
  )
}
