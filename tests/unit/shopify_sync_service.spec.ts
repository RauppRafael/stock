import { test } from '@japa/runner'
import ShopifySyncService, {
  type LocalSnapshot,
  ShopifySyncError,
} from '#services/shopify_sync_service'
import ShopifyClient, { type ShopifyLocation, type ShopifyProduct } from '#services/shopify_client'
import Category from '#models/category'
import Color from '#models/color'
import Size from '#models/size'
import Product from '#models/product'
import Variant from '#models/variant'
import Location from '#models/location'
import Stock from '#models/stock'
import StockMovement from '#models/stock_movement'
import ShopifySetting from '#models/shopify_setting'
import ShopifyVariantLink from '#models/shopify_variant_link'
import User from '#models/user'
import StockService from '#services/stock_service'

/**
 * Stand-in for the real ShopifyClient. Yields a configured list of products
 * from `iterateProducts` and records every `setOnHandQuantities` call so
 * tests can assert on the wire-level call shape. Throwing variants let us
 * simulate Shopify-side failures without going near the network.
 */
class FakeShopifyClient extends ShopifyClient {
  pushCalls: Array<{
    locationId: string
    items: Array<{ inventoryItemId: string; quantity: number }>
    reason: string
  }> = []
  catalogWalks = 0
  pushImpl: (() => Promise<void>) | null = null

  constructor(
    private fakeProducts: ShopifyProduct[],
    private fakeLocationId: string = 'gid://shopify/Location/1'
  ) {
    super()
  }

  override async *iterateProducts(_locationId: string): AsyncIterable<ShopifyProduct> {
    this.catalogWalks++
    for (const p of this.fakeProducts) yield p
  }

  override async listLocations(): Promise<ShopifyLocation[]> {
    return [{ id: this.fakeLocationId, name: 'Test', isActive: true }]
  }

  override async getPrimaryLocationId(): Promise<string> {
    return this.fakeLocationId
  }

  override async setOnHandQuantities(
    locationId: string,
    items: Array<{ inventoryItemId: string; quantity: number }>,
    reason: string = 'correction'
  ): Promise<void> {
    this.pushCalls.push({ locationId, items, reason })
    if (this.pushImpl) await this.pushImpl()
  }
}

type Fixture = {
  user: User
  product: Product
  variant: Variant
  location: Location
  shopifyVariantGid: string
  shopifyInventoryItemId: string
  shopifyProductGid: string
  shopifyLocationId: string
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
    fullName: 'Sync Tester',
    email: 'sync-tester@example.com',
    password: 'secret-password-1',
  })
  const shopifyLocationId = 'gid://shopify/Location/1'
  await ShopifySetting.updateOrCreate({ id: 1 }, { shopifyLocationId })
  return {
    user,
    product,
    variant,
    location,
    shopifyVariantGid: 'gid://shopify/ProductVariant/100',
    shopifyInventoryItemId: 'gid://shopify/InventoryItem/100',
    shopifyProductGid: 'gid://shopify/Product/10',
    shopifyLocationId,
  }
}

function fakeProduct(opts: {
  productGid: string
  productTitle: string
  variants: Array<{
    gid: string
    inventoryItemId: string
    title?: string
    onHand: number | null
  }>
}): ShopifyProduct {
  return {
    id: opts.productGid,
    title: opts.productTitle,
    featuredImageUrl: null,
    variants: opts.variants.map((v) => ({
      id: v.gid,
      sku: null,
      title: v.title ?? 'Default Title',
      selectedOptions: [],
      inventoryItemId: v.inventoryItemId,
      imageUrl: null,
      onHandAtLocation: v.onHand,
    })),
  }
}

