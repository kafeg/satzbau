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
  // ⚠ Якорь должен быть в документе, а blob-URL нельзя отзывать синхронно: Firefox
  // не обрабатывает клик по неприсоединённому якорю, Safari отменяет скачивание
  // по уже отозванному URL. А это тот самый путь, который страхует от вытеснения
  // хранилища на iOS, — молчаливый отказ здесь дороже всего.
  const a = document.createElement('a')
  a.href = url
  a.download = `satzbau-${new Date().toISOString().slice(0, 10)}.json`
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
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
  // ⚠ Проверяются ВСЕ поля, от которых зависит пересчёт. Без проверки `rule` запись
  // с чужим или правленым форматом заводила карточку `r:undefined`, а без `ok` любой
  // ответ считался ошибкой: журнал тихо превращался в мусор, который не отличить
  // от настоящего.
  const ok = d.answers.filter(
    (a): a is Answer =>
      !!a &&
      typeof a.t === 'number' &&
      Number.isFinite(a.t) &&
      typeof a.tpl === 'string' &&
      typeof a.word === 'string' &&
      typeof a.rule === 'string' &&
      (a.ok === 0 || a.ok === 1) &&
      typeof a.given === 'string',
  )
  if (!ok.length) throw new Error('в файле нет ответов')
  return ok.sort((a, b) => a.t - b.t)
}

export async function upload(file: File): Promise<Answer[]> {
  const answers = parse(await file.text())
  await replaceAnswers(answers)
  return answers
}
