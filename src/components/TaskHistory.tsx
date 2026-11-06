import type { History, Profile } from '../types/database'
import { formatDate } from '../lib/workflow'
import { Avatar, Badge, Icon } from './Ui'

export function TaskHistory({ history, profiles }: { history: History[]; profiles: Profile[] }) {
  const name = (id: string) => profiles.find(profile => profile.id === id)?.display_name ?? 'Профиль недоступен'
  return <section className="history-section" aria-labelledby="task-history-title">
    <div className="history-heading"><Icon name="clock" size={20} /><h2 id="task-history-title">История статусов</h2><span className="count">{history.length}</span></div>
    {!history.length ? <p className="muted">Записей пока нет.</p> : <ol className="history-list">
      {history.map(entry => <li key={entry.id}>
        <span className={`history-point status-${entry.to_status}`} aria-hidden="true"><Icon name={entry.from_status ? 'check' : 'plus'} size={12} /></span>
        <div className="history-entry">
          <div className="history-transition">
            {entry.from_status ? <><Badge status={entry.from_status} /><Icon name="right" size={15} /><Badge status={entry.to_status} /></> : <><strong>Задача создана</strong><Badge status={entry.to_status} /></>}
          </div>
          <div className="history-meta"><span className="person"><Avatar name={name(entry.actor_id)} /><span>{name(entry.actor_id)}</span></span><time dateTime={entry.created_at}>{formatDate(entry.created_at)}</time></div>
          {entry.comment && <p className="history-comment preserve-lines">{entry.comment}</p>}
        </div>
      </li>)}
    </ol>}
  </section>
}
