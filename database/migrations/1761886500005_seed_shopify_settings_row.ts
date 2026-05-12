import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Eliminates the cold-start `firstOrCreate({ id: 1 })` race: three
 * concurrent /sync requests all trying to INSERT id=1 would have one win
 * and two fail with a duplicate-key error. Pre-seeding the row from
 * migration time means `findOrFail(1)` is always safe — no insert path
 * during request handling, no race.
 *
 * `INSERT IGNORE` makes this safe to apply on existing installations where
 * the row may already exist (created by an earlier `firstOrCreate`).
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      const now = new Date()
      await db.rawQuery(
        `INSERT IGNORE INTO shopify_settings (id, created_at, updated_at) VALUES (1, ?, ?)`,
        [now, now]
      )
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.from('shopify_settings').where('id', 1).delete()
    })
  }
}
