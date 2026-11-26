// Ход урока: 10 слов, ошибки возвращаются в конце по одному разу.
import { right } from './exercises/gender.ts'
import type { Gender, Noun } from './types.ts'

export const SIZE = 10

export type Step = { word: Noun; retry: boolean }
export type Lesson = { steps: Step[]; i: number; wrong: Noun[] }

export function start(pool: Noun[], rnd: () => number = Math.random, size = SIZE): Lesson {
  const xs = [...pool]
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[xs[i], xs[j]] = [xs[j]!, xs[i]!]
  }
  return { steps: xs.slice(0, size).map((word) => ({ word, retry: false })), i: 0, wrong: [] }
}

export function current(l: Lesson): Step | undefined {
  return l.steps[l.i]
}

// Ответ на текущий шаг: ошибка с первой попытки ставит слово в конец урока ещё раз.
export function answer(l: Lesson, g: Gender): Lesson {
  const step = current(l)
  if (!step || right(step.word, g) || step.retry) return l
  return { ...l, steps: [...l.steps, { word: step.word, retry: true }], wrong: [...l.wrong, step.word] }
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
