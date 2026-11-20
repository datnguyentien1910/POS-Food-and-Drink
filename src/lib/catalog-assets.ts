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

/**
 * Static `imageKey → asset` map. Vite needs static imports, so the catalogue
 * layers dynamic item data on top of this fixed table.
 */
export const CATALOG_IMAGES: Record<string, string> = {
  'beef-burger.webp': beefBurger,
  'caesar-salad.webp': caesarSalad,
  'che.webp': che,
  'chicken-pasta.webp': chickenPasta,
  'chocolate-cake.webp': chocolateCake,
  'french-fries.webp': frenchFries,
  'garlic-bread.webp': garlicBread,
  'grilled-chicken.webp': grilledChicken,
  'hot-coffee.webp': hotCoffee,
  'ice-cream.webp': iceCream,
  'lemonade.webp': lemonade,
  'mango-smoothie.webp': mangoSmoothie,
  'margherita-pizza.webp': margheritaPizza,
  'peach-tea.webp': peachTea,
  'spring-rolls.webp': springRolls,
  'veg-sandwich.webp': vegSandwich,
}

const PLACEHOLDER =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60">' +
      '<rect width="80" height="60" fill="#efe8e4"/>' +
      '<text x="40" y="34" text-anchor="middle" font-size="9" fill="#a08f88">Ảnh món</text>' +
      '</svg>',
  )

/** Resolves a catalog `imageKey` to a bundled asset, with a neutral fallback. */
export function assetFor(imageKey: string | null | undefined): string {
  if (imageKey && CATALOG_IMAGES[imageKey]) return CATALOG_IMAGES[imageKey]
  return PLACEHOLDER
}
