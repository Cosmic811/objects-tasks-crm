import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Building2, CalendarDays, Check,
  CheckCheck, ChevronRight, CircleAlert, CircleCheck, CircleDot, ClipboardList,
  Clock3, Eye, EyeOff, LockKeyhole, LogOut, Mail, MapPin, Menu, Plus,
  RotateCcw, ShieldCheck, Trash2, UserRound, X,
} from 'lucide-react'
import { availableActions, statusLabels } from '../lib/workflow'
import type { Profile, Status, Task } from '../types/database'
import { usePagination } from '../hooks/usePagination'

const icons = {
  building: Building2, tasks: ClipboardList, arrow: ArrowUpRight,
  right: ArrowRight, back: ArrowLeft, chevron: ChevronRight, logout: LogOut,
  plus: Plus, pin: MapPin, menu: Menu, close: X, check: Check,
  accepted: CheckCheck, alert: CircleAlert, success: CircleCheck,
  new: CircleDot, clock: Clock3, revision: RotateCcw, user: UserRound,
  calendar: CalendarDays, lock: LockKeyhole, shield: ShieldCheck,
  mail: Mail, eye: Eye, 'eye-off': EyeOff, trash: Trash2,
}
export type IconName = keyof typeof icons
export function Icon({ name, size = 20, className = '' }: {
  name: IconName; size?: number; className?: string
}) {
  const Glyph = icons[name]
  return <Glyph size={size} strokeWidth={1.65} aria-hidden="true" className={className} />
}
export function Brand() {
  return <div className="brand">
    <span className="brand-symbol"><Icon name="building" size={23} /></span>
    <span className="brand-name">Объекты<span>и задачи</span></span>
  </div>
}
export function Avatar({ name, className = '' }: { name: string; className?: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('')
  return <span className={`avatar ${className}`} aria-hidden="true">{initials}</span>
}
const statusIcons: Record<Status, IconName> = {
  new: 'new', in_progress: 'clock', review: 'tasks', accepted: 'accepted', revision: 'revision',
}
export function Badge({ status }: { status: Status }) {
  return <span key={status} className={`badge status-${status}`}>
    <Icon name={statusIcons[status]} size={14} />{statusLabels[status]}
  </span>
}
export function ErrorNotice({ children, id }: { children: ReactNode; id?: string }) {
  return <div id={id} className="notice error" role="alert"><Icon name="alert" /><div>{children}</div></div>
}
export function Success({ children }: { children: ReactNode }) {
  return <div className={children ? 'notice success' : 'sr-only'} role="status" aria-atomic="true">{children && <><Icon name="success" /><div>{children}</div></>}</div>
}
export function Loading({ variant = 'list' }: { variant?: 'list' | 'task' }) {
  return <div className={`loading loading-${variant}`} role="status" aria-live="polite">
    <span className="sr-only">Загрузка данных</span>
    {variant === 'task' && <div className="loading-title"><span className="skeleton skeleton-label" /><span className="skeleton skeleton-heading" /></div>}
    <div className="loading-rows">{[0, 1, 2].map(row => <div className="skeleton-row" key={row} aria-hidden="true">
      <span className="skeleton skeleton-icon" /><div className="skeleton-copy"><span className="skeleton skeleton-line" /><span className="skeleton skeleton-line short" /></div><span className="skeleton skeleton-label" />
    </div>)}</div>
  </div>
}
export function LoadError({ error, retry }: { error: string; retry: () => void }) {
  return <div className="stack"><ErrorNotice>{error}</ErrorNotice><button className="button secondary" onClick={retry}><Icon name="revision" size={17} />Повторить загрузку</button></div>
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty"><span className="empty-symbol"><Icon name="tasks" size={26} /></span><h2>{title}</h2><p>{children}</p></div>
}
export function Breadcrumbs({ object }: { object?: { id: string; name: string } }) {
  return <nav aria-label="Путь к странице" className="breadcrumbs">
    <Link to="/"><Icon name="building" size={15} />Объекты</Link>
    {object && <><Icon name="chevron" size={14} /><Link to={`/objects/${object.id}`}>{object.name}</Link></>}
  </nav>
}
export function Dialog({ title, description, children, onClose, busy = false, className = '' }: {
  title: string; description?: string; children: ReactNode; onClose: () => void; busy?: boolean; className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const [closing, setClosing] = useState(false)
  function requestClose() {
    if (busy || closing) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) onClose()
    else setClosing(true)
  }
  useEffect(() => {
    if (!closing) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const finish = () => { if (preference.matches) onClose() }
    preference.addEventListener('change', finish)
    finish()
    return () => preference.removeEventListener('change', finish)
  }, [closing, onClose])
  useEffect(() => {
    const opener = document.activeElement
    const dialog = ref.current
    if (!dialog?.open) dialog?.showModal()
    return () => {
      dialog?.close()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])
  return <dialog ref={ref} className={className} data-closing={closing || undefined} aria-labelledby={titleId}
    aria-describedby={description ? descriptionId : undefined} aria-busy={busy}
    onCancel={event => { event.preventDefault(); requestClose() }}
    onAnimationEnd={event => { if (closing && event.target === ref.current) onClose() }}
    onSubmitCapture={event => { if (closing) { event.preventDefault(); event.stopPropagation() } }}
    onClickCapture={event => { if (closing) { event.preventDefault(); event.stopPropagation() } }}
    onClick={event => {
      if (event.target instanceof Element && event.target.closest('[data-dialog-cancel]')) requestClose()
    }}>
    <div className="dialog-header"><div><h2 id={titleId}>{title}</h2>{description && <p className="muted" id={descriptionId}>{description}</p>}</div>
      <button type="button" className="icon-button" aria-label="Закрыть" onClick={requestClose} disabled={busy || closing}><Icon name="close" /></button>
    </div>{children}
  </dialog>
}
function taskHint(task: Task, viewer?: Profile) {
  if (viewer) {
    const action = availableActions(viewer, task)[0]
    if (action) return action.label
  }
  const hints: Record<Status, string> = {
    new: 'Ожидает начала', in_progress: 'Выполняется', review: 'Ожидает проверки',
    accepted: 'Работа завершена', revision: 'Есть замечания',
  }
  return hints[task.status]
}
export function Pagination({ page, pages, from, to, total, previous, next }: {
  page: number; pages: number; from: number; to: number; total: number
  previous: () => void; next: () => void
}) {
  if (pages < 2) return null
  return <nav className="pagination" aria-label="Страницы списка">
    <span role="status" aria-live="polite">{from}–{to} из {total}</span>
    <div className="actions">
      <button className="button secondary" onClick={previous} disabled={page === 0} aria-label="Предыдущая страница"><Icon name="back" size={17} />Назад</button>
      <button className="button secondary" onClick={next} disabled={page === pages - 1} aria-label="Следующая страница">Далее<Icon name="right" size={17} /></button>
    </div>
  </nav>
}
export function TaskTable({ tasks, profiles, showObject, objectNames, viewer }: {
  tasks: Task[]; profiles: Profile[]; showObject?: boolean; objectNames?: Record<string, string>; viewer?: Profile
}) {
  const pagination = usePagination(tasks)
  const names = Object.fromEntries(profiles.map(profile => [profile.id, profile.display_name]))
  if (!tasks.length) return <Empty title="Задач пока нет">Здесь появятся назначенные задачи и их текущие статусы.</Empty>
  return <>
    <div className="table-wrap"><table className="task-table">
      <thead><tr><th scope="col">Задача</th><th scope="col">Статус</th><th scope="col">Исполнитель</th><th scope="col"><span className="sr-only">Переход</span></th></tr></thead>
      <tbody>{pagination.items.map(task => <tr key={task.id}>
        <td><Link className="row-link" to={`/tasks/${task.id}`}>{task.title}</Link>{showObject && <span className="cell-subtitle"><Icon name="building" size={13} />{objectNames?.[task.object_id] ?? 'Объект'}</span>}</td>
        <td><Badge status={task.status} /><span className="cell-hint">{taskHint(task, viewer)}</span></td>
        <td><span className="person"><Avatar name={names[task.assignee_id] ?? '?'} /><span>{names[task.assignee_id] ?? 'Профиль недоступен'}</span></span></td>
        <td><Icon name="arrow" size={18} /></td>
      </tr>)}</tbody>
    </table></div>
    <ul className="task-cards" aria-label="Список задач">{pagination.items.map(task => <li key={task.id}>
      <Link className="task-card" to={`/tasks/${task.id}`}>
        <div className="task-card-title"><strong>{task.title}</strong><Icon name="arrow" size={18} /></div>
        {showObject && <span className="cell-subtitle"><Icon name="building" size={14} />{objectNames?.[task.object_id] ?? 'Объект'}</span>}
        <div className="task-card-status"><Badge status={task.status} /><span className="cell-hint">{taskHint(task, viewer)}</span></div>
        <span className="person"><Avatar name={names[task.assignee_id] ?? '?'} /><span>{names[task.assignee_id] ?? 'Профиль недоступен'}</span></span>
      </Link>
    </li>)}</ul>
    <Pagination {...pagination} />
  </>
}
