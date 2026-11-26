// Рамка урока (docs/app.md): полоса, счётчик, метка, «Дальше», Enter и Escape.
// Вопрос, кнопки и разбор рисует экран упражнения из ui/exercises.
import { useCallback, useEffect, useState } from 'react'
import { type Lesson as L, answer, current, next } from '../core/run.ts'
import type { Answer } from '../core/types.ts'
import type { Data } from '../store/db.ts'
import { VIEWS } from './exercises/index.ts'

// «3 / 10» по основным карточкам, потом «повтор 1 / 2» по вернувшимся ошибкам
function count(l: L): string {
  const base = l.steps.filter((s) => !s.retry).length
  return l.i < base ? `${l.i + 1} / ${base}` : `повтор ${l.i - base + 1} / ${l.steps.length - base}`
}

type Props = { data: Data; lesson: L; where: (wordId: string) => string; onRecord: (a: Answer) => void; onDone: (l: L) => void; onClose: () => void }

export function Lesson({ data, lesson: first, where, onRecord, onDone, onClose }: Props) {
  const [lesson, setLesson] = useState(first)
  const [given, setGiven] = useState<{ a: unknown; ok: boolean } | null>(null)
  const step = current(lesson)

  const onAnswer = useCallback(
    (a: unknown) => {
      if (given || !step) return
      const { ex, word } = step.card
      const ok = ex.check(word, a as never)
      setGiven({ a, ok })
      setLesson(answer(lesson, ok))
      if (!step.retry) onRecord({ t: Date.now(), ex: ex.id, word: word.id, ok: ok ? 1 : 0, given: ex.key(a as never) })
    },
    [given, step, lesson, onRecord],
  )

  const go = useCallback(() => {
    if (!given) return
    const l = next(lesson)
    setGiven(null)
    if (l.i >= l.steps.length) onDone(l)
    else setLesson(l)
  }, [given, lesson, onDone])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.key === 'Enter' || e.key === ' ') && given) {
        e.preventDefault()
        go()
      } else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [given, go, onClose])

  if (!step) return null
  const { ex, word, fresh } = step.card
  const view = VIEWS[ex.id]!
  const tag = step.retry ? 'ещё раз' : fresh ? 'новое' : 'повтор'
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
        <span className={`tag ${fresh && !step.retry ? 'new' : ''}`}>{tag}</span>
        <view.Prompt word={word} />
      </section>

      <view.Choices key={`${lesson.i}`} word={word} given={given?.a ?? null} onAnswer={onAnswer} />
      {!given && <p className="where">{where(word.id)}</p>}

      {given && (
        <section className="answer" aria-live="polite">
          <view.Reveal word={word} given={given.a} ok={given.ok} data={data} />
        </section>
      )}

      {given && (
        <div className="next">
          <button className="primary" onClick={go} autoFocus>
            Дальше
          </button>
        </div>
      )}
    </div>
  )
}
