import { test } from '@japa/runner'
import WildcardService, { WildcardServiceError } from '#services/wildcard_service'
import Category from '#models/category'
import Color from '#models/color'
import Size from '#models/size'
import Product from '#models/product'
import Variant from '#models/variant'
import Location from '#models/location'
import Stock from '#models/stock'
import StockMovement from '#models/stock_movement'
import ShopifyVariantLink from '#models/shopify_variant_link'
import User from '#models/user'

/**
 * End-to-end fixture for the wildcard conversion flow:
 *
 *   Category "Hoodie" (has color + size)
 *     ├─ Product "Hoodie Blank" (is_wildcard = true)
 *     │   └─ Variant (color=Black, size=M)
 *     ├─ Product "Hoodie Plain" (wildcard_id → Hoodie Blank)
 *     │   └─ Variant (color=Black, size=M)
 *     └─ Product "Hoodie Puff" (wildcard_id → Hoodie Blank)
 *         └─ Variant (color=Black, size=M)
 *
 * Plus a location and a user for the audit row.
 */
type Fixture = {
  user: User
  location: Location
  wildcardVariant: Variant
  plainVariant: Variant
  puffVariant: Variant
  wildcardProduct: Product
}

async function makeFixture(): Promise<Fixture> {
  const category = await Category.create({
    name: 'Hoodie',
    hasColor: false,
    hasSize: false,
  })
  const wildcardProduct = await Product.create({
    name: 'Hoodie Blank',
    code: 'HDBLK',
    categoryId: category.id,
    isWildcard: true,
  })
  const plainProduct = await Product.create({
    name: 'Hoodie Plain',
    code: 'HDPL',
    categoryId: category.id,
    wildcardId: wildcardProduct.id,
  })
  const puffProduct = await Product.create({
    name: 'Hoodie Puff',
    code: 'HDPF',
    categoryId: category.id,
    wildcardId: wildcardProduct.id,
  })
  const wildcardVariant = await Variant.create({ productId: wildcardProduct.id })
  const plainVariant = await Variant.create({ productId: plainProduct.id })
  const puffVariant = await Variant.create({ productId: puffProduct.id })
  const location = await Location.create({ name: 'Test Warehouse' })
  const user = await User.create({
    fullName: 'Tester',
    email: 'wildcard-tester@example.com',
    password: 'secret-password-1',
  })
  return { user, location, wildcardVariant, plainVariant, puffVariant, wildcardProduct }
}

