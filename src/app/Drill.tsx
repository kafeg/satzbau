// Дрилл: фраза с пропуском, перевод СЛОВА (не фразы — её перевода в данных нет),
// варианты или ввод, после ответа — разбор.

import { useEffect, useState } from 'react'
import { getBundle } from '../core/bundle.ts'
import { accepts } from '../core/check.ts'
import type { Item } from '../core/types.ts'
import { Explain } from './Explain.tsx'
import { go, type Route } from './route.ts'
import { germanVoice, onVoices, speak } from './speech.ts'

const GENDER_CLASS: Record<string, string> = { der: 'g-m', die: 'g-f', das: 'g-n' }

/** Чего ждёт поле ввода. Окончание просят только шаблоны `adj_ending`, их восемь из
 *  тридцати одного; остальным нужна форма целиком, и подпись «окончание» толкала
 *  написать «st» вместо «fährst». */
const FIELD: Record<string, string> = {
  adj_ending: 'окончание',
  noun_plural: 'множественное',
  noun_case: 'форма слова',
  participle: 'Partizip II',
  verb_present: 'форма глагола',
  verb_stem: 'форма глагола',
  verb_past: 'Präteritum',
  imperative: 'повелительная форма',
  adj_comparative: 'сравнительная',
  adj_superlative: 'превосходная',
}

const slotParadigm = (item: Item): string =>
  getBundle().templates.find((t) => t.id === item.templateId)?.slot.paradigm ?? ''

export function Drill({
  item,
  n,
  total,
  rule,
  back,
  onNext,
}: {
  item: Item
  n: number
  total: number
  /** сессия одного правила: в шапке его название, иначе тема и уровень */
  rule?: string
  /** куда ведёт стрелка назад: на тему, если пришли оттуда */
  back: Route
  onNext: (correct: boolean, given: string, hinted: boolean) => void
}) {
  const [given, setGiven] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  // ⚠ Два разных флага, а не один. «Не знаю» до ответа — это признание, что правило
  // неизвестно, и оно идёт в журнал. «Почему так» после ВЕРНОГО ответа — любопытство,
  // и в журнал оно попадать не должно: с одним флагом разбор после верного ответа
  // ставил правилу Again и возвращал его в «пора».
  const [hint, setHint] = useState(false)
  const [why, setWhy] = useState(false)
  const [voice, setVoice] = useState(() => !!germanVoice())

  useEffect(() => onVoices(() => setVoice(!!germanVoice())), [])

  const answered = given !== null
  // что считается верным вводом, решает ядро: по тому же правилу считает симулятор
  const correct = given !== null && accepts(item, given)
  // бейдж рода, а не nom_article: в задании про род он называл бы ответ
  const article = item.ctx.badge
  // в шапке короткое имя правила (поле name), а в сессии вперемешку — тема и уровень:
  // длинный title — это заголовок разбора, во фразу-чип он не помещается
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
        <div className="row">
          <button className="back" onClick={() => go(back)} aria-label="назад">
            ←
          </button>
          <span className="rule-name">
            {rule ? getBundle().explain[rule]?.name : `${theme} · ${item.level}`}
          </span>
          <span className="count mono">
            {n} / {total}
          </span>
        </div>
        <div className="bar">
          <div className="fill" style={{ width: `${(n / total) * 100}%` }} />
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

        <div className="word">
          <span className="wtag">
            {article && <span className={`tag ${GENDER_CLASS[article] ?? ''}`}>{article}</span>}
          </span>
          <span className="wtext">
            {/* ⚠ Словарная форма прячется, когда ответ написан в ней самой: у «aussteigen»
                это приставка «aus». После ответа показываем — там она и нужна. */}
            {(!item.ctx.hide_lemma || answered) && <span className="lemma">{item.word}</span>}
            {item.ru && (
              <span className="ru">
                {!item.ctx.hide_lemma || answered ? ' — ' : ''}
                {item.ru}
              </span>
            )}
          </span>
          <span className="wspeak">
            {/* ⚠ До ответа озвучивается СЛОВО, а не фраза: `item.full` — это фраза
                с подставленным ответом, и кнопка читала решение вслух. После ответа
                фраза целиком полезна: слышно, как звучит верная форма в предложении. */}
            {voice && (
              <button
                className="speak"
                onClick={() => speak(answered ? item.full : item.word)}
                aria-label={answered ? 'озвучить фразу' : 'озвучить слово'}
              >
                🔊
              </button>
            )}
          </span>
        </div>

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
              placeholder={FIELD[slotParadigm(item)] ?? 'форма'}
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

        {(hint || why || (answered && !correct)) && (
          <Explain item={item} given={given ?? undefined} />
        )}
        {answered && correct && !hint && !why && (
          <button className="ghost" onClick={() => setWhy(true)}>
            почему так
          </button>
        )}
      </main>

      {answered && (
        <footer>
          <button className="primary wide" onClick={() => onNext(correct, given, hint)}>
            Дальше
          </button>
        </footer>
      )}
    </>
  )
}
