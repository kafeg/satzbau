// Варианты ответа и клавиши 1…N. После ответа цветная только нажатая: зелёная — верно, красная — нет;
// остальные приглушены. Верный вариант на кнопках не показан: он над словом и в панели (docs/app.md).
import { useEffect } from 'react'

// tone — класс цвета варианта (g-m): заголовок полосы в раскладке
export type Option = { label: string; tone?: string }

type Props = { options: Option[]; chosen: number | null; ok: boolean; onPick: (i: number) => void; wide?: boolean }

export function Choices({ options, chosen, ok, onPick, wide }: Props) {
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
        const cls = !done ? '' : i === chosen ? `me ${ok ? 'ok' : 'bad'}` : 'dim'
        return (
          <button key={o.label} className={`choice mono ${cls}`} disabled={done} onClick={() => onPick(i)}>
            {o.label}
            <kbd>{i + 1}</kbd>
          </button>
        )
      })}
    </div>
  )
}
