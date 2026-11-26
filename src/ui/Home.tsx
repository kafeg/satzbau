import { useRef } from 'react'
import type { AnyExercise } from '../core/exercises/index.ts'
import { type Overview, freshToday } from '../core/lesson.ts'
import { plural } from '../core/text.ts'
import { LEVELS, type Level } from '../core/types.ts'
import type { Data } from '../store/db.ts'

export const EXTRA = 10

type Props = {
  data: Data
  level: Level
  onLevel: (l: Level) => void
  ov: Overview
  // по упражнению отдельно: карточки под «Заниматься», если упражнений больше одного
  each: [AnyExercise, Overview][]
  theme: string
  onThemes: () => void
  onStart: (extra: number, only?: string) => void
  stored: boolean
  notice: string | null
  onUpdate: (() => void) | null
  onExport: () => void
  onImport: (f: File) => void
}

export function Home({ data, level, onLevel, ov, each, theme, onThemes, onStart, stored, notice, onUpdate, onExport, onImport }: Props) {
  const file = useRef<HTMLInputElement>(null)
  const due = ov.due.length
  const fresh = freshToday(ov)
  const { learned, learning, untouched } = ov.words
  const total = learned + learning + untouched || 1
  const more = Math.min(EXTRA, ov.fresh.length)
  const n = learned + learning + untouched

  return (
    <main className="home">
      {onUpdate && (
        <button className="update" onClick={onUpdate}>
          Есть новая версия · <b>Обновить</b>
        </button>
      )}
      <h1>satzbau</h1>

      <div>
        <div className="section">Уровень</div>
        <div className="chips" role="radiogroup" aria-label="Уровень">
          {LEVELS.map((l) => (
            <button key={l} role="radio" aria-checked={l === level} className={`chip ${l === level ? 'on' : ''}`} onClick={() => onLevel(l)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <button className="picker" onClick={onThemes}>
        <span>
          <span className="caption">Тема</span>
          <span className="v">
            {theme} · {n} {plural(n, ['слово', 'слова', 'слов'])}
          </span>
        </span>
        <span className="chev" aria-hidden>
          ›
        </span>
      </button>

      <div>
        <div className="section">Сегодня</div>
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
              <span className="cta-sub">все слова уровня начаты, следующий повтор — по расписанию</span>
            </span>
          </div>
        )}
        {each.length > 1 &&
          each.map(([ex, o]) => {
            const d = o.due.length
            const f = freshToday(o)
            const empty = d + f === 0
            return (
              <button key={ex.id} className="card ex" disabled={empty} onClick={() => onStart(0, ex.id)}>
                <span>
                  <span className="cta-title">{ex.title}</span>
                  <span className="cta-sub">
                    {!empty ? `${d} к повтору · ${f} новых` : ex.after && o.fresh.length === 0 && o.words.untouched > 0 ? 'новые слова открываются после рода' : 'на сегодня всё'}
                  </span>
                </span>
                {d > 0 && <span className="badge on">{d}</span>}
              </button>
            )
          })}
      </div>

      <div>
        <div className="section">Прогресс {level}</div>
        <div className="stats">
          <div className="stat">
            <b>{learned}</b>
            <span>выучено</span>
          </div>
          <div className="stat">
            <b>{learning}</b>
            <span>в работе</span>
          </div>
          <div className="stat">
            <b>{untouched}</b>
            <span>не начато</span>
          </div>
        </div>
        <div className="meter" aria-hidden>
          <i style={{ width: `${(learned / total) * 100}%` }} />
          <i className="w" style={{ width: `${(learning / total) * 100}%` }} />
        </div>
      </div>

      <footer className="about">
        <p>
          {stored ? 'Прогресс хранится на этом устройстве. ' : '⚠ Хранилище недоступно: прогресс этой сессии не сохранится. '}
          <button className="link" onClick={onExport}>
            Сохранить в файл
          </button>
          {' · '}
          <button className="link" onClick={() => file.current?.click()}>
            Загрузить из файла
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) onImport(f)
            }}
          />
        </p>
        {notice && <p className="notice">{notice}</p>}
        <p>
          Переводы слов и фраз, которых нет в словарях и Tatoeba, сделаны LLM. Данные: {data.meta.attribution}. Код MIT, данные CC BY-SA 4.0 —{' '}
          <a href="https://github.com/kafeg/satzbau">github.com/kafeg/satzbau</a>
        </p>
        <p>satzbau {__VERSION__}</p>
      </footer>
    </main>
  )
}
