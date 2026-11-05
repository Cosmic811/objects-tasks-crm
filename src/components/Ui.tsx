import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { statusLabels } from '../lib/workflow'
import type { Profile, Status, Task } from '../types/database'

export function Icon({ name }: { name: 'building' | 'tasks' | 'arrow' | 'logout' | 'plus' }) {
  const paths = {
    building: <><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1M10 21v-3h4v3" /></>,
    tasks: <><rect x="4" y="4" width="16" height="17" rx="2" /><path d="m8 10 2 2 5-5M8 16h8" /></>,
    arrow: <path d="m9 5 7 7-7 7" />,
    logout: <><path d="M10 4H5v16h5m5-13 5 5-5 5M9 12h11" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
  }
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
export function Badge({ status }: { status: Status }) {
  return <span className={`badge status-${status}`}><span className="status-dot" />{statusLabels[status]}</span>
}
export function ErrorNotice({ children }: { children: ReactNode }) {
  return <div className="notice error" role="alert">{children}</div>
}
export function Success({ children }: { children: ReactNode }) {
  return children ? <div className="notice success" role="status">{children}</div> : null
}
export function Loading() {
  return <div className="loading" role="status"><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /><span className="sr-only">Загрузка данных</span></div>
}
export function LoadError({ error, retry }: { error: string; retry: () => void }) {
  return <div className="stack"><ErrorNotice>{error}</ErrorNotice><button className="button secondary" onClick={retry}>Повторить загрузку</button></div>
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty"><Icon name="tasks" /><h2>{title}</h2><p>{children}</p></div>
}
export function Breadcrumbs({ object }: { object?: { id: string; name: string } }) {
  return <nav aria-label="Путь к странице" className="breadcrumbs"><Link to="/">Объекты</Link>{object && <><span aria-hidden="true">/</span><Link to={`/objects/${object.id}`}>{object.name}</Link></>}</nav>
}
export function Dialog({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const opener = document.activeElement
    ref.current?.showModal()
    return () => { if (opener instanceof HTMLElement && opener.isConnected) opener.focus() }
  }, [])
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={event => {
    event.preventDefault()
    if (!busy) onClose()
  }}>
    <div className="dialog-header"><h2 id={titleId}>{title}</h2><button type="button" className="text-button" onClick={onClose} disabled={busy}>Закрыть</button></div>
    {children}
  </dialog>
}
export function TaskTable({ tasks, profiles, showObject, objectNames }: {
  tasks: Task[]; profiles: Profile[]; showObject?: boolean; objectNames?: Record<string, string>
}) {
  const names = Object.fromEntries(profiles.map(p => [p.id, p.display_name]))
  if (!tasks.length) return <Empty title="Задач пока нет">Здесь появятся назначенные задачи и их текущие статусы.</Empty>
  return <div className="table-wrap"><table>
    <thead><tr><th scope="col">Задача</th><th scope="col">Статус</th><th scope="col" className="desktop-cell">Исполнитель</th></tr></thead>
    <tbody>{tasks.map(task => <tr key={task.id}>
      <td><Link className="row-link" to={`/tasks/${task.id}`}>{task.title}</Link>{showObject && <span className="cell-subtitle">{objectNames?.[task.object_id] ?? 'Объект'}</span>}</td>
      <td><Badge status={task.status} /></td>
      <td className="desktop-cell">{names[task.assignee_id] ?? 'Профиль недоступен'}</td>
    </tr>)}</tbody>
  </table></div>
}
