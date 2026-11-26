// Фраза-пример с выделенным словом и переводом; слово — в нужном числе (docs/app.md, «Экран ответа»).
import { useMemo } from 'react'
import { around } from '../../core/text.ts'
import type { Data } from '../../store/db.ts'

export function Example({ data, wordId, number, mark }: { data: Data; wordId: string; number: 'sg' | 'pl'; mark: string }) {
  const ex = useMemo(() => data.example(wordId, number), [data, wordId, number])
  if (!ex) return null
  const [a, w, c] = around(ex.de, ex.word, ex.nth)
  return (
    <div className="example">
      <p className="de">
        {a}
        <mark className={mark}>{w}</mark>
        {c}
      </p>
      <p className="tr">{ex.tr}</p>
    </div>
  )
}
