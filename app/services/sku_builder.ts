import type Color from '#models/color'
import type Product from '#models/product'
import type Size from '#models/size'

export type SkuParts = {
  product: Pick<Product, 'code'>
  color: Pick<Color, 'code'> | null
  size: Pick<Size, 'code'> | null
}

/**
 * Build the human-readable SKU string for a variant from the codes of its
 * product plus its color/size axes. The SKU is purely derived data — never
 * persisted — so editing any code instantly updates every SKU it appears in.
 */
export function buildSkuCode({ product, color, size }: SkuParts): string {
  const segments = [product.code]
  if (color) segments.push(color.code)
  if (size) segments.push(size.code)
  return segments.filter(Boolean).join('-')
}
