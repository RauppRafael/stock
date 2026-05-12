import { test } from '@japa/runner'
import VariantGenerator from '#services/variant_generator'
import Category from '#models/category'
import Color from '#models/color'
import Size from '#models/size'
import Product from '#models/product'
import Stock from '#models/stock'
import StockMovement from '#models/stock_movement'
import ShopifyVariantLink from '#models/shopify_variant_link'
import Variant from '#models/variant'

type Fixture = {
  category: Category
  product: Product
  colors: Color[]
  sizes: Size[]
}

async function makeFixture(flags: { hasColor: boolean; hasSize: boolean }): Promise<Fixture> {
  const category = await Category.create({
    name: `Cat-${Math.random()}`,
    ...flags,
  })
  const product = await Product.create({
    name: 'Test Product',
    code: `TST${Math.floor(Math.random() * 10_000)}`,
    categoryId: category.id,
  })

  const colors = await Promise.all([
    Color.create({ name: `Red-${Math.random()}`, code: `R${Math.floor(Math.random() * 10_000)}` }),
    Color.create({ name: `Blue-${Math.random()}`, code: `B${Math.floor(Math.random() * 10_000)}` }),
  ])
  const sizes = await Promise.all([
    Size.create({
      name: `S-${Math.random()}`,
      code: `S${Math.floor(Math.random() * 10_000)}`,
      sortOrder: 10,
    }),
    Size.create({
      name: `M-${Math.random()}`,
      code: `M${Math.floor(Math.random() * 10_000)}`,
      sortOrder: 20,
    }),
    Size.create({
      name: `L-${Math.random()}`,
      code: `L${Math.floor(Math.random() * 10_000)}`,
      sortOrder: 30,
    }),
  ])

  return { category, product, colors, sizes }
}

test.group('VariantGenerator', (group) => {
  group.each.setup(async () => {
    // Tear down in dependency order — stock_movements/stocks/shopify_variant_links
    // RESTRICT-FK their variants, so any rows left by a previous suite must go first.
    await StockMovement.query().delete()
    await Stock.query().delete()
    await ShopifyVariantLink.query().delete()
    await Variant.query().delete()
    await Product.query().delete()
    await Color.query().delete()
    await Size.query().delete()
    await Category.query().delete()
  })

  test('produces the cartesian product of color × size axes', async ({ assert }) => {
    const f = await makeFixture({ hasColor: true, hasSize: true })
    const generator = new VariantGenerator()

    const created = await generator.generate(f.product, f.category, {
      colorIds: f.colors.map((c) => c.id),
      sizeIds: f.sizes.map((s) => s.id),
    })

    assert.lengthOf(created, 2 * 3)
    const all = await Variant.query().where('product_id', f.product.id)
    assert.lengthOf(all, 6)
  })

  test('uses NULL placeholders for attribute axes the category does not declare', async ({
    assert,
  }) => {
    // Hat-style: color, but no size
    const f = await makeFixture({ hasColor: true, hasSize: false })
    await new VariantGenerator().generate(f.product, f.category, {
      colorIds: [f.colors[0].id, f.colors[1].id],
      sizeIds: [f.sizes[0].id], // ignored because hasSize=false
    })

    const variants = await Variant.query().where('product_id', f.product.id)
    assert.lengthOf(variants, 2)
    assert.isTrue(variants.every((v) => v.sizeId === null))
    assert.isTrue(variants.every((v) => v.colorId !== null))
  })

  test('skips combinations that already exist (idempotent re-runs)', async ({ assert }) => {
    const f = await makeFixture({ hasColor: true, hasSize: true })
    const generator = new VariantGenerator()

    const first = await generator.generate(f.product, f.category, {
      colorIds: [f.colors[0].id],
      sizeIds: [f.sizes[0].id, f.sizes[1].id],
    })
    assert.lengthOf(first, 2)

    // Same selection, no new variants:
    const second = await generator.generate(f.product, f.category, {
      colorIds: [f.colors[0].id],
      sizeIds: [f.sizes[0].id, f.sizes[1].id],
    })
    assert.lengthOf(second, 0)

    // Adding one new size only creates the missing combination:
    const third = await generator.generate(f.product, f.category, {
      colorIds: [f.colors[0].id],
      sizeIds: [f.sizes[0].id, f.sizes[1].id, f.sizes[2].id],
    })
    assert.lengthOf(third, 1)
    assert.equal(third[0].sizeId, f.sizes[2].id)

    const total = await Variant.query().where('product_id', f.product.id)
    assert.lengthOf(total, 3)
  })

  test('returns nothing when a required attribute axis is empty', async ({ assert }) => {
    const f = await makeFixture({ hasColor: true, hasSize: true })
    const generator = new VariantGenerator()

    // Missing colors — no cartesian to fold against, so no rows.
    const noColors = await generator.generate(f.product, f.category, {
      sizeIds: [f.sizes[0].id],
    })
    assert.lengthOf(noColors, 0)

    // Missing sizes — same.
    const noSizes = await generator.generate(f.product, f.category, {
      colorIds: [f.colors[0].id],
    })
    assert.lengthOf(noSizes, 0)

    const created = await Variant.query().where('product_id', f.product.id)
    assert.lengthOf(created, 0)
  })
})
