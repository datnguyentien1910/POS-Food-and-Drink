import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createMenuItem,
  deleteMenuItem,
  getCategories,
  updateMenuItem,
  uploadMenuItemImage,
} from './menu'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('menu API', () => {
  it('loads category summaries', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        data: [{ id: 'c1', name: 'mains', sortOrder: 1 }],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getCategories()).resolves.toEqual([
      { id: 'c1', name: 'mains', sortOrder: 1 },
    ])
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/menu/categories',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('creates an item with a JSON body', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ data: { id: 'm1', name: 'Phở', price: 89000 } }, 201),
    )
    vi.stubGlobal('fetch', fetchMock)

    const input = {
      categoryId: 'c1',
      name: 'Phở',
      price: 89000,
      available: true,
    }
    await expect(createMenuItem(input)).resolves.toMatchObject({
      id: 'm1',
      price: 89000,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/menu/items',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })

  it('updates an item with a PATCH', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ data: { id: 'm1', price: 99000 } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(updateMenuItem('m1', { price: 99000 })).resolves.toMatchObject(
      { price: 99000 },
    )
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/menu/items/m1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ price: 99000 }),
      }),
    )
  })

  it('deletes an item and resolves undefined on 204', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(undefined, 204))
    vi.stubGlobal('fetch', fetchMock)

    await expect(deleteMenuItem('m1')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/menu/items/m1',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('uploads an image as FormData without a manual content type', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ data: { id: 'm1', imageUrl: '/uploads/menu/a.webp' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const file = new File(['bytes'], 'a.webp', { type: 'image/webp' })
    await expect(uploadMenuItemImage('m1', file)).resolves.toMatchObject({
      imageUrl: '/uploads/menu/a.webp',
    })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('/api/v1/menu/items/m1/image')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('file')).toBe(file)
    expect(init.headers).not.toHaveProperty('Content-Type')
  })
})
