import { test } from '@japa/runner'
import VariantGenerator from '#services/variant_generator'
import Category from '#models/category'
import Color from '#models/color'
import Print from '#models/print'
import Size from '#models/size'
import Product from '#models/product'
import Variant from '#models/variant'

type Fixture = {
  category: Category
  product: Product
  colors: Color[]
  prints: Print[]
  sizes: Size[]
}

async function makeFixture(flags: {
  hasColor: boolean
  hasPrint: boolean
  hasSize: boolean
}): Promise<Fixture> {
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
  const prints = await Promise.all([
    Print.create({ name: `Plain-${Math.random()}`, code: `P${Math.floor(Math.random() * 10_000)}` }),
    Print.create({ name: `Stripe-${Math.random()}`, code: `S${Math.floor(Math.random() * 10_000)}` }),
  ])
  const sizes = await Promise.all([
    Size.create({ name: `S-${Math.random()}`, code: `S${Math.floor(Math.random() * 10_000)}`, sortOrder: 10 }),
    Size.create({ name: `M-${Math.random()}`, code: `M${Math.floor(Math.random() * 10_000)}`, sortOrder: 20 }),
    Size.create({ name: `L-${Math.random()}`, code: `L${Math.floor(Math.random() * 10_000)}`, sortOrder: 30 }),
  ])

  return { category, product, colors, prints, sizes }
}

test.group('VariantGenerator', (group) => {
  group.each.setup(async () => {
    await Variant.query().delete()
    await Product.query().delete()
    await Color.query().delete()
    await Print.query().delete()
    await Size.query().delete()
    await Category.query().delete()
  })

  test('produces the cartesian product when category uses every attribute', async ({ assert }) => {
    const f = await makeFixture({ hasColor: true, hasPrint: true, hasSize: true })
    const generator = new VariantGenerator()

    const created = await generator.generate(f.product, f.category, {
      colorIds: f.colors.map((c) => c.id),
      printIds: f.prints.map((p) => p.id),
      sizeIds: f.sizes.map((s) => s.id),
    })

    assert.lengthOf(created, 2 * 2 * 3)
    const all = await Variant.query().where('product_id', f.product.id)
    assert.lengthOf(all, 12)
  })

  test('uses NULL placeholders for attributes the category does not declare', async ({
    assert,
  }) => {
    // Hat-style: color + print, but no size
    const f = await makeFixture({ hasColor: true, hasPrint: true, hasSize: false })
    await new VariantGenerator().generate(f.product, f.category, {
      colorIds: [f.colors[0].id, f.colors[1].id],
      printIds: [f.prints[0].id],
      sizeIds: [f.sizes[0].id], // ignored because hasSize=false
    })

    const variants = await Variant.query().where('product_id', f.product.id)
    assert.lengthOf(variants, 2)
    assert.isTrue(variants.every((v) => v.sizeId === null))
    assert.isTrue(variants.every((v) => v.colorId !== null && v.printId !== null))
  })

  test('skips combinations that already exist (idempotent re-runs)', async ({ assert }) => {
    const f = await makeFixture({ hasColor: true, hasPrint: false, hasSize: true })
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
    const f = await makeFixture({ hasColor: true, hasPrint: false, hasSize: true })
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
