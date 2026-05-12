import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/category'
import Color from '#models/color'
import Size from '#models/size'
import Product from '#models/product'
import StockMovement from '#models/stock_movement'
import VariantGenerator from '#services/variant_generator'
import CategoryTransformer from '#transformers/category_transformer'
import ColorTransformer from '#transformers/color_transformer'
import SizeTransformer from '#transformers/size_transformer'
import ProductTransformer from '#transformers/product_transformer'
import VariantTransformer from '#transformers/variant_transformer'
import StockTransformer from '#transformers/stock_transformer'
import StockMovementTransformer from '#transformers/stock_movement_transformer'
import { createProductValidator, updateProductValidator } from '#validators/product'

export default class ProductsController {
  async index({ inertia, request }: HttpContext) {
    const categoryId = request.input('categoryId') ? Number(request.input('categoryId')) : undefined
    const search = request.input('search', '').toString().trim()

    const query = Product.notTrashed()
      .preload('category')
      .withCount('variants')
      .orderBy('name', 'asc')
    if (categoryId) query.where('category_id', categoryId)
    if (search) query.whereILike('name', `%${search}%`)

    const [products, categories] = await Promise.all([
      query,
      Category.notTrashed().orderBy('name', 'asc'),
    ])

    return inertia.render('products/index', {
      products: ProductTransformer.transform(products),
      categories: CategoryTransformer.transform(categories),
      filters: { categoryId: categoryId ?? null, search },
    })
  }

  async create({ inertia }: HttpContext) {
    const [categories, colors, sizes] = await Promise.all([
      Category.notTrashed().orderBy('name', 'asc'),
      Color.query().orderBy('name', 'asc'),
      Size.query().orderBy('sort_order', 'asc'),
    ])
    return inertia.render('products/create', {
      categories: CategoryTransformer.transform(categories),
      colors: ColorTransformer.transform(colors),
      sizes: SizeTransformer.transform(sizes),
    })
  }

  async store({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(createProductValidator)
    const category = await Category.findOrFail(payload.categoryId)

    const product = await Product.create({
      name: payload.name,
      code: payload.code,
      categoryId: payload.categoryId,
      description: payload.description ?? null,
      lowStockThreshold: payload.lowStockThreshold ?? null,
    })

    await new VariantGenerator().generate(product, category, {
      colorIds: payload.colorIds,
      sizeIds: payload.sizeIds,
    })

    session.flash('success', `Product "${product.name}" created.`)
    return response.redirect().toRoute('products.show', { id: product.id })
  }

  async show({ inertia, params }: HttpContext) {
    const product = await Product.notTrashed()
      .where('id', Number(params.id))
      .preload('category')
      .preload('variants', (q) => {
        q.preload('color')
          .preload('size')
          .preload('stocks', (s) => s.preload('location'))
      })
      .firstOrFail()

    // Wire the parent product onto each variant so the `skuCode` computed
    // getter (which reads `this.product.code`) resolves without a redundant
    // preload — we already have the product in scope.
    for (const variant of product.variants) {
      variant.$setRelated('product', product)
    }

    // Preload returns variants in insertion order. Sort by color name → size
    // sortOrder so the variants & stock table reads top-to-bottom in a
    // predictable order. Size.sortOrder lives on the Size table so doing
    // this in JS is simpler than a join in the preload callback.
    product.variants.sort((a, b) => {
      const cola = a.color?.name ?? null
      const colb = b.color?.name ?? null
      if (cola === null && colb !== null) return 1
      if (cola !== null && colb === null) return -1
      if (cola !== null && colb !== null && cola !== colb) return cola.localeCompare(colb)
      const sa = a.size?.sortOrder ?? 0
      const sb = b.size?.sortOrder ?? 0
      if (sa !== sb) return sa - sb
      return (a.size?.name ?? '').localeCompare(b.size?.name ?? '')
    })

    const variantIds = product.variants.map((v) => v.id)
    const movements = variantIds.length
      ? await StockMovement.query()
          .whereIn('variant_id', variantIds)
          .preload('variant', (v) =>
            v
              .preload('color')
              .preload('size')
              .preload('product', (p) => p.preload('category'))
          )
          .preload('location')
          .preload('user')
          .orderBy('created_at', 'desc')
          .limit(50)
      : []

    return inertia.render('products/show', {
      product: ProductTransformer.transform(product),
      variants: VariantTransformer.transform(product.variants),
      stocks: StockTransformer.transform(product.variants.flatMap((v) => v.stocks)),
      movements: StockMovementTransformer.transform(movements),
    })
  }

  async edit({ inertia, params }: HttpContext) {
    const product = await Product.notTrashed()
      .where('id', Number(params.id))
      .preload('category')
      .preload('variants', (q) => q.preload('color').preload('size'))
      .firstOrFail()

    const [colors, sizes] = await Promise.all([
      Color.query().orderBy('name', 'asc'),
      Size.query().orderBy('sort_order', 'asc'),
    ])

    return inertia.render('products/edit', {
      product: ProductTransformer.transform(product),
      variants: VariantTransformer.transform(product.variants),
      colors: ColorTransformer.transform(colors),
      sizes: SizeTransformer.transform(sizes),
    })
  }

  async update({ request, response, session, params }: HttpContext) {
    const product = await Product.notTrashed()
      .where('id', Number(params.id))
      .preload('category')
      .firstOrFail()
    const payload = await request.validateUsing(updateProductValidator, {
      meta: { id: product.id },
    })

    product.merge({
      name: payload.name,
      code: payload.code,
      description: payload.description ?? null,
      lowStockThreshold: payload.lowStockThreshold ?? null,
    })
    await product.save()

    if (payload.colorIds || payload.sizeIds) {
      await new VariantGenerator().generate(product, product.category, {
        colorIds: payload.colorIds,
        sizeIds: payload.sizeIds,
      })
    }

    session.flash('success', 'Product updated.')
    return response.redirect().toRoute('products.show', { id: product.id })
  }

  async destroy({ response, session, params }: HttpContext) {
    const product = await Product.notTrashed().where('id', Number(params.id)).firstOrFail()
    const movementCount = await StockMovement.query()
      .whereIn('variant_id', (q) => q.from('variants').where('product_id', product.id).select('id'))
      .count('* as total')
      .first()
    if (movementCount && Number(movementCount.$extras.total) > 0) {
      // We always soft-delete, but be explicit about why hard-deletion is off
      // limits: history must remain readable.
      await product.trash()
      session.flash('success', 'Product archived (movement history preserved).')
    } else {
      await product.trash()
      session.flash('success', 'Product archived.')
    }
    return response.redirect().toRoute('products.index')
  }
}
