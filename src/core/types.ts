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
  /** примеры дополнения с предлогом: «auf den Zug», по одному на предлог. Руками, см. fixes.yaml */
  govex?: string[]
  auxn?: string
  refl?: 1
  /** принятые формы императива 2 л. ед. ч. из UniMorph: «buch» и «buche» обе верны */
  imp?: string[]
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
  /** `from_word` — род первого слова, `from_fill2` — второго (так работают прилагательные) */
  gender?: Gender | 'from_word' | 'from_fill2'
  decl?: Decl
  /** `from_word` — лицо выводится из пары «шаблон + слово», чтобы ответ не был одним на всё */
  person?: Person | 'from_word'
  /** модальный глагол: его формы и есть парадигма пропуска */
  modal?: string
  prep?: string
  from_word?: 'aux'
  /** какой по счёту пример управления берём: у глагола их бывает два */
  nth?: number
}

export interface SlotOptions {
  paradigm: string
  count: number
  prep?: string
}

/**
 * Второе слово фразы: лексика, а не грамматика. Нужно там, где одного слова не хватает
 * на осмысленную фразу: «Er kocht …» без объекта — обрубок.
 */
export interface Fill2 {
  need: Need
  case?: Case
  num?: Num
}

export interface Template {
  id: string
  rule: string
  level: Level
  kind: 'choice' | 'input'
  frame: string
  need: Need
  fill2?: Fill2
  slot: Slot
  options?: SlotOptions
  why: string
}

export interface Explanation {
  /** короткое имя для списка правил */
  name: string
  /** блок на главной */
  group: string
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
  /** другие формы, которые тоже верны: «hol» и «hole» — обе. Только для ввода */
  answers?: string[]
  options?: string[]
  word: string
  /** второе слово, если шаблон его просит */
  word2?: string
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
