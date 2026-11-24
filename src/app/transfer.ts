// Экспорт и импорт прогресса файлом. Переносится ЖУРНАЛ, а не состояние повторов:
// состояние производное, оно пересчитается на той стороне.
//
// ⚠ Пересчёт не обязан дать те же числа: FSRS зависит от версии и параметров.
// Поэтому в файле записана версия, и расхождение будет объяснимым, а не загадочным.

import { replaceAnswers, type Answer } from './store.ts'

const FORMAT = 1

export interface Dump {
  format: number
  app: 'satzbau'
  saved: string
  answers: Answer[]
}

export function download(answers: Answer[]): void {
  const dump: Dump = {
    format: FORMAT,
    app: 'satzbau',
    saved: new Date().toISOString(),
    answers,
  }
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(dump)], { type: 'application/json' }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = `satzbau-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Разбор файла. Бросает с человеческим текстом: это видно в интерфейсе. */
export function parse(text: string): Answer[] {
  let dump: unknown
  try {
    dump = JSON.parse(text)
  } catch {
    throw new Error('это не файл satzbau: не разбирается как JSON')
  }
  const d = dump as Partial<Dump>
  if (d.app !== 'satzbau' || !Array.isArray(d.answers)) {
    throw new Error('это не файл satzbau')
  }
  if (d.format !== FORMAT) {
    throw new Error(`формат файла ${d.format}, приложение понимает ${FORMAT}`)
  }
  const ok = d.answers.filter(
    (a) => a && typeof a.t === 'number' && typeof a.tpl === 'string' && typeof a.word === 'string',
  )
  if (!ok.length) throw new Error('в файле нет ответов')
  return ok.sort((a, b) => a.t - b.t)
}

export async function upload(file: File): Promise<Answer[]> {
  const answers = parse(await file.text())
  await replaceAnswers(answers)
  return answers
}
