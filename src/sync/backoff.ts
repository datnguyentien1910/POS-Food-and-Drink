const BASE_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000] as const

/** Base backoff (no jitter) for a given attempt count, capped at 60s. */
export function baseDelay(attempts: number): number {
  const index = Math.max(0, Math.min(Math.floor(attempts), BASE_DELAYS_MS.length - 1))
  return BASE_DELAYS_MS[index]
}

/**
 * Next retry delay: exponential-ish base plus ±20% jitter. `random` is
 * injectable so the sequence is deterministic in tests.
 */
export function nextDelay(attempts: number, random: () => number = Math.random): number {
  const base = baseDelay(attempts)
  const jitter = (random() * 2 - 1) * 0.2
  return Math.max(0, Math.round(base * (1 + jitter)))
}
