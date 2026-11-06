import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { client } from '../lib/supabase'
import { Brand, ErrorNotice, Icon, Loading } from '../components/Ui'

function PlanDrawing() {
  return <svg className="plan-drawing" viewBox="0 0 440 300" fill="none" aria-hidden="true">
    <g className="plan-grid">{[60, 100, 140, 180, 220, 260, 300, 340, 380].map(x => <path d={`M${x} 20V280`} key={x} />)}{[50, 90, 130, 170, 210, 250].map(y => <path d={`M20 ${y}H420`} key={y} />)}</g>
    <g className="plan-wall"><path d="M80 65H360V235H80V65Z" /><path d="M225 65V125M225 165V235M80 155H142M182 155H225M295 65V100M295 140V235M225 175H295" /></g>
    <g className="plan-fine"><path d="M225 125a40 40 0 0 1 40 40h-40M142 155a40 40 0 0 0 40 40v-40M295 100a40 40 0 0 1 40 40h-40" /><path d="M80 43H360M80 37V49M360 37V49M58 65V235M52 65H64M52 235H64" /></g>
    <g className="plan-window"><path d="M112 65H165M80 185V215M332 235H350M360 100V150" /></g>
    <circle cx="225" cy="155" r="4" className="plan-point" />
  </svg>
}
export function Login() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (loading) return <main className="standalone"><Loading /></main>
  if (session) {
    const target: unknown = location.state?.from
    return <Navigate to={typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') && target !== '/login' ? target : '/'} replace />
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const { error } = await client().auth.signInWithPassword({ email: email.trim(), password })
      if (error) setError(error.status === 429 ? 'Слишком много попыток. Подождите немного и повторите вход.' : 'Не удалось войти. Проверьте email и пароль.')
    } catch { setError('Нет соединения с сервером. Попробуйте ещё раз.') }
    finally { setBusy(false) }
  }
  return <main className="login-page">
    <aside className="login-identity">
      <Brand />
      <div className="login-introduction"><h2>От задачи<br />к результату.</h2><p>Объекты, ответственные и история работы.<br />В одном рабочем пространстве.</p></div>
      <PlanDrawing />
      <div className="login-identity-note"><Icon name="building" size={16} /><span>Для строительной команды</span></div>
    </aside>
    <section className="login-workspace" aria-labelledby="login-title">
      <div className="login-mobile-brand"><Brand /></div>
      <div className="login-card">
        <span className="login-lock"><Icon name="lock" size={23} /></span>
        <h1 id="login-title">Вход в рабочий кабинет</h1><p className="muted">Введите данные аккаунта, который вам выдал руководитель.</p>
        <form className="form stack" onSubmit={submit} aria-label="Вход в аккаунт" aria-busy={busy}>
          {error && <ErrorNotice>{error}</ErrorNotice>}
          <label>Email<div className="input-with-icon"><Icon name="mail" size={18} /><input type="email" autoComplete="username" placeholder="name@company.ru" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></div></label>
          <div className="form-field"><label htmlFor="login-password">Пароль</label><div className="password-field"><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Введите пароль" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /><button type="button" className="password-toggle" aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} disabled={busy}><Icon name={showPassword ? 'eye-off' : 'eye'} size={18} /></button></div></div>
          <button className="button full" disabled={busy}><span>{busy ? 'Входим…' : 'Войти в кабинет'}</span><Icon name="right" size={18} /></button>
        </form>
        <p className="login-note"><Icon name="shield" size={17} /><span>Доступ только для сотрудников.<br />Самостоятельной регистрации нет.</span></p>
      </div>
      <p className="login-footer">Объекты и задачи · Рабочий кабинет команды</p>
    </section>
  </main>
}
