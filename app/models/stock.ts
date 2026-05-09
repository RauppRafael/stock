import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { StockSchema } from '#database/schema'
import Variant from '#models/variant'
import Location from '#models/location'

export default class Stock extends StockSchema {
  @belongsTo(() => Variant)
  declare variant: BelongsTo<typeof Variant>

  @belongsTo(() => Location)
  declare location: BelongsTo<typeof Location>
}
