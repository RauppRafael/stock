import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  /**
   * Step 2 of the SKU refactor: now that every row has a `code` value, lock
   * the column down to NOT NULL + UNIQUE and drop the stored sku_code from
   * variants (we compute it on render from the related codes).
   */
  async up() {
    this.schema.alterTable('products', (table) => {
      table.string('code', 16).notNullable().unique().alter()
    })
    this.schema.alterTable('colors', (table) => {
      table.string('code', 8).notNullable().unique().alter()
    })
    this.schema.alterTable('prints', (table) => {
      table.string('code', 8).notNullable().unique().alter()
    })
    this.schema.alterTable('sizes', (table) => {
      table.string('code', 8).notNullable().unique().alter()
    })

    this.schema.alterTable('variants', (table) => {
      table.dropUnique(['sku_code'])
      table.dropColumn('sku_code')
    })
  }

  async down() {
    this.schema.alterTable('variants', (table) => {
      table.string('sku_code', 120).nullable()
    })
    this.schema.alterTable('products', (table) => {
      table.string('code', 16).nullable().alter()
    })
    this.schema.alterTable('colors', (table) => {
      table.string('code', 8).nullable().alter()
    })
    this.schema.alterTable('prints', (table) => {
      table.string('code', 8).nullable().alter()
    })
    this.schema.alterTable('sizes', (table) => {
      table.string('code', 8).nullable().alter()
    })
  }
}
