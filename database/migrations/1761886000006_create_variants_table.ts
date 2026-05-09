import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'variants'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      table
        .integer('color_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('colors')
        .onDelete('RESTRICT')
      table
        .integer('print_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('prints')
        .onDelete('RESTRICT')
      table
        .integer('size_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('sizes')
        .onDelete('RESTRICT')

      table.string('sku_code', 120).notNullable().unique()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['product_id'])
      // Unique on the attribute combination. MySQL treats NULLs as distinct
      // here, so the StockService is responsible for dedup at write time.
      table.unique(['product_id', 'color_id', 'print_id', 'size_id'], {
        indexName: 'variants_combo_unique',
      })
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
