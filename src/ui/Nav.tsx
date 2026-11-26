// Разделы «Занятие» и «Прогресс»: на телефоне — панель внизу, на компьютере — значок в шапке (CSS по ширине).
export type Tab = 'learn' | 'progress'

export function ProgressIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M5 19V11M12 19V5M19 19v-6" />
    </svg>
  )
}

function LearnIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M9 11h6M9 15h6" />
    </svg>
  )
}

export function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className="tabbar">
      <button className={tab === 'learn' ? 'on' : ''} aria-current={tab === 'learn'} onClick={() => onTab('learn')}>
        <LearnIcon />
        Занятие
      </button>
      <button className={tab === 'progress' ? 'on' : ''} aria-current={tab === 'progress'} onClick={() => onTab('progress')}>
        <ProgressIcon />
        Прогресс
      </button>
    </nav>
  )
}
