// Журнал ответов в IndexedDB — единственное, что приложение хранит (docs/app.md, «Журнал»).
// Своя база `satzbau-v2`: в `satzbau` лежит журнал v1 другого формата, его не трогаем.
import type { Answer } from '../core/types.ts'

const NAME = 'satzbau-v2'
const STORE = 'answers'
// ⚠ IndexedDB может не ответить вовсе (другая вкладка, вытеснение): не ждём дольше
const OPEN_TIMEOUT = 1500

let db: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  db ??= new Promise((ok, fail) => {
    const req = indexedDB.open(NAME, 1)
    const timer = setTimeout(() => fail(new Error('хранилище не отвечает')), OPEN_TIMEOUT)
    const settle = <T>(f: (x: T) => void) => (x: T) => {
      clearTimeout(timer)
      f(x)
    }
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { autoIncrement: true })
    req.onsuccess = settle(() => ok(req.result))
    req.onerror = settle(() => fail(req.error ?? new Error('хранилище недоступно')))
    req.onblocked = settle(() => fail(new Error('хранилище занято другой вкладкой')))
  })
  return db
}

function tx(mode: IDBTransactionMode, run: (s: IDBObjectStore) => void): Promise<void> {
  return open().then(
    (d) =>
      new Promise<void>((ok, fail) => {
        const t = d.transaction(STORE, mode)
        t.oncomplete = () => ok()
        t.onerror = () => fail(t.error ?? new Error('запись не удалась'))
        t.onabort = () => fail(t.error ?? new Error('запись прервана'))
        run(t.objectStore(STORE))
      }),
  )
}

export function all(): Promise<Answer[]> {
  return open().then(
    (d) =>
      new Promise<Answer[]>((ok, fail) => {
        const req = d.transaction(STORE, 'readonly').objectStore(STORE).getAll()
        req.onsuccess = () => ok((req.result as Answer[]).sort((a, b) => a.t - b.t))
        req.onerror = () => fail(req.error ?? new Error('чтение не удалось'))
      }),
  )
}

export function add(a: Answer): Promise<void> {
  return tx('readwrite', (s) => s.add(a))
}

// Импорт: журнал заменяется целиком одной транзакцией — сбой посередине не оставит половину.
export function replace(xs: Answer[]): Promise<void> {
  return tx('readwrite', (s) => {
    s.clear()
    for (const a of xs) s.add(a)
  })
}

// Постоянное хранилище просим после первого ответа, а не на старте.
export async function persist(): Promise<void> {
  try {
    await navigator.storage?.persist?.()
  } catch {
    // браузер не дал — остаётся перенос файлом
  }
}
