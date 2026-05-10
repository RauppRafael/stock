import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/category'
import Location from '#models/location'
import Product from '#models/product'
import Stock from '#models/stock'
import Variant from '#models/variant'
import StockService from '#services/stock_service'
import StockTransformer from '#transformers/stock_transformer'
import CategoryTransformer from '#transformers/category_transformer'
import LocationTransformer from '#transformers/location_transformer'
import ProductTransformer from '#transformers/product_transformer'
import VariantTransformer from '#transformers/variant_transformer'
import {
  adjustStockValidator,
  bulkAdjustStockValidator,
  stockIndexFiltersValidator,
  stockLookupCategoryParamsValidator,
  stockLookupGridParamsValidator,
  stockLookupGridQueryValidator,
  stockLookupProductParamsValidator,
  stockLookupVariantParamsValidator,
} from '#validators/stock'

export default class StockController {
  async index({ inertia, request }: HttpContext) {
    const filters = await stockIndexFiltersValidator.validate(request.qs())

    const query = Stock.query()
      .preload('location')
      .preload('variant', (v) => {
        v.preload('color')
          .preload('print')
          .preload('size')
          .preload('product', (p) => p.preload('category'))
      })
      // Always exclude stocks whose product is trashed — done at the SQL
      // level so we don't pull rows we'll discard later.
      .whereHas('variant', (v) =>
        v.whereHas('product', (p) => p.whereNull('deleted_at'))
      )

    if (filters.locationId) query.where('location_id', filters.locationId)
    if (filters.productId) {
      query.whereHas('variant', (v) => v.where('product_id', filters.productId!))
    }
    if (filters.categoryId) {
      query.whereHas('variant', (v) =>
        v.whereHas('product', (p) => p.where('category_id', filters.categoryId!))
      )
    }

    let stocks = await query

    if (filters.lowOnly) {
      // Threshold lives on the product, so this stays in JS — moving it to
      // SQL would require a JOIN we don't otherwise need.
      stocks = stocks.filter((s) => {
        const threshold = s.variant?.product?.lowStockThreshold
        if (threshold == null) return s.quantity === 0
        return s.quantity <= threshold
      })
    }

    const [categories, locations] = await Promise.all([
      Category.notTrashed().orderBy('name', 'asc'),
      Location.query().orderBy('name', 'asc'),
    ])

    let products: Product[] = []
    if (filters.categoryId) {
      products = await Product.notTrashed()
        .where('category_id', filters.categoryId)
        .orderBy('name', 'asc')
    }

    return inertia.render('stock/index', {
      stocks: StockTransformer.transform(stocks),
      categories: CategoryTransformer.transform(categories),
      locations: LocationTransformer.transform(locations),
      products: ProductTransformer.transform(products),
      filters: {
        categoryId: filters.categoryId ?? null,
        productId: filters.productId ?? null,
        locationId: filters.locationId ?? null,
        lowOnly: filters.lowOnly ?? false,
      },
    })
  }

  async create({ inertia, request }: HttpContext) {
    const variantId = request.input('variantId') ? Number(request.input('variantId')) : null
    const locationId = request.input('locationId') ? Number(request.input('locationId')) : null

    const [categories, locations] = await Promise.all([
      Category.notTrashed().orderBy('name', 'asc'),
      Location.query().orderBy('name', 'asc'),
    ])

    let prefilledVariant: Variant | null = null
    if (variantId) {
      prefilledVariant = await Variant.query()
        .where('id', variantId)
        .preload('color')
        .preload('print')
        .preload('size')
        .preload('product', (p) => p.preload('category'))
        .first()
    }

    return inertia.render('stock/adjust', {
      categories: CategoryTransformer.transform(categories),
      locations: LocationTransformer.transform(locations),
      prefilledVariant: prefilledVariant ? VariantTransformer.transform(prefilledVariant) : null,
      prefilledLocationId: locationId,
    })
  }

  async adjust({ request, response, session, auth }: HttpContext) {
    const payload = await request.validateUsing(adjustStockValidator)
    const user = auth.getUserOrFail()

    const movement = await new StockService().adjust({
      variantId: payload.variantId,
      locationId: payload.locationId,
      newQuantity: payload.newQuantity,
      userId: user.id,
      reason: payload.reason ?? null,
    })

    session.flash(
      'success',
      `Stock updated: ${movement.previousQuantity} → ${movement.newQuantity} (Δ ${movement.delta >= 0 ? '+' : ''}${movement.delta}).`
    )
    return response.redirect().toRoute('stock.index')
  }

