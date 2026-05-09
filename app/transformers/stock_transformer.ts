import { BaseTransformer } from '@adonisjs/core/transformers'
import type Stock from '#models/stock'
import VariantTransformer from '#transformers/variant_transformer'
import LocationTransformer from '#transformers/location_transformer'

export default class StockTransformer extends BaseTransformer<Stock> {
  toObject() {
    const s = this.resource
    return {
      ...this.pick(s, ['id', 'variantId', 'locationId', 'quantity']),
      variant: s.variant ? VariantTransformer.transform(s.variant).depth(6) : null,
      location: s.location ? LocationTransformer.transform(s.location).depth(6) : null,
    }
  }
}
