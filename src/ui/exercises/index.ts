// Реестр экранов упражнений: id из core/exercises/index.ts → как упражнение выглядит.
import type { FC } from 'react'
import type { Noun } from '../../core/types.ts'
import type { Data } from '../../store/db.ts'
import { gender } from './Gender.tsx'
import { plural } from './Plural.tsx'

export type View<A = never> = {
  // содержимое карточки слова до ответа
  Prompt: FC<{ word: Noun }>
  // кнопки ответа и их клавиши; после ответа показывают, что верно
  Choices: FC<{ word: Noun; given: A | null; onAnswer: (a: A) => void }>
  // разбор после ответа
  Reveal: FC<{ word: Noun; given: A; ok: boolean; data: Data }>
  // строка слова в итоге урока
  Summary: FC<{ word: Noun }>
}

// тип ответа знает только сам экран
export const VIEWS: Record<string, View<any>> = { gender, plural }
