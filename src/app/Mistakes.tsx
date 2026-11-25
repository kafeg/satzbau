// Мои ошибки: что хромает и когда вернётся. Строка собирается из журнала, а текст
// причины — из задания, пересобранного по паре «шаблон + слово»: в журнале подстановок
// нет, и это ровно та причина, по которой пара в нём хранится.

import { useState } from 'react'
import { getBundle, getWords } from '../core/bundle.ts'
import { explainItem } from '../core/explain.ts'
import { generate } from '../core/generate.ts'
import { go } from './route.ts'
import { plural } from './session.ts'
import { dueAt, ruleKey, wordKey, type Cards } from './srs.ts'
import type { Answer } from './store.ts'

type By = 'rule' | 'word' | 'theme'

const WHEN = (ms: number | null): string => {
  if (ms === null) return 'новое'
  const d = Math.round((ms - Date.now()) / 86400000)
  if (ms <= Date.now()) return 'сейчас'
  if (d < 1) return 'сегодня'
  if (d === 1) return 'завтра'
  if (d < 30) return `через ${d} дн.`
  return `через ${Math.round(d / 30)} мес.`
}

/** Короткая причина ошибки — из объяснения правила, подставленного под это задание. */
function reason(a: Answer): string {
  const t = getBundle().templates.find((x) => x.id === a.tpl)
  const w = getWords().find((x) => x.w === a.word)
  if (!t || !w) return ''
  try {
    return explainItem(generate(t, w, getWords())).short
  } catch {
    return ''
  }
}

export function Mistakes({
  answers,
  cards,
  onExport,
  onImport,
}: {
  answers: Answer[]
  cards: Cards
  onExport: () => void
  onImport: (file: File) => Promise<void>
}) {
  const [by, setBy] = useState<By>('rule')
  const [note, setNote] = useState<string | null>(null)
  const bundle = getBundle()
  const themeOf = (word: string) => getWords().find((w) => w.w === word)?.theme

  const wrong = answers.filter((a) => !a.ok)
  const groups = new Map<string, { title: string; sub: string; n: number; due: number | null }>()
  for (const a of wrong) {
    const key =
      by === 'rule' ? a.rule : by === 'word' ? a.word : (themeOf(a.word) ?? 'без темы')
    const got = groups.get(key)
    if (got) {
      got.n++
      continue
    }
    groups.set(key, {
      title:
        by === 'rule'
          ? (bundle.explain[a.rule]?.name ?? a.rule)
          : by === 'word'
            ? a.word
            : (bundle.themes[key]?.title ?? key),
      sub: by === 'theme' ? '' : reason(a),
      n: 1,
      due:
        by === 'rule'
          ? dueAt(cards, ruleKey(a.rule))
          : by === 'word'
            ? dueAt(cards, wordKey(a.word))
            : null,
    })
  }
  const rows = [...groups.entries()].sort((a, b) => b[1].n - a[1].n)

  return (
    <main className="home">
      <button className="back wide-back" onClick={() => go({ screen: 'home' })}>
        ← главная
      </button>
      <h1>Мои ошибки</h1>

      {wrong.length === 0 ? (
        <p className="lead">
          Пока ни одной. Они появятся здесь после первых занятий — вместе с тем, когда
          каждую пора повторить.
        </p>
      ) : (
        <>
          <div className="chips">
            {(
              [
                ['rule', 'по правилу'],
                ['word', 'по словам'],
                ['theme', 'по теме'],
              ] as [By, string][]
            ).map(([k, label]) => (
              <button key={k} className={`chip${by === k ? ' on' : ''}`} onClick={() => setBy(k)}>
                {label}
              </button>
            ))}
          </div>

          <ul className="group mistakes">
            {rows.map(([key, r]) => (
              <li key={key}>
                <div className="grule">
                  <span className="rname">
                    {r.title}
                    {r.sub && <span className="rtheme mono">{r.sub}</span>}
                  </span>
                  <span className="rn mono">×{r.n}</span>
                  <span className="rlv">{WHEN(r.due)}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="section">
        <span>Прогресс</span>
        <span>{plural(answers.length, ['ответ', 'ответа', 'ответов'])}</span>
      </h2>
      <div className="panel stack">
        <p className="note small">
          Перенос между устройствами — файлом: на iOS хранилище приложения может быть
          вытеснено, если им не пользоваться, так что выгрузка это ещё и страховка.
        </p>
        <div className="row-buttons">
          <button className="primary" disabled={!answers.length} onClick={onExport}>
            Выгрузить
          </button>
          <label className="ghost file">
            Загрузить
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                onImport(file).then(
                  () => setNote('Прогресс загружен'),
                  (err: unknown) => setNote(err instanceof Error ? err.message : String(err)),
                )
                e.target.value = ''
              }}
            />
          </label>
        </div>
        {note && <p className="note small saved">{note}</p>}
      </div>
    </main>
  )
}
