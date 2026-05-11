import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Location from '#models/location'
import Product from '#models/product'
import StockMovement from '#models/stock_movement'
import User from '#models/user'
import StockMovementTransformer from '#transformers/stock_movement_transformer'
import LocationTransformer from '#transformers/location_transformer'
import ProductTransformer from '#transformers/product_transformer'
import UserTransformer from '#transformers/user_transformer'
import { stockMovementFiltersValidator } from '#validators/stock_movement'

const PER_PAGE = 25

export default class StockMovementsController {
  async index({ inertia, request }: HttpContext) {
    const filters = await stockMovementFiltersValidator.validate(request.qs())

    const query = StockMovement.query()
      .preload('variant', (v) =>
        v
          .preload('color')
          .preload('size')
          .preload('product', (p) => p.preload('category'))
      )
      .preload('location')
      .preload('user')
      .orderBy('created_at', 'desc')

    if (filters.locationId) query.where('location_id', filters.locationId)
    if (filters.userId) query.where('user_id', filters.userId)
    if (filters.variantId) query.where('variant_id', filters.variantId)
    if (filters.productId) {
      query.whereHas('variant', (v) => v.where('product_id', filters.productId!))
    }

    const fromDt = filters.from ? DateTime.fromISO(filters.from) : null
    const toDt = filters.to ? DateTime.fromISO(filters.to) : null
    if (fromDt && fromDt.isValid) query.where('created_at', '>=', fromDt.toSQL()!)
    if (toDt && toDt.isValid) query.where('created_at', '<=', toDt.endOf('day').toSQL()!)

    const page = filters.page ?? 1
    const result = await query.paginate(page, PER_PAGE)

    const [products, locations, users] = await Promise.all([
      Product.notTrashed().orderBy('name', 'asc'),
      Location.query().orderBy('name', 'asc'),
      User.query().orderBy('email', 'asc'),
    ])

    return inertia.render('movements/index', {
      movements: StockMovementTransformer.transform(result.all()),
      pagination: {
        page: result.currentPage,
        perPage: result.perPage,
        total: result.total,
        lastPage: result.lastPage,
      },
      locations: LocationTransformer.transform(locations),
      products: ProductTransformer.transform(products),
      users: UserTransformer.transform(users),
      filters: {
        from: filters.from ?? null,
        to: filters.to ?? null,
        productId: filters.productId ?? null,
        variantId: filters.variantId ?? null,
        locationId: filters.locationId ?? null,
        userId: filters.userId ?? null,
      },
    })
  }
}
