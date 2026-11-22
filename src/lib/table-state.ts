export const TAKEAWAY_KEY = '__takeaway__'

export function orderKey(tableId: string | null): string {
  return tableId ?? TAKEAWAY_KEY
}
