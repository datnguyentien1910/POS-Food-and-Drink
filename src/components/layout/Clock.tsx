import { useEffect, useState } from 'react'
import { formatClock, formatDate } from '../../lib/format'

export function Clock() {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div
      className="hidden text-right leading-tight xl:block"
      aria-label="Ngày và giờ hiện tại"
    >
      <p className="text-xs font-semibold text-ink">{formatDate(now)}</p>
      <p className="mt-0.5 text-[11px] font-medium text-muted">
        {formatClock(now)}
      </p>
    </div>
  )
}
