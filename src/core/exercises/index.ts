// Реестр упражнений ядра (docs/app.md, «Упражнение»). Экраны — ui/exercises/index.ts.
import type { Noun } from '../types.ts'
import { gender } from './gender.ts'
import { plural } from './plural.ts'

export type Exercise<A = never> = {
  id: string
  title: string
  after?: string
  fits(w: Noun): boolean
  check(w: Noun, a: A): boolean
  key(a: A): string
}

// реестру тип ответа не важен: его знают модуль и экран упражнения
export type AnyExercise = Exercise<any>

export const EXERCISES: AnyExercise[] = [gender, plural]

export function exercise(id: string): AnyExercise | undefined {
  return EXERCISES.find((e) => e.id === id)
}
