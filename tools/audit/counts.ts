// Правила, задания и слова по уровням — то, что экраны показывают счётчиками.
// Числа на главной, в «Темах» и «Грамматике» обязаны сходиться с этими.

import { bundle } from '../../src/core/data.ts'
import { getWords } from '../../src/core/bundle.ts'
import { countFor, rules, wordsOf } from '../../src/app/session.ts'
import type { Level } from '../../src/core/types.ts'

for (const lv of [undefined, 'A1', 'A2', 'B1'] as (Level | undefined)[]) {
  const rs = rules({ level: lv })
  console.log(
    `уровень ${(lv ?? 'всё').padEnd(4)} правил ${String(rs.length).padStart(3)}` +
      ` (с заданиями ${rs.filter((r) => r.count > 0).length})` +
      ` | заданий ${String(countFor({ level: lv })).padStart(6)}` +
      ` | слов ${String(wordsOf({ level: lv }).length).padStart(5)}`,
  )
}
console.log(`\nтем ${Object.keys(bundle.themes).length}, слов всего ${getWords().length}, шаблонов ${bundle.templates.length}`)
const empty = rules().filter((r) => r.count === 0).map((r) => r.rule)
console.log('правил без заданий:', empty.join(', ') || 'нет')
