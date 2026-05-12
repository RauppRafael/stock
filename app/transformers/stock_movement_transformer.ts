import { BaseTransformer } from '@adonisjs/core/transformers'
import type StockMovement from '#models/stock_movement'
import VariantTransformer from '#transformers/variant_transformer'
import LocationTransformer from '#transformers/location_transformer'
import UserTransformer from '#transformers/user_transformer'

export default class StockMovementTransformer extends BaseTransformer<StockMovement> {
  toObject() {
    const m = this.resource
    return {
      ...this.pick(m, [
        'id',
        'variantId',
        'locationId',
        'previousQuantity',
        'newQuantity',
        'delta',
        'reason',
        'userId',
        'source',
      ]),
      createdAt: m.createdAt?.toISO() ?? null,
      variant: m.variant ? VariantTransformer.transform(m.variant).depth(6) : null,
      location: m.location ? LocationTransformer.transform(m.location).depth(6) : null,
      user: m.user ? UserTransformer.transform(m.user).depth(6) : null,
    }
  }
}
