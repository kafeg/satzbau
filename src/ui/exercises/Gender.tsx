// Данные упражнения «Род» для общих частей экрана (docs/ex-gender.md). Цвет рода — у метки над словом и в
// разборе; кнопки цветом рода не красим: красный die читался бы как «неверно».
import { ARTICLE, ORDER, right } from '../../core/exercises/gender.ts'
import type { Gender as G, Noun } from '../../core/types.ts'
import { Art } from '../answer/Art.tsx'
import type { View } from './index.ts'

// формы слова: артикль и слово · die и множественное · также другой род
export function Full({ word }: { word: Noun }) {
  const [g, ...also] = word.gender
  return (
    <>
      <Art g={g!} /> <span className="mono">{word.lemma}</span>
      {word.plural[0] ? (
        <span className="pl">
          {' · '}
          <Art g="pl" /> <span className="mono">{word.plural[0]}</span>
        </span>
      ) : (
        // plural: [] — словарь подтвердил: множественного нет (docs/data-model.md, «Только ед. ч.»)
        <span className="also"> · только ед. ч.</span>
      )}
      {also.length > 0 && <span className="also"> · также {also.map((x) => ARTICLE[x]).join(', ')}</span>}
    </>
  )
}

export const gender: View<G> = {
  options: () => ORDER.map((g) => ({ a: g, label: ARTICLE[g], tone: `g-${g}` })),
  art: (w, given) => (given === null ? null : right(w, given) ? given : w.gender[0]!),
  sort: 'Разложи по артиклям',
  facts: (w) => {
    const g = w.gender[0]!
    return {
      forms: <Full word={w} />,
      number: 'sg',
      mark: `g-${g}`,
      rule: {
        own: <Art g={g} />,
        part: (head) => (
          <>
            <span className="pre">как последняя часть</span>
            <span>
              <Art g={g} /> {head}
            </span>
          </>
        ),
        why: 'сложное слово берёт род последней части',
      },
    }
  },
  summary: (w) => (
    <>
      <span>
        <Art g={w.gender[0]!} /> <span className="mono">{w.lemma}</span>
      </span>
      {w.ru && <span className="sub">{w.ru}</span>}
    </>
  ),
}
