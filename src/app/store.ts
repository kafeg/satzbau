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

/**
 * ⚠ Запрос к IndexedDB может не ответить ВООБЩЕ: ни success, ни error, ни blocked.
 * Так бывает, когда базу держит другая вкладка или хранилище вытеснено. Журнал
 * читается до первого кадра, поэтому приложение висело на «Загрузка…» навсегда —
 * без объяснения и без выхода. Поэтому здесь есть срок: не ответили — считаем
 * хранилище недоступным и работаем в памяти, сказав об этом человеку.
 *
 * ⚠ Срок короткий нарочно: это не «сколько ждать базу», а «сколько человек смотрит
 * на „Загрузка…“, когда базы нет». Открытие базы занимает единицы миллисекунд даже
 * на телефоне — чтение журнала идёт отдельно и под этот срок не попадает.
 */
const OPEN_TIMEOUT = 1500

function open(): Promise<IDBDatabase> {
  db ??= new Promise((ok, fail) => {
    const req = indexedDB.open(DB, 1)
    const timer = setTimeout(() => fail(new Error('IndexedDB не отвечает')), OPEN_TIMEOUT)
    const done = <T>(f: (x: T) => void) => (x: T) => {
      clearTimeout(timer)
      f(x)
    }
    req.onupgradeneeded = () => {
      const d = req.result
      if (!d.objectStoreNames.contains(STORE)) {
        d.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = done(() => ok(req.result))
    req.onerror = done(() => fail(req.error ?? new Error('IndexedDB недоступна')))
    req.onblocked = done(() => fail(new Error('IndexedDB занята другой вкладкой')))
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

/**
 * Импорт: журнал заменяется целиком, иначе пришлось бы решать, что делать с пересечениями.
 *
 * ⚠ Очистка и запись — ОДНА транзакция, и успехом считается её `oncomplete`. Раньше это
 * были clear() плюс транзакция на каждый ответ: сбой на середине (квота, выгрузка вкладки)
 * оставлял человека без старого журнала и с половиной нового, восстанавливать нечем.
 *
 * `id` проставляет само хранилище, поэтому из импортируемых записей он снимается: в файле
 * он бессмысленный номер с чужой машины, а при слиянии файлов — источник коллизий.
 */
export function replaceAnswers(xs: Answer[]): Promise<void> {
  return open().then(
    (d) =>
      new Promise<void>((ok, fail) => {
        const t = d.transaction(STORE, 'readwrite')
        t.oncomplete = () => ok()
        t.onerror = () => fail(t.error ?? new Error('импорт не записался'))
        t.onabort = () => fail(t.error ?? new Error('импорт прерван'))
        const s = t.objectStore(STORE)
        s.clear()
        for (const a of xs) {
          const { id: _id, ...rest } = a as Answer & { id?: number }
          s.add(rest)
        }
      }),
  )
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
