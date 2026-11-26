import { expect, test } from 'vitest'
import { gender } from './exercises/gender.ts'
import type { Card } from './lesson.ts'
import { answer, current, done, firstTry, next, start } from './run.ts'
import { noun } from './test-words.ts'

const card = (l: string): Card => ({ ex: gender, word: noun(l), fresh: true })

test('ошибка возвращает карточку в конец один раз', () => {
  let l = start([card('Tisch'), card('Stuhl')])
  const c = current(l)!.card
  l = answer(l, false)
  expect(l.steps).toHaveLength(3)
  l = next(next(l))
  expect(current(l)).toEqual({ card: c, retry: true })
  l = answer(l, false)
  expect(l.steps).toHaveLength(3)
  l = next(l)
  expect(done(l)).toBe(true)
  expect(firstTry(l)).toBe(1)
})

test('верный ответ ничего не добавляет', () => {
  const l = answer(start([card('Tisch')]), true)
  expect(l.steps).toHaveLength(1)
  expect(l.wrong).toEqual([])
})
