import { beforeAll, expect, test } from 'vitest'
import type { AnyExercise } from './exercises/index.ts'
import { gender } from './exercises/gender.ts'
import { NEW_PER_DAY, SORT, build, freshToday, overview, steps } from './lesson.ts'
import { init, replay } from './srs.ts'
import { noun } from './test-words.ts'
import type { Answer } from './types.ts'

const T0 = new Date(2026, 10, 26, 10).getTime()
const DAY = 86_400_000
const words = Array.from({ length: 40 }, (_, i) => noun(`W${String(i).padStart(2, '0')}`))
const keep = () => 0.99 // перемешивание без перестановок: порядок виден в тестах
const a = (i: number, ok: 0 | 1, t = T0, ex = 'gender'): Answer => ({ t, ex, word: words[i]!.id, ok, given: 'm' })
const plural: AnyExercise = { id: 'plural', title: 'мн. ч.', after: 'gender', fits: () => true, check: () => true, key: String, hows: ['word'] }

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
  expect(o.left).toBe(0)
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

test('лимит новых — общий на все упражнения', () => {
  const xs = Array.from({ length: NEW_PER_DAY / 2 }, (_, i) => a(i, 1))
  const ys = Array.from({ length: NEW_PER_DAY / 2 }, (_, i) => a(i, 1, T0, 'plural'))
  const o = overview(words, [gender, plural], replay([...xs, ...ys]), T0 + 60_000)
  expect(o.left).toBe(0)
  expect(build(o, keep).filter((c) => c.fresh)).toEqual([])
})

const all = () => true
const none = () => false

test('подачи: новые — основной; повтор — по кругу по числу ответов, phrase — только если есть фраза', () => {
  // W00 отвечен раз, W01 — дважды: у первого подача по кругу вторая, у второго — снова основная
  const m = replay([a(0, 0), a(1, 0), a(1, 0, T0 + DAY)])
  const cards = build(overview(words.slice(0, 3), [gender], m, T0 + 3 * DAY), keep)
  const how = (ss: ReturnType<typeof steps>, l: string) => ss.find((s) => s.cards[0]!.word.lemma === l)!.how
  const ss = steps(cards, m, all)
  expect(how(ss, 'W00')).toBe('phrase')
  expect(how(ss, 'W01')).toBe('word')
  expect(how(ss, 'W02')).toBe('word')
  expect(how(steps(cards, m, none), 'W00')).toBe('word')
})

test('раскладка: SORT повторов упражнения с sort — один шаг; меньше — по одной', () => {
  const m = replay(Array.from({ length: SORT }, (_, i) => a(i, 0)))
  const cards = build(overview(words, [gender], m, T0 + DAY), keep)
  const ss = steps(cards, m, none)
  const sort = ss.filter((s) => s.how === 'sort')
  expect(sort).toHaveLength(1)
  expect(sort[0]!.cards).toHaveLength(SORT)
  expect(sort[0]!.cards.every((c) => !c.fresh)).toBe(true)
  expect(ss.flatMap((s) => s.cards)).toHaveLength(cards.length)
  const few = replay(Array.from({ length: SORT - 1 }, (_, i) => a(i, 0)))
  expect(steps(build(overview(words, [gender], few, T0 + DAY), keep), few, none).some((s) => s.how === 'sort')).toBe(false)
})

test('упражнение без sort раскладкой не спрашивается', () => {
  const xs = Array.from({ length: SORT }, (_, i) => a(i, 0, T0, 'plural'))
  const m = replay(xs)
  const ss = steps(build(overview(words, [plural], m, T0 + DAY), keep), m, all)
  expect(ss.every((s) => s.how === 'word')).toBe(true)
})
