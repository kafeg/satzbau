// Склонение существительных и степени сравнения против UniMorph.
//
// ⚠ Дательный ЕДИНСТВЕННОГО не сверяется: UniMorph даёт архаичное Dativ-e («dem Manne»,
// «dem Hause») — это 461 расхождение из 494, и прав наш вывод, а не источник.
// Остальные семь клеток сверяемы, и ими найдены Mensch, Gast, Feld, Leiter, «den Namens».

import { bundle } from '../../src/core/data.ts'
import { adjForm, comparative, nounForm, superlative } from '../../src/core/morph.ts'
import type { Case, Gender, Num } from '../../src/core/types.ts'
import { head, unimorph } from './_lib.ts'

const um = unimorph()
const CASES: Case[] = ['nom', 'akk', 'dat', 'gen']
const GEN: [string, Gender][] = [['masc', 'm'], ['fem', 'f'], ['neut', 'n']]
type Row = { w: string; slot: string; got: string; want: string[] }

const bad: Row[] = []
let checked = 0
for (const n of bundle.nouns) {
  const want = um[n.w]
  if (!want) continue
  for (const c of CASES) {
    for (const num of ['sg', 'pl'] as Num[]) {
      if (c === 'dat' && num === 'sg') continue
      const exp = want[`n_${c}_${num}`]
      const got = nounForm(n, c, num)
      if (!exp || !got) continue
      checked++
      if (!exp.includes(got)) bad.push({ w: n.w, slot: `${c}_${num}`, got, want: exp })
    }
  }
}
head(`существительные: ${checked} форм, расхождений ${bad.length}`)
report(bad)

const badA: Row[] = []
let checkedA = 0
for (const a of bundle.adjs) {
  const want = um[a.w]
  if (!want) continue
  const pairs: [string, string[] | undefined, string][] = [
    ['cmpr', want['a_cmpr'], comparative(a)],
    ['sprl', want['a_sprl'], superlative(a)],
    ...GEN.map(([k, g]) => [`strong_nom_${k}`, want[`astrong_nom_${k}`], adjForm(a, 'strong', 'nom', g)] as [string, string[] | undefined, string]),
    ['strong_nom_pl', want['astrong_nom_pl'], adjForm(a, 'strong', 'nom', 'm', 'pl')],
  ]
  for (const [slot, exp, got] of pairs) {
    if (!exp) continue
    checkedA++
    if (!exp.includes(got)) badA.push({ w: a.w, slot, got, want: exp })
  }
}
head(`прилагательные: ${checkedA} форм, расхождений ${badA.length}`)
report(badA)

function report(rows: Row[]): void {
  const by: Record<string, Row[]> = {}
  for (const r of rows) (by[r.slot] ??= []).push(r)
  for (const [k, rs] of Object.entries(by).sort((a, b) => b[1].length - a[1].length)) {
    console.log(` ${k}: ${rs.length}`)
    for (const r of rs.slice(0, 25)) console.log(`    ${r.w}: ${r.got} ∉ ${r.want.join(' / ')}`)
    if (rs.length > 25) console.log(`    … ещё ${rs.length - 25}`)
  }
}
