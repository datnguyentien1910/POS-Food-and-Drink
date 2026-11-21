import { assetFor } from './catalog-assets'

/**
 * Picks the uploaded image when the server has one, otherwise falls back to
 * the bundled asset for the seed `imageKey`, and finally a neutral placeholder.
 */
export function resolveMenuImage(
  imageUrl: string | null | undefined,
  imageKey: string | null | undefined,
): string {
  if (imageUrl) return imageUrl
  return assetFor(imageKey)
}
