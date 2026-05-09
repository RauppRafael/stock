import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stocks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('variant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('variants')
        .onDelete('CASCADE')
      table
        .integer('location_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('locations')
        .onDelete('RESTRICT')
      table.integer('quantity').notNullable().defaultTo(0)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['variant_id', 'location_id'])
      table.index(['location_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
