// Нормализация ввода не должна склеивать РАЗНЫЕ слова: диграфы («faehrst») принимаются,
// а голая гласная («fahrst») обязана остаться ошибкой — это ровно то, что тренируется.

import { bundle } from '../../src/core/data.ts'
import { normalize } from '../../src/core/check.ts'

const by = new Map<string, Set<string>>()
for (const e of [...bundle.nouns, ...bundle.verbs, ...bundle.adjs]) {
  const k = normalize(e.w)
  if (!by.has(k)) by.set(k, new Set())
  by.get(k)!.add(e.w)
}
const clash = [...by.values()].filter((s) => s.size > 1)
console.log(`пар слов лексикона, которые нормализация делает одним: ${clash.length}`)
for (const s of clash) console.log('  ', [...s].join(' = '))
console.log('\n⚠ Пары, различающиеся только РЕГИСТРОМ (Essen/essen), — не дефект:')
console.log('   ввод и так принимается без учёта регистра, пропуск бывает первым словом фразы.')
console.log('   Дефект — пара, которую склеил бы ДИГРАФ или ß: её тут быть не должно.')
const digraph = clash.filter((s) => new Set([...s].map((x) => x.toLowerCase())).size > 1)
console.log(`\nсклеено диграфом или ß: ${digraph.length}`)
for (const s of digraph) console.log('  ⚠', [...s].join(' = '))
