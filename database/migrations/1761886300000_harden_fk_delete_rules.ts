import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Three FKs were configured in a way that risked silent data loss:
 *
 * 1. `variants.product_id` ON DELETE CASCADE — hard-deleting a product
 *    would attempt to delete all its variants (and their stocks via
 *    another cascade below). We always soft-delete products, but the
 *    constraint should enforce that contract.
 * 2. `stocks.variant_id` ON DELETE CASCADE — even if cascade #1 was
 *    blocked (movements RESTRICT it), an explicit variant delete would
 *    still wipe stock rows. Stock is the source of truth for on-hand
 *    quantity; we keep it.
 * 3. `stock_movements.user_id` ON DELETE RESTRICT — blocks deleting a
 *    user who ever touched stock. Audit history should outlive the
 *    user record, so the FK becomes ON DELETE SET NULL and the column
 *    becomes nullable.
 *
 * Movements still RESTRICT against variants and locations: losing the
 * referenced row would leave history with dangling identifiers.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('variants', (table) => {
      table.dropForeign(['product_id'])
      table
        .foreign('product_id')
        .references('id')
        .inTable('products')
        .onDelete('RESTRICT')
    })

    this.schema.alterTable('stocks', (table) => {
      table.dropForeign(['variant_id'])
      table
        .foreign('variant_id')
        .references('id')
        .inTable('variants')
        .onDelete('RESTRICT')
    })

    this.schema.alterTable('stock_movements', (table) => {
      table.dropForeign(['user_id'])
      table.integer('user_id').unsigned().nullable().alter()
      table
        .foreign('user_id')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable('stock_movements', (table) => {
      table.dropForeign(['user_id'])
      table.integer('user_id').unsigned().notNullable().alter()
      table
        .foreign('user_id')
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
    })

    this.schema.alterTable('stocks', (table) => {
      table.dropForeign(['variant_id'])
      table
        .foreign('variant_id')
        .references('id')
        .inTable('variants')
        .onDelete('CASCADE')
    })

    this.schema.alterTable('variants', (table) => {
      table.dropForeign(['product_id'])
      table
        .foreign('product_id')
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
    })
  }
}
