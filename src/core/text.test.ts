import { expect, test } from 'vitest'
import { noun } from './test-words.ts'
import { around, spoken, when } from './text.ts'

test('пример делится на слово целиком, по номеру вхождения', () => {
  expect(around('Die Bank und die Bankkarte.', 'Bank', 0)).toEqual(['Die ', 'Bank', ' und die Bankkarte.'])
  expect(around('Bank, Bank!', 'Bank', 1)).toEqual(['Bank, ', 'Bank', '!'])
  expect(around('Nichts hier.', 'Bank', 0)).toEqual(['Nichts hier.', '', ''])
})

test('когда повтор — по-русски', () => {
  expect([0, 1, 2, 5, 11, 21, 22].map(when)).toEqual([
    'сегодня', 'завтра', 'через 2 дня', 'через 5 дней', 'через 11 дней', 'через 21 день', 'через 22 дня',
  ])
})

test('формы для озвучки — как строка форм: с множественным и без, первый род и первая форма', () => {
  expect(spoken(noun('Tisch', ['m'], { plural: ['Tische'] }))).toBe('der Tisch, die Tische')
  expect(spoken(noun('Milch', ['f']))).toBe('die Milch')
  expect(spoken(noun('Joghurt', ['m', 'n'], { plural: ['Joghurts', 'Joghurt'] }))).toBe('der Joghurt, die Joghurts')
})
