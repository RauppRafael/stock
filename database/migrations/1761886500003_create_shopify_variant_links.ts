import { BaseSchema } from '@adonisjs/lucid/schema'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'

/**
 * Replaces the old 1:1 `variants.shopify_variant_id` mapping with a
 * many-to-one join table — one local variant can mirror multiple Shopify
 * variants. The duplicate-Shopify-products case (same SKU listed twice with
 * different photography for M/W) drove this.
 *
 * `last_known_quantity` snapshots what we last pushed to (or saw on) each
 * Shopify variant. Pull uses it to compute per-link deltas correctly when
 * sales hit duplicates independently:
 *   delta_i = current_shopify_qty_i − last_known_quantity_i
 *   pulled_decrement = sum(min(delta_i, 0))
 * That sum is what gets deducted from local stock; positive deltas (manual
 * upward edits in Shopify admin) are ignored because the next push overwrites
 * them anyway.
 *
 * `shopify_variant_id` is UNIQUE — a single Shopify variant can never bind
 * to two local variants. `variant_id` is NOT unique so one local can have
 * many links. `shopify_product_id` is stored alongside as a useful
 * denormalisation for the Link tab UI grouping; runtime matching is by
 * variant GID alone.
 *
 * Per-link `image_url` lets each Shopify variant keep its own photo; the
 * Variant model still has its own `image_url` as a denormalised "canonical"
 * image used by the rest of the UI (Stock page, etc.), populated from the
 * first link's image on create.
 *
 * Existing 1:1 rows are migrated into the new table by the deferred
 * backfill below; the legacy columns are dropped in the next migration.
 */
export default class extends BaseSchema {
  protected tableName = 'shopify_variant_links'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('variant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('variants')
        .onDelete('RESTRICT')
      table.string('shopify_variant_id', 64).notNullable().unique()
      table.string('shopify_product_id', 64).notNullable()
      table.integer('last_known_quantity').nullable()
      table.string('image_url', 2048).nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['variant_id'])
    })

    this.defer(async (db) => {
      await this.backfill(db)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }

  private async backfill(db: QueryClientContract) {
    const rows = await db
      .from('variants')
      .join('products', 'variants.product_id', 'products.id')
      .whereNotNull('variants.shopify_variant_id')
      .select(
        'variants.id as variant_id',
        'variants.shopify_variant_id as shopify_variant_id',
        'variants.image_url as image_url',
        'products.shopify_product_id as shopify_product_id'
      )

    if (!rows.length) return
    const now = new Date()
    for (const row of rows) {
      await db.table('shopify_variant_links').insert({
        variant_id: row.variant_id,
        shopify_variant_id: row.shopify_variant_id,
        // shopify_product_id should always be present whenever
        // shopify_variant_id is (applyLink enforced it), but fall back to
        // empty string for any malformed legacy row so the NOT NULL passes;
        // the row will fail the next sync's validation and be re-linked.
        shopify_product_id: row.shopify_product_id ?? '',
        last_known_quantity: null,
        image_url: row.image_url ?? null,
        created_at: now,
        updated_at: now,
      })
    }
  }
}
