import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Adds the "wildcard" concept to the product catalog.
 *
 * A wildcard product is a printless base (e.g. "Fold Hoodie Blank") whose
 * stock acts as a shared pool for one or more printed products derived from
 * it ("Fold Hoodie Plain", "Fold Hoodie Puff", …). Locally the wildcard is
 * a distinct Product with its own variants and stock; on Shopify it isn't
 * pushed independently — instead, when we push a printed product's quantity
 * to Shopify, we add in any wildcard variant of matching color/size.
 *
 *   is_wildcard  — true on the blank itself. Cannot also have wildcard_id.
 *   wildcard_id  — on a printed product, points at its blank source. Same
 *                  category enforced at the validator layer (a cross-table
 *                  CHECK isn't worth the schema noise). RESTRICT matches
 *                  the rest of the inventory chain: archiving the printed
 *                  product is the right escape hatch, never silent cascade.
 *
 * A DB CHECK enforces the mutual-exclusion invariant so it can never be
 * violated even if a future writer skips the validator.
 */
export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_wildcard').notNullable().defaultTo(false)
      table
        .integer('wildcard_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('products')
        .onDelete('RESTRICT')
      table.index(['is_wildcard'])
      table.index(['wildcard_id'])
    })

    // MySQL 8 enforces CHECK constraints. Wildcards can't themselves derive
    // from another wildcard — the relation is strictly one level deep.
    this.schema.raw(
      `ALTER TABLE \`products\` ADD CONSTRAINT \`products_wildcard_xor_source\` ` +
        `CHECK (NOT (is_wildcard = 1 AND wildcard_id IS NOT NULL))`
    )
  }

  async down() {
    this.schema.raw(`ALTER TABLE \`products\` DROP CONSTRAINT \`products_wildcard_xor_source\``)

    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['wildcard_id'])
      table.dropIndex(['wildcard_id'])
      table.dropIndex(['is_wildcard'])
      table.dropColumn('wildcard_id')
      table.dropColumn('is_wildcard')
    })
  }
}
