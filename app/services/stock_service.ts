import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Stock from '#models/stock'
import StockMovement from '#models/stock_movement'

/**
 * Tag for the system that originated a movement. Stays a TS union (not an
 * enum) so callers fail at the type-check site rather than at runtime when
 * a typo creeps in. Mirrors the values written to `stock_movements.source`.
 */
export type MovementSource = 'manual' | 'shopify_pull' | 'shopify_push'

export type StockAdjustment = {
  variantId: number
  locationId: number
  newQuantity: number
  userId: number | null
  reason?: string | null
  source?: MovementSource
  /**
   * Optional outer transaction. When provided, the adjust runs inside the
   * caller's transaction so additional writes (e.g. a Shopify-sync baseline
   * update) can be committed atomically with the stock change. When omitted,
   * the service opens and commits its own transaction as before.
   */
  trx?: TransactionClientContract
}

export type BulkStockAdjustment = {
  adjustments: Array<{ variantId: number; locationId: number; newQuantity: number }>
  userId: number | null
  reason?: string | null
  source?: MovementSource
  trx?: TransactionClientContract
}

export class StockServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StockServiceError'
  }
}

export default class StockService {
  /**
   * Set the on-hand quantity for a (variant, location) and append an audit
   * row. Wrapped in a single transaction with a row lock so concurrent
   * adjusters cannot race.
   *
   * Implementation note: `forUpdate()` only locks rows that exist. To avoid
   * two concurrent first-time adjustments both inserting and one losing on
   * the unique index, we ensure the row exists *before* taking the lock —
   * `firstOrCreate` is safe under concurrency thanks to the
   * (variant_id, location_id) unique index.
   *
   * Accepts an optional `input.trx` so callers (e.g. SyncService.applyPull)
   * can fold the adjust into a larger transaction that also writes their own
   * side state — making the whole sequence atomic.
   */
  async adjust(input: StockAdjustment): Promise<StockMovement> {
    if (!Number.isInteger(input.newQuantity) || input.newQuantity < 0) {
      throw new StockServiceError('newQuantity must be a non-negative integer')
    }
    return input.trx
      ? this.adjustWithTrx(input, input.trx)
      : db.transaction((trx) => this.adjustWithTrx(input, trx))
  }

  private async adjustWithTrx(
    input: StockAdjustment,
    trx: TransactionClientContract
  ): Promise<StockMovement> {
    await Stock.firstOrCreate(
      { variantId: input.variantId, locationId: input.locationId },
      { variantId: input.variantId, locationId: input.locationId, quantity: 0 },
      { client: trx }
    )

    const stock = await Stock.query({ client: trx })
      .where('variant_id', input.variantId)
      .andWhere('location_id', input.locationId)
      .forUpdate()
      .firstOrFail()

    const previousQuantity = stock.quantity
    stock.quantity = input.newQuantity
    await stock.save()

    return StockMovement.create(
      {
        variantId: input.variantId,
        locationId: input.locationId,
        previousQuantity,
        newQuantity: input.newQuantity,
        delta: input.newQuantity - previousQuantity,
        reason: input.reason ?? null,
        userId: input.userId,
        source: input.source ?? 'manual',
      },
      { client: trx }
    )
  }

  /**
   * Apply many (variant, location) -> newQuantity updates atomically. Rows
   * whose quantity already matches `newQuantity` are skipped so we don't
   * litter the audit history with no-op movements. The whole batch runs in
   * one transaction with `forUpdate()` per row, so a failure anywhere rolls
   * everything back. Accepts an optional outer trx like `adjust`.
   */
  async bulkAdjust(input: BulkStockAdjustment): Promise<StockMovement[]> {
    for (const a of input.adjustments) {
      if (!Number.isInteger(a.newQuantity) || a.newQuantity < 0) {
        throw new StockServiceError('newQuantity must be a non-negative integer')
      }
    }
    return input.trx
      ? this.bulkAdjustWithTrx(input, input.trx)
      : db.transaction((trx) => this.bulkAdjustWithTrx(input, trx))
  }

  private async bulkAdjustWithTrx(
    input: BulkStockAdjustment,
    trx: TransactionClientContract
  ): Promise<StockMovement[]> {
    const movements: StockMovement[] = []
    for (const a of input.adjustments) {
      await Stock.firstOrCreate(
        { variantId: a.variantId, locationId: a.locationId },
        { variantId: a.variantId, locationId: a.locationId, quantity: 0 },
        { client: trx }
      )

      const stock = await Stock.query({ client: trx })
        .where('variant_id', a.variantId)
        .andWhere('location_id', a.locationId)
        .forUpdate()
        .firstOrFail()

      const previousQuantity = stock.quantity
      if (previousQuantity === a.newQuantity) continue

      stock.quantity = a.newQuantity
      await stock.save()

      const movement = await StockMovement.create(
        {
          variantId: a.variantId,
          locationId: a.locationId,
          previousQuantity,
          newQuantity: a.newQuantity,
          delta: a.newQuantity - previousQuantity,
          reason: input.reason ?? null,
          userId: input.userId,
          source: input.source ?? 'manual',
        },
        { client: trx }
      )
      movements.push(movement)
    }
    return movements
  }
}
