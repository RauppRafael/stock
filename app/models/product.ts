import { compose } from '@adonisjs/core/helpers'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { ProductSchema } from '#database/schema'
import { withSoftDelete } from '#models/mixins/soft_delete'
import Category from '#models/category'
import Variant from '#models/variant'

export default class Product extends compose(ProductSchema, withSoftDelete) {
  @belongsTo(() => Category)
  declare category: BelongsTo<typeof Category>

  @hasMany(() => Variant)
  declare variants: HasMany<typeof Variant>

  /**
   * When this product is printed-from-a-wildcard, `wildcardSource` is the
   * blank it derives from. Mirror relation on the blank side is
   * `derivatives` — every printed product pointing at this wildcard.
   */
  @belongsTo(() => Product, { foreignKey: 'wildcardId' })
  declare wildcardSource: BelongsTo<typeof Product>

  @hasMany(() => Product, { foreignKey: 'wildcardId' })
  declare derivatives: HasMany<typeof Product>
}
