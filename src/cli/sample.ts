// Печать сгенерированных заданий для чтения глазами. Условие готовности Э3:
// сто заданий подряд читаются и среди них нет кривых.
//
//   npm run sample            все задания по шаблонам
//   npm run sample -- 20      первые 20 на шаблон
//   npm run sample -- --why   с разбором ошибки

import { bundle, words } from '../core/data.ts'
import { explainItem } from '../core/explain.ts'
import { itemsFor } from '../core/generate.ts'

const args = process.argv.slice(2)
const limit = Number(args.find((a) => /^\d+$/.test(a)) ?? 0) || Infinity
const withWhy = args.includes('--why')

let total = 0
for (const t of bundle.templates) {
  const items = itemsFor(t, words)
  total += items.length
  console.log(`\n── ${t.id}  [${t.rule}, ${t.level}, ${t.kind}]  заданий: ${items.length}`)
  for (const i of items.slice(0, limit)) {
    const opts = i.options ? `   ${i.options.map((o) => (o === i.answer ? `[${o}]` : o)).join(' · ')}` : ''
    console.log(`   ${i.full.padEnd(46)}${opts}`)
  }
  if (withWhy && items[0]) {
    const e = explainItem(items[0])
    console.log(`   ┌ ${e.title}`)
    console.log(`   │ ${e.short}`)
    for (const s of e.steps) console.log(`   │ · ${s}`)
    console.log(`   └ ${e.ru_contrast.replace(/\s+/g, ' ').slice(0, 120)}…`)
  }
}
console.log(`\nвсего заданий: ${total} из ${bundle.templates.length} шаблонов на ${words.length} словах`)
