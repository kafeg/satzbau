// Симулятор ученика: персона занимается N дней через настоящую очередь и повторы.
// Спека и как читать выгрузку — docs/learner-sim.md.
//
//   node src/cli/learner.ts --out /tmp/sim                    все персоны, 42 дня
//   node src/cli/learner.ts --persona a1-new --days 21 --seed 2 --out /tmp/sim

import { join } from 'node:path'
import '../core/data.ts'
import { init } from '../app/srs.ts'
import { write } from './learner/out.ts'
import { PERSONAS } from './learner/personas.ts'
import { lookup, run } from './learner/run.ts'

const args = process.argv.slice(2)
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const out = opt('out')
if (!out) {
  console.error('нужен --out <папка вне репозитория>')
  process.exit(2)
}
const days = Number(opt('days') ?? 42)
const seed = Number(opt('seed') ?? 1)
const id = opt('persona') ?? 'all'
const chosen = id === 'all' ? PERSONAS : PERSONAS.filter((p) => p.id === id)
if (!chosen.length) {
  console.error(`нет персоны ${id}; есть: ${PERSONAS.map((p) => p.id).join(', ')}`)
  process.exit(2)
}

await init()
const look = lookup()
for (const p of chosen) {
  const t0 = performance.now()
  const r = run(p, days, seed)
  const m = write(r, look, join(out, p.id), Date.now())
  const end = m.checkpoints[m.checkpoints.length - 1]
  console.log(
    `${p.id}: ${m.answers} ответов, верных ${m.accuracy}%, не по знанию ${m.lucky}%, ` +
      `ложное «держится» ${end ? `${end.falseSolidRules.length} правил, слов ${end.falseSolidWords}` : '—'}, ` +
      `${Math.round((performance.now() - t0) / 1000)} с → ${join(out, p.id)}`,
  )
}
