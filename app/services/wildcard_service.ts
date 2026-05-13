import db from '@adonisjs/lucid/services/db'
import Product from '#models/product'
import Stock from '#models/stock'
import Variant from '#models/variant'
import StockService from '#services/stock_service'
import type StockMovement from '#models/stock_movement'

export class WildcardServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WildcardServiceError'
  }
}

export type ConversionInput = {
  /** Variant of an `is_wildcard` product — the source pool. */
  wildcardVariantId: number
  /**
   * Variant of a printed product whose `wildcardId` points at the source's
   * product. Must share color + size with the source variant; otherwise the
   * Shopify-side math (which pools wildcards into matching printed variants)
   * would mis-attribute the conversion.
   */
  targetVariantId: number
  /**
   * Same location for both legs of the swap. Physically the operator picks
   * one blank off the shelf and the printed garment goes back onto the same
   * shelf; modelling it as one location keeps the audit story clean.
   */
  locationId: number
  /** Strictly positive — converting zero is a no-op and trips the guard. */
  quantity: number
  userId: number | null
}

export type ConversionResult = {
  wildcardMovement: StockMovement
  targetMovement: StockMovement
}

/**
 * Service for the wildcard → printed conversion flow.
 *
 * A conversion writes two `StockMovement` rows inside a single transaction:
 * −N on the wildcard variant, +N on the chosen printed variant. The trx is
 * shared with `StockService.adjust` (via its `trx` option) so either both
 * legs land or neither does. We don't add a `linked_movement_id` column for
 * v1 — the two movements cross-reference through their `reason` text, which
 * is enough to read the audit log and tell what happened.
 *
 * Invariants enforced here (the controller's validator only guarantees
 * positive ints + existence):
 *
 *   - source product is `is_wildcard`
 *   - target product has `wildcard_id === source.product.id`
 *   - source and target share (colorId, sizeId)
 *   - source has at least `quantity` on hand at the location
 */
