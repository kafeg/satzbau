// Немецкая озвучка голосом системы (docs/app.md, «Озвучка»): единственное место, где приложение трогает speechSynthesis.
import { useSyncExternalStore } from 'react'

const synth = typeof speechSynthesis === 'undefined' ? null : speechSynthesis
// есть ли озвучка в браузере вообще
export const speaks = synth !== null
const subs = new Set<() => void>()
// голос по умолчанию; null — немецкого ещё нет (Chrome отдаёт голоса не сразу, а событием voiceschanged)
let voice: SpeechSynthesisVoice | null = null

export const voices = (): SpeechSynthesisVoice[] => synth?.getVoices().filter((v) => /^de([-_]|$)/i.test(v.lang)) ?? []

// de-DE на устройстве, потом любой de-DE, потом любой немецкий (de-AT, de-CH)
function best(): SpeechSynthesisVoice | null {
  const de = voices()
  const dd = de.filter((v) => v.lang.replace('_', '-') === 'de-DE')
  return dd.find((v) => v.localService) ?? dd[0] ?? de[0] ?? null
}

const ready = () => (voice ??= best()) !== null

synth?.addEventListener('voiceschanged', () => {
  voice = best()
  subs.forEach((f) => f())
})

export function onVoices(f: () => void): () => void {
  subs.add(f)
  return () => subs.delete(f)
}

// есть ли немецкий голос: нет — кнопок озвучки нет
export const useGerman = (): boolean => useSyncExternalStore(onVoices, ready)

type On = { voice?: SpeechSynthesisVoice; onstart?: () => void; onend?: () => void; onerror?: (e: SpeechSynthesisErrorEvent) => void }

export function say(text: string, on: On = {}) {
  if (!synth) return
  // iOS: озвучка иногда «залипает» в состоянии speaking и молчит — cancel() перед speak() её сбрасывает
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'de-DE'
  ready()
  u.voice = on.voice ?? voice
  u.onstart = on.onstart ?? null
  u.onend = on.onend ?? null
  u.onerror = on.onerror ?? null
  synth.speak(u)
}
