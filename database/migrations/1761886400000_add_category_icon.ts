import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'categories'

  async up() {
    /**
     * `icon` stores a short visual marker for the category (an emoji works
     * out-of-the-box, but any 1–8 char string is accepted). Nullable for
     * legacy rows; the seeder backfills sensible defaults.
     */
    this.schema.alterTable(this.tableName, (table) => {
      table.string('icon', 8).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('icon')
    })
  }
}