export default class WildcardService {
  async convert(input: ConversionInput): Promise<ConversionResult> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new WildcardServiceError('quantity must be a positive integer')
    }

    return db.transaction(async (trx) => {
      const wildcardVariant = await Variant.query({ client: trx })
        .where('id', input.wildcardVariantId)
        .preload('product')
        .first()
      if (!wildcardVariant) {
        throw new WildcardServiceError('Wildcard variant not found.')
      }
      if (!wildcardVariant.product?.isWildcard) {
        throw new WildcardServiceError('Source variant is not part of a wildcard product.')
      }

      const targetVariant = await Variant.query({ client: trx })
        .where('id', input.targetVariantId)
        .preload('product')
        .first()
      if (!targetVariant) {
        throw new WildcardServiceError('Target variant not found.')
      }
      if (!targetVariant.product) {
        throw new WildcardServiceError('Target variant has no parent product.')
      }
      if (targetVariant.product.isWildcard) {
        throw new WildcardServiceError('Target must be a printed product, not another wildcard.')
      }
      if (targetVariant.product.wildcardId !== wildcardVariant.product.id) {
        throw new WildcardServiceError('Target product is not derived from the chosen wildcard.')
      }
      if (
        (wildcardVariant.colorId ?? null) !== (targetVariant.colorId ?? null) ||
        (wildcardVariant.sizeId ?? null) !== (targetVariant.sizeId ?? null)
      ) {
        throw new WildcardServiceError(
          'Wildcard and target variants must share the same color and size.'
        )
      }

      // Both stock rows must be locked before we read their on-hand, or a
      // concurrent adjuster on the *target* could slip between our read and
      // StockService.adjust's own forUpdate — we'd then pass an absolute
      // `newQuantity` computed from the stale snapshot, overwriting the
      // adjuster's commit. `forUpdate()` only locks rows that exist, so
      // firstOrCreate primes both rows first. The (variant_id, location_id)
      // unique index makes the firstOrCreate concurrency-safe.
      await Stock.firstOrCreate(
        { variantId: wildcardVariant.id, locationId: input.locationId },
        { variantId: wildcardVariant.id, locationId: input.locationId, quantity: 0 },
        { client: trx }
      )
      await Stock.firstOrCreate(
        { variantId: targetVariant.id, locationId: input.locationId },
        { variantId: targetVariant.id, locationId: input.locationId, quantity: 0 },
        { client: trx }
      )

      const wildcardStock = await Stock.query({ client: trx })
        .where('variant_id', wildcardVariant.id)
        .andWhere('location_id', input.locationId)
        .forUpdate()
        .firstOrFail()
      const targetStock = await Stock.query({ client: trx })
        .where('variant_id', targetVariant.id)
        .andWhere('location_id', input.locationId)
        .forUpdate()
        .firstOrFail()

      const wildcardOnHand = wildcardStock.quantity
      const targetOnHand = targetStock.quantity

      if (wildcardOnHand < input.quantity) {
        throw new WildcardServiceError(
          `Not enough wildcard stock at this location — have ${wildcardOnHand}, need ${input.quantity}.`
        )
      }

      const stockService = new StockService()
      const wildcardSku = await this.skuFor(wildcardVariant.id, trx)
      const targetSku = await this.skuFor(targetVariant.id, trx)

      const wildcardMovement = await stockService.adjust({
        variantId: wildcardVariant.id,
        locationId: input.locationId,
        newQuantity: wildcardOnHand - input.quantity,
        userId: input.userId,
        reason: `Wildcard conversion → ${targetSku}`,
        source: 'manual',
        trx,
      })

      const targetMovement = await stockService.adjust({
        variantId: targetVariant.id,
        locationId: input.locationId,
        newQuantity: targetOnHand + input.quantity,
        userId: input.userId,
        reason: `Wildcard conversion ← ${wildcardSku}`,
        source: 'manual',
        trx,
      })

      return { wildcardMovement, targetMovement }
    })
  }

  /**
   * Fetch a friendly SKU-ish label for a variant. Used only in the audit
   * reason text — falls back to `variant#<id>` when one of the parts is
   * missing so a movement row still reads sensibly.
   */
  private async skuFor(
    variantId: number,
    trx: import('@adonisjs/lucid/types/database').TransactionClientContract
  ): Promise<string> {
    const variant = await Variant.query({ client: trx })
      .where('id', variantId)
      .preload('product')
      .preload('color')
      .preload('size')
      .first()
    if (!variant) return `variant#${variantId}`
    return variant.skuCode ?? `variant#${variantId}`
  }

  /**
   * Convenience: list every printed product that derives from a given
   * wildcard and has a variant matching the wildcard variant's (colorId,
   * sizeId). Drives the target picker on the conversion page so the
   * operator only sees products that are *actually convertible right now*
   * — a product missing the right color/size combo is filtered out.
   */
  async targetsForWildcardVariant(
    wildcardVariantId: number
  ): Promise<Array<{ product: Product; targetVariantId: number }>> {
    const wildcardVariant = await Variant.query()
      .where('id', wildcardVariantId)
      .preload('product')
      .first()
    if (!wildcardVariant || !wildcardVariant.product?.isWildcard) return []

    const derivatives = await Product.notTrashed()
      .where('wildcard_id', wildcardVariant.product.id)
      .preload('category')
      .preload('variants', (q) => q.preload('color').preload('size'))
      .orderBy('name', 'asc')

    const matches: Array<{ product: Product; targetVariantId: number }> = []
    for (const product of derivatives) {
      const match = product.variants.find(
        (v) =>
          (v.colorId ?? null) === (wildcardVariant.colorId ?? null) &&
          (v.sizeId ?? null) === (wildcardVariant.sizeId ?? null)
      )
      if (match) matches.push({ product, targetVariantId: match.id })
    }
    return matches
  }

  /**
   * For a set of *printed* variants (i.e. variants whose product has a
   * `wildcardId`), compute the wildcard pool contribution at each location
   * in `locationIds`. Returns a map keyed by `${variantId}:${locationId}`
   * → wildcard-side stock at that location.
   *
   * Pulled out of `StockController#index` so the math is unit-testable: it
   * does its own DB queries (so the controller doesn't have to preload the
   * wildcard universe just to compute pools) and only emits entries with
   * positive pool, keeping the wire payload small.
   *
   * Variants whose product isn't a derivative (no `wildcardId`) or that
   * *are* wildcards are silently skipped — the controller can pass in its
   * raw `variantsInScope` set without pre-filtering.
   */
  async computePoolMap(
    printedVariants: Variant[],
    locationIds: number[]
  ): Promise<Record<string, number>> {
    const pools: Record<string, number> = {}
    if (!locationIds.length) return pools

    const eligible = printedVariants.filter((v) => !v.product?.isWildcard && v.product?.wildcardId)
    if (!eligible.length) return pools

    const wildcardProductIds = Array.from(
      new Set(
        eligible.map((v) => v.product?.wildcardId ?? null).filter((id): id is number => id !== null)
      )
    )

    const wildcardVariants = await Variant.query().whereIn('product_id', wildcardProductIds)
    const wildcardKey = (productId: number, colorId: number | null, sizeId: number | null) =>
      `${productId}|${colorId ?? 'x'}|${sizeId ?? 'x'}`
    const wildcardByKey = new Map<string, number>()
    for (const wv of wildcardVariants) {
      wildcardByKey.set(wildcardKey(wv.productId, wv.colorId, wv.sizeId), wv.id)
    }

    const wildcardStocks = wildcardVariants.length
      ? await Stock.query()
          .whereIn(
            'variant_id',
            wildcardVariants.map((wv) => wv.id)
          )
          .whereIn('location_id', locationIds)
      : []
    const wildcardStockByPair = new Map<string, number>()
    for (const s of wildcardStocks) {
      wildcardStockByPair.set(`${s.variantId}:${s.locationId}`, s.quantity)
    }

    for (const v of eligible) {
      const sourceProductId = v.product!.wildcardId!
      const matchKey = wildcardKey(sourceProductId, v.colorId, v.sizeId)
      const wildcardVariantId = wildcardByKey.get(matchKey)
      if (wildcardVariantId === undefined) continue
      for (const locationId of locationIds) {
        const qty = wildcardStockByPair.get(`${wildcardVariantId}:${locationId}`) ?? 0
        if (qty > 0) pools[`${v.id}:${locationId}`] = qty
      }
    }
    return pools
  }
}
