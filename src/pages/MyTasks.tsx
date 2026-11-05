import { useAuth } from '../auth/context'
import { api } from '../lib/api'
import { useQuery } from '../hooks/useQuery'
import { LoadError, Loading, TaskTable } from '../components/Ui'
import { Navigate } from 'react-router-dom'

export function MyTasks() {
  const { profile } = useAuth()
  const { data, error, reload } = useQuery(async () => {
    const [tasks, profiles, objects] = await Promise.all([api.tasks(), api.profiles(), api.objects()])
    return { tasks, profiles, objectNames: Object.fromEntries(objects.map(o => [o.id, o.name])) }
  }, 'my-tasks')
  if (profile!.role !== 'executor') return <Navigate to="/" replace />
  return <><div className="page-header"><div><h1>Мои задачи</h1><p className="muted">Назначенные вам работы и их текущие статусы.</p></div></div>
    {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : <TaskTable tasks={data.tasks} profiles={data.profiles} showObject objectNames={data.objectNames} />}
  </>
}
