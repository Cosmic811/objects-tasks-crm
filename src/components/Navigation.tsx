import { Link, useLocation } from 'react-router-dom'
import type { Profile, Role } from '../types/database'
import { roleLabels } from '../lib/workflow'
import { Avatar, Icon } from './Ui'

export function WorkspaceNavigation({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const { pathname } = useLocation()
  const taskPage = pathname.startsWith('/tasks/')
  const objectsActive = pathname === '/' || pathname.startsWith('/objects/') || (role === 'manager' && taskPage)
  return <nav className="workspace-nav" aria-label="Основная навигация">
    <Link to="/" className={objectsActive ? 'active' : ''} aria-current={objectsActive ? 'page' : undefined} onClick={onNavigate}><Icon name="building" /><span>Объекты</span><Icon name="chevron" size={15} /></Link>
    {role === 'executor' && <Link to="/my-tasks" className={pathname === '/my-tasks' || taskPage ? 'active' : ''} aria-current={pathname === '/my-tasks' || taskPage ? 'page' : undefined} onClick={onNavigate}><Icon name="tasks" /><span>Мои задачи</span><Icon name="chevron" size={15} /></Link>}
  </nav>
}
export function UserAccount({ profile, onLogout, busy }: { profile: Profile; onLogout: () => void; busy: boolean }) {
  return <div className="account">
    <div className="account-person"><Avatar name={profile.display_name} /><div><strong>{profile.display_name}</strong><span>{roleLabels[profile.role]}</span></div></div>
    <button className="logout-button" onClick={onLogout} disabled={busy}><Icon name="logout" size={18} /><span>{busy ? 'Выходим…' : 'Выйти из аккаунта'}</span></button>
  </div>
}
