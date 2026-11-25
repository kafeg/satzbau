// Дательный множественного в рамках, где он есть, против UniMorph.
//
// Находка жила латентно, пока рамки на эту клетку не было: правило приписывало -n всему,
// что не кончается на n или s, и первая же такая рамка дала «Mit guten Visan» и «Skin».

import { bundle, words } from '../../src/core/data.ts'
import { fillingFor, generate } from '../../src/core/generate.ts'
import { nounForm } from '../../src/core/morph.ts'
import type { Noun } from '../../src/core/types.ts'
import { unimorph } from './_lib.ts'

const um = unimorph()
let frames = 0
const bad: string[] = []
for (const t of bundle.templates) {
  if ((t.slot.num ?? 'sg') !== 'pl' || (t.slot.case ?? 'nom') !== 'dat') continue
  frames++
  const fl = fillingFor(t, words)
  console.log(`рамка ${t.id}: ${fl.length} заданий`)
  for (const w of fl) {
    const n = w.entry as Noun
    const got = nounForm(n, 'dat', 'pl')
    const want = um[n.w]?.['n_dat_pl']
    if (want && got && !want.includes(got)) {
      bad.push(`${n.w}: ${got} ∉ ${want.join(' / ')}   «${generate(t, w, words).full}»`)
    }
  }
}
if (!frames) console.log('рамок на дательный множественного нет — проверять нечего')
console.log(`\nрасхождений: ${bad.length}`)
for (const x of bad) console.log('  ', x)
