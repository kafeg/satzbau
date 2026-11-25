// Разбор утверждает про задание то, чего в нём нет. Текст один на правило, а правило
// охватывает рамки с разным предлогом, лицом, родом и глаголом.
//
// ⚠ Проверка «предлог назван, а в задании его нет» ПРОПУСКАЕТ слитные формы: в «Wir sind
// im Zimmer» предлог сидит внутри «im», искать его отдельным словом бессмысленно, и без
// этого исключения проверка давала 200 ложных срабатываний на одних только слияниях.

import { bundle, words } from '../../src/core/data.ts'
import { explainItem } from '../../src/core/explain.ts'
import { fillingFor, generate } from '../../src/core/generate.ts'
import type { Noun } from '../../src/core/types.ts'

const hits: Record<string, { n: number; ex: string[] }> = {}
const add = (k: string, s: string) => {
  ;(hits[k] ??= { n: 0, ex: [] }).n++
  if (hits[k]!.ex.length < 2) hits[k]!.ex.push(s)
}

for (const t of bundle.templates) {
  for (const w of fillingFor(t, words)) {
    const it = generate(t, w, words)
    const e = explainItem(it)
    const all = [e.title, e.short, ...e.steps].join(' ‖ ')

    // пример в сравнительной степени на задании про превосходную
    if (t.slot.paradigm === 'adj_superlative' && /alt → älter/.test(all)) {
      add('пример сравнительной на превосходной', `${it.full} ‖ ${all}`)
    }
    // утверждение про единственное число на форме множественного
    if (t.slot.paradigm === 'modal_present' && /множественного/.test(it.ctx.person_ru ?? '')) {
      if (/в единственном числе нет -t/.test(all) || /не «\S+t»/.test(all)) {
        add('про единственное число на множественном', `${it.full} ‖ ${all}`)
      }
    }
    // «появляется окончание» там, где его не появляется
    if (/появляется окончание/.test(all) && w.pos === 'n' && it.ctx.wform === (w.entry as Noun).w) {
      add('«появляется окончание», а его нет', it.full)
    }
    // предлог назван буквально, а в задании его нет (см. ложные выше)
    const m = t.slot.paradigm === 'merged_prep_article' ? null : all.match(/предлог (\w+)/)
    if (m && !new RegExp(`\\b${m[1]}\\b`).test(it.full)) {
      add(`предлог «${m[1]}» не в задании [${t.id}]`, `${it.full} ‖ ${all}`)
    }
    // определённый артикль назван неопределённым
    if (/— неопределённый артикль/.test(all) && ['der', 'die', 'das', 'dem', 'den', 'des'].includes(it.ctx.article ?? '')) {
      add('определённый артикль назван неопределённым', `${it.full} ‖ ${all}`)
    }
  }
}
const rows = Object.entries(hits).sort((a, b) => b[1].n - a[1].n)
if (!rows.length) console.log('ложных утверждений не найдено')
for (const [k, v] of rows) {
  console.log(`${String(v.n).padStart(5)}  ${k}`)
  for (const x of v.ex) console.log(`        ${x}`)
}