test.group('WildcardService.convert', (group) => {
  group.each.setup(async () => {
    await Promise.all([StockMovement.query().delete(), Stock.query().delete()])
    await ShopifyVariantLink.query().delete()
    await Variant.query().delete()
    // Products must be deleted before categories (FK), but wildcard_id is a
    // self-FK so derivatives must go before their source. The simplest is two
    // passes: first products with a wildcard_id, then the wildcards.
    await Product.query().whereNotNull('wildcard_id').delete()
    await Product.query().delete()
    await Color.query().delete()
    await Size.query().delete()
    await Category.query().delete()
    await Location.query().delete()
    await User.query().delete()
  })

  test('moves stock from wildcard to printed atomically', async ({ assert }) => {
    const { user, location, wildcardVariant, plainVariant } = await makeFixture()
    // Seed the wildcard with 10 on hand at the test location.
    const { default: StockService } = await import('#services/stock_service')
    await new StockService().adjust({
      variantId: wildcardVariant.id,
      locationId: location.id,
      newQuantity: 10,
      userId: user.id,
    })

    const result = await new WildcardService().convert({
      wildcardVariantId: wildcardVariant.id,
      targetVariantId: plainVariant.id,
      locationId: location.id,
      quantity: 3,
      userId: user.id,
    })

    assert.equal(result.wildcardMovement.previousQuantity, 10)
    assert.equal(result.wildcardMovement.newQuantity, 7)
    assert.equal(result.wildcardMovement.delta, -3)
    assert.equal(result.targetMovement.previousQuantity, 0)
    assert.equal(result.targetMovement.newQuantity, 3)
    assert.equal(result.targetMovement.delta, 3)

    const wildcardStock = await Stock.query()
      .where('variant_id', wildcardVariant.id)
      .andWhere('location_id', location.id)
      .firstOrFail()
    const plainStock = await Stock.query()
      .where('variant_id', plainVariant.id)
      .andWhere('location_id', location.id)
      .firstOrFail()
    assert.equal(wildcardStock.quantity, 7)
    assert.equal(plainStock.quantity, 3)

    const movements = await StockMovement.query().orderBy('id')
    assert.lengthOf(movements, 3) // 1 seed + 2 from conversion
  })

  test('adds to existing target stock when target already has on-hand', async ({ assert }) => {
    // This exists as a regression net for the pre-fix bug where the target
    // row was read without `forUpdate`. The pattern under test — read
    // current, compute `current + delta`, write via StockService.adjust —
    // is only correct when the read is taken under the same row lock that
    // StockService re-acquires. The fix prime+forUpdates both rows before
    // computing newQuantity, so this test should keep passing as long as
    // the locking discipline is preserved.
    const { user, location, wildcardVariant, plainVariant } = await makeFixture()
    const { default: StockService } = await import('#services/stock_service')
    await new StockService().adjust({
      variantId: wildcardVariant.id,
      locationId: location.id,
      newQuantity: 10,
      userId: user.id,
    })
    await new StockService().adjust({
      variantId: plainVariant.id,
      locationId: location.id,
      newQuantity: 5,
      userId: user.id,
    })

    const result = await new WildcardService().convert({
      wildcardVariantId: wildcardVariant.id,
      targetVariantId: plainVariant.id,
      locationId: location.id,
      quantity: 3,
      userId: user.id,
    })

    assert.equal(result.wildcardMovement.previousQuantity, 10)
    assert.equal(result.wildcardMovement.newQuantity, 7)
    assert.equal(result.targetMovement.previousQuantity, 5)
    assert.equal(result.targetMovement.newQuantity, 8)
    assert.equal(result.targetMovement.delta, 3)
  })

  test('rejects converting more than is on hand at the location', async ({ assert }) => {
    const { user, location, wildcardVariant, plainVariant } = await makeFixture()
    const { default: StockService } = await import('#services/stock_service')
    await new StockService().adjust({
      variantId: wildcardVariant.id,
      locationId: location.id,
      newQuantity: 2,
      userId: user.id,
    })

    await assert.rejects(
      () =>
        new WildcardService().convert({
          wildcardVariantId: wildcardVariant.id,
          targetVariantId: plainVariant.id,
          locationId: location.id,
          quantity: 5,
          userId: user.id,
        }),
      WildcardServiceError
    )

    // The conversion should leave no movements (the seed adjust still
    // counts, so we expect exactly 1).
    const movements = await StockMovement.query()
    assert.lengthOf(movements, 1)
  })

  test('rejects converting to a target product not derived from the wildcard', async ({
    assert,
  }) => {
    const { user, location, wildcardVariant } = await makeFixture()
    // Different category, no wildcard relationship.
    const otherCategory = await Category.create({
      name: 'Tee',
      hasColor: false,
      hasSize: false,
    })
    const strangerProduct = await Product.create({
      name: 'Random Tee',
      code: 'RNDT',
      categoryId: otherCategory.id,
    })
    const strangerVariant = await Variant.create({ productId: strangerProduct.id })

    const { default: StockService } = await import('#services/stock_service')
    await new StockService().adjust({
      variantId: wildcardVariant.id,
      locationId: location.id,
      newQuantity: 10,
      userId: user.id,
    })

    await assert.rejects(
      () =>
        new WildcardService().convert({
          wildcardVariantId: wildcardVariant.id,
          targetVariantId: strangerVariant.id,
          locationId: location.id,
          quantity: 1,
          userId: user.id,
        }),
      WildcardServiceError
    )
  })

  test('rejects zero or negative quantity', async ({ assert }) => {
    const { user, location, wildcardVariant, plainVariant } = await makeFixture()
    await assert.rejects(
      () =>
        new WildcardService().convert({
          wildcardVariantId: wildcardVariant.id,
          targetVariantId: plainVariant.id,
          locationId: location.id,
          quantity: 0,
          userId: user.id,
        }),
      WildcardServiceError
    )
    await assert.rejects(
      () =>
        new WildcardService().convert({
          wildcardVariantId: wildcardVariant.id,
          targetVariantId: plainVariant.id,
          locationId: location.id,
          quantity: -1,
          userId: user.id,
        }),
      WildcardServiceError
    )
  })

  test('lists eligible targets for a wildcard variant', async ({ assert }) => {
    const { wildcardVariant, plainVariant, puffVariant } = await makeFixture()
    const targets = await new WildcardService().targetsForWildcardVariant(wildcardVariant.id)
    const ids = targets.map((t) => t.targetVariantId).sort((a, b) => a - b)
    assert.deepEqual(
      ids,
      [plainVariant.id, puffVariant.id].sort((a, b) => a - b)
    )
  })
})

