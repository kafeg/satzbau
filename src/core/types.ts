// Типы ядра. Записи базы — docs/data-model.md, понятия приложения — docs/app.md.
export type Gender = 'm' | 'f' | 'n'
export const ARTICLE: Record<Gender, string> = { m: 'der', f: 'die', n: 'das' }
export type Level = 'A1' | 'A2' | 'B1'
// подача — как спрашиваем карточку (docs/app.md, «Подача»): основная, во фразе, раскладкой
export type How = 'word' | 'phrase' | 'sort'
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

// Фраза для подачи «во фразе»: где в тексте пропуск и где спрашиваемое слово (как Example.word и nth).
export type Cloze = {
  de: string
  tr: string
  gap: { text: string; nth: number }
  word: { text: string; nth: number }
}

// Подсказка правила по полю слова (docs/rules.md): правило, его доля на всём словаре, верно ли оно для слова.
export type Hint = {
  text: string
  // что правило утверждает о поле: род («f») или тип множественного («-(e)n»); у «как у последней части» — 'head'
  value: string
  share: number
  n: number
  ok: boolean
  head: string | null
  sources: { url: string; at: string }[]
}

// Запись журнала: единственное, что приложение хранит (docs/app.md, «Журнал»).
export type Answer = {
  t: number
  ex: string
  word: string
  ok: 0 | 1
  given: string
  // подача; нет поля — основная (так записаны ответы до подач)
  how?: How
}
