// Карточка слова в разборе: формы → карточка объяснения (простыми словами, потом правило) → пример. Всегда в
// этом порядке и одинаково при верном и неверном ответе; пример не показываем, если фраза уже на экране.
import type { Noun } from '../../core/types.ts'
import type { Data } from '../../store/db.ts'
import type { View } from '../exercises/index.ts'
import { Example } from './Example.tsx'
import { Rule } from './Rule.tsx'

// field — поле упражнения (Exercise.field): по нему подсказка правила
type Props = { view: View<any>; field: string; word: Noun; given: unknown; data: Data; example: boolean }

export function WordFacts({ view, field, word, given, data, example }: Props) {
  const f = view.facts(word, given)
  const hint = f.rule ? data.hint(word.id, field) : null
  // одно объяснение — одна карточка: сначала простыми словами, под ним правило
  const lead = f.note?.text ?? null
  return (
    <div className="wf">
      <div className="full forms">{f.forms}</div>
      {hint && f.rule ? (
        <Rule hint={hint} view={f.rule} lead={lead} />
      ) : (
        lead && (
          <div className="hint-rule">
            <p className="lead">{lead}</p>
          </div>
        )
      )}
      {example && <Example data={data} wordId={word.id} number={f.number} mark={f.mark} />}
    </div>
  )
}
