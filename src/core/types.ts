// Типы повторяют схемы из docs/data.md. Ключи короткие, потому что это те же JSON-записи.

export type Level = 'A1' | 'A2' | 'B1'
export type Gender = 'm' | 'f' | 'n'
export type Case = 'nom' | 'akk' | 'dat' | 'gen'
export type Num = 'sg' | 'pl'
export type Pos = 'n' | 'v' | 'a'
export type Decl = 'strong' | 'weak' | 'mixed'
export type Person = '1sg' | '2sg' | '3sg' | '1pl' | '2pl' | '3pl'

export interface Noun {
  w: string
  lv: Level
  g?: Gender
  pl?: string
  gen?: string
  dpl?: string
  nd?: 1
  pl_only?: 1
  plu?: 1
  npl?: 1
  mass?: 1
  adjdecl?: 1
  ru?: string
}

export interface Verb {
  w: string
  lv: Level
  p3: string
  pt: string
  pp: string
  aux: 'h' | 's' | 'hs'
  k2?: string
  gov?: string[]
  auxn?: string
  ru?: string
}

export interface Adj {
  w: string
  lv: Level
  st?: string
  cmp?: string
  sup?: string
  ru?: string
}

export type Entry = Noun | Verb | Adj

export interface ThemeWord {
  w: string
  pos: Pos
  lv: Level
  tags?: string[]
}

export interface Theme {
  title: string
  words: ThemeWord[]
}

/** Закрытый список условий отбора наполнения. Новое добавляется только под нужный шаблон. */
export interface Need {
  pos?: Pos
  theme?: string
  tags?: string[]
  g?: Gender[]
  lv_max?: Level
  has?: string[]
  not?: string[]
}

export interface Slot {
  paradigm: string
  case?: Case
  num?: Num
  gender?: Gender | 'from_word'
  decl?: Decl
  person?: Person
  prep?: string
  from_word?: 'aux'
}

export interface SlotOptions {
  paradigm: string
  count: number
  prep?: string
}

export interface Template {
  id: string
  rule: string
  level: Level
  kind: 'choice' | 'input'
  frame: string
  need: Need
  slot: Slot
  options?: SlotOptions
  why: string
}

export interface Explanation {
  title: string
  short: string
  ru_contrast: string
  steps: string[]
  more?: string
}

/** Задание. Не хранится: собирается из шаблона и слова и живёт до ответа. */
export interface Item {
  templateId: string
  rule: string
  level: Level
  kind: 'choice' | 'input'
  /** фраза с пропуском, пропуск показан как ___ */
  text: string
  /** фраза с подставленным верным ответом */
  full: string
  answer: string
  options?: string[]
  word: string
  pos: Pos
  theme: string
  ru?: string
  why: string
  /** подстановки для текста объяснения */
  ctx: Record<string, string>
}

export interface Bundle {
  nouns: Noun[]
  verbs: Verb[]
  adjs: Adj[]
  themes: Record<string, Theme>
  templates: Template[]
  explain: Record<string, Explanation>
  meta: { version: string; built: string; counts: Record<string, number> }
}
