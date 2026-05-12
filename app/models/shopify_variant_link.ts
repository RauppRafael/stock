import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ShopifyVariantLinkSchema } from '#database/schema'
import Variant from '#models/variant'

/**
 * Many-to-one binding: one local variant can mirror multiple Shopify
 * variants (typically duplicate products on Shopify, e.g. M/W versions of
 * the same SKU). `last_known_quantity` is what we last pushed to or pulled
 * from this Shopify variant, used to compute per-link deltas correctly when
 * sales hit duplicates independently.
 */
export default class ShopifyVariantLink extends ShopifyVariantLinkSchema {
  @belongsTo(() => Variant)
  declare variant: BelongsTo<typeof Variant>
}
