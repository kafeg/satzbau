import { expect, test } from 'vitest'
import { gender } from './exercises/gender.ts'
import type { Card, Step } from './lesson.ts'
import { answer, current, done, firstTry, next, start } from './run.ts'
import { noun } from './test-words.ts'

const card = (l: string, fresh = true): Card => ({ ex: gender, word: noun(l), fresh })
const one = (c: Card): Step => ({ how: 'word', cards: [c], retry: false })

test('ошибка возвращает карточку в конец один раз', () => {
  let l = start([one(card('Tisch')), one(card('Stuhl'))])
  const c = current(l)!.cards[0]!
  l = answer(l, [false])
  expect(l.steps).toHaveLength(3)
  l = next(next(l))
  expect(current(l)).toEqual({ how: 'word', cards: [c], retry: true })
  l = answer(l, [false])
  expect(l.steps).toHaveLength(3)
  l = next(l)
  expect(done(l)).toBe(true)
  expect(firstTry(l)).toBe(1)
})

test('верный ответ ничего не добавляет', () => {
  const l = answer(start([one(card('Tisch'))]), [true])
  expect(l.steps).toHaveLength(1)
  expect(l.wrong).toEqual([])
})

test('раскладка: каждая ошибочная карточка возвращается одна, основной подачей', () => {
  const six = ['A', 'B', 'C', 'D', 'E', 'F'].map((x) => card(x, false))
  let l = start([{ how: 'sort', cards: six, retry: false }])
  l = answer(l, [true, false, true, true, false, true])
  expect(l.steps.slice(1)).toEqual([
    { how: 'word', cards: [six[1]], retry: true },
    { how: 'word', cards: [six[4]], retry: true },
  ])
  expect(firstTry(l)).toBe(4)
})
