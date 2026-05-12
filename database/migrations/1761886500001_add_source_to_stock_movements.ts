import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Tag each movement with the system that originated it so the audit history
 * can distinguish "operator typed it in" from "Shopify pull deducted it" from
 * "we pushed our truth to Shopify".
 *
 * Stored as a short string rather than a MySQL ENUM — ENUMs require a
 * migration to add values, and this set is likely to grow (webhooks, CSV
 * imports, returns, etc.). The model exposes the canonical values as a TS
 * union.
 *
 * Default 'manual' covers all existing rows and every future row written by
 * the regular adjust flow that doesn't pass a source explicitly.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('stock_movements', (table) => {
      table.string('source', 32).notNullable().defaultTo('manual')
      table.index(['source'])
    })
  }

  async down() {
    this.schema.alterTable('stock_movements', (table) => {
      table.dropIndex(['source'])
      table.dropColumn('source')
    })
  }
}
