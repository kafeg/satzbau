// Формы, которые UniMorph знает, а дрилл не примет: человек пишет верное и получает минус.
//
// ⚠ 65 ложных срабатываний на `imperativ-trennbar`: приставка стоит В РАМКЕ, а в пропуске
// только основа, поэтому «räum auf» из источника не сравнить с принятым «räum».
// Остальной остаток почти целиком мусор источника: Bank → Bänke от скамьи, frägt, buk.

import { bundle, words } from '../../src/core/data.ts'
import { accepts } from '../../src/core/check.ts'
import { fillingFor, generate } from '../../src/core/generate.ts'
import type { Template } from '../../src/core/types.ts'
import { unimorph } from './_lib.ts'

const um = unimorph()

/** Какая клетка эталона отвечает пропуску шаблона. */
function cell(t: Template): string | null {
  const s = t.slot
  switch (s.paradigm) {
    case 'noun_plural': return `n_${s.case ?? 'nom'}_pl`
    case 'noun_case': return `n_${s.case ?? 'nom'}_${s.num ?? 'sg'}`
    case 'participle': return 'v_pp'
    case 'verb_past': return 'v_pt3'
    case 'adj_comparative': return 'a_cmpr'
    case 'adj_superlative': return 'a_sprl'
    case 'imperative': return 'v_imp'
    case 'verb_present':
    case 'verb_stem': return `v_${s.person ?? '3sg'}`
    default: return null
  }
}

const rows: { tpl: string; w: string; accept: string[]; missing: string[] }[] = []
for (const t of bundle.templates) {
  if (t.kind !== 'input') continue
  const key = cell(t)
  if (!key) continue
  for (const w of fillingFor(t, words)) {
    const it = generate(t, w, words)
    const want = um[w.w]?.[key]
    if (!want) continue
    // verb_stem: в пропуске только спрягаемая часть, приставка в рамке
    const norm = (x: string) => (t.slot.paradigm === 'verb_stem' ? (x.split(' ')[0] ?? x) : x)
    const missing = want.map(norm).filter((f) => !accepts(it, f))
    if (missing.length) rows.push({ tpl: t.id, w: w.w, accept: [it.answer, ...(it.answers ?? [])], missing })
  }
}
const by: Record<string, typeof rows> = {}
for (const r of rows) (by[r.tpl] ??= []).push(r)
console.log(`заданий ввода, где источник знает форму, а дрилл её не примет: ${rows.length}\n`)
for (const [k, rs] of Object.entries(by).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`## ${k}: ${rs.length}`)
  for (const r of rs.slice(0, 20)) console.log(`   ${r.w}: примет ${JSON.stringify(r.accept)}, отвергнет ${JSON.stringify(r.missing)}`)
  if (rs.length > 20) console.log(`   … ещё ${rs.length - 20}`)
}
