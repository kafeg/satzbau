import { beforeAll, expect, test } from 'vitest'
import type { AnyExercise } from './exercises/index.ts'
import { gender } from './exercises/gender.ts'
import { NEW_PER_DAY, build, freshToday, overview } from './lesson.ts'
import { init, replay } from './srs.ts'
import { noun } from './test-words.ts'
import type { Answer } from './types.ts'

const T0 = new Date(2026, 10, 26, 10).getTime()
const DAY = 86_400_000
const words = Array.from({ length: 40 }, (_, i) => noun(`W${String(i).padStart(2, '0')}`))
const keep = () => 0.99 // перемешивание без перестановок: порядок виден в тестах
const a = (i: number, ok: 0 | 1, t = T0, ex = 'gender'): Answer => ({ t, ex, word: words[i]!.id, ok, given: 'm' })
const plural: AnyExercise = { id: 'plural', title: 'мн. ч.', after: 'gender', fits: () => true, check: () => true, key: String }

beforeAll(init)

test('сначала пора повторить, потом новые по порядку пула', () => {
  const m = replay([a(5, 0), a(7, 0)])
  const o = overview(words, [gender], m, T0 + DAY)
  const ids = build(o, keep).map((c) => c.word.lemma)
  expect(ids.slice(0, 2).sort()).toEqual(['W05', 'W07'])
  expect(ids).toHaveLength(10)
  expect(ids).toContain('W00')
  expect(ids).toContain('W09')
  expect(ids).not.toContain('W10')
  expect(build(o, keep).filter((c) => c.fresh)).toHaveLength(8)
})

test('лимит новых в день; сверх лимита — только «ещё»', () => {
  const xs = Array.from({ length: NEW_PER_DAY }, (_, i) => a(i, 1))
  const o = overview(words, [gender], replay(xs), T0 + 60_000)
  expect(o.left.get('gender')).toBe(0)
  expect(freshToday(o)).toBe(0)
  expect(build(o, keep)).toEqual([])
  expect(build(o, keep, 10).map((c) => c.word.lemma)[0]).toBe(`W${NEW_PER_DAY}`)
  expect(freshToday(overview(words, [gender], replay(xs), T0 + DAY))).toBe(NEW_PER_DAY)
})

test('after: новая карточка — только когда у слова начато первое упражнение', () => {
  const o = overview(words.slice(0, 3), [gender, plural], replay([a(1, 1)]), T0)
  expect(o.fresh.filter((c) => c.ex.id === 'plural').map((c) => c.word.lemma)).toEqual(['W01'])
})

test('одно слово — один раз за урок', () => {
  const m = replay([a(0, 0), a(0, 0, T0, 'plural')])
  const cards = build(overview(words.slice(0, 2), [gender, plural], m, T0 + DAY), keep)
  expect(cards.map((c) => c.word.lemma).sort()).toEqual(['W00', 'W01'])
})

test('слова, которым упражнение не подходит, не берутся', () => {
  const pl = noun('Eltern', [], { number: 'pl' })
  expect(overview([pl], [gender], replay([]), T0).fresh).toEqual([])
})
