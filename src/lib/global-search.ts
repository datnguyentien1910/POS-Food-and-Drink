import { getMenuItem } from '../data/menu'
import { tableName } from '../data/tables'
import type { Draft, MenuItem, OrderRecord } from '../types'
import { matchesQuery } from './search'

export interface GlobalSearchSources {
  menu: MenuItem[]
  drafts: Draft[]
  history: OrderRecord[]
}

export interface GlobalSearchResults {
  menu: MenuItem[]
  drafts: Draft[]
  history: OrderRecord[]
  total: number
}

const MENU_LIMIT = 5
const DRAFT_LIMIT = 3
const ORDER_LIMIT = 4

const draftDishNames = (draft: Draft) =>
  draft.items
    .map((line) => getMenuItem(line.menuItemId)?.name ?? '')
    .filter(Boolean)

const orderDishNames = (order: OrderRecord) =>
  order.items.map((item) => item.name)

export function searchEverything(
  query: string,
  sources: GlobalSearchSources,
): GlobalSearchResults {
  if (!query.trim()) {
    return { menu: [], drafts: [], history: [], total: 0 }
  }

  const menu = sources.menu
    .filter((item) =>
      matchesQuery(query, item.name, item.description ?? ''),
    )
    .slice(0, MENU_LIMIT)

  const drafts = sources.drafts
    .filter((draft) =>
      matchesQuery(
        query,
        tableName(draft.tableId),
        draft.note,
        ...draftDishNames(draft),
      ),
    )
    .slice(0, DRAFT_LIMIT)

  const history = sources.history
    .filter((order) =>
      matchesQuery(
        query,
        order.code,
        order.tableName,
        order.note,
        order.cashier,
        ...orderDishNames(order),
      ),
    )
    .slice(0, ORDER_LIMIT)

  return {
    menu,
    drafts,
    history,
    total: menu.length + drafts.length + history.length,
  }
}
