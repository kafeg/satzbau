// Дрилл: фраза с пропуском, перевод СЛОВА (не фразы — её перевода в данных нет),
// варианты или ввод, после ответа — разбор.

import { useEffect, useState } from 'react'
import { getBundle } from '../core/bundle.ts'
import type { Item } from '../core/types.ts'
import { Explain } from './Explain.tsx'
import { go } from './route.ts'
import { germanVoice, onVoices, speak } from './speech.ts'

const GENDER_CLASS: Record<string, string> = { der: 'g-m', die: 'g-f', das: 'g-n' }

export function Drill({
  item,
  n,
  total,
  rule,
  onNext,
}: {
  item: Item
  n: number
  total: number
  /** сессия одного правила: в шапке его название, иначе тема и уровень */
  rule?: string
  onNext: (correct: boolean, given: string) => void
}) {
  const [given, setGiven] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [hint, setHint] = useState(false)
  const [voice, setVoice] = useState(() => !!germanVoice())

  useEffect(() => onVoices(() => setVoice(!!germanVoice())), [])

  const answered = given !== null
  const correct = given === item.answer
  const article = item.ctx.nom_article
  // в шапке тема и уровень, а НЕ правило: «prep-dativ» называет падеж до ответа
  const theme = getBundle().themes[item.theme]?.title ?? item.theme
  // пропуск после окончания слова не отрывается от него: «klein___», а не «klein ___»
  const [before = '', after = ''] = item.text.split('___')
  const tight = /\S$/.test(before)
  // пропуск первым словом фразы — ответ показывается с заглавной: «Mein Arm tut weh»
  const start = before === ''
  const cut = tight ? before.lastIndexOf(' ') + 1 : before.length

  const check = (value: string) => {
    if (!answered && value.trim()) setGiven(value.trim())
  }

  return (
    <>
      <header>
        <div className="bar">
          <div className="fill" style={{ width: `${(n / total) * 100}%` }} />
        </div>
        <div className="row">
          <button className="back" onClick={() => go({ screen: 'home' })} aria-label="назад">
            ←
          </button>
          <span className="chip">
            {rule ? getBundle().explain[rule]?.title : `${theme} · ${item.level}`}
          </span>
          <span className="count mono">
            {n} / {total}
          </span>
        </div>
      </header>

      <main>
        <p className="sentence">
          {before.slice(0, cut)}
          <span className="nowrap">
            {before.slice(cut)}
            <span className={`gap${answered ? ' ok' : ''}${tight ? ' tight' : ''}`}>
              {answered
                ? start
                  ? item.answer.charAt(0).toUpperCase() + item.answer.slice(1)
                  : item.answer
                : '\u00a0\u00a0\u00a0'}
            </span>
          </span>
          {after}
        </p>

        <p className="word">
          {article && <span className={`tag ${GENDER_CLASS[article] ?? ''}`}>{article}</span>}
          <span className="lemma">{item.word}</span>
          {item.ru && <span className="ru">— {item.ru}</span>}
          {voice && (
            <button className="speak" onClick={() => speak(item.full)} aria-label="озвучить">
              🔊
            </button>
          )}
        </p>

        {item.options ? (
          <div className="options">
            {item.options.map((o) => {
              const state = !answered
                ? ''
                : o === item.answer
                  ? ' ok'
                  : o === given
                    ? ' bad'
                    : ' dim'
              return (
                <button key={o} className={`option mono${state}`} onClick={() => check(o)}>
                  {o}
                </button>
              )
            })}
          </div>
        ) : (
          <form
            className="input"
            onSubmit={(e) => {
              e.preventDefault()
              check(typed)
            }}
          >
            <input
              className={`mono${answered && !correct ? ' bad' : ''}`}
              value={answered ? (given ?? '') : typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="окончание"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={answered}
            />
            {!answered && <button className="primary">Проверить</button>}
          </form>
        )}

        {!answered && !hint && (
          <button className="ghost" onClick={() => setHint(true)}>
            не знаю — показать правило
          </button>
        )}

        {(hint || (answered && !correct)) && <Explain item={item} given={given ?? undefined} />}
        {answered && correct && !hint && (
          <button className="ghost" onClick={() => setHint(true)}>
            почему так
          </button>
        )}
      </main>

      {answered && (
        <footer>
          <button className="primary wide" onClick={() => onNext(correct, given)}>
            Дальше
          </button>
        </footer>
      )}
    </>
  )
}
