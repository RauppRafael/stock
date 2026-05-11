import { BaseSchema } from '@adonisjs/lucid/schema'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'

export default class extends BaseSchema {
  /**
   * Step 1: add a short `code` column to every entity that contributes to the
   * SKU, then backfill it from the existing names. We add the column nullable
   * first so we can populate it before the second migration tightens it to
   * NOT NULL + UNIQUE.
   */
  async up() {
    this.schema.alterTable('products', (table) => {
      table.string('code', 16).nullable()
    })
    this.schema.alterTable('colors', (table) => {
      table.string('code', 8).nullable()
    })
    this.schema.alterTable('sizes', (table) => {
      table.string('code', 8).nullable()
    })

    this.defer(async (db) => {
      await this.backfill(db, 'products', 6)
      await this.backfill(db, 'colors', 5)
      await this.backfill(db, 'sizes', 4)
    })
  }

  async down() {
    this.schema.alterTable('products', (table) => {
      table.dropColumn('code')
    })
    this.schema.alterTable('colors', (table) => {
      table.dropColumn('code')
    })
    this.schema.alterTable('sizes', (table) => {
      table.dropColumn('code')
    })
  }

  private async backfill(db: QueryClientContract, table: string, length: number) {
    const rows = await db.from(table).select('id', 'name')
    const used = new Set<string>()
    for (const row of rows) {
      const base = abbreviate(row.name, length)
      let code = base
      let suffix = 2
      while (used.has(code)) {
        const tail = String(suffix++)
        code = `${base.slice(0, Math.max(1, length - tail.length))}${tail}`
      }
      used.add(code)
      await db.from(table).where('id', row.id).update({ code })
    }
  }
}

function abbreviate(value: string, length: number): string {
  const stripped = value
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
  return (stripped || 'X').slice(0, length)
}
