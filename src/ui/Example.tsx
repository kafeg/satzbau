import { useMemo } from 'react'
import { around } from '../core/text.ts'
import type { Data } from '../store/db.ts'

// Фраза с выделенным словом и переводом; машинный перевод подписан.
export function Example({ data, wordId, mark, plural = false }: { data: Data; wordId: string; mark: string; plural?: boolean }) {
  const ex = useMemo(() => data.example(wordId, plural), [data, wordId, plural])
  if (!ex) return null
  const [a, w, c] = around(ex.de, ex.word, ex.nth)
  return (
    <div className="example">
      <p className="de">
        {a}
        <mark className={mark}>{w}</mark>
        {c}
      </p>
      <p className="tr">
        {ex.tr}
        {ex.llm && <span className="llm"> · машинный перевод</span>}
      </p>
    </div>
  )
}
