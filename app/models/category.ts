import { compose } from '@adonisjs/core/helpers'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { CategorySchema } from '#database/schema'
import { withSoftDelete } from '#models/mixins/soft_delete'
import Product from '#models/product'

export default class Category extends compose(CategorySchema, withSoftDelete) {
  @hasMany(() => Product)
  declare products: HasMany<typeof Product>
}
