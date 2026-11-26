// Правило из данных (docs/rules.md): само правило крупно — «условие → что значит»; сила и доля — мелко справа
// внизу, по нажатию на них раскрываются источники. Значение слова рисует упражнение.
import type { ReactNode } from 'react'
import { level, percent } from '../../core/rules.ts'
import type { Hint } from '../../core/types.ts'

// «de.wikipedia · Deutscher Plural»: у двух статей одного сайта подписи разные
const name = (url: string) => {
  const u = new URL(url)
  const page = decodeURIComponent(u.pathname.split('/').pop() ?? '').replace(/_/g, ' ')
  return `${u.hostname.replace(/^www\./, '').replace(/\.org$/, '')} · ${page}`
}

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

// lead — то же простыми словами («без окончания, только умлаут a → ä»), первой строкой той же карточки;
// с ним «а здесь …» у исключения не повторяем
export function Rule({ hint, view, lead }: { hint: Hint; view: RuleView; lead?: string | null }) {
  const lvl = level(hint.share)
  const kind = hint.head ? 'сложное слово' : hint.ok ? null : 'исключение из правила'
  return (
    <div className="hint-rule">
      {lead && <p className="lead">{lead}</p>}
      {kind && <p className="kind">{kind}</p>}
      <p className={`line ${hint.ok || hint.head ? '' : 'off'}`}>{hint.head ? view.part(hint.head) : <Line text={hint.text} />}</p>
      {hint.head ? <p className="why">{view.why}</p> : !hint.ok && !lead && <p className="why">а здесь {view.own}</p>}
      <details className="src">
        <summary title={`${percent(hint.share)} из ${hint.n} слов словаря · источники`}>
          {level(hint.share)} · {percent(hint.share)}
        </summary>
        {hint.sources.map((s) => (
          <a key={s.url} href={s.url} target="_blank" rel="noreferrer" title={s.at}>
            {name(s.url)} ↗
          </a>
        ))}
      </details>
    </div>
  )
}
