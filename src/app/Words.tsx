// Новые слова темы: карточка на слово — род цветом, множественное, перевод, пример.
// Новое значит «карточки FSRS ещё нет», то есть слово ни разу не встречалось в заданиях.
//
// ⚠ В макете у примера стояла пометка падежа. Её нет и не будет: примеры берутся
// из Tatoeba, синтаксического разбора у нас нет, а выдумывать падеж нельзя.

import { useEffect, useState } from 'react'
import { getBundle, getWords } from '../core/bundle.ts'
import { nounForm } from '../core/morph.ts'
import { defArticle } from '../core/paradigms.ts'
import type { Adj, Level, Noun, Verb } from '../core/types.ts'
import { loadSentences, type Sentence } from './load.ts'
import { go } from './route.ts'
import { plural } from './session.ts'
import { wordKey, type Cards } from './srs.ts'

const PACK = 8
const GENDER_CLASS: Record<string, string> = { der: 'g-m', die: 'g-f', das: 'g-n' }

export function Words({
  theme,
  level,
  cards,
  onTrain,
}: {
  theme: string
  level?: Level
  cards: Cards
  onTrain: (words: string[]) => void
}) {
  const [examples, setExamples] = useState<Map<string, Sentence[]> | null>(null)
  useEffect(() => {
    loadSentences().then(setExamples, () => setExamples(new Map()))
  }, [])

  const t = getBundle().themes[theme]
  if (!t) return <p className="note">Такой темы нет.</p>
  const LV = { A1: 1, A2: 2, B1: 3 } as const
  const fresh = getWords()
    .filter((w) => w.theme === theme)
    .filter((w) => !level || LV[w.lv] <= LV[level])
    .filter((w) => !cards.has(wordKey(w.w)))
  const pack = fresh.slice(0, PACK)

  return (
    <main className="home">
      <button className="back wide-back" onClick={() => go({ screen: 'theme', theme })}>
        ← {t.title}
      </button>
      <h1>Новые слова</h1>

      {fresh.length === 0 ? (
        <p className="lead">
          Все слова темы уже встречались в заданиях. Новые появятся, когда тема пополнится.
        </p>
      ) : (
        <>
          <p className="lead">
            Осталось {plural(fresh.length, ['слово', 'слова', 'слов'])}, показаны первые{' '}
            {pack.length}.
          </p>
          <ul className="cards">
            {pack.map((w) => {
              const e = w.entry as Noun & Verb & Adj
              const art = w.pos === 'n' && e.g ? defArticle('nom', e.g) : ''
              // у неисчисляемых множественное в данных есть, а в речи его нет: «die Blute»
              const pl = w.pos === 'n' && !e.mass && !e.npl ? nounForm(e, 'nom', 'pl') : null
              const ex = examples?.get(w.w)?.[0]
              return (
                <li key={w.w} className="wcard">
                  <div className="wtop">
                    {art && <span className={`tag ${GENDER_CLASS[art] ?? ''}`}>{art}</span>}
                    <span className="wlemma">{w.w}</span>
                    <span className="wlv mono">{w.lv}</span>
                  </div>
                  {e.ru && <div className="wru">{e.ru}</div>}
                  {pl && (
                    <div className="wpl mono">
                      мн. ч.: die {pl}
                    </div>
                  )}
                  {ex && (
                    <div className="wex">
                      <div className="wde">{ex.de}</div>
                      <div className="wruex">{ex.ru}</div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <button
            className="primary wide"
            onClick={() => onTrain(pack.map((w) => w.w))}
          >
            Тренировать эти слова
          </button>
        </>
      )}
    </main>
  )
}
