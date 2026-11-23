// Загрузка собранных данных. В приложении те же файлы придут по fetch и лягут в кэш
// service worker; здесь они импортируются, чтобы ядро и тесты работали без браузера.

import adjs from '../../content/build/adjs.json' with { type: 'json' }
import explain from '../../content/build/explain.json' with { type: 'json' }
import meta from '../../content/build/meta.json' with { type: 'json' }
import nouns from '../../content/build/nouns.json' with { type: 'json' }
import templates from '../../content/build/templates.json' with { type: 'json' }
import themes from '../../content/build/themes.json' with { type: 'json' }
import verbs from '../../content/build/verbs.json' with { type: 'json' }
import type { Adj, Bundle, Entry, Explanation, Noun, Pos, Template, Theme, ThemeWord, Verb } from './types.ts'

export const bundle: Bundle = {
  nouns: nouns as Noun[],
  verbs: verbs as Verb[],
  adjs: adjs as Adj[],
  themes: themes as Record<string, Theme>,
  templates: templates as Template[],
  explain: explain as Record<string, Explanation>,
  meta: meta as Bundle['meta'],
}

/** Слово темы плюс его запись в лексиконе: генератору нужны обе половины. */
export interface Word extends ThemeWord {
  theme: string
  entry: Entry
}

const byLemma = new Map<string, Entry>()
for (const e of [...bundle.nouns, ...bundle.verbs, ...bundle.adjs]) byLemma.set(e.w, e)

export const words: Word[] = Object.entries(bundle.themes).flatMap(([theme, t]) =>
  t.words
    .filter((w) => byLemma.has(w.w))
    .map((w) => ({ ...w, theme, entry: byLemma.get(w.w) as Entry })),
)

export function entry(lemma: string): Entry | undefined {
  return byLemma.get(lemma)
}

export function isPos<T extends Entry>(w: Word, pos: Pos): w is Word & { entry: T } {
  return w.pos === pos
}
