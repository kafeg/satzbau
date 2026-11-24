// Озвучка без ассетов: системный немецкий голос. Голоса в Safari приезжают асинхронно,
// и на устройстве немецкого может не быть вовсе — тогда кнопка не показывается, а не молчит.

const synth = typeof speechSynthesis === 'undefined' ? null : speechSynthesis

export function germanVoice(): SpeechSynthesisVoice | null {
  return synth?.getVoices().find((v) => v.lang.toLowerCase().startsWith('de')) ?? null
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
