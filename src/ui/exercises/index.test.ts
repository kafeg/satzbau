import { expect, test } from 'vitest'
import { EXERCISES } from '../../core/exercises/index.ts'
import { VIEWS } from './index.ts'

test('у каждого упражнения есть экран, и лишних экранов нет', () => {
  expect(Object.keys(VIEWS).sort()).toEqual(EXERCISES.map((e) => e.id).sort())
})
