import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { StockMovementSchema } from '#database/schema'
import Variant from '#models/variant'
import Location from '#models/location'
import User from '#models/user'

export default class StockMovement extends StockMovementSchema {
  @belongsTo(() => Variant)
  declare variant: BelongsTo<typeof Variant>

  @belongsTo(() => Location)
  declare location: BelongsTo<typeof Location>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
