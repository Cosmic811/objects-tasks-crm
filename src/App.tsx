import { useEffect, useState } from 'react'
import {
  HashRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/context'
import { configured } from './lib/supabase'
import { errorMessage } from './lib/errors'
import { roleLabels } from './lib/workflow'
import { Brand, Dialog, ErrorNotice, Icon, Loading } from './components/Ui'
import { UserAccount, WorkspaceNavigation } from './components/Navigation'
import { Login } from './pages/Login'
import { Objects } from './pages/Objects'
import { ObjectDetail } from './pages/ObjectDetail'
import { MyTasks } from './pages/MyTasks'
import { TaskDetail } from './pages/TaskDetail'

function Protected() {
  const { session, profile, loading, error, retry, signOut } = useAuth()
  const location = useLocation()
  const [logoutError, setLogoutError] = useState('')
  if (loading)
    return (
      <main className="standalone">
        <Loading />
      </main>
    )
  if (!session)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!profile)
    return (
      <main className="standalone stack">
        <h1>Доступ пока не настроен</h1>
        <ErrorNotice>
          {error ||
            'Для аккаунта не назначена роль. Обратитесь к руководителю.'}
        </ErrorNotice>
        {logoutError && <ErrorNotice>{logoutError}</ErrorNotice>}
        <div className="actions">
          <button className="button" onClick={retry}>
            Проверить снова
          </button>
          <button
            className="button secondary"
            onClick={() => {
              void signOut().catch((error) =>
                setLogoutError(errorMessage(error)),
              )
            }}
          >
            Выйти
          </button>
        </div>
      </main>
    )
  return <Shell key={profile.id} />
}
function Shell() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [navigationOpen, setNavigationOpen] = useState(false)
  useEffect(() => {
    document.getElementById('main')?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])
  const context = location.pathname.startsWith('/tasks/') ? 'Карточка задачи'
    : location.pathname.startsWith('/objects/') ? 'Карточка объекта'
      : location.pathname === '/my-tasks' ? 'Мои задачи' : 'Объекты'
  async function logout() {
    setBusy(true)
    setError('')
    try {
      await signOut()
    } catch (error) {
      setError(errorMessage(error))
      setBusy(false)
    }
  }
  return (
    <div className="app-shell">
      <a
        href="#main"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault()
          const main = document.getElementById('main')
          main?.focus()
          main?.scrollIntoView({ block: 'start' })
        }}
      >
        Перейти к содержанию
      </a>
      <aside className="sidebar">
        <Link to="/" className="brand-link" aria-label="Объекты и задачи"><Brand /></Link>
        <p className="navigation-label">Рабочее пространство</p>
        <WorkspaceNavigation role={profile!.role} />
        <UserAccount profile={profile!} onLogout={logout} busy={busy} />
      </aside>
      <div className="workspace">
        <header className="mobile-header">
          <Link to="/" className="brand-link" aria-label="Объекты и задачи"><Brand /></Link>
          <button className="menu-button" aria-label="Открыть меню" aria-expanded={navigationOpen} aria-controls={navigationOpen ? 'workspace-navigation' : undefined} onClick={() => setNavigationOpen(true)}><Icon name="menu" /></button>
        </header>
        <header className="topbar">
          <div className="workspace-context"><span>Рабочий кабинет</span><Icon name="chevron" size={14} /><span>{context}</span></div>
          <span className="role-tag"><Icon name={profile!.role === 'manager' ? 'shield' : 'user'} size={14} />{roleLabels[profile!.role]}</span>
        </header>
        <main id="main" className="content" tabIndex={-1}>
          {error && <ErrorNotice>{error}</ErrorNotice>}
          <div className="route-view" key={location.pathname}><Outlet /></div>
        </main>
        <footer className="app-footer">
          Объекты и задачи · Рабочее пространство команды
        </footer>
      </div>
      {navigationOpen && <Dialog title="Навигация" onClose={() => setNavigationOpen(false)} className="navigation-dialog">
        <div id="workspace-navigation"><WorkspaceNavigation role={profile!.role} onNavigate={() => setNavigationOpen(false)} />{error && <ErrorNotice>{error}</ErrorNotice>}<UserAccount profile={profile!} onLogout={logout} busy={busy} /></div>
      </Dialog>}
    </div>
  )
}
function Setup() {
  return (
    <main className="standalone stack">
      <div className="brand">
        <Icon name="building" />
        Объекты и задачи
      </div>
      <h1>Нужно подключить Supabase</h1>
      <p>
        Приложение готово к настройке. Соединение с базой ещё не задано, вход и
        рабочие данные недоступны.
      </p>
      <ol className="setup-steps">
        <li>Примените SQL-миграцию из папки supabase/migrations.</li>
        <li>Отключите регистрацию и создайте пользователей с профилями.</li>
        <li>
          Задайте VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY в локальном
          окружении.
        </li>
        <li>
          Перезапустите приложение. Пошаговая инструкция находится в README.
        </li>
      </ol>
      <p className="muted">
        Используйте публичный ключ. Секретный service_role во frontend не нужен.
      </p>
    </main>
  )
}
export function App() {
  if (!configured) return <Setup />
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected />}>
            <Route index element={<Objects />} />
            <Route path="objects/:id" element={<ObjectDetail />} />
            <Route path="tasks/:id" element={<TaskDetail />} />
            <Route path="my-tasks" element={<MyTasks />} />
            <Route
              path="*"
              element={
                <div className="stack">
                  <h1>Страница не найдена</h1>
                  <p>Проверьте адрес или вернитесь к списку объектов.</p>
                  <Link to="/" className="button">
                    К объектам
                  </Link>
                </div>
              }
            />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
