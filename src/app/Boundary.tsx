// Исключение в разборе или генераторе не должно давать белый экран на телефоне.
// Ошибки здесь намеренные (fill бросает на отсутствующей подстановке) — значит
// пользователь должен увидеть, что сломалось, и суметь выйти на главную.

import { Component, type ErrorInfo, type ReactNode } from 'react'

export class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('satzbau:', error, info.componentStack)
  }

  override render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="note">
        <h1>Задание не собралось</h1>
        <p className="mono bad">{this.state.error.message}</p>
        <button
          className="primary wide"
          onClick={() => {
            location.hash = '#/'
            this.setState({ error: null })
          }}
        >
          К списку правил
        </button>
      </main>
    )
  }
}