test.group('WildcardService.computePoolMap', (group) => {
  group.each.setup(async () => {
    await Promise.all([StockMovement.query().delete(), Stock.query().delete()])
    await ShopifyVariantLink.query().delete()
    await Variant.query().delete()
    await Product.query().whereNotNull('wildcard_id').delete()
    await Product.query().delete()
    await Color.query().delete()
    await Size.query().delete()
    await Category.query().delete()
    await Location.query().delete()
    await User.query().delete()
  })

  /**
   * `computePoolMap` is the data source for the per-row "🃏 +N" chips on
   * the stock index page. It must:
   *  - emit one entry per (printed variant, location) where the wildcard
   *    holds matching-color/size stock,
   *  - skip pairs whose quantity is 0 (the front-end shouldn't render
   *    chips for "no pool"),
   *  - handle missing matches without leaking pool from a different
   *    color/size, and
   *  - never include wildcard variants themselves.
   *
   * The fixture from the convert tests already wires three products in
   * the same category — we just need to bring matching-axis variants and
   * stocks into play. Inline setup keeps each test's intent obvious.
   */
  test('emits pool entries per (printed variant, location) with matching wildcard stock', async ({
    assert,
  }) => {
    const { user, location, wildcardVariant, plainVariant, puffVariant } = await makeFixture()
    const { default: StockService } = await import('#services/stock_service')

    // 6 blanks at location → both printed derivatives should see +6.
    await new StockService().adjust({
      variantId: wildcardVariant.id,
      locationId: location.id,
      newQuantity: 6,
      userId: user.id,
    })

    // Load the printed variants the way the controller does (`product`
    // preloaded with `category`) so `computePoolMap` finds `isWildcard`
    // and `wildcardId` on `v.product`.
    const printedVariants = await Variant.query()
      .whereIn('id', [plainVariant.id, puffVariant.id])
      .preload('product')

    const pools = await new WildcardService().computePoolMap(printedVariants, [location.id])

    assert.deepEqual(pools, {
      [`${plainVariant.id}:${location.id}`]: 6,
      [`${puffVariant.id}:${location.id}`]: 6,
    })
  })

  test('omits entries with zero pool so the front-end never renders empty chips', async ({
    assert,
  }) => {
    const { plainVariant } = await makeFixture()
    // Wildcard has no stock anywhere — nothing to fold in.
    const printedVariants = await Variant.query().where('id', plainVariant.id).preload('product')

    const pools = await new WildcardService().computePoolMap(printedVariants, [1])

    assert.deepEqual(pools, {})
  })

  test('does not leak pool when no wildcard variant matches the printed (color, size)', async ({
    assert,
  }) => {
    const { user, location } = await makeFixture()
    // Build a separate setup where the printed variant's (color, size)
    // intentionally doesn't exist on the wildcard. The printed row should
    // get no pool, NOT inherit a different axis combination.
    const category = await Category.create({
      name: 'Tee',
      hasColor: true,
      hasSize: true,
    })
    const black = await Color.create({ name: 'Tee Black', code: 'TBL' })
    const red = await Color.create({ name: 'Tee Red', code: 'TRD' })
    const sizeM = await Size.create({ name: 'M', code: 'M', sortOrder: 1 })
    const wildcardProduct = await Product.create({
      name: 'Tee Blank',
      code: 'TEEBL',
      categoryId: category.id,
      isWildcard: true,
    })
    const printedProduct = await Product.create({
      name: 'Tee Plain',
      code: 'TEEPL',
      categoryId: category.id,
      wildcardId: wildcardProduct.id,
    })
    const wildcardVariant = await Variant.create({
      productId: wildcardProduct.id,
      colorId: black.id,
      sizeId: sizeM.id,
    })
    const printedVariant = await Variant.create({
      productId: printedProduct.id,
      colorId: red.id, // ← different colour, no match
      sizeId: sizeM.id,
    })
    const { default: StockService } = await import('#services/stock_service')
    await new StockService().adjust({
      variantId: wildcardVariant.id,
      locationId: location.id,
      newQuantity: 7,
      userId: user.id,
    })

    const printedVariants = await Variant.query().where('id', printedVariant.id).preload('product')

    const pools = await new WildcardService().computePoolMap(printedVariants, [location.id])

    assert.deepEqual(pools, {})
  })

  test('keys pool entries per location so multi-location stock is reflected separately', async ({
    assert,
  }) => {
    const { user, location, wildcardVariant, plainVariant } = await makeFixture()
    const otherLocation = await Location.create({ name: 'Other Warehouse' })
    const { default: StockService } = await import('#services/stock_service')
    // 3 blanks at the fixture's location, 5 at a second — chips per row
    // must be addressable per location, not collapsed.
    await new StockService().adjust({
      variantId: wildcardVariant.id,
      locationId: location.id,
      newQuantity: 3,
      userId: user.id,
    })
    await new StockService().adjust({
      variantId: wildcardVariant.id,
      locationId: otherLocation.id,
      newQuantity: 5,
      userId: user.id,
    })

    const printedVariants = await Variant.query().where('id', plainVariant.id).preload('product')

    const pools = await new WildcardService().computePoolMap(printedVariants, [
      location.id,
      otherLocation.id,
    ])

    assert.deepEqual(pools, {
      [`${plainVariant.id}:${location.id}`]: 3,
      [`${plainVariant.id}:${otherLocation.id}`]: 5,
    })
  })

  test('ignores wildcard variants passed in alongside printed ones', async ({ assert }) => {
    // Defensive: the controller filters `variantsInScope` directly to
    // wildcards in some cases (when the operator filters by a wildcard
    // product). Passing wildcard variants in shouldn't generate self-pool
    // entries — `computePoolMap` should silently skip them.
    const { user, location, wildcardVariant, plainVariant } = await makeFixture()
    const { default: StockService } = await import('#services/stock_service')
    await new StockService().adjust({
      variantId: wildcardVariant.id,
      locationId: location.id,
      newQuantity: 4,
      userId: user.id,
    })

    const variants = await Variant.query()
      .whereIn('id', [wildcardVariant.id, plainVariant.id])
      .preload('product')

    const pools = await new WildcardService().computePoolMap(variants, [location.id])

    // Only the printed variant should appear in the map. The wildcard's
    // own row gets no chip.
    assert.deepEqual(pools, {
      [`${plainVariant.id}:${location.id}`]: 4,
    })
  })
})
