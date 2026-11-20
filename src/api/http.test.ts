import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request } from './http'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('request', () => {
  it('unwraps the data envelope', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: { id: 'u1' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(request<{ id: string }>('/auth/me')).resolves.toEqual({
      id: 'u1',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/me',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('sends a JSON body and content type for writes', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: { ok: true } }))
    vi.stubGlobal('fetch', fetchMock)

    await request('/auth/login', {
      method: 'POST',
      body: { email: 'a@b.c', password: 'secret' },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.c', password: 'secret' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })

  it('throws an ApiError carrying the error envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          { error: { code: 'UNAUTHORIZED', message: 'Hết phiên' } },
          401,
        ),
      ),
    )

    const error = (await request('/auth/me').catch(
      (caught) => caught,
    )) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
    expect(error.message).toBe('Hết phiên')
  })

  it('carries error details from the envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            error: {
              code: 'PRICE_CHANGED',
              message: 'Giá đổi',
              details: { expectedTotal: 1, actualTotal: 2 },
            },
          },
          409,
        ),
      ),
    )

    const error = (await request('/orders').catch(
      (caught) => caught,
    )) as ApiError

    expect(error.details).toEqual({ expectedTotal: 1, actualTotal: 2 })
  })

  it('reports an unreachable server as a network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    const error = await request('/auth/me').catch((caught) => caught)

    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
  })

  it('aborts a request that exceeds its timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            )
          }),
      ),
    )

    const error = await request('/auth/me', { timeoutMs: 5 }).catch(
      (caught) => caught,
    )

    expect(error).toMatchObject({ status: 0, code: 'TIMEOUT' })
  })
})
