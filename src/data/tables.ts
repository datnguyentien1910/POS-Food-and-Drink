import { RESTAURANT } from '../config'
import type { TableOption } from '../types'

export const TABLES: TableOption[] = Array.from(
  { length: RESTAURANT.tableCount },
  (_, index) => ({
    id: `ban-${index + 1}`,
    name: `Bàn ${String(index + 1).padStart(2, '0')}`,
    seats: index < 4 ? 2 : index < 8 ? 4 : 6,
  }),
)

export function getTable(id: string | null): TableOption | undefined {
  if (!id) return undefined
  return TABLES.find((table) => table.id === id)
}

export function tableName(id: string | null): string {
  return getTable(id)?.name ?? 'Mang đi'
}
