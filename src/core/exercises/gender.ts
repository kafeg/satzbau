// Упражнение «Род» (docs/ex-gender.md).
import type { Gender, Noun } from '../types.ts'
import type { Exercise } from './index.ts'

export const ORDER: Gender[] = ['m', 'f', 'n']

// любой род из списка засчитывается
export function right(word: Noun, g: Gender): boolean {
  return word.gender.includes(g)
}

export const gender: Exercise<Gender> = {
  id: 'gender',
  title: 'Род: der, die, das',
  // у слов только во множественном артикль множественного, а не род
  fits: (w) => w.number === 'sg' && w.gender.length > 0 && !('gender' in w.skip),
  check: right,
  key: (g) => g,
  hows: ['word', 'phrase', 'sort'],
  field: 'gender',
}
