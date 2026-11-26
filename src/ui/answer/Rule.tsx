// Правило из данных (docs/rules.md): само правило крупно — «условие → что значит», сила меткой справа,
// источники — неприметной кнопкой, раскрываются по нажатию. Значение слова рисует упражнение.
import type { ReactNode } from 'react'
import { LEVELS, level, percent } from '../../core/rules.ts'
import type { Hint } from '../../core/types.ts'

const host = (url: string) => new URL(url).hostname.replace(/^www\./, '')

// own — значение этого слова («die», «¨-er»); part и why — строка «как у последней части» сложного слова
export type RuleView = { own: ReactNode; part: (head: string) => ReactNode; why: string }

// «-e (die) → -(e)n»: условие и следствие отдельно, стрелка между ними — не слипаются в одну строку
function Line({ text }: { text: string }) {
  const [when, then] = text.split(' → ')
  return then === undefined ? (
    <span className="if">{text}</span>
  ) : (
    <>
      <span className="if">{when}</span>
      <span className="to" aria-label="значит">
        →
      </span>
      <span className="then">{then}</span>
    </>
  )
}

export function Rule({ hint, view }: { hint: Hint; view: RuleView }) {
  const lvl = level(hint.share)
  return (
    <div className="hint-rule">
      <p className="kind">{hint.head ? 'сложное слово' : hint.ok ? '' : 'исключение из правила'}</p>
      <span className={`lvl lvl-${LEVELS.indexOf(lvl)}`} title={`${percent(hint.share)} из ${hint.n} слов словаря`}>
        {lvl} · {percent(hint.share)}
      </span>
      <p className={`line ${hint.ok || hint.head ? '' : 'off'}`}>{hint.head ? view.part(hint.head) : <Line text={hint.text} />}</p>
      {hint.head ? <p className="why">{view.why}</p> : !hint.ok && <p className="why">а здесь {view.own}</p>}
      <details className="src">
        <summary>источники</summary>
        {hint.sources.map((s) => (
          <a key={s.url} href={s.url} target="_blank" rel="noreferrer" title={s.at}>
            {host(s.url)} ↗
          </a>
        ))}
      </details>
    </div>
  )
}
