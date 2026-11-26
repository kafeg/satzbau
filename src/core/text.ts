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
