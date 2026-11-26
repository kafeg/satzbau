// Главная — «Занятие»: что учим (уровень и тема одной кнопкой), смешанный урок и упражнения по отдельности.
import type { AnyExercise } from '../core/exercises/index.ts'
import { type Overview, freshToday } from '../core/lesson.ts'
import type { Level } from '../core/types.ts'
import { ProgressIcon } from './Nav.tsx'

export const EXTRA = 10

type Props = {
  level: Level
  theme: string
  ov: Overview
  // по упражнению отдельно: строки под «Заниматься»
  each: [AnyExercise, Overview][]
  onPick: () => void
  onProgress: () => void
  onStart: (extra: number, only?: string) => void
  // новая версия скачана и ждёт кнопки
  onUpdate: (() => void) | null
}

export function Brand() {
  return (
    <span className="brand">
      <span className="art g-m">der</span> Satzbau
    </span>
  )
}

export function Home({ level, theme, ov, each, onPick, onProgress, onStart, onUpdate }: Props) {
  const due = ov.due.length
  const fresh = freshToday(ov)
  const { learned, learning, untouched } = ov.words
  const more = Math.min(EXTRA, ov.fresh.length)

  return (
    <main className="home with-bar">
      {onUpdate && (
        <button className="update" onClick={onUpdate}>
          Есть новая версия · <b>Обновить</b>
        </button>
      )}
      <header className="hdr">
        <h1>
          <Brand />
        </h1>
        <button className="flt" onClick={onPick} aria-label={`Что учим: ${level}, ${theme}`}>
          <span>
            <b>{level}</b> · {theme}
          </span>
        </button>
        <button className="ico wide" onClick={onProgress} aria-label="Прогресс">
          <ProgressIcon />
        </button>
      </header>

      {due + fresh > 0 ? (
        <button className="cta" onClick={() => onStart(0)}>
          <span>
            <span className="cta-title">Заниматься</span>
            <span className="cta-sub">
              {due} к повтору · {fresh} новых
            </span>
          </span>
          {due > 0 && <span className="badge">{due}</span>}
        </button>
      ) : more > 0 ? (
        <button className="cta" onClick={() => onStart(more)}>
          <span>
            <span className="cta-title">На сегодня всё</span>
            <span className="cta-sub">повторы пройдены, новые на сегодня тоже · взять ещё {more} новых</span>
          </span>
        </button>
      ) : (
        <div className="card">
          <span>
            <span className="cta-title">Повторять пока нечего</span>
            <span className="cta-sub">все слова начаты, следующий повтор — по расписанию</span>
          </span>
        </div>
      )}

      <div>
        <div className="section">Существительные</div>
        <ul className="exl">
          {each.map(([ex, o]) => {
            const d = o.due.length
            const f = freshToday(o)
            const empty = d + f === 0
            return (
              <li key={ex.id}>
                <button className="exr" disabled={empty} onClick={() => onStart(0, ex.id)}>
                  <span>
                    <span className="t">{ex.title}</span>
                    <span className="s">
                      {!empty ? `${d} к повтору · ${f} новых` : ex.after && o.fresh.length === 0 && o.words.untouched > 0 ? 'новые слова открываются после рода' : 'на сегодня всё'}
                    </span>
                  </span>
                  {d > 0 ? <span className="badge on">{d}</span> : <span />}
                  <span className="chev" aria-hidden>
                    ›
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="mini">
        <span>
          <b>{learned}</b> выучено
        </span>
        <span>
          <b>{learning}</b> в работе
        </span>
        <span>
          <b>{untouched}</b> не начато
        </span>
      </p>
    </main>
  )
}
