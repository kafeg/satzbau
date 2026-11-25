// Несклеенная форма среди вариантов: «in dem Bad» — верный немецкий, и человек её выбирает.
//
// Это НЕ дефект: тренируется именно слияние, а разбор говорит «падеж верный, и так тоже
// говорят» — но только там, где падеж действительно совпал. Скрипт пересчитывает обе доли
// той же логикой, что `Explain.tsx`: сколько вариантов получат оговорку и сколько останутся
// настоящей ошибкой падежа. Числа должны сходиться; расхождение значит, что логика разошлась.

import { bundle, words } from '../../src/core/data.ts'
import { fillingFor, generate } from '../../src/core/generate.ts'
import { formMatches } from '../../src/core/paradigms.ts'

let fair = 0
let caseError = 0
const ex: string[] = []
for (const t of bundle.templates) {
  if (t.slot.paradigm !== 'merged_prep_article') continue
  for (const w of fillingFor(t, words)) {
    const it = generate(t, w, words)
    for (const given of (it.options ?? []).filter((o) => o.includes(' ') && o !== it.answer)) {
      const m = formMatches('merged_prep_article', given, { decl: t.slot.decl, prep: t.slot.prep })
      const same = m.some((x) => x.case === (t.slot.case ?? 'nom'))
      if (same) fair++
      else caseError++
      if (ex.length < 4) ex.push(`${same ? '✓ оговорка' : '✗ ошибка падежа'}  ${it.full} ← «${given}»`)
    }
  }
}
console.log(`несклеенных вариантов ТОГО ЖЕ падежа (получат оговорку): ${fair}`)
console.log(`несклеенных вариантов ДРУГОГО падежа (оговорки нет):     ${caseError}`)
for (const x of ex) console.log('  ', x)
