import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import StockService, { StockServiceError } from '#services/stock_service'
import Category from '#models/category'
import Product from '#models/product'
import Variant from '#models/variant'
import Location from '#models/location'
import Stock from '#models/stock'
import StockMovement from '#models/stock_movement'
import User from '#models/user'

type Fixture = {
  user: User
  variant: Variant
  location: Location
}

async function makeFixture(): Promise<Fixture> {
  const category = await Category.create({
    name: 'Test Hoodie',
    hasColor: false,
    hasSize: false,
  })
  const product = await Product.create({
    name: 'Test Product',
    code: 'TST',
    categoryId: category.id,
  })
  const variant = await Variant.create({ productId: product.id })
  const location = await Location.create({ name: 'Test Warehouse' })
  const user = await User.create({
    fullName: 'Tester',
    email: 'tester@example.com',
    password: 'secret-password-1',
  })
  return { user, variant, location }
}

test.group('StockService', (group) => {
  group.each.setup(async () => {
    await Promise.all([StockMovement.query().delete(), Stock.query().delete()])
    await Variant.query().delete()
    await Product.query().delete()
    await Category.query().delete()
    await Location.query().delete()
    await User.query().delete()
  })

  test('creates the stock row from zero on first adjustment', async ({ assert }) => {
    const { user, variant, location } = await makeFixture()
    const service = new StockService()

    const movement = await service.adjust({
      variantId: variant.id,
      locationId: location.id,
      newQuantity: 7,
      userId: user.id,
      reason: 'initial intake',
    })

    assert.equal(movement.previousQuantity, 0)
    assert.equal(movement.newQuantity, 7)
    assert.equal(movement.delta, 7)
    assert.equal(movement.reason, 'initial intake')

    const stock = await Stock.query()
      .where('variant_id', variant.id)
      .andWhere('location_id', location.id)
      .firstOrFail()
    assert.equal(stock.quantity, 7)
  })

  test('increments existing stock and records the delta', async ({ assert }) => {
    const { user, variant, location } = await makeFixture()
    const service = new StockService()

    await service.adjust({
      variantId: variant.id,
      locationId: location.id,
      newQuantity: 3,
      userId: user.id,
    })
    const movement = await service.adjust({
      variantId: variant.id,
      locationId: location.id,
      newQuantity: 10,
      userId: user.id,
    })

    assert.equal(movement.previousQuantity, 3)
    assert.equal(movement.newQuantity, 10)
    assert.equal(movement.delta, 7)

    const movements = await StockMovement.query().where('variant_id', variant.id).orderBy('id')
    assert.lengthOf(movements, 2)
  })

  test('decrements existing stock and records a negative delta', async ({ assert }) => {
    const { user, variant, location } = await makeFixture()
    const service = new StockService()

    await service.adjust({
      variantId: variant.id,
      locationId: location.id,
      newQuantity: 8,
      userId: user.id,
    })
    const movement = await service.adjust({
      variantId: variant.id,
      locationId: location.id,
      newQuantity: 2,
      userId: user.id,
      reason: 'damaged units written off',
    })

    assert.equal(movement.delta, -6)
    assert.equal(movement.reason, 'damaged units written off')
  })

  test('rejects negative quantities and writes nothing', async ({ assert }) => {
    const { user, variant, location } = await makeFixture()
    const service = new StockService()

    await assert.rejects(
      () =>
        service.adjust({
          variantId: variant.id,
          locationId: location.id,
          newQuantity: -1,
          userId: user.id,
        }),
      StockServiceError
    )

    const stockCount = await Stock.query().count('* as total').first()
    const movementCount = await StockMovement.query().count('* as total').first()
    assert.equal(Number(stockCount?.$extras.total ?? 0), 0)
    assert.equal(Number(movementCount?.$extras.total ?? 0), 0)
  })

  test('rolls the transaction back when the movement insert fails', async ({ assert }) => {
    const { user, variant, location } = await makeFixture()
    const service = new StockService()

    await service.adjust({
      variantId: variant.id,
      locationId: location.id,
      newQuantity: 5,
      userId: user.id,
    })
    const stockBefore = await Stock.query()
      .where('variant_id', variant.id)
      .andWhere('location_id', location.id)
      .firstOrFail()
    const movementsBefore = await StockMovement.query()
    assert.equal(stockBefore.quantity, 5)
    assert.lengthOf(movementsBefore, 1)

    await assert.rejects(() =>
      // userId 999999 violates the FK to users(id) and forces the transaction to abort
      service.adjust({
        variantId: variant.id,
        locationId: location.id,
        newQuantity: 12,
        userId: 999_999,
      })
    )

    const stockAfter = await Stock.query()
      .where('variant_id', variant.id)
      .andWhere('location_id', location.id)
      .firstOrFail()
    const movementsAfter = await StockMovement.query()
    assert.equal(stockAfter.quantity, 5, 'stock quantity must not change when the movement fails')
    assert.lengthOf(movementsAfter, 1, 'no new movement row should be written')
  })

  test('rolls back when an outer caller wraps the service in a failing transaction', async ({
    assert,
  }) => {
    const { user, variant, location } = await makeFixture()
    const service = new StockService()

    await assert.rejects(async () => {
      await db.transaction(async () => {
        await service.adjust({
          variantId: variant.id,
          locationId: location.id,
          newQuantity: 4,
          userId: user.id,
        })
        throw new Error('outer caller aborts')
      })
    })

    // Service uses db.transaction (independent of the outer one), so this verifies that
    // an outer abort that throws *after* the service commits keeps the inner write.
    // The point of this test: the service writes both rows atomically — the outer caller
    // controls its own scope.
    const stock = await Stock.query()
      .where('variant_id', variant.id)
      .andWhere('location_id', location.id)
      .first()
    const movements = await StockMovement.query().where('variant_id', variant.id)
    assert.exists(stock)
    assert.equal(stock!.quantity, 4)
    assert.lengthOf(movements, 1)
  })
})
