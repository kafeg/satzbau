// Панель ответа: зелёная или красная, в ней одна или несколько карточек слова, прокрутка внутри, «Дальше» на месте.
// Строки «Верно/Неверно» нет: вердикт — цвет нажатой кнопки и панели. Под панелью — подсказка про озвучку (SayTip).
import type { ReactNode } from 'react'
import { SayTip } from './Say.tsx'

export function AnswerPanel({ ok, fill, onNext, children }: { ok: boolean; fill?: boolean; onNext: () => void; children: ReactNode }) {
  return (
    <>
      <section className={`sheet ${ok ? 'ok' : 'bad'} ${fill ? 'fill' : ''}`} aria-live="polite">
        <div className="facts">{children}</div>
        <button className="go" onClick={onNext} autoFocus>
          Дальше
        </button>
      </section>
      <SayTip />
    </>
  )
}
