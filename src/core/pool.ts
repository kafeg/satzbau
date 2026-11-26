// Пул: слова уровня и ниже в порядке показа новых (docs/app.md, «Урок», п. 3).
import { LEVELS, type Level, type Noun } from './types.ts'

export function pool(nouns: Noun[], level: Level): Noun[] {
  const top = LEVELS.indexOf(level)
  const rank = (w: Noun) => w.freq ?? Number.MAX_SAFE_INTEGER
  return nouns
    .filter((w) => LEVELS.indexOf(w.level) <= top)
    .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || rank(a) - rank(b) || a.lemma.localeCompare(b.lemma, 'de'))
}
