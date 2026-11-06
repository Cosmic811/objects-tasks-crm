import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../lib/api'
import { mutationErrorMessage } from '../lib/errors'
import type { Building } from '../types/database'
import { Dialog, ErrorNotice, Icon } from './Ui'

export function ObjectForm({
  object,
  onClose,
  onSaved,
}: {
  object?: Building
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const [name, setName] = useState(object?.name ?? '')
  const [address, setAddress] = useState(object?.address ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const addressRef = useRef<HTMLInputElement>(null)
  const errorId = useId()
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending.current) return
    if (!name.trim() || !address.trim()) {
      setError('Укажите название и адрес объекта.')
      ;(!name.trim() ? nameRef : addressRef).current?.focus()
      return
    }
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const id = await api.saveObject(object?.id ?? null, name, address)
      onSaved(id)
    } catch (error) {
      setError(mutationErrorMessage(error))
      setBusy(false)
    } finally {
      pending.current = false
    }
  }
  return (
    <Dialog
      title={object ? 'Изменить объект' : 'Новый объект'}
      description="Название и адрес строительной площадки."
      onClose={onClose}
      busy={busy}
    >
      <form className="form stack" onSubmit={submit} aria-busy={busy}>
        {error && <ErrorNotice id={errorId}>{error}</ErrorNotice>}
        <label>
          Название объекта
          <input
            ref={nameRef}
            name="object-name"
            aria-invalid={Boolean(error && !name.trim()) || undefined}
            aria-describedby={error ? errorId : undefined}
            autoFocus
            required
            maxLength={160}
            placeholder="Например, ЖК Северный"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Адрес
          <input
            ref={addressRef}
            name="object-address"
            aria-invalid={Boolean(error && !address.trim()) || undefined}
            aria-describedby={error ? errorId : undefined}
            required
            maxLength={500}
            placeholder="Город, улица, номер здания"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={busy}
          />
        </label>
        <div className="actions">
          <button className="button" disabled={busy}>
            {busy ? 'Сохраняем…' : 'Сохранить объект'}
            <Icon name="right" size={17} />
          </button>
          <button
            type="button"
            className="button secondary"
            data-dialog-cancel
            disabled={busy}
          >
            Отмена
          </button>
        </div>
      </form>
    </Dialog>
  )
}
