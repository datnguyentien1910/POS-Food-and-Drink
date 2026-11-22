/**
 * Categories the server seeds but the UI only uses as POS filters, never as
 * real menu groups. They own no items, so management screens must hide them.
 */
export const VIRTUAL_CATEGORY_NAMES = new Set(['all', 'popular'])

export function isVirtualCategory(name: string): boolean {
  return VIRTUAL_CATEGORY_NAMES.has(name)
}
