// Типы ядра. Записи базы — docs/data-model.md, понятия приложения — docs/app.md.
export type Gender = 'm' | 'f' | 'n'
export type Level = 'A1' | 'A2' | 'B1'
export const LEVELS: Level[] = ['A1', 'A2', 'B1']

export type Noun = {
  id: string
  lemma: string
  gender: Gender[]
  plural: string[]
  number: 'sg' | 'pl'
  ru: string | null
  level: Level
  freq: number | null
  skip: Record<string, string>
}

// Тема: упорядоченный список id слов, порядок = порядок показа новых.
export type Theme = { id: string; title: string; words: string[] }

export type Example = {
  de: string
  tr: string
  // токен со словом: его текст и номер среди одинаковых токенов фразы
  word: string
  nth: number
}

// Запись журнала: единственное, что приложение хранит (docs/app.md, «Журнал»).
export type Answer = {
  t: number
  ex: string
  word: string
  ok: 0 | 1
  given: string
}
