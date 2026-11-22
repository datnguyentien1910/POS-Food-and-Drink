import { AlertCircle } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useCatalogStore } from '../../store/useCatalogStore'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { useToast } from '../ui/toast-context'

export interface TableFormModalProps {
  open: boolean
  onClose: () => void
}

const inputClass =
  'h-10 w-full rounded-xl border border-line bg-bg/40 px-3 text-xs font-medium text-ink placeholder:text-faint focus:border-primary-ring focus:bg-surface focus:outline-none'

export function TableFormModal({ open, onClose }: TableFormModalProps) {
  const formId = useId()
  const nameId = useId()
  const seatsId = useId()
  const zoneId = useId()

  const [name, setName] = useState('')
  const [seats, setSeats] = useState('4')
  const [zone, setZone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  if (!open) return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    const numericSeats = Number(seats)
    if (!trimmedName) {
      setError('Vui lòng nhập tên bàn')
      return
    }
    if (
      seats.trim() === '' ||
      !Number.isInteger(numericSeats) ||
      numericSeats < 1 ||
      numericSeats > 50
    ) {
      setError('Số chỗ phải từ 1 đến 50')
      return
    }

    const result = useCatalogStore.getState().createTable({
      name: trimmedName,
      seats: numericSeats,
      zone: zone.trim() || null,
    })
    if (!result.ok) {
      setError(
        result.reason === 'DUPLICATE_NAME'
          ? 'Tên bàn đã tồn tại'
          : 'Số chỗ phải từ 1 đến 50',
      )
      return
    }

    toast.push('Đã thêm bàn')
    onClose()
    void useCatalogStore.getState().flushTableOps()
  }

  return (
    <Modal
      open
      title="Thêm bàn"
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form={formId}>
            Lưu bàn
          </Button>
        </div>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-negative-soft px-3 py-2 text-[11px] font-medium text-negative"
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </p>
        ) : null}

        <div>
          <label
            htmlFor={nameId}
            className="mb-1 block text-[11px] font-semibold text-muted"
          >
            Tên bàn
          </label>
          <input
            id={nameId}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={50}
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor={seatsId}
            className="mb-1 block text-[11px] font-semibold text-muted"
          >
            Số chỗ
          </label>
          <input
            id={seatsId}
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            step={1}
            value={seats}
            onChange={(event) => setSeats(event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor={zoneId}
            className="mb-1 block text-[11px] font-semibold text-muted"
          >
            Khu vực
          </label>
          <input
            id={zoneId}
            type="text"
            value={zone}
            onChange={(event) => setZone(event.target.value)}
            maxLength={50}
            placeholder="Ví dụ: Tầng 1"
            className={inputClass}
          />
        </div>
      </form>
    </Modal>
  )
}
