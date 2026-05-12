import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Single-row settings table for Shopify-specific state that needs to survive
 * restarts: which Shopify location we write inventory levels to, and the last
 * pull cursor so we can fetch only what changed.
 *
 * Single-row is enforced by `id INT PRIMARY KEY DEFAULT 1`, plus app-level
 * `firstOrCreate({ id: 1 }, …)` — the model never inserts a second row.
 *
 * `shopify_location_id` is set automatically on first sync (we pick the shop's
 * primary location); the user can override later if they want inventory
 * written to a different Shopify location.
 *
 * `last_pull_cursor` is the GraphQL `endCursor` from the previous successful
 * pull; storing it lets the next pull skip ahead instead of re-walking the
 * entire catalog.
 */
export default class extends BaseSchema {
  protected tableName = 'shopify_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.integer('id').unsigned().primary().defaultTo(1)
      table.string('shopify_location_id', 64).nullable()
      table.string('last_pull_cursor', 512).nullable()
      table.timestamp('last_pull_at').nullable()
      table.timestamp('last_push_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
