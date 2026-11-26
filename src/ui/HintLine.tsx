// Строка подсказки после ответа: правило, его сила с долей на словаре, источники (docs/rules.md).
import { level, percent } from '../core/rules.ts'
import type { Gender, Hint } from '../core/types.ts'
import { Art } from './exercises/Gender.tsx'

const host = (url: string) => new URL(url).hostname.replace(/^www\./, '')

const LEVELS = ['правило', 'чаще всего', 'часто', 'редко']

export function HintLine({ hint, gender }: { hint: Hint; gender: Gender }) {
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
            Как последняя часть: <Art g={gender} /> <span className="mono">{hint.head}</span>
            {badge}
          </p>
          <p className="why">сложное слово берёт род последней части</p>
        </>
      ) : hint.ok ? (
        <p>
          <b className="mono">{hint.text}</b>
          {badge}
        </p>
      ) : (
        <p>
          Исключение: <span className="mono">{hint.text}</span>
          {badge}, а здесь <Art g={gender} />
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
