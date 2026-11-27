// Варианты ответа и клавиши 1…N. После ответа: нажатая — зелёная (верно) или красная с подписью «ты»;
// при ошибке верная — зелёная пунктирная рамка с подписью «верно»; остальные приглушены (docs/app.md).
import { useEffect } from 'react'

import type { ReactNode } from 'react'

// tone — класс цвета варианта (g-m): заголовок полосы в раскладке; show — как нарисовать подпись, если не текстом
export type Option = { label: string; tone?: string; show?: ReactNode; full?: boolean }

type Props = { options: Option[]; chosen: number | null; right: number | null; onPick: (i: number) => void; wide?: boolean }

export function Choices({ options, chosen, right, onPick, wide }: Props) {
  const done = chosen !== null
  useEffect(() => {
    if (done) return
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const i = Number(e.key) - 1
      if (Number.isInteger(i) && i >= 0 && i < options.length) onPick(i)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [done, options.length, onPick])
  return (
    <div className={`choices ${wide ? 'types' : ''}`}>
      {options.map((o, i) => {
        const ok = done && chosen === right
        const cls = !done ? '' : i === chosen ? `me ${ok ? 'ok' : 'bad'}` : i === right ? 'right' : 'dim'
        const cap = !done || ok ? null : i === chosen ? 'ты' : i === right ? 'верно' : null
        return (
          <button key={o.label} className={`choice mono ${cls} ${o.full ? 'full' : ''}`} disabled={done} onClick={() => onPick(i)}>
            <span>{o.show ?? o.label}</span>
            {cap && <span className="cap">{cap}</span>}
            <kbd>{i + 1}</kbd>
          </button>
        )
      })}
    </div>
  )
}
