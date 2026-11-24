// Журнал ответов в IndexedDB. Хранится ТОЛЬКО журнал: состояние повторов выводится
// из него при загрузке (src/app/srs.ts). Так состояние не может разойтись с журналом,
// а формат FSRS можно менять в любой версии — пересчитается.
//
// Журнал он же файл экспорта: ⚠ на iOS хранилище PWA вытесняется, если приложением
// не пользоваться, поэтому выгрузка в файл — страховка, а не роскошь.

export interface Answer {
  /** время ответа, мс */
  t: number
  /** шаблон и слово: по этой паре задание пересобирается целиком */
  tpl: string
  word: string
  rule: string
  ok: 0 | 1
  /** что именно ответил человек */
  given: string
  /** смотрел правило до ответа */
  hint?: 1
}

const DB = 'satzbau'
const STORE = 'answers'
let db: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  db ??= new Promise((ok, fail) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      const d = req.result
      if (!d.objectStoreNames.contains(STORE)) {
        d.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => ok(req.result)
    req.onerror = () => fail(req.error ?? new Error('IndexedDB недоступна'))
  })
  return db
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (d) =>
      new Promise<T>((ok, fail) => {
        const t = d.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => ok(req.result)
        req.onerror = () => fail(req.error ?? new Error('ошибка записи'))
      }),
  )
}

export function addAnswer(a: Answer): Promise<unknown> {
  return tx('readwrite', (s) => s.add(a))
}

export function allAnswers(): Promise<Answer[]> {
  return tx<Answer[]>('readonly', (s) => s.getAll() as IDBRequest<Answer[]>).then((xs) =>
    xs.sort((a, b) => a.t - b.t),
  )
}

export function clearAnswers(): Promise<unknown> {
  return tx('readwrite', (s) => s.clear())
}

/** Импорт: журнал заменяется целиком, иначе пришлось бы решать, что делать с пересечениями. */
export async function replaceAnswers(xs: Answer[]): Promise<void> {
  await clearAnswers()
  for (const a of xs) await addAnswer(a)
}

/**
 * Постоянное хранилище: просим после первого осмысленного действия, а не на старте —
 * иначе браузер спросит человека раньше, чем тот понял, что это за приложение.
 */
export async function persist(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
