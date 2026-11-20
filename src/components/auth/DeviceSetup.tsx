import { useState, type FormEvent } from 'react'
import { Button } from '../ui/Button'

interface DeviceSetupProps {
  busy: boolean
  error: string | null
  onSubmit: (input: { email: string; password: string; name: string }) => void
}

const DEFAULT_DEVICE_NAME = 'POS quầy 1'

export function DeviceSetup({ busy, error, onSubmit }: DeviceSetupProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState(DEFAULT_DEVICE_NAME)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({ email, password, name })
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <p className="text-sm text-muted">
        Thiết bị này chưa được đăng ký. Chủ quán hoặc quản lý đăng nhập để đăng
        ký thiết bị, sau đó nhân viên vào ca bằng PIN.
      </p>

      <label className="grid gap-1.5 text-xs font-semibold text-ink">
        Email
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-normal text-ink outline-none focus:border-primary"
        />
      </label>

      <label className="grid gap-1.5 text-xs font-semibold text-ink">
        Mật khẩu
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-normal text-ink outline-none focus:border-primary"
        />
      </label>

      <label className="grid gap-1.5 text-xs font-semibold text-ink">
        Tên thiết bị
        <input
          type="text"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-normal text-ink outline-none focus:border-primary"
        />
      </label>

      {error ? <p className="text-xs text-negative">{error}</p> : null}

      <Button type="submit" fullWidth disabled={busy}>
        {busy ? 'Đang đăng ký…' : 'Đăng ký thiết bị'}
      </Button>
    </form>
  )
}
