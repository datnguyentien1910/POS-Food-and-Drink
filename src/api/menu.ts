import { request } from './http'
import type {
  ServerMenuCategory,
  ServerMenuCategorySummary,
  ServerMenuItem,
} from './types'

/** Loads the full menu grouped by category. */
export async function getMenu(): Promise<ServerMenuCategory[]> {
  const result = await request<{ categories: ServerMenuCategory[] }>('/menu')
  return result.categories
}

/** Loads the category list used by the item form. */
export function getCategories(): Promise<ServerMenuCategorySummary[]> {
  return request<ServerMenuCategorySummary[]>('/menu/categories')
}

export interface MenuItemInput {
  categoryId: string
  name: string
  description?: string
  price: number
  available?: boolean
  popular?: boolean
  sortOrder?: number
}

/** Creates a menu item (OWNER/MANAGER only). */
export function createMenuItem(input: MenuItemInput): Promise<ServerMenuItem> {
  return request<ServerMenuItem>('/menu/items', {
    method: 'POST',
    body: input,
  })
}

/** Partially updates a menu item (OWNER/MANAGER only). */
export function updateMenuItem(
  id: string,
  input: Partial<MenuItemInput>,
): Promise<ServerMenuItem> {
  return request<ServerMenuItem>(`/menu/items/${id}`, {
    method: 'PATCH',
    body: input,
  })
}

/** Deletes a menu item (OWNER/MANAGER only). */
export async function deleteMenuItem(id: string): Promise<void> {
  await request<void>(`/menu/items/${id}`, { method: 'DELETE' })
}

/** Uploads a new item image and returns the updated item. */
export function uploadMenuItemImage(
  id: string,
  file: File,
): Promise<ServerMenuItem> {
  const body = new FormData()
  body.append('file', file)
  return request<ServerMenuItem>(`/menu/items/${id}/image`, {
    method: 'POST',
    body,
  })
}
