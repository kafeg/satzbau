// Ход урока: ошибка с первого раза ставит карточку в конец урока ещё раз, один раз.
import type { Card } from './lesson.ts'

export type Step = { card: Card; retry: boolean }
export type Lesson = { steps: Step[]; i: number; wrong: Card[] }

export function start(cards: Card[]): Lesson {
  return { steps: cards.map((card) => ({ card, retry: false })), i: 0, wrong: [] }
}

export function current(l: Lesson): Step | undefined {
  return l.steps[l.i]
}

export function answer(l: Lesson, ok: boolean): Lesson {
  const step = current(l)
  if (!step || ok || step.retry) return l
  return { ...l, steps: [...l.steps, { card: step.card, retry: true }], wrong: [...l.wrong, step.card] }
}

export function next(l: Lesson): Lesson {
  return { ...l, i: l.i + 1 }
}

export function done(l: Lesson): boolean {
  return l.i >= l.steps.length
}

export function firstTry(l: Lesson): number {
  return l.steps.filter((s) => !s.retry).length - l.wrong.length
}
