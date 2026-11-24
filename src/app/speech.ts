// Озвучка без ассетов: системный немецкий голос. Голоса в Safari приезжают асинхронно,
// и на устройстве немецкого может не быть вовсе — тогда кнопка не показывается, а не молчит.

const synth = typeof speechSynthesis === 'undefined' ? null : speechSynthesis

const VOICE_KEY = 'satzbau.voice'

export function germanVoices(): SpeechSynthesisVoice[] {
  return synth?.getVoices().filter((v) => v.lang.toLowerCase().startsWith('de')) ?? []
}

/** Выбранный голос, если он ещё есть в системе, иначе первый немецкий. */
export function germanVoice(): SpeechSynthesisVoice | null {
  const all = germanVoices()
  let name: string | null = null
  try {
    name = localStorage.getItem(VOICE_KEY)
  } catch {
    name = null
  }
  return all.find((v) => v.name === name) ?? all[0] ?? null
}

export function pickVoice(name?: string): void {
  try {
    if (name) localStorage.setItem(VOICE_KEY, name)
    else localStorage.removeItem(VOICE_KEY)
  } catch {
    // приватный просмотр: выбор не запомнится
  }
}

export function onVoices(cb: () => void): () => void {
  if (!synth) return () => {}
  synth.addEventListener('voiceschanged', cb)
  return () => synth.removeEventListener('voiceschanged', cb)
}

export function speak(text: string): void {
  const voice = germanVoice()
  if (!synth || !voice) return
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.voice = voice
  u.lang = voice.lang
  u.rate = 0.9
  synth.speak(u)
}
