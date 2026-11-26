// Карточка задания (docs/app.md, «Экран ответа»): строка артикля над словом занята всегда — слово не сдвигается.
import type { Noun } from '../../core/types.ts'
import { Art, type Tone } from './Art.tsx'

export function WordPrompt({ word, art, ask }: { word: Noun; art: Tone | null; ask?: string }) {
  return (
    <>
      <div className="art-line">{art && <Art g={art} />}</div>
      <div className="lemma mono">{word.lemma}</div>
      <div className="ru">{word.ru}</div>
      {ask && <div className="ask mono">{ask}</div>}
    </>
  )
}
