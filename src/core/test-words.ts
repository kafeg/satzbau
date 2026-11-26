// Слова для тестов ядра.
import type { Gender, Level, Noun } from './types.ts'

export const noun = (lemma: string, gender: Gender[] = ['m'], extra: Partial<Noun> = {}): Noun => ({
  id: `n:${lemma}`,
  lemma,
  gender,
  plural: [],
  number: 'sg',
  ru: null,
  ruLlm: false,
  level: 'A1' as Level,
  freq: null,
  skip: {},
  ...extra,
})
