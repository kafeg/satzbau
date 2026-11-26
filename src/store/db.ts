// Единственный модуль, который читает базу (docs/data-model.md, «База приложения»).
// База только читается: sql.js держит её в памяти, офлайн её хранит кэш service worker.
import initSqlJs, { type Database, type SqlValue } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import type { Cloze, Example, Hint, Level, Noun, Theme } from '../core/types.ts'

export type Data = {
  meta: Record<string, string>
  // существительные курса; кому из них какое упражнение подходит, решает упражнение
  nouns: Noun[]
  // темы по порядку, слова темы — в порядке показа
  themes: Theme[]
  // сначала фразы с переводом человека, среди них — самая короткая; слово в нужном числе:
  // для рода — в единственном (во множественном род не виден), для множественного — во множественном
  example(wordId: string, number: 'sg' | 'pl'): Example | null
  // фраза для подачи «во фразе» по полю слова (tools/clozes.py) или null
  cloze(wordId: string, field: string): Cloze | null
  // подсказка правила по полю слова (Exercise.field: 'gender', 'plural'): самое надёжное подходящее правило или исключение
  hint(wordId: string, field: string): Hint | null
}

async function bytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`база: ${res.status} ${url}`)
  const buf = new Uint8Array(await res.arrayBuffer())
  // сервер мог уже снять gzip сам (Content-Encoding): тогда магических байтов нет
  if (buf[0] !== 0x1f || buf[1] !== 0x8b) return buf
  const out = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(out).arrayBuffer())
}

function rows(db: Database, sql: string, params: SqlValue[] = []): Record<string, SqlValue>[] {
  const st = db.prepare(sql, params)
  const out: Record<string, SqlValue>[] = []
  while (st.step()) out.push(st.getAsObject())
  st.free()
  return out
}

export function open(db: Database): Data {
  // сколько таких же токенов во фразе раньше этого: по нему слово находится в тексте фразы
  const nth = (sentence: number, i: number, text: string) =>
    (rows(db, 'SELECT count(*) AS c FROM tokens WHERE sentence = ? AND i < ? AND text = ?', [sentence, i, text])[0]?.c as number) ?? 0
  const meta = Object.fromEntries(rows(db, 'SELECT key, value FROM meta').map((r) => [r.key, r.value])) as Record<string, string>
  const nouns = rows(db, `SELECT id, lemma, gender, plural, number, ru, level, freq, skip FROM words
    WHERE pos = 'noun' AND level IS NOT NULL`).map((r) => ({
    id: r.id as string,
    lemma: r.lemma as string,
    gender: JSON.parse(r.gender as string),
    plural: JSON.parse(r.plural as string),
    number: r.number as Noun['number'],
    ru: r.ru as string | null,
    level: r.level as Level,
    freq: r.freq as number | null,
    skip: JSON.parse(r.skip as string),
  }))
  const themes: Theme[] = rows(db, 'SELECT id, title FROM themes ORDER BY n').map((r) => ({
    id: r.id as string,
    title: r.title as string,
    words: rows(db, 'SELECT word_id FROM theme_words WHERE theme = ? ORDER BY i', [r.id as string]).map((x) => x.word_id as string),
  }))
  return {
    meta,
    nouns,
    themes,
    hint(wordId, field) {
      const [r] = rows(db, `SELECT r.text, r.value, r.n, r.ok AS good, r.sources, h.ok, h.head FROM hints h
        JOIN rules r ON r.id = h.rule_id WHERE h.word_id = ? AND h.field = ?`, [wordId, field])
      if (!r) return null
      return {
        text: r.text as string,
        value: r.value as string,
        share: (r.good as number) / (r.n as number),
        n: r.n as number,
        ok: r.ok === 1,
        head: r.head as string | null,
        sources: JSON.parse(r.sources as string),
      }
    },
    example(wordId, number) {
      const [r] = rows(db, `SELECT s.n, s.de, s.ru, s.ru_by, s.en, s.en_by, t.i, t.text FROM tokens t
        JOIN sentences s ON s.n = t.sentence JOIN morphs m ON m.n = t.morph
        WHERE t.word_id = ? AND m.morph LIKE ?
        ORDER BY s.ru_by LIKE 'tatoeba:%' DESC, s.len, s.n LIMIT 1`, [wordId, number === 'pl' ? '%Number=Plur%' : '%Number=Sing%'])
      if (!r) return null
      return { de: r.de as string, tr: (r.ru as string | null) ?? (r.en as string), word: r.text as string, nth: nth(r.n as number, r.i as number, r.text as string) }
    },
    cloze(wordId, field) {
      const [r] = rows(db, `SELECT s.n, s.de, s.ru, s.en, c.gap, g.text AS gap_text, t.i, t.text FROM clozes c
        JOIN sentences s ON s.n = c.sentence JOIN tokens g ON g.sentence = s.n AND g.i = c.gap
        JOIN tokens t ON t.sentence = s.n AND t.word_id = c.word_id
        WHERE c.word_id = ? AND c.field = ? ORDER BY t.i LIMIT 1`, [wordId, field])
      if (!r) return null
      const n = r.n as number
      return {
        de: r.de as string,
        tr: (r.ru as string | null) ?? (r.en as string),
        gap: { text: r.gap_text as string, nth: nth(n, r.gap as number, r.gap_text as string) },
        word: { text: r.text as string, nth: nth(n, r.i as number, r.text as string) },
      }
    },
  }
}

export async function load(): Promise<Data> {
  const [SQL, buf] = await Promise.all([initSqlJs({ locateFile: () => wasmUrl }), bytes(import.meta.env.BASE_URL + __DB__)])
  return open(new SQL.Database(buf))
}