test.group('ShopifySyncService', (group) => {
  group.each.setup(async () => {
    await Promise.all([StockMovement.query().delete(), Stock.query().delete()])
    await ShopifyVariantLink.query().delete()
    await Variant.query().delete()
    // Derivatives must go before wildcards (self-FK is RESTRICT). The
    // `is_wildcard`/`wildcard_id` columns were added partway through this
    // feature's life; tests that don't touch wildcards effectively run the
    // first delete as a no-op.
    await Product.query().whereNotNull('wildcard_id').delete()
    await Product.query().delete()
    await Color.query().delete()
    await Size.query().delete()
    await Category.query().delete()
    await Location.query().delete()
    await User.query().delete()
    await ShopifySetting.query().delete()
  })

  test('buildAllDiffs walks the Shopify catalog exactly once', async ({ assert }) => {
    const f = await makeFixture()
    await ShopifyVariantLink.create({
      variantId: f.variant.id,
      shopifyVariantId: f.shopifyVariantGid,
      shopifyProductId: f.shopifyProductGid,
      lastKnownQuantity: 5,
    })
    const client = new FakeShopifyClient([
      fakeProduct({
        productGid: f.shopifyProductGid,
        productTitle: 'Mirror',
        variants: [
          { gid: f.shopifyVariantGid, inventoryItemId: f.shopifyInventoryItemId, onHand: 5 },
        ],
      }),
    ])
    const service = new ShopifySyncService(client)

    await service.buildAllDiffs()

    assert.equal(client.catalogWalks, 1, 'buildAllDiffs should snapshot Shopify once')
  })

  test('buildPullDiff sums negative deltas and ignores positive ones', async ({ assert }) => {
    const f = await makeFixture()
    // Two links on the same local variant: one decremented by 3 (sale), one
    // incremented by 2 (manual edit in Shopify admin, should be ignored).
    const secondGid = 'gid://shopify/ProductVariant/200'
    const secondInventoryId = 'gid://shopify/InventoryItem/200'
    await ShopifyVariantLink.create({
      variantId: f.variant.id,
      shopifyVariantId: f.shopifyVariantGid,
      shopifyProductId: f.shopifyProductGid,
      lastKnownQuantity: 10,
    })
    await ShopifyVariantLink.create({
      variantId: f.variant.id,
      shopifyVariantId: secondGid,
      shopifyProductId: f.shopifyProductGid,
      lastKnownQuantity: 5,
    })
    const client = new FakeShopifyClient([
      fakeProduct({
        productGid: f.shopifyProductGid,
        productTitle: 'Mirror',
        variants: [
          { gid: f.shopifyVariantGid, inventoryItemId: f.shopifyInventoryItemId, onHand: 7 },
          { gid: secondGid, inventoryItemId: secondInventoryId, onHand: 7 },
        ],
      }),
    ])
    const service = new ShopifySyncService(client)

    const rows = await service.buildPullDiff()

    assert.lengthOf(rows, 1)
    const row = rows[0]
    assert.equal(row.totalDecrement, 3, 'only the −3 delta should be summed')
    assert.lengthOf(row.targets, 2)
    const deltas = row.targets.map((t) => t.delta).sort((a, b) => a - b)
    assert.deepEqual(deltas, [-3, 2])
  })

  test('buildPullDiff treats null baseline as zero delta', async ({ assert }) => {
    const f = await makeFixture()
    await ShopifyVariantLink.create({
      variantId: f.variant.id,
      shopifyVariantId: f.shopifyVariantGid,
      shopifyProductId: f.shopifyProductGid,
      lastKnownQuantity: null,
    })
    const client = new FakeShopifyClient([
      fakeProduct({
        productGid: f.shopifyProductGid,
        productTitle: 'Mirror',
        variants: [
          { gid: f.shopifyVariantGid, inventoryItemId: f.shopifyInventoryItemId, onHand: 7 },
        ],
      }),
    ])
    const service = new ShopifySyncService(client)

    const rows = await service.buildPullDiff()

    // No decrement → no row surfaced; we just learned of this link, the next
    // push will baseline it.
    assert.lengthOf(rows, 0)
  })

  test('applyPull deducts the decrement and advances every baseline', async ({ assert }) => {
    const f = await makeFixture()
    // Seed local stock at 20 so we have something to deduct from.
    await new StockService().adjust({
      variantId: f.variant.id,
      locationId: f.location.id,
      newQuantity: 20,
      userId: f.user.id,
    })
    const link = await ShopifyVariantLink.create({
      variantId: f.variant.id,
      shopifyVariantId: f.shopifyVariantGid,
      shopifyProductId: f.shopifyProductGid,
      lastKnownQuantity: 10,
    })
    const client = new FakeShopifyClient([
      fakeProduct({
        productGid: f.shopifyProductGid,
        productTitle: 'Mirror',
        variants: [
          { gid: f.shopifyVariantGid, inventoryItemId: f.shopifyInventoryItemId, onHand: 7 },
        ],
      }),
    ])
    const service = new ShopifySyncService(client)

    const result = await service.applyPull(
      [{ localVariantId: f.variant.id, locationId: f.location.id }],
      f.user.id
    )

    assert.equal(result.adjusted, 1)
    // Auto-push fires after the pull commits — verify it ran with the new
    // local total (17 = 20 − 3) targeting the same inventory item.
    assert.equal(result.autoPushed, 1)
    assert.lengthOf(client.pushCalls, 1)
    assert.deepEqual(client.pushCalls[0].items, [
      { inventoryItemId: f.shopifyInventoryItemId, quantity: 17 },
    ])

    const stock = await Stock.query()
      .where('variant_id', f.variant.id)
      .andWhere('location_id', f.location.id)
      .firstOrFail()
    assert.equal(stock.quantity, 17, 'local stock should reflect the −3 deduction')

    await link.refresh()
    // Pull sets the baseline to the observed Shopify value (7), then the
    // auto-push step writes the new local total (17) to Shopify and
    // overwrites the baseline with it. End-of-pipeline both sides are at 17.
    assert.equal(
      link.lastKnownQuantity,
      17,
      'auto-push should land the baseline on the new local total so the next pull computes from there'
    )
  })

  test('applyPull rejects a location with insufficient stock without writing anything', async ({
    assert,
  }) => {
    const f = await makeFixture()
    await new StockService().adjust({
      variantId: f.variant.id,
      locationId: f.location.id,
      newQuantity: 2,
      userId: f.user.id,
    })
    const link = await ShopifyVariantLink.create({
      variantId: f.variant.id,
      shopifyVariantId: f.shopifyVariantGid,
      shopifyProductId: f.shopifyProductGid,
      lastKnownQuantity: 10,
    })
    const client = new FakeShopifyClient([
      fakeProduct({
        productGid: f.shopifyProductGid,
        productTitle: 'Mirror',
        variants: [
          { gid: f.shopifyVariantGid, inventoryItemId: f.shopifyInventoryItemId, onHand: 2 },
        ],
      }),
    ])
    const service = new ShopifySyncService(client)

    await assert.rejects(
      () =>
        service.applyPull([{ localVariantId: f.variant.id, locationId: f.location.id }], f.user.id),
      ShopifySyncError
    )

    const stock = await Stock.query()
      .where('variant_id', f.variant.id)
      .andWhere('location_id', f.location.id)
      .firstOrFail()
    assert.equal(stock.quantity, 2, 'stock must not change when the guard rejects the pull')

    await link.refresh()
    assert.equal(link.lastKnownQuantity, 10, 'baseline must not advance when the pull is rejected')
    assert.lengthOf(client.pushCalls, 0, 'auto-push must not fire when the pull throws')
  })

  test('applyPush writes local total to every Shopify mirror and bumps the baseline', async ({
    assert,
  }) => {
    const f = await makeFixture()
    // Local total 12, two Shopify mirrors at 7 and 9 — both should land on 12.
    await new StockService().adjust({
      variantId: f.variant.id,
      locationId: f.location.id,
      newQuantity: 12,
      userId: f.user.id,
    })
    const secondGid = 'gid://shopify/ProductVariant/200'
    const secondInventoryId = 'gid://shopify/InventoryItem/200'
    const linkA = await ShopifyVariantLink.create({
      variantId: f.variant.id,
      shopifyVariantId: f.shopifyVariantGid,
      shopifyProductId: f.shopifyProductGid,
      lastKnownQuantity: 7,
    })
    const linkB = await ShopifyVariantLink.create({
      variantId: f.variant.id,
      shopifyVariantId: secondGid,
      shopifyProductId: f.shopifyProductGid,
      lastKnownQuantity: 9,
    })
    const client = new FakeShopifyClient([
      fakeProduct({
        productGid: f.shopifyProductGid,
        productTitle: 'Mirror',
        variants: [
          { gid: f.shopifyVariantGid, inventoryItemId: f.shopifyInventoryItemId, onHand: 7 },
          { gid: secondGid, inventoryItemId: secondInventoryId, onHand: 9 },
        ],
      }),
    ])
    const service = new ShopifySyncService(client)

    const result = await service.applyPush([f.variant.id])

    assert.equal(result.pushed, 2)
    assert.lengthOf(client.pushCalls, 1)
    const sent = [...client.pushCalls[0].items].sort((a, b) =>
      a.inventoryItemId.localeCompare(b.inventoryItemId)
    )
    assert.deepEqual(sent, [
      { inventoryItemId: f.shopifyInventoryItemId, quantity: 12 },
      { inventoryItemId: secondInventoryId, quantity: 12 },
    ])

    await Promise.all([linkA.refresh(), linkB.refresh()])
    assert.equal(linkA.lastKnownQuantity, 12)
    assert.equal(linkB.lastKnownQuantity, 12)
  })

  test('applyPush rolls baselines back when the Shopify call fails', async ({ assert }) => {
    const f = await makeFixture()
    await new StockService().adjust({
      variantId: f.variant.id,
      locationId: f.location.id,
      newQuantity: 4,
      userId: f.user.id,
    })
    const link = await ShopifyVariantLink.create({
      variantId: f.variant.id,
      shopifyVariantId: f.shopifyVariantGid,
      shopifyProductId: f.shopifyProductGid,
      lastKnownQuantity: 10,
    })
    const client = new FakeShopifyClient([
      fakeProduct({
        productGid: f.shopifyProductGid,
        productTitle: 'Mirror',
        variants: [
          { gid: f.shopifyVariantGid, inventoryItemId: f.shopifyInventoryItemId, onHand: 10 },
        ],
      }),
    ])
    client.pushImpl = async () => {
      throw new Error('simulated Shopify outage')
    }
    const service = new ShopifySyncService(client)

    await assert.rejects(() => service.applyPush([f.variant.id]))

    await link.refresh()
    assert.equal(
      link.lastKnownQuantity,
      10,
      'baseline must remain at its pre-push value — Shopify ordering is "DB writes first, push last", so a push failure unwinds the trx'
    )
    const settings = await ShopifySetting.findOrFail(1)
    assert.isNull(settings.lastPushAt, 'lastPushAt must not be set when the push fails')
  })

  test('computeEffectiveTotals folds wildcard pool into matching printed variants', async ({
    assert,
  }) => {
    // Pure-logic test for the math that decides what gets pushed to
    // Shopify. We assemble a `LocalSnapshot` by hand so no Shopify fixture
    // is needed — but we still need real Color/Size rows because the
    // variants table FKs to them.
    const category = await Category.create({
      name: 'Hoodie',
      hasColor: true,
      hasSize: true,
    })
    const black = await Color.create({ name: 'Black', code: 'BLK' })
    const sizeM = await Size.create({ name: 'M', code: 'M', sortOrder: 1 })
    const wildcardProduct = await Product.create({
      name: 'Hoodie Blank',
      code: 'HDBLK',
      categoryId: category.id,
      isWildcard: true,
    })
    const printedProduct = await Product.create({
      name: 'Hoodie Plain',
      code: 'HDPL',
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
      colorId: black.id,
      sizeId: sizeM.id,
    })

    const variants = await Variant.query()
      .whereIn('id', [wildcardVariant.id, printedVariant.id])
      .preload('product')
    const totalByVariantId = new Map<number, number>([
      [wildcardVariant.id, 10],
      [printedVariant.id, 4],
    ])
    const snapshot: LocalSnapshot = { variants, totalByVariantId }

    const result = new ShopifySyncService().computeEffectiveTotals(snapshot)

    assert.equal(result.effectiveByVariantId.get(printedVariant.id), 14)
    assert.equal(result.wildcardPoolByVariantId.get(printedVariant.id), 10)
    // Wildcards must be pinned to 0 so a stray ShopifyVariantLink on a
    // wildcard variant can't leak the blank stock through applyPush.
    assert.equal(result.effectiveByVariantId.get(wildcardVariant.id), 0)
    assert.equal(result.wildcardPoolByVariantId.get(wildcardVariant.id), 0)
  })

  test('computeEffectiveTotals shares the same pool across multiple derivatives', async ({
    assert,
  }) => {
    // Critical invariant: two printed products derived from the same
    // wildcard each see the full pool. Shopify oversell on shared pools is
    // accepted as the v1 behaviour — push math is correct, pull reconciles.
    const category = await Category.create({
      name: 'Hoodie',
      hasColor: true,
      hasSize: true,
    })
    const black = await Color.create({ name: 'Black', code: 'BLK' })
    const sizeM = await Size.create({ name: 'M', code: 'M', sortOrder: 1 })
    const wildcardProduct = await Product.create({
      name: 'Hoodie Blank',
      code: 'HDBLK',
      categoryId: category.id,
      isWildcard: true,
    })
    const printedA = await Product.create({
      name: 'Hoodie Plain',
      code: 'HDPL',
      categoryId: category.id,
      wildcardId: wildcardProduct.id,
    })
    const printedB = await Product.create({
      name: 'Hoodie Puff',
      code: 'HDPF',
      categoryId: category.id,
      wildcardId: wildcardProduct.id,
    })
    const wildcardVariant = await Variant.create({
      productId: wildcardProduct.id,
      colorId: black.id,
      sizeId: sizeM.id,
    })
    const printedAVariant = await Variant.create({
      productId: printedA.id,
      colorId: black.id,
      sizeId: sizeM.id,
    })
    const printedBVariant = await Variant.create({
      productId: printedB.id,
      colorId: black.id,
      sizeId: sizeM.id,
    })

    const variants = await Variant.query()
      .whereIn('id', [wildcardVariant.id, printedAVariant.id, printedBVariant.id])
      .preload('product')
    const snapshot: LocalSnapshot = {
      variants,
      totalByVariantId: new Map<number, number>([
        [wildcardVariant.id, 10],
        [printedAVariant.id, 4],
        [printedBVariant.id, 2],
      ]),
    }

    const result = new ShopifySyncService().computeEffectiveTotals(snapshot)

    assert.equal(result.effectiveByVariantId.get(printedAVariant.id), 14)
    assert.equal(result.effectiveByVariantId.get(printedBVariant.id), 12)
    assert.equal(result.wildcardPoolByVariantId.get(printedAVariant.id), 10)
    assert.equal(result.wildcardPoolByVariantId.get(printedBVariant.id), 10)
  })

  test('computeEffectiveTotals contributes zero when no wildcard variant matches', async ({
    assert,
  }) => {
    // Printed variant in a (color, size) the wildcard doesn't carry — the
    // operator added a print-only colour, say. The printed variant must
    // collapse to own-stock only, NOT inherit a different colour's pool.
    const category = await Category.create({
      name: 'Hoodie',
      hasColor: true,
      hasSize: true,
    })
    const black = await Color.create({ name: 'Black', code: 'BLK' })
    const red = await Color.create({ name: 'Red', code: 'RED' })
    const sizeM = await Size.create({ name: 'M', code: 'M', sortOrder: 1 })
    const wildcardProduct = await Product.create({
      name: 'Hoodie Blank',
      code: 'HDBLK',
      categoryId: category.id,
      isWildcard: true,
    })
    const printedProduct = await Product.create({
      name: 'Hoodie Plain',
      code: 'HDPL',
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

    const variants = await Variant.query()
      .whereIn('id', [wildcardVariant.id, printedVariant.id])
      .preload('product')
    const snapshot: LocalSnapshot = {
      variants,
      totalByVariantId: new Map<number, number>([
        [wildcardVariant.id, 10],
        [printedVariant.id, 3],
      ]),
    }

    const result = new ShopifySyncService().computeEffectiveTotals(snapshot)

    assert.equal(result.effectiveByVariantId.get(printedVariant.id), 3)
    assert.equal(result.wildcardPoolByVariantId.get(printedVariant.id), 0)
  })

  test('computeEffectiveTotals falls back to 0 own stock when totalByVariantId omits a variant', async ({
    assert,
  }) => {
    // The aggregation SQL only returns rows for variants with at least one
    // Stock row, so untouched variants are simply absent from the map.
    // The fold must treat absence as own=0, not undefined — otherwise the
    // Shopify push would write NaN.
    const category = await Category.create({
      name: 'Hoodie',
      hasColor: true,
      hasSize: true,
    })
    const black = await Color.create({ name: 'Black', code: 'BLK' })
    const sizeM = await Size.create({ name: 'M', code: 'M', sortOrder: 1 })
    const wildcardProduct = await Product.create({
      name: 'Hoodie Blank',
      code: 'HDBLK',
      categoryId: category.id,
      isWildcard: true,
    })
    const printedProduct = await Product.create({
      name: 'Hoodie Plain',
      code: 'HDPL',
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
      colorId: black.id,
      sizeId: sizeM.id,
    })

    const variants = await Variant.query()
      .whereIn('id', [wildcardVariant.id, printedVariant.id])
      .preload('product')
    const snapshot: LocalSnapshot = {
      variants,
      totalByVariantId: new Map<number, number>([
        [wildcardVariant.id, 5],
        // printedVariant is intentionally absent from totals.
      ]),
    }

    const result = new ShopifySyncService().computeEffectiveTotals(snapshot)

    assert.equal(result.effectiveByVariantId.get(printedVariant.id), 5)
    assert.equal(result.wildcardPoolByVariantId.get(printedVariant.id), 5)
  })

  test('applyLink baselines new links to the current Shopify quantity', async ({ assert }) => {
    const f = await makeFixture()
    const client = new FakeShopifyClient([
      fakeProduct({
        productGid: f.shopifyProductGid,
        productTitle: 'Mirror',
        variants: [
          { gid: f.shopifyVariantGid, inventoryItemId: f.shopifyInventoryItemId, onHand: 8 },
        ],
      }),
    ])
    const service = new ShopifySyncService(client)

    const result = await service.applyLink([
      { localVariantId: f.variant.id, shopifyVariantIds: [f.shopifyVariantGid] },
    ])

    assert.equal(result.linked, 1)
    const link = await ShopifyVariantLink.query().where('variant_id', f.variant.id).firstOrFail()
    assert.equal(
      link.lastKnownQuantity,
      8,
      'first link should snapshot the current Shopify quantity so the very next pull has a baseline'
    )
  })
})
