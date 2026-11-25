// Статическая загрузка собранных данных — для тестов и CLI, где нет сети и браузера.
// Приложение берёт те же файлы по сети: src/app/load.ts.

import adjs from '../../content/build/adjs.json' with { type: 'json' }
import explain from '../../content/build/explain.json' with { type: 'json' }
import meta from '../../content/build/meta.json' with { type: 'json' }
import nouns from '../../content/build/nouns.json' with { type: 'json' }
import templates from '../../content/build/templates.json' with { type: 'json' }
import themes from '../../content/build/themes.json' with { type: 'json' }
import verbs from '../../content/build/verbs.json' with { type: 'json' }
import { getBundle, getWords, setBundle } from './bundle.ts'
import type { Adj, Bundle, Explanation, Noun, Template, Theme, Verb } from './types.ts'

setBundle({
  nouns: nouns as Noun[],
  verbs: verbs as Verb[],
  adjs: adjs as Adj[],
  themes: themes as Record<string, Theme>,
  templates: templates as Template[],
  explain: explain as Record<string, Explanation>,
  meta: meta as Bundle['meta'],
})

export const bundle = getBundle()
export const words = getWords()
export type { Word } from './bundle.ts'
