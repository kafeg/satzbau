// Реестр упражнений ядра (docs/app.md, «Упражнение»). Экраны — ui/exercises/index.ts.
import type { How, Noun } from '../types.ts'
import { gender } from './gender.ts'
import { plural } from './plural.ts'

export type Exercise<A = never> = {
  id: string
  title: string
  after?: string
  fits(w: Noun): boolean
  check(w: Noun, a: A): boolean
  key(a: A): string
  // подачи (docs/app.md, «Подача»), первая — основная
  hows: How[]
  // поле слова, о котором спрашиваем: по нему подсказка правила и фраза для пропуска
  field: string
}

// реестру тип ответа не важен: его знают модуль и экран упражнения
export type AnyExercise = Exercise<any>

export const EXERCISES: AnyExercise[] = [gender, plural]

export function exercise(id: string): AnyExercise | undefined {
  return EXERCISES.find((e) => e.id === id)
}
