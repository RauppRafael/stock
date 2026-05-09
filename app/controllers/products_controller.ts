import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Category from '#models/category'
import Color from '#models/color'
import Print from '#models/print'
import Size from '#models/size'
import Product from '#models/product'
import StockMovement from '#models/stock_movement'
import VariantGenerator from '#services/variant_generator'
import CategoryTransformer from '#transformers/category_transformer'
import ColorTransformer from '#transformers/color_transformer'
import PrintTransformer from '#transformers/print_transformer'
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

    const query = Product.notTrashed().preload('category').orderBy('name', 'asc')
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
    const [categories, colors, prints, sizes] = await Promise.all([
      Category.notTrashed().orderBy('name', 'asc'),
      Color.query().orderBy('name', 'asc'),
      Print.query().orderBy('name', 'asc'),
      Size.query().orderBy('sort_order', 'asc'),
    ])
    return inertia.render('products/create', {
      categories: CategoryTransformer.transform(categories),
      colors: ColorTransformer.transform(colors),
      prints: PrintTransformer.transform(prints),
      sizes: SizeTransformer.transform(sizes),
    })
  }

  async store({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(createProductValidator)
    const category = await Category.findOrFail(payload.categoryId)

    const product = await db.transaction(async (trx) => {
      const created = await Product.create(
        {
          name: payload.name,
          code: payload.code,
          categoryId: payload.categoryId,
          description: payload.description ?? null,
          lowStockThreshold: payload.lowStockThreshold ?? null,
        },
        { client: trx }
      )
      return created
    })

    await new VariantGenerator().generate(product, category, {
      colorIds: payload.colorIds,
      printIds: payload.printIds,
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
          .preload('print')
          .preload('size')
          .preload('stocks', (s) => s.preload('location'))
      })
      .firstOrFail()

    const variantIds = product.variants.map((v) => v.id)
    const movements = variantIds.length
      ? await StockMovement.query()
          .whereIn('variant_id', variantIds)
          .preload('variant', (v) => v.preload('color').preload('print').preload('size'))
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
      .preload('variants', (q) => q.preload('color').preload('print').preload('size'))
      .firstOrFail()

    const [colors, prints, sizes] = await Promise.all([
      Color.query().orderBy('name', 'asc'),
      Print.query().orderBy('name', 'asc'),
      Size.query().orderBy('sort_order', 'asc'),
    ])

    return inertia.render('products/edit', {
      product: ProductTransformer.transform(product),
      variants: VariantTransformer.transform(product.variants),
      colors: ColorTransformer.transform(colors),
      prints: PrintTransformer.transform(prints),
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

    if (payload.colorIds || payload.printIds || payload.sizeIds) {
      await new VariantGenerator().generate(product, product.category, {
        colorIds: payload.colorIds,
        printIds: payload.printIds,
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
