import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { client } from '../lib/supabase'
import { ErrorNotice, Icon, Loading } from '../components/Ui'

export function Login() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (loading) return <Loading />
  if (session) {
    const target: unknown = location.state?.from
    return (
      <Navigate
        to={
          typeof target === 'string' &&
          target.startsWith('/') &&
          !target.startsWith('//') &&
          target !== '/login'
            ? target
            : '/'
        }
        replace
      />
    )
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { error } = await client().auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error)
        setError(
          error.status === 429
            ? 'Слишком много попыток. Подождите немного и повторите вход.'
            : 'Не удалось войти. Проверьте email и пароль.',
        )
    } catch {
      setError('Нет соединения с сервером. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="login-page">
      <div className="login-card">
        <div className="brand">
          <span className="brand-symbol">
            <Icon name="building" />
          </span>
          <span>Объекты и задачи</span>
        </div>
        <h1>Вход в рабочий кабинет</h1>
        <p className="muted">
          Задачи строительных объектов, от назначения до проверки результата.
        </p>
        <form
          className="form stack"
          onSubmit={submit}
          aria-label="Вход в аккаунт"
        >
          {error && <ErrorNotice>{error}</ErrorNotice>}
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </label>
          <button className="button full" disabled={busy}>
            {busy ? 'Входим…' : 'Войти'}
          </button>
        </form>
        <p className="login-note">
          Доступ выдаёт руководитель. Самостоятельной регистрации нет.
        </p>
      </div>
      <p className="login-footer">Мини-CRM для строительной команды</p>
    </main>
  )
}
