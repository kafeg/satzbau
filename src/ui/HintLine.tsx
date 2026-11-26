// Строка подсказки после ответа: правило, его сила с долей на словаре, источники (docs/rules.md).
import { level, percent } from '../core/rules.ts'
import type { Gender, Hint } from '../core/types.ts'
import { Art } from './exercises/Gender.tsx'

const host = (url: string) => new URL(url).hostname.replace(/^www\./, '')

export function HintLine({ hint, gender }: { hint: Hint; gender: Gender }) {
  const strength = `${level(hint.share)}, ${percent(hint.share)} слов словаря`
  return (
    <div className="hint-rule">
      {hint.head ? (
        <p>
          Как последняя часть: <Art g={gender} /> <span className="mono">{hint.head}</span>
          <span className="why"> · сложное слово берёт её род · {strength}</span>
        </p>
      ) : hint.ok ? (
        <p>
          <b className="mono">{hint.text}</b>
          <span className="why"> · {strength}</span>
        </p>
      ) : (
        <p>
          Исключение: <span className="mono">{hint.text}</span>
          <span className="why"> · {strength}</span>, а здесь <Art g={gender} />
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
