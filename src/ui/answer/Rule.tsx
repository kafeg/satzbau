// Правило из данных (docs/rules.md): правило, сила с долей на словаре, источники. Значение слова рисует упражнение.
import type { ReactNode } from 'react'
import { level, percent } from '../../core/rules.ts'
import type { Hint } from '../../core/types.ts'

const host = (url: string) => new URL(url).hostname.replace(/^www\./, '')
const LEVELS = ['правило', 'чаще всего', 'часто', 'редко']

// own — значение этого слова («die», «¨-er»); part и why — строка «как у последней части» сложного слова
export type RuleView = { own: ReactNode; part: (head: string) => ReactNode; why: string }

export function Rule({ hint, view }: { hint: Hint; view: RuleView }) {
  const lvl = level(hint.share)
  const badge = (
    <span className={`lvl lvl-${LEVELS.indexOf(lvl)}`} title={`${percent(hint.share)} из ${hint.n} слов словаря`}>
      {lvl} · {percent(hint.share)}
    </span>
  )
  return (
    <div className="hint-rule">
      {hint.head ? (
        <>
          <p>
            {view.part(hint.head)}
            {badge}
          </p>
          <p className="why">{view.why}</p>
        </>
      ) : hint.ok ? (
        <p>
          <b className="mono">{hint.text}</b>
          {badge}
        </p>
      ) : (
        <p>
          Исключение: <span className="mono">{hint.text}</span>
          {badge}, а здесь {view.own}
        </p>
      )}
      <p className="src">
        {hint.sources.map((s, i) => (
          <a key={s.url} href={s.url} target="_blank" rel="noreferrer" title={s.at}>
            {i ? ' · ' : 'источники: '}
            {host(s.url)}
          </a>
        ))}
      </p>
    </div>
  )
}
