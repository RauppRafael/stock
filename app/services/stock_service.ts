import db from '@adonisjs/lucid/services/db'
import Stock from '#models/stock'
import StockMovement from '#models/stock_movement'

export type StockAdjustment = {
  variantId: number
  locationId: number
  newQuantity: number
  userId: number
  reason?: string | null
}

export type BulkStockAdjustment = {
  adjustments: Array<{ variantId: number; locationId: number; newQuantity: number }>
  userId: number
  reason?: string | null
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
   */
  async adjust(input: StockAdjustment): Promise<StockMovement> {
    if (!Number.isInteger(input.newQuantity) || input.newQuantity < 0) {
      throw new StockServiceError('newQuantity must be a non-negative integer')
    }

    return db.transaction(async (trx) => {
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

      const movement = await StockMovement.create(
        {
          variantId: input.variantId,
          locationId: input.locationId,
          previousQuantity,
          newQuantity: input.newQuantity,
          delta: input.newQuantity - previousQuantity,
          reason: input.reason ?? null,
          userId: input.userId,
        },
        { client: trx }
      )

      return movement
    })
  }

  /**
   * Apply many (variant, location) -> newQuantity updates atomically. Rows
   * whose quantity already matches `newQuantity` are skipped so we don't
   * litter the audit history with no-op movements. The whole batch runs in
   * one transaction with `forUpdate()` per row, so a failure anywhere rolls
   * everything back.
   */
  async bulkAdjust(input: BulkStockAdjustment): Promise<StockMovement[]> {
    for (const a of input.adjustments) {
      if (!Number.isInteger(a.newQuantity) || a.newQuantity < 0) {
        throw new StockServiceError('newQuantity must be a non-negative integer')
      }
    }

    return db.transaction(async (trx) => {
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
          },
          { client: trx }
        )
        movements.push(movement)
      }
      return movements
    })
  }
}
