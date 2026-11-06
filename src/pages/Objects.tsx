import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { api } from '../lib/api'
import { taskCount } from '../lib/workflow'
import { useQuery } from '../hooks/useQuery'
import { usePagination } from '../hooks/usePagination'
import { ObjectForm } from '../components/ObjectForm'
import { Empty, Icon, LoadError, Loading, Pagination, Success } from '../components/Ui'

export function Objects() {
  const { profile } = useAuth()
  const location = useLocation()
  const manager = profile!.role === 'manager'
  const [creating, setCreating] = useState(false)
  const [success, setSuccess] = useState(location.state?.message ?? '')
  const { data, error, reload, refreshing } = useQuery(async () => {
    const [objects, tasks] = await Promise.all([api.objects(), api.tasks()])
    return { objects, tasks }
  }, 'objects')
  const pagination = usePagination(data?.objects ?? [])
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Объекты</h1>
          <p className="muted">
            {manager
              ? 'Строительные площадки и задачи вашей команды.'
              : 'Объекты, на которых вам назначены задачи.'}
          </p>
        </div>
        {manager && (
          <button className="button" onClick={() => setCreating(true)} disabled={refreshing}>
            <Icon name="plus" />
            Создать объект
          </button>
        )}
      </div>
      <Success>{success}</Success>
      {error ? (
        <LoadError error={error} retry={reload} />
      ) : !data ? (
        <Loading />
      ) : !data.objects.length ? (
        <Empty title="Нет доступных объектов">
          {manager
            ? 'Создайте первый объект, затем добавьте задачи и назначьте исполнителей.'
            : 'Когда руководитель назначит вам задачу, её объект появится здесь.'}
        </Empty>
      ) : (
        <><section className="object-list" aria-label="Список объектов" aria-busy={refreshing}>
          {pagination.items.map((object) => {
            const tasks = data.tasks.filter((t) => t.object_id === object.id)
            return (
              <Link
                className="object-row"
                key={object.id}
                to={`/objects/${object.id}`}
              >
                <span className="object-symbol">
                  <Icon name="building" />
                </span>
                <span className="object-text">
                  <strong>{object.name}</strong>
                  <span><Icon name="pin" size={14} />{object.address}</span>
                </span>
                <span className="object-count">
                  <span className="object-total">{taskCount(tasks.length)}</span>
                  <span className={tasks.some(task => task.status !== 'accepted') ? 'object-open' : 'object-open completed'}>
                    <span className="status-dot" />Не завершено:{' '}
                    {tasks.filter((t) => t.status !== 'accepted').length}
                  </span>
                </span>
                <span className="row-arrow"><Icon name="arrow" /></span>
              </Link>
            )
          })}
        </section><Pagination {...pagination} /></>
      )}
      {creating && (
        <ObjectForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            setSuccess('Объект создан. Можно добавить задачи.')
            reload()
          }}
        />
      )}
    </>
  )
}