  async bulkAdjust({ request, response, session, auth }: HttpContext) {
    const payload = await request.validateUsing(bulkAdjustStockValidator)
    const user = auth.getUserOrFail()

    const movements = await new StockService().bulkAdjust({
      adjustments: payload.adjustments.map((a) => ({
        variantId: a.variantId,
        locationId: payload.locationId,
        newQuantity: a.newQuantity,
      })),
      userId: user.id,
      reason: payload.reason ?? null,
    })

    if (movements.length === 0) {
      session.flash('success', 'No changes — quantities already match.')
    } else {
      const totalDelta = movements.reduce((sum, m) => sum + m.delta, 0)
      const sign = totalDelta >= 0 ? '+' : ''
      session.flash(
        'success',
        `${movements.length} variant(s) updated (Δ ${sign}${totalDelta}).`
      )
    }
    return response.redirect().back()
  }

  /**
   * JSON helpers used by the cascading variant selector. Returns minimal
   * data needed to drill from category → product → variant. We rely on the
   * application's BaseSerializer (via ctx.serialize) so transformer Items
   * and Collections get fully resolved into plain JSON.
   */
  async productsForCategory(ctx: HttpContext) {
    const { categoryId } = await stockLookupCategoryParamsValidator.validate(ctx.request.params())
    const products = await Product.notTrashed()
      .where('category_id', categoryId)
      .orderBy('name', 'asc')
    return ctx.serialize(ProductTransformer.transform(products))
  }

  async variantsForProduct(ctx: HttpContext) {
    const { productId } = await stockLookupProductParamsValidator.validate(ctx.request.params())
    const variants = await Variant.query()
      .where('product_id', productId)
      .preload('color')
      .preload('print')
      .preload('size')
      .preload('product', (p) => p.preload('category'))
      .orderBy('id', 'asc')
    return ctx.serialize(VariantTransformer.transform(variants))
  }

  async lookupStock(ctx: HttpContext) {
    const { variantId, locationId } = await stockLookupVariantParamsValidator.validate(
      ctx.request.params()
    )
    const stock = await Stock.query()
      .where('variant_id', variantId)
      .andWhere('location_id', locationId)
      .first()
    return ctx.response.json({
      data: { quantity: stock?.quantity ?? 0 },
    })
  }

  /**
   * Returns every variant of a product (optionally narrowed by color/print)
   * paired with the on-hand quantity at the given location. Used by the
   * adjust page to render a per-size editable grid in one shot. Variants
   * are ordered by size sortOrder so S/M/L line up consistently.
   *
   * Returned as parallel arrays (`variants`, `quantities`) rather than
   * `[{ variant, quantity }, …]` so the variant collection can flow through
   * `ctx.serialize` and resolve nested transformer Items the same way the
   * other lookup endpoints do.
   */
  async lookupGrid(ctx: HttpContext) {
    const { productId, locationId } = await stockLookupGridParamsValidator.validate(
      ctx.request.params()
    )
    const { colorId, printId } = await stockLookupGridQueryValidator.validate(ctx.request.qs())

    const variantsQuery = Variant.query()
      .where('product_id', productId)
      .preload('color')
      .preload('print')
      .preload('size')
      .preload('product', (p) => p.preload('category'))

    if (colorId !== undefined) variantsQuery.where('color_id', colorId)
    if (printId !== undefined) variantsQuery.where('print_id', printId)

    const variants = await variantsQuery
    variants.sort((a, b) => {
      const sa = a.size?.sortOrder ?? 0
      const sb = b.size?.sortOrder ?? 0
      if (sa !== sb) return sa - sb
      return (a.size?.name ?? '').localeCompare(b.size?.name ?? '')
    })

    const variantIds = variants.map((v) => v.id)
    const stocks = variantIds.length
      ? await Stock.query()
          .where('location_id', locationId)
          .whereIn('variant_id', variantIds)
      : []
    const quantityByVariant: Record<number, number> = {}
    for (const s of stocks) quantityByVariant[s.variantId] = s.quantity
    for (const v of variants) {
      if (quantityByVariant[v.id] === undefined) quantityByVariant[v.id] = 0
    }

    const resolvedVariants = await ctx.serialize.withoutWrapping(
      VariantTransformer.transform(variants)
    )
    return ctx.response.json({
      data: {
        variants: resolvedVariants,
        quantities: quantityByVariant,
      },
    })
  }
}
