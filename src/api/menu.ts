import { request } from './http'
import type { ServerMenuCategory } from './types'

/** Loads the full menu grouped by category. */
export async function getMenu(): Promise<ServerMenuCategory[]> {
  const result = await request<{ categories: ServerMenuCategory[] }>('/menu')
  return result.categories
}
