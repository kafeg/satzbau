import { expect, test } from 'vitest'
import { right } from './exercises/gender.ts'
import { answer, current, done, firstTry, next, start } from './run.ts'
import { around } from './text.ts'
import type { Noun } from './types.ts'

const noun = (lemma: string, gender: Noun['gender']): Noun =>
  ({ id: `n:${lemma}`, lemma, gender, plural: [], ru: null, ruLlm: false, level: 'A1' })

const pool = ['Bank', 'Haus', 'Tisch', 'Kilo'].map((l, i) => noun(l, i === 3 ? ['n', 'm'] : [(['f', 'n', 'm'] as const)[i]!]))

test('урок без повторов и не больше пула', () => {
  const l = start(pool, () => 0.5, 10)
  expect(l.steps).toHaveLength(4)
  expect(new Set(l.steps.map((s) => s.word.id)).size).toBe(4)
})

test('любой род из списка засчитывается', () => {
  expect(right(pool[3]!, 'm')).toBe(true)
  expect(right(pool[3]!, 'n')).toBe(true)
  expect(right(pool[3]!, 'f')).toBe(false)
})

test('ошибка возвращает слово в конец один раз', () => {
  let l = start(pool.slice(0, 2), () => 0, 2)
  const w = current(l)!.word
  const bad = (['m', 'f', 'n'] as const).find((g) => !right(w, g))!
  l = answer(l, bad)
  expect(l.steps).toHaveLength(3)
  l = next(next(l))
  expect(current(l)).toEqual({ word: w, retry: true })
  l = answer(l, bad)
  expect(l.steps).toHaveLength(3)
  l = next(l)
  expect(done(l)).toBe(true)
  expect(firstTry(l)).toBe(1)
})

test('пример делится на слово целиком, по номеру вхождения', () => {
  expect(around('Die Bank und die Bankkarte.', 'Bank', 0)).toEqual(['Die ', 'Bank', ' und die Bankkarte.'])
  expect(around('Bank, Bank!', 'Bank', 1)).toEqual(['Bank, ', 'Bank', '!'])
  expect(around('Nichts hier.', 'Bank', 0)).toEqual(['Nichts hier.', '', ''])
})
