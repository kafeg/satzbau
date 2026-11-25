// Печать заданий для чтения ГЛАЗАМИ: смысл фразы машинно не проверяется, и это
// единственный способ поймать «das saubere Frühstück» или «Sie werden das nie gehen».
//
// Выборка ровная по наполнению, а не первые N: первые — всегда самые частотные слова,
// и кривое сидит в хвосте.
//
//   node tools/audit/sample.ts        по 3 задания на шаблон
//   node tools/audit/sample.ts 10     по 10
//   node tools/audit/sample.ts 3 adj  только шаблоны, в id которых есть «adj»

import { bundle, words } from '../../src/core/data.ts'
import { itemsFor } from '../../src/core/generate.ts'
import { spread } from './_lib.ts'

const n = Number(process.argv[2]) || 3
const filter = process.argv[3]
let total = 0
for (const t of bundle.templates) {
  if (filter && !t.id.includes(filter)) continue
  const items = itemsFor(t, words)
  total += items.length
  console.log(`\n── ${t.id} [${t.rule}, ${t.level}, ${t.kind}] ${items.length}`)
  for (const i of spread(items, n)) {
    const opts = i.options ? `   ${i.options.map((o) => (o === i.answer ? `[${o}]` : o)).join(' · ')}` : ''
    console.log(`   ${i.full.padEnd(46)}${opts}`)
  }
}
console.log(`\nвсего заданий: ${total}`)
