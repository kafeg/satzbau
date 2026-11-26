// Упражнение «Род» (docs/ex-gender.md).
import type { Gender, Noun } from '../types.ts'

export const ARTICLE: Record<Gender, string> = { m: 'der', f: 'die', n: 'das' }
export const ORDER: Gender[] = ['m', 'f', 'n']

// любой род из списка засчитывается
export function right(word: Noun, g: Gender): boolean {
  return word.gender.includes(g)
}
