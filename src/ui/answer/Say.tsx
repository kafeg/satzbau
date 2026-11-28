// Кнопка «послушать» (docs/app.md, «Озвучка»): только по нажатию; нет немецкого голоса — кнопки нет.
// После первого нажатия за всё время под панелью ответа — подсказка про беззвучный режим iPhone (SayTip).
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { save, saved } from '../prefs.ts'
import { say, stop, useGerman } from '../speech.ts'

// видна ли подсказка сейчас (до закрытия панели); что её уже показывали — флаг said
let tip = false
const subs = new Set<() => void>()
const setTip = (on: boolean) => {
  tip = on
  subs.forEach((f) => f())
}
const watch = (f: () => void) => {
  subs.add(f)
  return () => subs.delete(f)
}

export function Say({ text }: { text: string }) {
  const can = useGerman()
  const [on, setOn] = useState(false)
  const playing = useRef(false)
  // кнопка ушла с экрана («Дальше») — её слово не договаривается поверх следующего вопроса
  useEffect(() => () => void (playing.current && stop()), [])
  if (!can) return null
  const done = () => {
    playing.current = false
    setOn(false)
  }
  const play = () => {
    playing.current = true
    setOn(true)
    say(text, { onend: done, onerror: done })
    if (saved('said')) return
    save('said', '1')
    setTip(true)
  }
  return (
    <button className={`say ${on ? 'on' : ''}`} aria-label={`послушать: ${text}`} onClick={play}>
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M4 9v6h4l5 4V5L8 9z" />
        <path d="M16 9a4 4 0 0 1 0 6" />
        <path d="M18.5 6.5a8 8 0 0 1 0 11" />
      </svg>
    </button>
  )
}

export function SayTip() {
  const shown = useSyncExternalStore(watch, () => tip)
  // панель закрылась — подсказка больше не появится
  useEffect(() => () => setTip(false), [])
  return shown ? <p className="tip">не слышно? выключи беззвучный режим</p> : null
}
