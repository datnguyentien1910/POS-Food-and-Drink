import { RESTAURANT } from '../config'
import { assetFor } from '../lib/catalog-assets'
import type { Category, CategoryId, MenuItem, TableOption } from '../types'

export const CATEGORIES: Category[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'popular', label: 'Phổ biến' },
  { id: 'drinks', label: 'Đồ uống' },
  { id: 'starters', label: 'Khai vị' },
  { id: 'mains', label: 'Món chính' },
  { id: 'desserts', label: 'Tráng miệng' },
]

interface SeedItem {
  id: string
  name: string
  description: string
  price: number
  category: CategoryId
  imageKey: string
  popular?: boolean
}

/**
 * Built-in mirror of the server seed (`server/src/prisma/seed-data.ts`). Used
 * before the first successful catalog fetch and by tests; the live catalog
 * replaces it as soon as `useCatalogStore.refresh()` succeeds.
 */
const SEED_ITEMS: SeedItem[] = [
  { id: 'ga-nuong', name: 'Gà nướng', description: 'Gà nướng than hoa, sốt tiêu chanh', price: 109000, category: 'mains', imageKey: 'grilled-chicken.webp', popular: true },
  { id: 'burger-bo', name: 'Burger bò', description: 'Bò Úc, phô mai cheddar, khoai tây chiên', price: 89000, category: 'mains', imageKey: 'beef-burger.webp', popular: true },
  { id: 'pizza-margherita', name: 'Pizza Margherita', description: 'Đế mỏng, sốt cà chua, phô mai mozzarella', price: 129000, category: 'mains', imageKey: 'margherita-pizza.webp', popular: true },
  { id: 'salad-caesar', name: 'Salad Caesar', description: 'Rau romaine, parmesan, sốt Caesar', price: 69000, category: 'starters', imageKey: 'caesar-salad.webp' },
  { id: 'khoai-tay-chien', name: 'Khoai tây chiên', description: 'Giòn ngoài, mềm trong, muối biển', price: 39000, category: 'starters', imageKey: 'french-fries.webp', popular: true },
  { id: 'mi-y-ga', name: 'Mì Ý gà', description: 'Sốt kem cà chua, gà áp chảo', price: 85000, category: 'mains', imageKey: 'chicken-pasta.webp' },
  { id: 'banh-chocolate', name: 'Bánh chocolate', description: 'Chocolate 70%, kem tươi', price: 45000, category: 'desserts', imageKey: 'chocolate-cake.webp' },
  { id: 'nuoc-chanh', name: 'Nước chanh', description: 'Chanh tươi, đường mía, đá', price: 29000, category: 'drinks', imageKey: 'lemonade.webp' },
  { id: 'ca-phe-nong', name: 'Cà phê nóng', description: 'Robusta pha phin, sữa đặc', price: 25000, category: 'drinks', imageKey: 'hot-coffee.webp', popular: true },
  { id: 'banh-mi-rau', name: 'Bánh mì rau', description: 'Bánh mì giòn, rau củ nướng', price: 49000, category: 'starters', imageKey: 'veg-sandwich.webp' },
  { id: 'banh-mi-bo-toi', name: 'Bánh mì bơ tỏi', description: 'Bơ tỏi, rau thơm, phô mai', price: 35000, category: 'starters', imageKey: 'garlic-bread.webp' },
  { id: 'kem', name: 'Kem', description: 'Kem vani, sốt caramel', price: 39000, category: 'desserts', imageKey: 'ice-cream.webp' },
  { id: 'tra-dao', name: 'Trà đào', description: 'Trà đen, đào ngâm, đá', price: 35000, category: 'drinks', imageKey: 'peach-tea.webp', popular: true },
  { id: 'sinh-to-xoai', name: 'Sinh tố xoài', description: 'Xoài chín, sữa chua', price: 45000, category: 'drinks', imageKey: 'mango-smoothie.webp' },
  { id: 'goi-cuon', name: 'Gỏi cuốn', description: 'Tôm, thịt, bún, rau sống', price: 55000, category: 'starters', imageKey: 'spring-rolls.webp' },
  { id: 'che', name: 'Chè', description: 'Chè ba màu, nước cốt dừa', price: 30000, category: 'desserts', imageKey: 'che.webp' },
]

export const MENU_ITEMS: MenuItem[] = SEED_ITEMS.map((item) => ({
  id: item.id,
  serverId: item.id,
  name: item.name,
  description: item.description,
  price: item.price,
  category: item.category,
  imageKey: item.imageKey,
  image: assetFor(item.imageKey),
  available: true,
  popular: Boolean(item.popular),
}))

export const TABLES: TableOption[] = Array.from(
  { length: RESTAURANT.tableCount },
  (_, index) => ({
    id: `ban-${index + 1}`,
    serverId: `ban-${index + 1}`,
    name: `Bàn ${String(index + 1).padStart(2, '0')}`,
    seats: index < 4 ? 2 : index < 8 ? 4 : 6,
  }),
)
