import { belongsTo, computed, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { VariantSchema } from '#database/schema'
import Product from '#models/product'
import Color from '#models/color'
import Print from '#models/print'
import Size from '#models/size'
import Stock from '#models/stock'
import StockMovement from '#models/stock_movement'
import { buildSkuCode } from '#services/sku_builder'

export default class Variant extends VariantSchema {
  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>

  @belongsTo(() => Color)
  declare color: BelongsTo<typeof Color>

  @belongsTo(() => Print)
  declare print: BelongsTo<typeof Print>

  @belongsTo(() => Size)
  declare size: BelongsTo<typeof Size>

  @hasMany(() => Stock)
  declare stocks: HasMany<typeof Stock>

  @hasMany(() => StockMovement)
  declare movements: HasMany<typeof StockMovement>

  @computed()
  get skuCode(): string | null {
    if (!this.product) return null
    return buildSkuCode({
      product: this.product,
      color: this.color ?? null,
      print: this.print ?? null,
      size: this.size ?? null,
    })
  }

  @computed()
  get displayName(): string {
    const parts: string[] = []
    if (this.product) parts.push(this.product.name)
    if (this.color) parts.push(this.color.name)
    if (this.print) parts.push(this.print.name)
    if (this.size) parts.push(this.size.name)
    return parts.join(' - ')
  }
}
