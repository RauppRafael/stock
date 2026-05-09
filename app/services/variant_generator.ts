import db from '@adonisjs/lucid/services/db'
import Variant from '#models/variant'
import type Product from '#models/product'
import type Category from '#models/category'

export type VariantSelection = {
  colorIds?: number[]
  printIds?: number[]
  sizeIds?: number[]
}

function* cartesian(a: (number | null)[], b: (number | null)[], c: (number | null)[]) {
  for (const x of a) for (const y of b) for (const z of c) yield [x, y, z] as const
}

function effectiveIds(selection: number[] | undefined, has: boolean): (number | null)[] {
  if (!has) return [null]
  return selection && selection.length > 0 ? selection : []
}

export default class VariantGenerator {
  /**
   * Create variants for every (color, print, size) combination implied by
   * the category flags + the selection. Skips combinations that already
   * exist so re-running is a no-op for existing variants. Returns the
   * variants that were created.
   */
  async generate(
    product: Product,
    category: Category,
    selection: VariantSelection
  ): Promise<Variant[]> {
    const colorIds = effectiveIds(selection.colorIds, category.hasColor)
    const printIds = effectiveIds(selection.printIds, category.hasPrint)
    const sizeIds = effectiveIds(selection.sizeIds, category.hasSize)
    if (colorIds.length === 0 || printIds.length === 0 || sizeIds.length === 0) {
      return []
    }

    const existing = await Variant.query().where('product_id', product.id)
    const existingKeys = new Set(
      existing.map((v) => `${v.colorId ?? 'x'}|${v.printId ?? 'x'}|${v.sizeId ?? 'x'}`)
    )

    const created: Variant[] = []
    await db.transaction(async (trx) => {
      for (const [colorId, printId, sizeId] of cartesian(colorIds, printIds, sizeIds)) {
        const key = `${colorId ?? 'x'}|${printId ?? 'x'}|${sizeId ?? 'x'}`
        if (existingKeys.has(key)) continue

        const variant = await Variant.create(
          { productId: product.id, colorId, printId, sizeId },
          { client: trx }
        )
        created.push(variant)
        existingKeys.add(key)
      }
    })
    return created
  }
}
