// Второй верный ответ среди дистракторов — самый вредный класс: задание засчитывает
// ошибку там, где человек прав. Перебор по ВСЕМ заданиям с вариантами, по трём осям.
//
// Оси: другое ЧИСЛО при той же форме слова («Ich helfe dem/den Kollegen»); другое ЛИЦО,
// когда подлежащее-местоимение читается двояко; другой РОД у слов с двумя принятыми.
// Несклеенные формы считает отдельно `unmerged.ts` — там это не дефект.

import { bundle, words } from '../../src/core/data.ts'
import { fillingFor, generate } from '../../src/core/generate.ts'
import { nounForm } from '../../src/core/morph.ts'
import { defArticle } from '../../src/core/paradigms.ts'
import type { Gender, Noun, Num, Template } from '../../src/core/types.ts'

const hits: Record<string, { n: number; ex: string[] }> = {}
const add = (k: string, s: string) => {
  ;(hits[k] ??= { n: 0, ex: [] }).n++
  if (hits[k]!.ex.length < 3) hits[k]!.ex.push(s)
}
const altAnswer = (t: Template, w: Parameters<typeof generate>[1], patch: object): string | null => {
  try {
    return generate({ ...t, slot: { ...t.slot, ...patch } }, w, words).answer
  } catch {
    return null
  }
}

for (const t of bundle.templates) {
  if (t.kind !== 'choice') continue
  for (const w of fillingFor(t, words)) {
    const it = generate(t, w, words)
    const opts = it.options ?? []
    const kase = t.slot.case ?? 'nom'

    // 1. другое число: форма слова в рамке та же, а падеж рамка задаёт
    if (w.pos === 'n' && kase !== 'nom') {
      const num = (t.slot.num ?? 'sg') as Num
      const other: Num = num === 'pl' ? 'sg' : 'pl'
      const n = w.entry as Noun
      const a = nounForm(n, kase, num)
      const b = nounForm(n, kase, other)
      if (a && b && a === b) {
        const alt = altAnswer(t, w, { num: other })
        if (alt && alt !== it.answer && opts.includes(alt)) {
          add('другое ЧИСЛО', `${it.full} | ответ ${it.answer} | тоже верно ${alt}`)
        }
      }
    }

    // 2. другое лицо: подлежащее-местоимение читается и как единственное
    if (t.slot.person === 'from_word' && !t.frame.includes('{vp}') && /\bsie\b/i.test(it.full)) {
      const alt = altAnswer(t, w, { person: '3sg' })
      if (alt && alt !== it.answer && opts.includes(alt)) {
        add('другое ЛИЦО', `${it.full} | ответ ${it.answer} | тоже верно ${alt}`)
      }
    }

    // 3. другой род у слова с двумя принятыми (`g2`).
    // ⚠ Мало того, что артикль другого рода лежит среди вариантов: форма СЛОВА в рамке
    // тоже должна совпасть. У «Wegen der Vokabel» средний род дал бы «des Vokabels»,
    // то есть выбравший «des» всё равно неправ, и это не второй верный ответ.
    const n2 = w.entry as Noun & { g2?: Gender }
    if (n2.g2 && w.pos === 'n') {
      const num = t.slot.num ?? 'sg'
      const same = nounForm(n2, kase, num) === nounForm({ ...n2, g: n2.g2 }, kase, num)
      const f = t.options?.paradigm === 'genus' ? defArticle('nom', n2.g2, 'sg') : defArticle(kase, n2.g2, num)
      if (same && f !== it.answer && opts.includes(f)) {
        add('другой РОД', `${it.full} | ответ ${it.answer} | тоже верно ${f}`)
      }
    }
  }
}

const rows = Object.entries(hits)
if (!rows.length) console.log('второго верного ответа среди дистракторов нет')
for (const [k, v] of rows) {
  console.log(`${String(v.n).padStart(5)}  ${k}`)
  for (const x of v.ex) console.log(`        ${x}`)
}
