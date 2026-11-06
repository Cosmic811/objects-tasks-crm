import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { api } from '../lib/api'
import { errorMessage } from '../lib/errors'
import { availableActions, formatDate, statusLabels } from '../lib/workflow'
import { useQuery } from '../hooks/useQuery'
import type { Status } from '../types/database'
import { Avatar, Badge, Breadcrumbs, ErrorNotice, Icon, LoadError, Loading, Success } from '../components/Ui'
import { TaskHistory } from '../components/TaskHistory'
import { TaskForm } from '../components/TaskForm'
import { DeleteDialog } from '../components/DeleteDialog'

export function TaskDetail() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const manager = profile!.role === 'manager'
  const [modal, setModal] = useState<'edit' | 'delete' | null>(null)
  const [revision, setRevision] = useState(false)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState(location.state?.message ?? '')
  const { data, error, reload, refreshing } = useQuery(async () => {
    const [task, profiles, history] = await Promise.all([api.task(id), api.profiles(), api.history(id)])
    const object = await api.object(task.object_id)
    return { task, object, profiles, history }
  }, `task:${id}`)
  const working = busy || refreshing
  async function transition(status: Status) {
    if (!data) return
    if (status === 'revision' && !comment.trim()) { setActionError('Для возврата задачи укажите причину.'); return }
    setBusy(true); setActionError(''); setSuccess('')
    try {
      await api.transition(data.task, status, status === 'revision' ? comment : undefined)
      setRevision(false); setComment('')
      setSuccess(`Статус изменён: ${statusLabels[status]}.`)
      reload()
    } catch (error) { setActionError(errorMessage(error)) }
    finally { setBusy(false) }
  }
  if (error) return <><Breadcrumbs /><LoadError error={error} retry={reload} /></>
  if (!data) return <Loading variant="task" />
  const { task, object, profiles, history } = data
  const name = (id: string) => profiles.find(person => person.id === id)?.display_name ?? 'Профиль недоступен'
  const actions = availableActions(profile!, task)
  const lastReturn = [...history].reverse().find(entry => entry.to_status === 'revision')
  const waitingText: Record<Status, string> = {
    new: 'Задача назначена. Исполнитель может взять её в работу.',
    in_progress: 'Исполнитель выполняет задачу.',
    review: 'Результат ожидает проверки постановщиком.',
    accepted: 'Работа принята постановщиком.',
    revision: 'Задача возвращена исполнителю на доработку.',
  }
  return <>
    <Breadcrumbs object={object} />
    <div className="page-header task-page-header">
      <div><Badge status={task.status} /><h1 className="task-title">{task.title}</h1></div>
      {manager && <div className="actions page-tools">
        <button className="button secondary" onClick={() => setModal('edit')} disabled={working}><Icon name="tasks" size={17} />Изменить</button>
        <button className="icon-button danger-text" aria-label="Удалить задачу" title="Удалить задачу" onClick={() => setModal('delete')} disabled={working}><Icon name="trash" size={18} /></button>
      </div>}
    </div>
    <Success>{success}</Success>
    {actionError && <ErrorNotice>{actionError} <button className="text-button" onClick={() => { setActionError(''); reload() }}>Обновить карточку</button></ErrorNotice>}
    <div className="task-layout">
      <section className="panel task-description" aria-busy={working}>
        <div className="panel-heading"><Icon name="tasks" size={20} /><h2>Что нужно сделать</h2></div>
        <p className="preserve-lines">{task.description || 'Описание не добавлено.'}</p>
        {task.status === 'revision' && lastReturn?.comment && <div className="return-note">
          <div className="return-note-title"><Icon name="revision" size={18} /><h3>Причина возврата</h3></div>
          <p className="preserve-lines">{lastReturn.comment}</p>
          <span className="return-note-meta">{name(lastReturn.actor_id)} · {formatDate(lastReturn.created_at)}</span>
        </div>}
        <div className="workflow-actions">
          <p className="muted">{actions.length ? manager ? 'Проверьте результат и выберите решение.' : 'Обновите статус, когда перейдёте к следующему этапу.' : waitingText[task.status]}</p>
          {actions.length > 0 && <div className="actions">{actions.map(action => <button
            className={`button ${action.secondary ? 'secondary' : ''}`} key={action.target} disabled={working}
            onClick={() => {
              if (action.target === 'revision') { setRevision(true); setActionError('') }
              else void transition(action.target)
            }}><Icon name={action.target === 'accepted' ? 'check' : action.target === 'revision' ? 'revision' : 'right'} size={18} />{working ? 'Сохраняем…' : action.label}</button>)}</div>}
        </div>
        {revision && <form className="form stack revision-form" aria-busy={working} onSubmit={event => { event.preventDefault(); void transition('revision') }}>
          <label>Причина возврата на доработку<textarea autoFocus required rows={3} maxLength={4000} placeholder="Что нужно исправить исполнителю?" value={comment} onChange={event => setComment(event.target.value)} disabled={working} /></label>
          <div className="actions"><button className="button" disabled={working}>{working ? 'Возвращаем…' : 'Отправить на доработку'}<Icon name="right" size={17} /></button><button className="button secondary" type="button" onClick={() => setRevision(false)} disabled={working}>Отмена</button></div>
        </form>}
      </section>
      <aside className="panel task-meta" aria-label="Данные задачи">
        <h2>Детали задачи</h2>
        <dl>
          <div><dt><Icon name="building" size={15} />Объект</dt><dd><Link to={`/objects/${object.id}`}>{object.name}<Icon name="arrow" size={14} /></Link></dd></div>
          <div><dt><Icon name="pin" size={15} />Адрес</dt><dd>{object.address}</dd></div>
          <div><dt><Icon name="user" size={15} />Исполнитель</dt><dd className="person"><Avatar name={name(task.assignee_id)} /><span>{name(task.assignee_id)}</span></dd></div>
          <div><dt><Icon name="user" size={15} />Автор</dt><dd className="person"><Avatar name={name(task.created_by)} /><span>{name(task.created_by)}</span></dd></div>
          <div><dt><Icon name="calendar" size={15} />Создана</dt><dd><time dateTime={task.created_at}>{formatDate(task.created_at)}</time></dd></div>
        </dl>
      </aside>
      <TaskHistory history={history} profiles={profiles} />
    </div>
    {modal === 'edit' && <TaskForm task={task} objectId={task.object_id} profiles={profiles} onClose={() => setModal(null)} onSaved={() => { setModal(null); setSuccess('Задача сохранена.'); reload() }} />}
    {modal === 'delete' && <DeleteDialog title="Удалить задачу?" description={`«${task.title}» больше не будет отображаться исполнителю.`} remove={() => api.deleteTask(task)} onClose={() => setModal(null)} onDeleted={() => navigate(`/objects/${task.object_id}`, { replace: true })} />}
  </>
}
