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
}
