import type { OrderRecord } from '../types'

export function makeId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function makeLineId(): string {
  return `line-${makeId()}`
}

export function nextOrderCode(history: OrderRecord[], now: Date): string {
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')
  const prefix = `HD-${datePart}-`
  let highest = 0

  for (const record of history) {
    if (!record.code?.startsWith(prefix)) continue

    const sequence = Number(record.code.slice(prefix.length))
    if (Number.isInteger(sequence) && sequence > highest) {
      highest = sequence
    }
  }

  return `${prefix}${String(highest + 1).padStart(3, '0')}`
}
