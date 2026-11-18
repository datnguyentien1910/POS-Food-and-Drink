const vndFormatter = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
})

const pad = (value: number) => String(value).padStart(2, '0')

export function formatVND(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0
  return `${vndFormatter.format(safe)} ₫`
}

export function formatClock(timestamp: number): string {
  const date = new Date(timestamp)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

export function formatDateTime(timestamp: number): string {
  return `${formatDate(timestamp)} ${formatClock(timestamp)}`
}
