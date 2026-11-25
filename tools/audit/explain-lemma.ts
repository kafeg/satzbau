// Разбор склеивает артикль или ответ со СЛОВАРНОЙ формой, а в рамке стоит другая:
// «des Fahrer» при «des Fahrers», «die guten Auto» при «die guten Autos».
//
// ⚠ ЛОЖНЫЕ СРАБАТЫВАНИЯ, их три и все законные: шаг «die Ampel — женский род» называет
// словарную форму НАМЕРЕННО (так учат множественное), «der Automat → ihn» берёт
// именительный, и «Automat — мужской род: der Automat» — тоже словарная форма.

import { bundle, words } from '../../src/core/data.ts'
import { explainItem } from '../../src/core/explain.ts'
import { fillingFor, generate } from '../../src/core/generate.ts'

const by: Record<string, { n: number; ex: string[] }> = {}
for (const t of bundle.templates) {
  for (const w of fillingFor(t, words)) {
    const it = generate(t, w, words)
    const lemma = it.ctx.w
    const form = it.ctx.wform
    if (!lemma || !form || lemma === form) continue
    const e = explainItem(it)
    const parts: [string, string][] = [['short', e.short], ['title', e.title], ...e.steps.map((s, i) => [`step${i}`, s] as [string, string])]
    for (const [where, txt] of parts) {
      const lead = [it.answer, it.ctx.nom_article, it.ctx.plain_article, it.ctx.article].filter(Boolean)
      const re = new RegExp(`(^|\\s)(${lead.join('|')})\\s${lemma}(\\s|$|[.,!?])`)
      if (re.test(txt) && !txt.includes(form)) {
        const k = `${t.rule} / ${where}`
        ;(by[k] ??= { n: 0, ex: [] }).n++
        if (by[k]!.ex.length < 2) by[k]!.ex.push(`${it.full}  ‖  ${txt}`)
      }
    }
  }
}
const rows = Object.entries(by).sort((a, b) => b[1].n - a[1].n)
if (!rows.length) console.log('не найдено')
for (const [k, v] of rows) {
  console.log(`${String(v.n).padStart(5)}  ${k}`)
  for (const x of v.ex) console.log(`        ${x}`)
}
