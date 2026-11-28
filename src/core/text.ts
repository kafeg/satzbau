import { ARTICLE } from './exercises/gender.ts'
import type { Noun } from './types.ts'

// Фраза примера на три части вокруг nth-го вхождения слова целиком (не внутри другого слова).
export function around(de: string, word: string, nth: number): [string, string, string] {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'gu')
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(de))) {
    if (k++ === nth) return [de.slice(0, m.index), m[0], de.slice(m.index + m[0].length)]
  }
  return [de, '', '']
}

// Русское число с существительным: 1 день, 3 дня, 5 дней, 21 день.
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const a = n % 10
  const b = n % 100
  if (a === 1 && b !== 11) return one
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few
  return many
}

// Когда повтор: «сегодня», «завтра», «через 3 дня».
export function when(days: number): string {
  if (days <= 0) return 'сегодня'
  if (days === 1) return 'завтра'
  return `через ${days} ${plural(days, ['день', 'дня', 'дней'])}`
}

// Формы слова для озвучки, как строка форм в разборе: «der Tisch, die Tische»; без множественного — «die Milch».
export function spoken(w: Noun): string {
  const sg = `${ARTICLE[w.gender[0]!]} ${w.lemma}`
  return w.plural[0] ? `${sg}, die ${w.plural[0]}` : sg
}
