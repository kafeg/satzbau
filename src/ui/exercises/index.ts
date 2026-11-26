// Реестр экранов упражнений: id из core/exercises/index.ts → данные для общих частей экрана (ui/answer,
// docs/app.md, «Экран ответа»). Как выглядит урок, решают общие части и подача, а не упражнение.
import type { ReactNode } from 'react'
import type { Noun } from '../../core/types.ts'
import type { Tone } from '../answer/Art.tsx'
import type { RuleView } from '../answer/Rule.tsx'
import { gender } from './Gender.tsx'
import { plural } from './Plural.tsx'

// разбор слова: формы, заметка об ответе, поле правила, число для примера, цвет слова в примере
export type Facts = { forms: ReactNode; note?: string; field: string; number: 'sg' | 'pl'; mark: string; rule: RuleView }

export type View<A = never> = {
  // варианты ответа по порядку клавиш 1…N; tone — цвет варианта
  options(w: Noun): { a: A; label: string; tone?: string }[]
  // что в строке над словом: у рода — артикль после ответа, у множественного — сразу
  art(w: Noun, done: boolean): Tone | null
  // вопрос под словом: «die …?»
  ask?: string
  // заголовок подачи «разложи», если она есть у упражнения
  sort?: string
  // given — ответ человека или null
  facts(w: Noun, given: A | null): Facts
  // строка слова в итоге урока
  summary(w: Noun): ReactNode
}

// тип ответа знает только сам экран
export const VIEWS: Record<string, View<any>> = { gender, plural }
