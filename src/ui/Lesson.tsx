// Рамка урока (docs/app.md): полоса, счётчик, метка, панель ответа, «Дальше», Enter и Escape.
// Вопрос рисует подача из общих частей ui/answer; упражнение даёт им только данные (VIEWS).
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Step } from '../core/lesson.ts'
import { type Lesson as L, answer, current, next } from '../core/run.ts'
import type { Answer } from '../core/types.ts'
import type { Data } from '../store/db.ts'
import { AnswerPanel } from './answer/AnswerPanel.tsx'
import { Choices } from './answer/Choices.tsx'
import { PhrasePrompt } from './answer/PhrasePrompt.tsx'
import { Say, SayTip } from './answer/Say.tsx'
import { SortBoard } from './answer/SortBoard.tsx'
import { WordFacts } from './answer/WordFacts.tsx'
import { WordPrompt } from './answer/WordPrompt.tsx'
import { viewOf } from './exercises/index.ts'

// «3 / 10» по основным шагам, потом «повтор 1 / 2» по вернувшимся ошибкам
function count(l: L): string {
  const base = l.steps.filter((s) => !s.retry).length
  return l.i < base ? `${l.i + 1} / ${base}` : `повтор ${l.i - base + 1} / ${l.steps.length - base}`
}

function tagOf(step: Step): [string, boolean] {
  if (step.retry) return ['ещё раз', false]
  if (step.how === 'sort') return [`повтор · ${step.cards.length} слов`, false]
  return step.cards[0]!.fresh ? ['новое', true] : ['повтор', false]
}

type Given = { as: unknown[]; oks: boolean[] }
type Props = { data: Data; lesson: L; where: (wordId: string) => string; onRecord: (a: Answer) => void; onDone: (l: L) => void; onClose: () => void }

export function Lesson({ data, lesson: first, where, onRecord, onDone, onClose }: Props) {
  const [lesson, setLesson] = useState(first)
  const [given, setGiven] = useState<Given | null>(null)
  const step = current(lesson)

  const onAnswer = useCallback(
    (as: unknown[]) => {
      if (given || !step) return
      const oks = step.cards.map((c, k) => c.ex.check(c.word, as[k] as never))
      setGiven({ as, oks })
      setLesson(answer(lesson, oks))
      if (step.retry) return
      const t = Date.now()
      step.cards.forEach((c, k) =>
        onRecord({ t, ex: c.ex.id, word: c.word.id, ok: oks[k] ? 1 : 0, given: c.ex.key(as[k] as never), how: step.how }),
      )
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

  const card = step?.cards[0]
  const cloze = useMemo(() => (card && step?.how === 'phrase' ? data.cloze(card.word.id, card.ex.field) : null), [data, card, step?.how])
  if (!step || !card) return null
  const view = viewOf(card.ex.id)
  const [label, isNew] = tagOf(step)
  const tag = <span className={`tag ${isNew ? 'new' : ''}`}>{label}</span>
  // в разборе: у одного слова — оно само, у раскладки — только ошибочные
  const shown = given ? step.cards.map((c, k) => [c, given.as[k]] as const).filter((_, k) => step.cards.length === 1 || !given.oks[k]) : []
  const options = view.options(card.word)
  const pick = (i: number) => onAnswer([options[i]!.a])
  const mine = given ? (given.as[0] as never) : null
  const at = (a: never) => options.findIndex((o) => card.ex.key(o.a) === card.ex.key(a))

  return (
    <div className={`lesson ${step.how === 'sort' ? 'sorting' : ''}`}>
      <header className="bar">
        <button className="close" aria-label="Закрыть урок" onClick={onClose}>
          ×
        </button>
        <div className="progress" aria-hidden>
          <i style={{ width: `${(lesson.i / lesson.steps.length) * 100}%` }} />
        </div>
        <span className="count">{count(lesson)}</span>
      </header>

      {step.how === 'sort' ? (
        <SortBoard key={lesson.i} cards={step.cards} view={view} tag={tag} done={!!given} onAnswer={onAnswer} />
      ) : (
        <>
          <section className="word">
            {tag}
            {cloze ? (
              <PhrasePrompt cloze={cloze} art={view.art(card.word, mine)} />
            ) : (
              <WordPrompt word={card.word} art={view.art(card.word, mine)} ask={view.ask} />
            )}
            {/* «послушать» — одна, в углу карточки и только после ответа: фраза с ответом или показанные формы */}
            {given && <Say text={cloze ? cloze.de : view.said(card.word, mine)} />}
          </section>
          <Choices
            key={lesson.i}
            options={options}
            chosen={mine === null ? null : at(mine)}
            // верный ответ засчитан — это нажатая; иначе первая подходящая (у слова с двумя родами верен любой)
            right={mine === null ? null : given!.oks[0] ? at(mine) : options.findIndex((o) => card.ex.check(card.word, o.a))}
            onPick={pick}
            wide={options.length > 3}
          />
          {!given && <p className="where">{where(card.word.id)}</p>}
        </>
      )}

      {given && (
        <AnswerPanel ok={given.oks.every(Boolean)} fill={step.how === 'sort' && shown.length > 0} onNext={go}>
          {shown.map(([c, a]) => (
            <WordFacts key={c.word.id} view={viewOf(c.ex.id)} field={c.ex.field} word={c.word} given={a} data={data} phrase={!!cloze} />
          ))}
        </AnswerPanel>
      )}
      {/* под панелью, один раз за всё время — после первого «послушать» */}
      {given && <SayTip />}
    </div>
  )
}
