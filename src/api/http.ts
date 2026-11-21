import { API_BASE } from '../config'

const DEFAULT_TIMEOUT_MS = 10_000

/** Failure talking to the API: HTTP error (`status > 0`) or unreachable server (`status === 0`). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  /** The server could not be reached (offline, timeout) rather than rejected the call. */
  get isOffline(): boolean {
    return this.status === 0
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface RequestOptions {
  method?: HttpMethod
  body?: unknown
  headers?: Record<string, string>
  timeoutMs?: number
  signal?: AbortSignal
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; details?: unknown }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException
      ? error.name === 'AbortError'
      : typeof error === 'object' &&
        error !== null &&
        (error as { name?: string }).name === 'AbortError'
  )
}

/**
 * Calls the RestoDash API and unwraps the `{ data }` envelope.
 *
 * Cookies (session + device) travel automatically through `credentials:
 * 'include'`; the Vite dev proxy keeps the API same-origin. HTTP errors become
 * `ApiError`; transport failures become `ApiError` with `status: 0`.
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  )
  const onExternalAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onExternalAbort)

  const isFormData = options.body instanceof FormData

  let requestBody: BodyInit | undefined
  if (options.body instanceof FormData) {
    requestBody = options.body
  } else if (options.body !== undefined) {
    requestBody = JSON.stringify(options.body)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: {
        ...(options.body === undefined || isFormData
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
      body: requestBody,
      signal: controller.signal,
    })
  } catch (error) {
    const aborted = isAbortError(error)
    throw new ApiError(
      0,
      aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
      aborted ? 'Yêu cầu quá hạn' : 'Không kết nối được máy chủ',
    )
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onExternalAbort)
  }

  const text = await response.text()
  let payload: unknown
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = undefined
    }
  }

  if (!response.ok) {
    const envelope = (payload ?? {}) as ErrorEnvelope
    throw new ApiError(
      response.status,
      envelope.error?.code ?? 'HTTP_ERROR',
      envelope.error?.message ?? `Lỗi ${response.status}`,
      envelope.error?.details,
    )
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data
  }
  return payload as T
}
