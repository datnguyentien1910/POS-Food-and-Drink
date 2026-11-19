export const RESTAURANT = {
  name: 'RestoDash',
  tagline: 'POS System',
  legalName: 'RestoDash Restaurant',
  address: '123 Đường Trung Tâm, Quận 1, TP.HCM',
  phone: '0901 234 567',
  supportEmail: 'support@restodash.vn',
  cashier: 'Thu ngân',
  taxRate: 0.08,
  tableCount: 12,
} as const

export const ACCOUNT = {
  name: 'Ngọc Anh',
  role: 'Quản lý',
  initials: 'NA',
} as const

export const APP_PAGES = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'pos', label: 'POS' },
  { id: 'orders', label: 'Đơn hàng' },
  { id: 'tables', label: 'Bàn' },
  { id: 'reservations', label: 'Đặt bàn' },
  { id: 'menu', label: 'Thực đơn' },
  { id: 'customers', label: 'Khách hàng' },
  { id: 'reports', label: 'Báo cáo' },
  { id: 'expenses', label: 'Chi phí' },
  { id: 'staff', label: 'Nhân viên' },
  { id: 'settings', label: 'Cài đặt' },
] as const

export type PageId = (typeof APP_PAGES)[number]['id']
