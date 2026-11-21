import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { LogIn, RefreshCw } from 'lucide-react'
import { ApiError } from '../api/http'
import type { StaffUser } from '../api/types'
import { RESTAURANT } from '../config'
import { DeviceSetup } from '../components/auth/DeviceSetup'
import { PinPad } from '../components/auth/PinPad'
import { StaffPicker } from '../components/auth/StaffPicker'
import { Button } from '../components/ui/Button'
import { useAuthStore } from '../store/useAuthStore'

type Mode = 'loading' | 'pin' | 'device' | 'password' | 'error'

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function LoginPage() {
  const loadStaff = useAuthStore((state) => state.loadStaff)
  const loginPin = useAuthStore((state) => state.loginPin)
  const loginPassword = useAuthStore((state) => state.loginPassword)
  const setupDevice = useAuthStore((state) => state.setupDevice)

  const [mode, setMode] = useState<Mode>('loading')
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pinError, setPinError] = useState<string | null>(null)

  const loadStaffList = useCallback(async () => {
    try {
      const list = await loadStaff()
      setError(null)
      setStaff(list)
      setSelectedId((current) => current ?? list[0]?.id ?? null)
      setMode('pin')
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        (caught.code === 'DEVICE_REQUIRED' || caught.code === 'DEVICE_REVOKED')
      ) {
        setMode('device')
      } else {
        setError(messageOf(caught, 'Không tải được danh sách nhân viên'))
        setMode('error')
      }
    } finally {
      setBusy(false)
    }
  }, [loadStaff])

  useEffect(() => {
    // Load after mount; every setState runs after an await so the effect never
    // triggers a synchronous cascading render.
    const run = async () => {
      try {
        const list = await loadStaff()
        setError(null)
        setStaff(list)
        setSelectedId((current) => current ?? list[0]?.id ?? null)
        setMode('pin')
      } catch (caught) {
        if (
          caught instanceof ApiError &&
          (caught.code === 'DEVICE_REQUIRED' ||
            caught.code === 'DEVICE_REVOKED')
        ) {
          setMode('device')
        } else {
          setError(messageOf(caught, 'Không tải được danh sách nhân viên'))
          setMode('error')
        }
      }
    }
    void run()
  }, [loadStaff])

  const handleDevice = async (input: {
    email: string
    password: string
    name: string
  }) => {
    setBusy(true)
    setError(null)
    try {
      await setupDevice(input)
      await loadStaffList()
    } catch (caught) {
      setError(messageOf(caught, 'Không đăng ký được thiết bị'))
    } finally {
      setBusy(false)
    }
  }

  const handlePin = async (pin: string) => {
    if (!selectedId) return
    setPinError(null)
    try {
      await loginPin(selectedId, pin)
    } catch (caught) {
      setPinError(
        caught instanceof ApiError && caught.status === 401
          ? 'PIN không đúng'
          : messageOf(caught, 'Đăng nhập thất bại'),
      )
    }
  }

  const handlePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '')
    const password = String(data.get('password') ?? '')
    setBusy(true)
    setError(null)
    try {
      await loginPassword(email, password)
    } catch (caught) {
      setError(messageOf(caught, 'Đăng nhập thất bại'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 py-8">
      <div className="card w-full max-w-[420px] p-6">
        <header className="mb-5 text-center">
          <p className="text-lg font-extrabold text-primary">
            {RESTAURANT.name}
          </p>
          <p className="text-[11px] font-medium text-muted">
            {RESTAURANT.tagline}
          </p>
        </header>

        {mode === 'loading' ? (
          <p className="py-6 text-center text-sm text-muted">Đang kiểm tra…</p>
        ) : null}

        {mode === 'error' ? (
          <div className="grid gap-3 text-center">
            <p className="text-sm text-negative">{error}</p>
            <Button
              variant="secondary"
              onClick={() => {
                setMode('loading')
                void loadStaffList()
              }}
            >
              <RefreshCw size={15} aria-hidden="true" />
              Thử lại
            </Button>
          </div>
        ) : null}

        {mode === 'device' ? (
          <DeviceSetup busy={busy} error={error} onSubmit={handleDevice} />
        ) : null}

        {mode === 'pin' ? (
          <div className="grid gap-4">
            <StaffPicker
              staff={staff}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id)
                setPinError(null)
              }}
            />
            <div className="flex justify-center">
              <PinPad disabled={busy || !selectedId} onSubmit={handlePin} />
            </div>
            {pinError ? (
              <p className="text-center text-xs text-negative">{pinError}</p>
            ) : null}
            <button
              type="button"
              className="text-center text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
              onClick={() => {
                setError(null)
                setMode('password')
              }}
            >
              Đăng nhập bằng mật khẩu
            </button>
          </div>
        ) : null}

        {mode === 'password' ? (
          <form onSubmit={handlePassword} className="grid gap-3">
            <label className="grid gap-1.5 text-xs font-semibold text-ink">
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-normal text-ink outline-none focus:border-primary"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-ink">
              Mật khẩu
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-normal text-ink outline-none focus:border-primary"
              />
            </label>
            {error ? <p className="text-xs text-negative">{error}</p> : null}
            <Button type="submit" fullWidth disabled={busy}>
              <LogIn size={15} aria-hidden="true" />
              Đăng nhập
            </Button>
            <button
              type="button"
              className="text-center text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
              onClick={() => {
                setError(null)
                setMode(staff.length > 0 ? 'pin' : 'device')
              }}
            >
              Quay lại
            </button>
          </form>
        ) : null}
      </div>
    </div>
  )
}
