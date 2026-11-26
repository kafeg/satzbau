// Ход урока: шаг — одна или несколько карточек (docs/app.md, «Подача»). Ошибочная карточка с первого
// раза возвращается в конец урока одна, основной подачей, один раз.
import type { Card, Step } from './lesson.ts'

export type Lesson = { steps: Step[]; i: number; wrong: Card[] }

export function start(steps: Step[]): Lesson {
  return { steps, i: 0, wrong: [] }
}

export function current(l: Lesson): Step | undefined {
  return l.steps[l.i]
}

// oks — по карточке шага, в том же порядке
export function answer(l: Lesson, oks: boolean[]): Lesson {
  const step = current(l)
  if (!step || step.retry) return l
  const wrong = step.cards.filter((_, k) => !oks[k])
  if (wrong.length === 0) return l
  const back = wrong.map((card): Step => ({ how: card.ex.hows[0]!, cards: [card], retry: true }))
  return { ...l, steps: [...l.steps, ...back], wrong: [...l.wrong, ...wrong] }
}

export function next(l: Lesson): Lesson {
  return { ...l, i: l.i + 1 }
}

export function done(l: Lesson): boolean {
  return l.i >= l.steps.length
}

// карточки урока без повторов ошибок
export function cards(l: Lesson): Card[] {
  return l.steps.filter((s) => !s.retry).flatMap((s) => s.cards)
}

export function firstTry(l: Lesson): number {
  return cards(l).length - l.wrong.length
}
