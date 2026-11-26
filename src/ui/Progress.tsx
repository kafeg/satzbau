// «Прогресс»: цифры по выбранному, по упражнениям; перенос прогресса файлом; версия и источники.
import { useRef } from 'react'
import type { AnyExercise } from '../core/exercises/index.ts'
import type { Overview } from '../core/lesson.ts'
import { plural } from '../core/text.ts'
import type { Level } from '../core/types.ts'

export type Check = 'idle' | 'checking' | 'loading' | 'latest' | 'failed'
const CHECK: Record<Check, string> = {
  idle: '',
  checking: 'проверяю…',
  loading: 'скачиваю новую версию…',
  latest: 'это последняя версия',
  failed: 'не удалось: нет сети?',
}

type Props = {
  level: Level
  theme: string
  ov: Overview
  each: [AnyExercise, Overview][]
  attribution: string
  stored: boolean
  notice: string | null
  // fresh — новая версия скачана и ждёт кнопки
  update: { fresh: boolean; check: Check; onCheck: () => void; onApply: () => void }
  onExport: () => void
  onImport: (f: File) => void
  onBack: () => void
}

export function Progress({ level, theme, ov, each, attribution, stored, notice, update, onExport, onImport, onBack }: Props) {
  const file = useRef<HTMLInputElement>(null)
  const { learned, learning, untouched } = ov.words
  const n = learned + learning + untouched
  const total = n || 1

  return (
    <main className="home with-bar">
      <header className="topbar">
        <button className="close wide" aria-label="Назад" onClick={onBack}>
          ‹
        </button>
        <h1>Прогресс</h1>
      </header>

      <div>
        <div className="section">
          {level} · {theme} · {n} {plural(n, ['слово', 'слова', 'слов'])}
        </div>
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

      <div>
        <div className="section">По упражнениям</div>
        <ul className="exl">
          {each.map(([ex, o]) => (
            <li key={ex.id} className="exr">
              <span>
                <span className="t">{ex.title}</span>
                <span className="s">
                  {o.words.learned} выучено · {o.words.learning} в работе · {o.words.untouched} не начато
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="section">Прогресс на этом устройстве</div>
        {!stored && <p className="notice">⚠ Хранилище недоступно: прогресс этой сессии не сохранится.</p>}
        <div className="btnrow">
          <button className="btn2" onClick={onExport}>
            Сохранить в файл
          </button>
          <button className="btn2" onClick={() => file.current?.click()}>
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
        </div>
        {notice && <p className="notice">{notice}</p>}
      </div>

      <footer className="about">
        <div className="section">О приложении</div>
        <p>
          der Satzbau {__VERSION__} ·{' '}
          {update.fresh ? (
            <button className="link" onClick={update.onApply}>
              обновить
            </button>
          ) : update.check === 'idle' || update.check === 'latest' || update.check === 'failed' ? (
            <>
              {CHECK[update.check] && `${CHECK[update.check]} · `}
              <button className="link" onClick={update.onCheck}>
                проверить обновления
              </button>
            </>
          ) : (
            CHECK[update.check]
          )}
        </p>
        <p>
          Часть переводов и примеров, которых нет в словарях и Tatoeba, сделана LLM. Данные: {attribution}. Код MIT, данные CC BY-SA 4.0 —{' '}
          <a href="https://github.com/kafeg/satzbau">github.com/kafeg/satzbau</a>
        </p>
      </footer>
    </main>
  )
}
