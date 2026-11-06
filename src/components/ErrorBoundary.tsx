import { Component } from 'react'
import type { ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main className="standalone stack">
      <h1>Не удалось открыть страницу</h1>
      <p role="alert">Обновите приложение. Если ошибка повторяется, обратитесь к руководителю.</p>
      <button className="button" onClick={() => window.location.reload()}>Перезагрузить приложение</button>
    </main>
    return this.props.children
  }
}
