// Типы ядра. Записи базы — docs/data-model.md, понятия приложения — docs/app.md.
export type Gender = 'm' | 'f' | 'n'
export type Level = 'A1' | 'A2' | 'B1'
export const LEVELS: Level[] = ['A1', 'A2', 'B1']

export type Noun = {
  id: string
  lemma: string
  gender: Gender[]
  plural: string[]
  ru: string | null
  ruLlm: boolean
  level: Level
}

export type Example = {
  de: string
  tr: string
  llm: boolean
  // токен со словом: его текст и номер среди одинаковых токенов фразы
  word: string
  nth: number
}
