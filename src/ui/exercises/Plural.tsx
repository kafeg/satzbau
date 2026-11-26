// Экран упражнения «Множественное число» (docs/ex-plural.md). Кнопки — типы формы, не слова:
// неправильные формы на экран не выводятся никогда.
import { useEffect, useState } from 'react'
import { ENDINGS, type Ending, LABEL, type Parse, type Pl, canUmlaut, parse, right } from '../../core/exercises/plural.ts'
import type { Noun } from '../../core/types.ts'
import { Example } from '../Example.tsx'
import { Art, Ru } from './Gender.tsx'
import type { View } from './index.ts'

// форма, по которой показываем разбор: та, что совпала с ответом, иначе первая
function shown(w: Noun, a: Pl | null): [string, Parse] {
  const forms = w.plural.map((f) => [f, parse(w.lemma, f)] as const).filter((x): x is [string, Parse] => x[1] !== null)
  const hit = a && forms.find(([, p]) => p.end === a.end && p.uml === a.uml)
  return hit ?? forms[0]!
}

function Form({ form, p }: { form: string; p: Parse }) {
  const cut = form.length - p.tail
  return (
    <span className="mono">
      {[...form.slice(0, cut)].map((ch, i) => (i === p.at ? <span key={i} className="chg">{ch}</span> : ch))}
      {p.tail > 0 && <span className="chg">{form.slice(cut)}</span>}
    </span>
  )
}

function rule(lemma: string, p: Parse): string {
  const end = p.end === '' ? 'без окончания' : `окончание ${LABEL[p.end]}`
  return p.uml ? `${end} и умлаут: ${lemma[p.at]} → ${'äöüÄÖÜ'['aouAOU'.indexOf(lemma[p.at]!)]}` : end
}

function verdict(w: Noun, a: Pl, ok: boolean): string {
  if (ok) return 'Верно'
  const [, p] = shown(w, null)
  if (p.end === a.end) return p.uml ? 'Неверно: окончание верное, нужен умлаут' : 'Неверно: окончание верное, умлаут не нужен'
  return `Неверно: ${p.end === '' ? 'без окончания' : `окончание ${LABEL[p.end]}`}${p.uml ? ' и умлаут' : ''}`
}

export const plural: View<Pl> = {
  Prompt: ({ word }) => (
    <>
      <div className="lemma mono">
        <Art g={word.gender[0]!} /> {word.lemma}
      </div>
      <div className="ru">
        <Ru word={word} />
      </div>
      <div className="ask mono">
        die <span className="q">…?</span>
      </div>
    </>
  ),

  Choices: ({ word, given, onAnswer }) => {
    const [uml, setUml] = useState(false)
    const can = canUmlaut(word.lemma)
    useEffect(() => {
      if (given) return
      const key = (e: KeyboardEvent) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return
        if (can && e.key.toLowerCase() === 'u') setUml((x) => !x)
        const end = ENDINGS[Number(e.key) - 1]
        if (end !== undefined && e.key !== ' ') onAnswer({ uml: can && uml, end })
      }
      window.addEventListener('keydown', key)
      return () => window.removeEventListener('keydown', key)
    }, [given, onAnswer, can, uml])

    const [, p] = shown(word, given)
    const cls = (e: Ending) => (!given ? '' : e === p.end ? 'ok' : e === given.end ? 'struck' : 'dim')
    let row = uml ? 'on' : ''
    let note = ''
    if (given) {
      row = p.uml && given.uml ? 'on' : p.uml ? 'miss' : given.uml ? 'struck' : ''
      note = p.uml && !given.uml ? 'нужен · не выбран' : !p.uml && given.uml ? 'не нужен' : ''
    }
    return (
      <>
        {can && (
          <button className={`uml ${row}`} disabled={!!given} onClick={() => setUml((x) => !x)} aria-pressed={uml}>
            <span>
              <span className="k mono">ä ö ü</span>
              <span className="caption">гласная основы меняется</span>
            </span>
            {note ? <span className="need">{note}</span> : <span className="sw" aria-hidden />}
            <kbd>U</kbd>
          </button>
        )}
        <div className="choices five">
          {ENDINGS.map((e, i) => (
            <button key={e || '0'} className={`choice mono ${cls(e)}`} disabled={!!given} onClick={() => onAnswer({ uml: can && uml, end: e })}>
              {LABEL[e]}
              <kbd>{i + 1}</kbd>
            </button>
          ))}
        </div>
      </>
    )
  },

  Reveal: ({ word, given, ok, data }) => {
    const [form, p] = shown(word, ok ? given : null)
    const also = word.plural.filter((f) => f !== form)
    return (
      <>
        <div className={`verdict ${ok ? 'yes' : 'no'}`}>{verdict(word, given, ok)}</div>
        <span className="full">
          <Art g={word.gender[0]!} /> <span className="mono">{word.lemma}</span> · <Art g="pl" /> <Form form={form} p={p} />
          {also.length > 0 && <span className="also"> · также {also.join(', ')}</span>}
        </span>
        <div className="rule">{rule(word.lemma, p)}</div>
        <Example data={data} wordId={word.id} mark="g-pl" plural />
      </>
    )
  },

  Summary: ({ word }) => (
    <>
      <span>
        <Art g={word.gender[0]!} /> <span className="mono">{word.lemma}</span> · <Art g="pl" />{' '}
        <span className="mono">{word.plural[0]}</span>
      </span>
      {word.ru && <span className="sub">{word.ru}</span>}
    </>
  ),
}
