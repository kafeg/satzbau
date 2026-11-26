// Пул: слова уровня и ниже (и темы) в порядке показа новых (docs/app.md, «Урок», п. 3):
// сначала нижний уровень; в теме — её порядок, во всех темах — частотность.
import { LEVELS, type Level, type Noun, type Theme } from './types.ts'

export function pool(nouns: Noun[], level: Level, theme?: Theme): Noun[] {
  const top = LEVELS.indexOf(level)
  const at = theme ? new Map(theme.words.map((id, i) => [id, i])) : null
  const rank = (w: Noun) => (at ? at.get(w.id)! : (w.freq ?? Number.MAX_SAFE_INTEGER))
  return nouns
    .filter((w) => LEVELS.indexOf(w.level) <= top && (!at || at.has(w.id)))
    .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || rank(a) - rank(b) || a.lemma.localeCompare(b.lemma, 'de'))
}
