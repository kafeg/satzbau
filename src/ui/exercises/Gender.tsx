// Экран упражнения «Род» (docs/ex-gender.md). Цвет значит только род: верность — зачёркиванием.
import { useEffect } from 'react'
import { ARTICLE, ORDER, right } from '../../core/exercises/gender.ts'
import type { Gender as G, Noun } from '../../core/types.ts'
import { Example } from '../Example.tsx'
import { HintLine } from '../HintLine.tsx'
import type { View } from './index.ts'

export function Art({ g }: { g: G | 'pl' }) {
  return <span className={`art g-${g}`}>{g === 'pl' ? 'die' : ARTICLE[g]}</span>
}

export function Full({ word }: { word: Noun }) {
  const [g, ...also] = word.gender
  return (
    <span className="full">
      <Art g={g!} /> <span className="mono">{word.lemma}</span>
      {word.plural[0] && (
        <span className="pl">
          {' · '}
          <Art g="pl" /> <span className="mono">{word.plural[0]}</span>
        </span>
      )}
      {also.length > 0 && <span className="also"> · также {also.map((x) => ARTICLE[x]).join(', ')}</span>}
    </span>
  )
}

export const gender: View<G> = {
  Prompt: ({ word }) => (
    <>
      <div className="lemma mono">{word.lemma}</div>
      <div className="ru">{word.ru}</div>
    </>
  ),

  Choices: ({ word, given, onAnswer }) => {
    useEffect(() => {
      if (given) return
      const key = (e: KeyboardEvent) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return
        const g = ORDER[Number(e.key) - 1]
        if (g) onAnswer(g)
      }
      window.addEventListener('keydown', key)
      return () => window.removeEventListener('keydown', key)
    }, [given, onAnswer])
    return (
      <div className="choices">
        {ORDER.map((g, i) => {
          const cls = !given ? '' : right(word, g) ? `g-${g} shown` : g === given ? 'struck' : 'dim'
          return (
            <button key={g} className={`choice mono ${cls}`} disabled={!!given} onClick={() => onAnswer(g)}>
              {ARTICLE[g]}
              <kbd>{i + 1}</kbd>
            </button>
          )
        })}
      </div>
    )
  },

  Right: ({ word }) => <Art g={word.gender[0]!} />,

  Reveal: ({ word, data }) => {
    const hint = data.hint(word.id, 'gender')
    return (
      <>
        <Full word={word} />
        {hint && <HintLine hint={hint} gender={word.gender[0]!} />}
        <Example data={data} wordId={word.id} mark={`g-${word.gender[0]}`} />
      </>
    )
  },

  Summary: ({ word }) => (
    <>
      <span>
        <Art g={word.gender[0]!} /> <span className="mono">{word.lemma}</span>
      </span>
      {word.ru && <span className="sub">{word.ru}</span>}
    </>
  ),
}
