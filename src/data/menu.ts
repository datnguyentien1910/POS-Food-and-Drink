export { CATEGORIES, MENU_ITEMS } from './catalog-seed'

import { resolveMenuItem } from '../lib/catalog-lookup'
import type { MenuItem } from '../types'

/** Resolves a menu item from the live catalog with a built-in seed fallback. */
export function getMenuItem(id: string): MenuItem | undefined {
  return resolveMenuItem(id)
}
