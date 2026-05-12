import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Links each local variant/product to its Shopify counterpart and adds an
 * `image_url` column so Shopify CDN URLs can be pulled and displayed in the
 * local UI.
 *
 * The link IDs are nullable: a variant/product can exist locally without a
 * Shopify counterpart, and the /sync page surfaces those as "unlinked" rows.
 * They're UNIQUE so the same Shopify variant can't accidentally bind to two
 * local variants — re-linking is intentional and goes through the sync flow.
 *
 * Image URL fits Shopify's CDN length comfortably at 2048; we'll never store
 * the binary, only the reference.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('products', (table) => {
      table.string('shopify_product_id', 64).nullable().unique()
      table.string('image_url', 2048).nullable()
    })

    this.schema.alterTable('variants', (table) => {
      table.string('shopify_variant_id', 64).nullable().unique()
      table.string('image_url', 2048).nullable()
    })
  }

  async down() {
    this.schema.alterTable('variants', (table) => {
      table.dropUnique(['shopify_variant_id'])
      table.dropColumn('shopify_variant_id')
      table.dropColumn('image_url')
    })

    this.schema.alterTable('products', (table) => {
      table.dropUnique(['shopify_product_id'])
      table.dropColumn('shopify_product_id')
      table.dropColumn('image_url')
    })
  }
}
