// Перенос журнала файлом. ⚠ На iOS хранилище PWA вытесняется: файл — единственная страховка.
import type { Answer, How } from '../core/types.ts'

const HOWS: How[] = ['word', 'phrase', 'sort']

const FORMAT = 1

export function download(answers: Answer[]): void {
  const dump = { format: FORMAT, app: 'satzbau', saved: new Date().toISOString(), answers }
  const url = URL.createObjectURL(new Blob([JSON.stringify(dump)], { type: 'application/json' }))
  // ⚠ якорь должен быть в документе, а URL нельзя отзывать сразу: иначе Firefox и Safari молча не качают
  const a = document.createElement('a')
  a.href = url
  a.download = `satzbau-${new Date().toISOString().slice(0, 10)}.json`
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const isAnswer = (a: unknown): a is Answer => {
  const x = a as Answer
  return (
    typeof x === 'object' && x !== null && Number.isFinite(x.t) && typeof x.ex === 'string' &&
    typeof x.word === 'string' && (x.ok === 0 || x.ok === 1) && typeof x.given === 'string'
  )
}

export async function parse(file: File): Promise<Answer[]> {
  let dump: { format?: unknown; app?: unknown; answers?: unknown }
  try {
    dump = JSON.parse(await file.text())
  } catch {
    throw new Error('это не файл прогресса satzbau')
  }
  if (dump.app !== 'satzbau' || dump.format !== FORMAT || !Array.isArray(dump.answers)) {
    throw new Error('это не файл прогресса satzbau этой версии')
  }
  if (!dump.answers.every(isAnswer)) throw new Error('файл повреждён')
  return dump.answers.map(({ t, ex, word, ok, given, how }) => (HOWS.includes(how as How) ? { t, ex, word, ok, given, how } : { t, ex, word, ok, given }))
}
