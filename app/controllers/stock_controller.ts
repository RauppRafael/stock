import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/category'
import Location from '#models/location'
import Product from '#models/product'
import Stock from '#models/stock'
import Variant from '#models/variant'
import StockService from '#services/stock_service'
import WildcardService, { WildcardServiceError } from '#services/wildcard_service'
import StockTransformer from '#transformers/stock_transformer'
import CategoryTransformer from '#transformers/category_transformer'
import LocationTransformer from '#transformers/location_transformer'
import ProductTransformer from '#transformers/product_transformer'
import VariantTransformer from '#transformers/variant_transformer'
import {
  adjustStockValidator,
  bulkAdjustStockValidator,
  convertWildcardValidator,
  stockIndexFiltersValidator,
  stockLookupCategoryParamsValidator,
  stockLookupGridParamsValidator,
  stockLookupGridQueryValidator,
  stockLookupProductParamsValidator,
  stockLookupVariantParamsValidator,
  wildcardTargetsParamsValidator,
} from '#validators/stock'

export default class StockController {
  async index({ inertia, request }: HttpContext) {
    const filters = await stockIndexFiltersValidator.validate(request.qs())

    // Drive the table from the variant universe (not the stock table) so a
    // variant that has never been adjusted still surfaces as a 0 row. We
    // pull every variant matching the filters, every location in scope,
    // and the existing stock rows for those (variant, location) pairs —
    // then fill the gaps with synthesized 0-quantity Stock instances.
    const variantsQuery = Variant.query()
      .preload('color')
      .preload('size')
      .preload('product', (p) => p.preload('category'))
      .whereHas('product', (p) => p.whereNull('deleted_at'))

    if (filters.productId) variantsQuery.where('product_id', filters.productId)
    if (filters.categoryId) {
      variantsQuery.whereHas('product', (p) =>
        p.whereNull('deleted_at').where('category_id', filters.categoryId!)
      )
    }

    const locationsQuery = Location.query()
    if (filters.locationId) locationsQuery.where('id', filters.locationId)

    const [variantsInScope, locationsInScope] = await Promise.all([variantsQuery, locationsQuery])

    const variantIds = variantsInScope.map((v) => v.id)
    const locationIds = locationsInScope.map((l) => l.id)

    const existingStocks =
      variantIds.length && locationIds.length
        ? await Stock.query().whereIn('variant_id', variantIds).whereIn('location_id', locationIds)
        : []

    const stockByKey = new Map<string, Stock>()
    for (const s of existingStocks) stockByKey.set(`${s.variantId}:${s.locationId}`, s)

    let stocks: Stock[] = []
    for (const v of variantsInScope) {
      for (const l of locationsInScope) {
        const key = `${v.id}:${l.id}`
        const existing = stockByKey.get(key)
        if (existing) {
          existing.$setRelated('variant', v)
          existing.$setRelated('location', l)
          stocks.push(existing)
        } else {
          // Phantom row — id stays undefined and is serialised as null so the
          // front-end can key off (variantId, locationId) instead.
          const phantom = new Stock()
          phantom.variantId = v.id
          phantom.locationId = l.id
          phantom.quantity = 0
          phantom.$setRelated('variant', v)
          phantom.$setRelated('location', l)
          stocks.push(phantom)
        }
      }
    }

    if (filters.stockStatus === 'inStock') {
      stocks = stocks.filter((s) => s.quantity > 0)
    } else if (filters.stockStatus === 'outOfStock') {
      stocks = stocks.filter((s) => s.quantity === 0)
    }

    // The front-end groups rows by (product, location, color) via rowspan,
    // which only works if rows that share a group are adjacent. Sort here so
    // the page can render the grouping without a second pass.
    stocks.sort((a, b) => {
      const ca = a.variant?.product?.category?.name ?? ''
      const cb = b.variant?.product?.category?.name ?? ''
      if (ca !== cb) return ca.localeCompare(cb)
      const pa = a.variant?.product?.name ?? ''
      const pb = b.variant?.product?.name ?? ''
      if (pa !== pb) return pa.localeCompare(pb)
      const la = a.location?.name ?? ''
      const lb = b.location?.name ?? ''
      if (la !== lb) return la.localeCompare(lb)
      // Same product + location → group by color. Null colors sort last so
      // colored variants come before the "no color" bucket.
      const cola = a.variant?.color?.name ?? null
      const colb = b.variant?.color?.name ?? null
      if (cola === null && colb !== null) return 1
      if (cola !== null && colb === null) return -1
      if (cola !== null && colb !== null && cola !== colb) return cola.localeCompare(colb)
      // Same product + location + color → order by size (sortOrder, then name).
      const sa = a.variant?.size?.sortOrder ?? 0
      const sb = b.variant?.size?.sortOrder ?? 0
      if (sa !== sb) return sa - sb
      const sna = a.variant?.size?.name ?? ''
      const snb = b.variant?.size?.name ?? ''
      return sna.localeCompare(snb)
    })

    const [categories, locations] = await Promise.all([
      Category.notTrashed().orderBy('name', 'asc'),
      Location.query().orderBy('name', 'asc'),
    ])

    const productsQuery = Product.notTrashed().orderBy('name', 'asc')
    if (filters.categoryId) productsQuery.where('category_id', filters.categoryId)
    const products = await productsQuery

    // Wildcard pool contribution per (printed variant, location) — i.e.
    // for each printed variant in scope, how much stock its source wildcard
    // holds in a matching (color, size) variant at the same location.
    // Computed server-side so it stays accurate even when the operator
    // filtered to a single non-wildcard product (which would otherwise hide
    // the wildcard's own rows entirely). The math lives on WildcardService
    // so it can be unit-tested in isolation.
    const pools = await new WildcardService().computePoolMap(variantsInScope, locationIds)

    return inertia.render('stock/index', {
      stocks: StockTransformer.transform(stocks),
      categories: CategoryTransformer.transform(categories),
      locations: LocationTransformer.transform(locations),
      products: ProductTransformer.transform(products),
      pools,
      filters: {
        categoryId: filters.categoryId ?? null,
        productId: filters.productId ?? null,
        locationId: filters.locationId ?? null,
        stockStatus: filters.stockStatus ?? 'all',
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
      session.flash('success', `${movements.length} variant(s) updated (Δ ${sign}${totalDelta}).`)
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
   * Render the convert-wildcard page. Optionally prefilled when the caller
   * passes a wildcard variant + location (e.g. clicking a wildcard row on
   * the stock page).
   */
  async createConversion({ inertia, request }: HttpContext) {
    const variantId = request.input('variantId') ? Number(request.input('variantId')) : null
    const locationId = request.input('locationId') ? Number(request.input('locationId')) : null

    const [categories, locations] = await Promise.all([
      Category.notTrashed().orderBy('name', 'asc'),
      Location.query().orderBy('name', 'asc'),
    ])

    let prefilledVariant: Variant | null = null
    if (variantId) {
      const v = await Variant.query()
        .where('id', variantId)
        .preload('color')
        .preload('size')
        .preload('product', (p) => p.preload('category'))
        .first()
      // Only honor the prefill when it's actually a wildcard variant —
      // otherwise the page would land in an unresolvable state and the
      // operator would have to clear it manually.
      if (v?.product?.isWildcard) prefilledVariant = v
    }

    return inertia.render('stock/convert', {
      categories: CategoryTransformer.transform(categories),
      locations: LocationTransformer.transform(locations),
      prefilledVariant: prefilledVariant ? VariantTransformer.transform(prefilledVariant) : null,
      prefilledLocationId: locationId,
    })
  }

  /**
   * Apply a wildcard → printed conversion. The service writes both
   * StockMovements atomically; we only translate its errors into a flash
   * for the redirect-back path.
   */
  async convert({ request, response, session, auth }: HttpContext) {
    const payload = await request.validateUsing(convertWildcardValidator)
    const user = auth.getUserOrFail()

    try {
      const result = await new WildcardService().convert({
        wildcardVariantId: payload.wildcardVariantId,
        targetVariantId: payload.targetVariantId,
        locationId: payload.locationId,
        quantity: payload.quantity,
        userId: user.id,
      })
      session.flash(
        'success',
        `Converted ${payload.quantity} unit(s) — wildcard ${result.wildcardMovement.previousQuantity}→${result.wildcardMovement.newQuantity}, printed ${result.targetMovement.previousQuantity}→${result.targetMovement.newQuantity}.`
      )
      return response.redirect().toRoute('stock.index')
    } catch (error) {
      const message =
        error instanceof WildcardServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Conversion failed.'
      session.flash('error', message)
      return response.redirect().back()
    }
  }

  /**
   * JSON: for a given wildcard variant, list the printed products + their
   * matching variant id that can be the target of a conversion. Used by
   * the convert page's "target picker".
   */
  async wildcardTargets(ctx: HttpContext) {
    const { wildcardVariantId } = await wildcardTargetsParamsValidator.validate(
      ctx.request.params()
    )
    const matches = await new WildcardService().targetsForWildcardVariant(wildcardVariantId)
    // Resolve product transformers explicitly so the front-end sees the
    // same { data: [...] } envelope it already validates for other lookups.
    const resolvedProducts = await ctx.serialize.withoutWrapping(
      ProductTransformer.transform(matches.map((m) => m.product))
    )
    const targets = resolvedProducts.map((p: { id: number }, i: number) => ({
      product: p,
      targetVariantId: matches[i].targetVariantId,
    }))
    return ctx.response.json({ data: targets })
  }

  /**
   * Returns every variant of a product (optionally narrowed by color)
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
    const { colorId } = await stockLookupGridQueryValidator.validate(ctx.request.qs())

    const variantsQuery = Variant.query()
      .where('product_id', productId)
      .preload('color')
      .preload('size')
      .preload('product', (p) => p.preload('category'))

    if (colorId !== undefined) variantsQuery.where('color_id', colorId)

    const variants = await variantsQuery
    variants.sort((a, b) => {
      const sa = a.size?.sortOrder ?? 0
      const sb = b.size?.sortOrder ?? 0
      if (sa !== sb) return sa - sb
      return (a.size?.name ?? '').localeCompare(b.size?.name ?? '')
    })

    const variantIds = variants.map((v) => v.id)
    const stocks = variantIds.length
      ? await Stock.query().where('location_id', locationId).whereIn('variant_id', variantIds)
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
