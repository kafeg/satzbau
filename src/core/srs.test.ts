import { beforeAll, expect, test } from 'vitest'
import { apply, dueIn, empty, init, isDue, learned, replay, startedToday } from './srs.ts'
import type { Answer } from './types.ts'

const T0 = new Date(2026, 10, 26, 10).getTime()
const DAY = 86_400_000
const a = (word: string, ok: 0 | 1, t = T0): Answer => ({ t, ex: 'gender', word, ok, given: 'm' })

beforeAll(init)

test('ошибка — повтор завтра, верно — позже', () => {
  const m = replay([a('n:Tisch', 0), a('n:Stuhl', 1)])
  expect(dueIn(m, 'gender', 'n:Tisch', T0)).toBe(1)
  expect(dueIn(m, 'gender', 'n:Stuhl', T0)).toBeGreaterThan(1)
  expect(isDue(m, 'gender', 'n:Tisch', T0)).toBe(false)
  expect(isDue(m, 'gender', 'n:Tisch', T0 + DAY)).toBe(true)
  expect(dueIn(m, 'gender', 'n:Bett', T0)).toBeNull()
})

test('ответ поверх даёт то же, что проигрыш журнала', () => {
  const xs = [a('n:Tisch', 0), a('n:Stuhl', 1), a('n:Tisch', 1, T0 + DAY), a('n:Stuhl', 1, T0 + 5 * DAY)]
  let m = empty()
  for (const x of xs) m = apply(m, x)
  expect(m).toEqual(replay(xs))
})

test('новые считаются по дню первого ответа', () => {
  const m = replay([a('n:Tisch', 1), a('n:Stuhl', 0), a('n:Tisch', 1, T0 + DAY)])
  expect(startedToday(m, 'gender', T0)).toBe(2)
  expect(startedToday(m, 'gender', T0 + DAY)).toBe(0)
})

test('выучено — интервал от трёх недель', () => {
  let t = T0
  const xs: Answer[] = []
  let m = empty()
  while (!learned(m, 'gender', 'n:Tisch') && xs.length < 10) {
    const x = a('n:Tisch', 1, t)
    xs.push(x)
    m = apply(m, x)
    t += (dueIn(m, 'gender', 'n:Tisch', t) ?? 1) * DAY
  }
  expect(learned(m, 'gender', 'n:Tisch')).toBe(true)
  expect(xs.length).toBeGreaterThan(1)
})
