// Единственный модуль, который читает базу (docs/data-model.md, «База приложения»).
// База только читается: sql.js держит её в памяти, офлайн её хранит кэш service worker.
import initSqlJs, { type Database, type SqlValue } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { type Example, LEVELS, type Level, type Noun } from '../core/types.ts'

export type Data = {
  meta: Record<string, string>
  genderWords(level: Level): Noun[]
  example(wordId: string): Example | null
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
  const meta = Object.fromEntries(rows(db, 'SELECT key, value FROM meta').map((r) => [r.key, r.value])) as Record<string, string>
  return {
    meta,
    genderWords(level) {
      const upto = LEVELS.slice(0, LEVELS.indexOf(level) + 1)
      return rows(db, `SELECT id, lemma, gender, plural, ru, ru_llm, level FROM words
        WHERE pos = 'noun' AND level IN (${upto.map(() => '?').join(',')})
          AND number = 'sg' AND gender != '[]' AND json_extract(skip, '$.gender') IS NULL`, upto)
        .map((r) => ({
          id: r.id as string,
          lemma: r.lemma as string,
          gender: JSON.parse(r.gender as string),
          plural: JSON.parse(r.plural as string),
          ru: r.ru as string | null,
          ruLlm: r.ru_llm === 1,
          level: r.level as Level,
        }))
    },
    example(wordId) {
      const [r] = rows(db, `SELECT s.n, s.de, s.ru, s.ru_by, s.en, s.en_by, t.i, t.text FROM tokens t
        JOIN sentences s ON s.n = t.sentence WHERE t.word_id = ? ORDER BY s.len, s.n LIMIT 1`, [wordId])
      if (!r) return null
      const [same] = rows(db, 'SELECT count(*) AS c FROM tokens WHERE sentence = ? AND i < ? AND text = ?',
        [r.n as number, r.i as number, r.text as string])
      const ru = r.ru as string | null
      return {
        de: r.de as string,
        tr: ru ?? (r.en as string),
        llm: String(ru ? r.ru_by : r.en_by).startsWith('llm:'),
        word: r.text as string,
        nth: (same?.c as number) ?? 0,
      }
    },
  }
}

export async function load(): Promise<Data> {
  const [SQL, buf] = await Promise.all([initSqlJs({ locateFile: () => wasmUrl }), bytes(import.meta.env.BASE_URL + __DB__)])
  return open(new SQL.Database(buf))
}
