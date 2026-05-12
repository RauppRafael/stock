import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Removes the legacy 1:1 Shopify binding columns now that
 * `shopify_variant_links` carries the relationship at variant-grain (and
 * many-per-variant). The previous migration backfilled existing rows.
 *
 * Down-migration recreates the columns nullable and copies the FIRST link
 * back into them so the system can revert to 1:1 behaviour without data
 * loss (best-effort — multi-link variants will keep only their first
 * Shopify pairing in the legacy column).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('variants', (table) => {
      table.dropUnique(['shopify_variant_id'])
      table.dropColumn('shopify_variant_id')
    })
    this.schema.alterTable('products', (table) => {
      table.dropUnique(['shopify_product_id'])
      table.dropColumn('shopify_product_id')
    })
  }

  async down() {
    this.schema.alterTable('products', (table) => {
      table.string('shopify_product_id', 64).nullable().unique()
    })
    this.schema.alterTable('variants', (table) => {
      table.string('shopify_variant_id', 64).nullable().unique()
    })

    this.defer(async (db) => {
      const links = await db
        .from('shopify_variant_links')
        .select('variant_id', 'shopify_variant_id', 'shopify_product_id')
        .orderBy('id', 'asc')
      const seenVariant = new Set<number>()
      const seenProduct = new Set<string>()
      for (const link of links) {
        if (!seenVariant.has(link.variant_id)) {
          seenVariant.add(link.variant_id)
          await db
            .from('variants')
            .where('id', link.variant_id)
            .update({ shopify_variant_id: link.shopify_variant_id })
        }
        // Map back product link via the variant's product_id, preserving
        // first-wins for products with multiple linked variants.
        const variantRow = await db
          .from('variants')
          .where('id', link.variant_id)
          .select('product_id')
          .first()
        if (variantRow && !seenProduct.has(String(variantRow.product_id))) {
          seenProduct.add(String(variantRow.product_id))
          await db
            .from('products')
            .where('id', variantRow.product_id)
            .update({ shopify_product_id: link.shopify_product_id })
        }
      }
    })
  }
}
