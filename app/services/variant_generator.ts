import db from '@adonisjs/lucid/services/db'
import Variant from '#models/variant'
import type Product from '#models/product'
import type Category from '#models/category'

export type VariantSelection = {
  colorIds?: number[]
  sizeIds?: number[]
}

function* cartesian(a: (number | null)[], b: (number | null)[]) {
  for (const x of a) for (const y of b) yield [x, y] as const
}

function effectiveIds(selection: number[] | undefined, has: boolean): (number | null)[] {
  if (!has) return [null]
  return selection && selection.length > 0 ? selection : []
}

export default class VariantGenerator {
  /**
   * Create variants for every (color, size) combination implied by the
   * category flags + the selection. Print is no longer a variant axis —
   * it lives on the product itself. Skips combinations that already exist
   * so re-running is a no-op. Returns the variants that were created.
   */
  async generate(
    product: Product,
    category: Category,
    selection: VariantSelection
  ): Promise<Variant[]> {
    const colorIds = effectiveIds(selection.colorIds, category.hasColor)
    const sizeIds = effectiveIds(selection.sizeIds, category.hasSize)
    if (colorIds.length === 0 || sizeIds.length === 0) {
      return []
    }

    const existing = await Variant.query().where('product_id', product.id)
    const existingKeys = new Set(existing.map((v) => `${v.colorId ?? 'x'}|${v.sizeId ?? 'x'}`))

    const created: Variant[] = []
    await db.transaction(async (trx) => {
      for (const [colorId, sizeId] of cartesian(colorIds, sizeIds)) {
        const key = `${colorId ?? 'x'}|${sizeId ?? 'x'}`
        if (existingKeys.has(key)) continue

        const variant = await Variant.create(
          { productId: product.id, colorId, sizeId },
          { client: trx }
        )
        created.push(variant)
        existingKeys.add(key)
      }
    })
    return created
  }
}
