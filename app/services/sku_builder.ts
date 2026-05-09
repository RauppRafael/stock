import type Color from '#models/color'
import type Print from '#models/print'
import type Product from '#models/product'
import type Size from '#models/size'

export type SkuParts = {
  product: Pick<Product, 'code'>
  color: Pick<Color, 'code'> | null
  print: Pick<Print, 'code'> | null
  size: Pick<Size, 'code'> | null
}

/**
 * Build the human-readable SKU string for a variant from the codes of its
 * underlying attributes. The SKU is purely derived data — never persisted —
 * so editing an attribute's code instantly updates every SKU it appears in.
 */
export function buildSkuCode({ product, color, print, size }: SkuParts): string {
  const segments = [product.code]
  if (color) segments.push(color.code)
  if (print) segments.push(print.code)
  if (size) segments.push(size.code)
  return segments.filter(Boolean).join('-')
}
