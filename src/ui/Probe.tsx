// Проверка голоса на устройстве (временно, docs/app.md, «Проверка голоса»): работает ли распознавание речи
// и немецкая озвучка в этом браузере и в PWA с иконки. Ничего не пишет в журнал и никуда не отправляет сам —
// распознавание браузера может уходить на серверы Apple или Google.
import { useEffect, useRef, useState } from 'react'

type Rec = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  processLocally?: boolean
  start(): void
  stop(): void
  abort?(): void
  onresult: ((e: any) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

const SR: (new () => Rec) | undefined = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true

export function Probe({ onBack }: { onBack: () => void }) {
  const [log, setLog] = useState<string[]>([])
  const [heard, setHeard] = useState('')
  const [local, setLocal] = useState(false)
  // как запускать: same — один объект; fresh — новый, прежний остановлен; continuous — одна сессия без перезапуска;
  // mic — микрофон открыт заранее (getUserMedia) и держится, объект новый;
  // cue — сначала короткая озвучка, через 0,4 с после её конца — новый объект; stop/abort не вызываем
  // (рецепт из WebKit bug 321436, комментарии 8–9: iOS 27, у двух людей работает)
  const [mode, setMode] = useState<'same' | 'fresh' | 'continuous' | 'mic' | 'cue'>('mic')
  const running = useRef(false)
  const stream = useRef<MediaStream | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voice, setVoice] = useState('')
  const rec = useRef<Rec | null>(null)
  const add = (s: string) => setLog((xs) => [`${new Date().toLocaleTimeString()} ${s}`, ...xs].slice(0, 30))

  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const load = () => {
      const de = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('de'))
      setVoices(de)
      setVoice((x) => x || de[0]?.name || '')
    }
    load()
    speechSynthesis.addEventListener('voiceschanged', load)
    return () => speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  // короткая озвучка перед распознаванием; true — договорила
  const cue = () =>
    new Promise<boolean>((done) => {
      if (!('speechSynthesis' in window)) return done(false)
      const u = new SpeechSynthesisUtterance('Bitte sprechen.')
      u.lang = 'de-DE'
      const v = voices.find((x) => x.name === voice)
      if (v) u.voice = v
      u.onend = () => setTimeout(() => done(true), 400)
      u.onerror = (e) => {
        add(`озвучка: ${e.error}`)
        done(false)
      }
      speechSynthesis.speak(u)
    })

  // WebKit в PWA: второй запуск распознавания часто не получает микрофон — четыре способа для сравнения
  const listen = async () => {
    if (!SR) return
    try {
      if (mode === 'continuous' && running.current) return add('уже слушаю — говори, «Стоп» — закончить')
      if (mode === 'mic' && !stream.current) {
        stream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
        add('микрофон открыт заранее')
      }
      if (mode === 'cue' && !(await cue())) return
      const prev = rec.current
      const reuse = mode === 'same' && prev
      if (!reuse && prev && mode !== 'cue') prev.abort?.()
      const r = reuse ? prev : new SR()
      r.lang = 'de-DE'
      r.interimResults = true
      r.maxAlternatives = 3
      r.continuous = mode === 'continuous'
      if (local) r.processLocally = true
      r.onstart = () => {
        running.current = true
        add(`слушаю… (${mode}, ${reuse ? 'тот же объект' : 'новый объект'})`)
      }
      r.onresult = (e) => {
        const res = e.results[e.results.length - 1]
        const alts = Array.from(res as ArrayLike<{ transcript: string; confidence: number }>).map((a) => `${a.transcript} (${Math.round(a.confidence * 100)}%)`)
        setHeard(alts.join(' · '))
        if (res.isFinal) add(`распознано: ${alts.join(' · ')}`)
      }
      r.onerror = (e) => add(`ошибка: ${e.error}${e.message ? ` — ${e.message}` : ''}`)
      r.onend = () => {
        running.current = false
        add('конец')
      }
      r.start()
      rec.current = r
    } catch (e) {
      add(`не запустилось: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`)
    }
  }

  const say = (text: string) => {
    // iOS: озвучка иногда «залипает» в состоянии speaking и молчит — cancel() перед speak() её сбрасывает
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'de-DE'
    const v = voices.find((x) => x.name === voice)
    if (v) u.voice = v
    add(`озвучка: голос ${v ? `${v.name} (${v.localService ? 'на устройстве' : 'через сеть'})` : 'по умолчанию для de-DE'}, всего голосов ${speechSynthesis.getVoices().length}`)
    u.onstart = () => add('озвучка: началась')
    u.onend = () => add(`сказано: ${text}`)
    u.onerror = (e) => add(`озвучка: ошибка ${e.error}`)
    speechSynthesis.speak(u)
    setTimeout(() => add(`озвучка через 1 с: speaking=${speechSynthesis.speaking} pending=${speechSynthesis.pending} paused=${speechSynthesis.paused}`), 1000)
  }

  return (
    <main className="home probe">
      <header className="topbar">
        <button className="close" aria-label="Назад" onClick={onBack}>
          ‹
        </button>
        <h1>Проверка голоса</h1>
      </header>

      <div>
        <div className="section">Это устройство</div>
        <p className="mini-line">
          {standalone ? 'приложение с иконки (PWA)' : 'вкладка браузера'} · {navigator.onLine ? 'сеть есть' : 'без сети'}
        </p>
        <p className="mini-line">{navigator.userAgent}</p>
      </div>

      <div>
        <div className="section">Распознавание речи</div>
        <p className="mini-line">{SR ? 'есть в браузере' : 'в этом браузере нет'}</p>
        {SR && (
          <>
            <label className="mini-line">
              <input type="checkbox" checked={local} onChange={(e) => setLocal(e.target.checked)} /> только на устройстве (processLocally)
            </label>
            <p className="mini-line">способ выбирай до первого нажатия, после запуска приложения: переключение посреди не работает</p>
            <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="same">один объект на все попытки</option>
              <option value="fresh">новый объект, прежний остановлен</option>
              <option value="continuous">одна сессия без перезапуска</option>
              <option value="mic">микрофон открыт заранее</option>
              <option value="cue">сначала озвучка «Bitte sprechen», потом слушать</option>
            </select>
            <div className="btnrow">
              <button className="btn2" onClick={() => void listen()}>
                Говорить по-немецки
              </button>
              <button className="btn2" onClick={() => rec.current?.stop()}>
                Стоп
              </button>
            </div>
            <p className="heard">{heard || 'скажи, например: «der Tisch, die Tische»'}</p>
          </>
        )}
      </div>

      <div>
        <div className="section">Озвучка</div>
        {'speechSynthesis' in window ? (
          <>
            <p className="mini-line">немецких голосов: {voices.length}</p>
            {voices.length > 0 && (
              <select value={voice} onChange={(e) => setVoice(e.target.value)}>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} · {v.lang} · {v.localService ? 'на устройстве' : 'через сеть'}
                  </option>
                ))}
              </select>
            )}
            <div className="btnrow">
              <button className="btn2" onClick={() => say('der Tisch, die Tische')}>
                «der Tisch, die Tische»
              </button>
              <button className="btn2" onClick={() => say('Die Rechnung, bitte.')}>
                «Die Rechnung, bitte.»
              </button>
            </div>
          </>
        ) : (
          <p className="mini-line">в этом браузере нет</p>
        )}
      </div>

      <div>
        <div className="section">Журнал</div>
        {log.map((l, i) => (
          <p key={i} className="mini-line">
            {l}
          </p>
        ))}
      </div>
    </main>
  )
}
