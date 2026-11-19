import beefBurger from '../assets/menu/beef-burger.webp'
import caesarSalad from '../assets/menu/caesar-salad.webp'
import che from '../assets/menu/che.webp'
import chickenPasta from '../assets/menu/chicken-pasta.webp'
import chocolateCake from '../assets/menu/chocolate-cake.webp'
import frenchFries from '../assets/menu/french-fries.webp'
import garlicBread from '../assets/menu/garlic-bread.webp'
import grilledChicken from '../assets/menu/grilled-chicken.webp'
import hotCoffee from '../assets/menu/hot-coffee.webp'
import iceCream from '../assets/menu/ice-cream.webp'
import lemonade from '../assets/menu/lemonade.webp'
import mangoSmoothie from '../assets/menu/mango-smoothie.webp'
import margheritaPizza from '../assets/menu/margherita-pizza.webp'
import peachTea from '../assets/menu/peach-tea.webp'
import springRolls from '../assets/menu/spring-rolls.webp'
import vegSandwich from '../assets/menu/veg-sandwich.webp'
import type { Category, MenuItem } from '../types'

export const CATEGORIES: Category[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'popular', label: 'Phổ biến' },
  { id: 'drinks', label: 'Đồ uống' },
  { id: 'starters', label: 'Khai vị' },
  { id: 'mains', label: 'Món chính' },
  { id: 'desserts', label: 'Tráng miệng' },
]

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'ga-nuong',
    name: 'Gà nướng',
    description: 'Gà nướng than hoa, sốt tiêu chanh',
    price: 109000,
    category: 'mains',
    image: grilledChicken,
    popular: true,
  },
  {
    id: 'burger-bo',
    name: 'Burger bò',
    description: 'Bò Úc, phô mai cheddar, khoai tây chiên',
    price: 89000,
    category: 'mains',
    image: beefBurger,
    popular: true,
  },
  {
    id: 'pizza-margherita',
    name: 'Pizza Margherita',
    description: 'Đế mỏng, sốt cà chua, phô mai mozzarella',
    price: 129000,
    category: 'mains',
    image: margheritaPizza,
    popular: true,
  },
  {
    id: 'salad-caesar',
    name: 'Salad Caesar',
    description: 'Rau romaine, parmesan, sốt Caesar',
    price: 69000,
    category: 'starters',
    image: caesarSalad,
  },
  {
    id: 'khoai-tay-chien',
    name: 'Khoai tây chiên',
    description: 'Giòn ngoài, mềm trong, muối biển',
    price: 39000,
    category: 'starters',
    image: frenchFries,
    popular: true,
  },
  {
    id: 'mi-y-ga',
    name: 'Mì Ý gà',
    description: 'Sốt kem cà chua, gà áp chảo',
    price: 85000,
    category: 'mains',
    image: chickenPasta,
  },
  {
    id: 'banh-chocolate',
    name: 'Bánh chocolate',
    description: 'Chocolate 70%, kem tươi',
    price: 45000,
    category: 'desserts',
    image: chocolateCake,
  },
  {
    id: 'nuoc-chanh',
    name: 'Nước chanh',
    description: 'Chanh tươi, đường mía, đá',
    price: 29000,
    category: 'drinks',
    image: lemonade,
  },
  {
    id: 'ca-phe-nong',
    name: 'Cà phê nóng',
    description: 'Robusta pha phin, sữa đặc',
    price: 25000,
    category: 'drinks',
    image: hotCoffee,
    popular: true,
  },
  {
    id: 'banh-mi-rau',
    name: 'Bánh mì rau',
    description: 'Bánh mì giòn, rau củ nướng',
    price: 49000,
    category: 'starters',
    image: vegSandwich,
  },
  {
    id: 'banh-mi-bo-toi',
    name: 'Bánh mì bơ tỏi',
    description: 'Bơ tỏi, rau thơm, phô mai',
    price: 35000,
    category: 'starters',
    image: garlicBread,
  },
  {
    id: 'kem',
    name: 'Kem',
    description: 'Kem vani, sốt caramel',
    price: 39000,
    category: 'desserts',
    image: iceCream,
  },
  {
    id: 'tra-dao',
    name: 'Trà đào',
    description: 'Trà đen, đào ngâm, đá',
    price: 35000,
    category: 'drinks',
    image: peachTea,
    popular: true,
  },
  {
    id: 'sinh-to-xoai',
    name: 'Sinh tố xoài',
    description: 'Xoài chín, sữa chua',
    price: 45000,
    category: 'drinks',
    image: mangoSmoothie,
  },
  {
    id: 'goi-cuon',
    name: 'Gỏi cuốn',
    description: 'Tôm, thịt, bún, rau sống',
    price: 55000,
    category: 'starters',
    image: springRolls,
  },
  {
    id: 'che',
    name: 'Chè',
    description: 'Chè ba màu, nước cốt dừa',
    price: 30000,
    category: 'desserts',
    image: che,
  },
]

export function getMenuItem(id: string): MenuItem | undefined {
  return MENU_ITEMS.find((item) => item.id === id)
}
