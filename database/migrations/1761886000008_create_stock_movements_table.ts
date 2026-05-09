import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stock_movements'

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
      table
        .integer('location_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('locations')
        .onDelete('RESTRICT')
      table.integer('previous_quantity').notNullable()
      table.integer('new_quantity').notNullable()
      table.integer('delta').notNullable()
      table.string('reason', 1000).nullable()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')

      table.timestamp('created_at').notNullable()

      table.index(['variant_id'])
      table.index(['location_id'])
      table.index(['user_id'])
      table.index(['created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
