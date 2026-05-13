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

/**
 * Cross-field validation for the wildcard fields. The basic shape (types +
 * `exists`) is done by the validator; here we layer the relationships:
 *
 *   - mutual exclusion: a product can be either wildcard *or* derive from
 *     one, never both
 *   - same category: a wildcard source must share the printed product's
 *     category (otherwise their variant axes can disagree)
 *   - source-is-actually-a-wildcard: pointing `wildcardId` at a non-wildcard
 *     product is meaningless and would corrupt the Shopify-push math
 *   - no self-reference (on update)
 *
 * Returns a `Record<field, message>` of errors. Empty means the payload is
 * good to write.
 */
async function validateWildcardFields(input: {
  selfId: number | null
  categoryId: number
  isWildcard: boolean | undefined
  wildcardId: number | null | undefined
}): Promise<Record<string, string>> {
  const errors: Record<string, string> = {}
  if (input.isWildcard === true && input.wildcardId) {
    errors.wildcardId = 'A wildcard product cannot also derive from another wildcard.'
    return errors
  }
  if (input.wildcardId === null || input.wildcardId === undefined) return errors
  if (input.selfId !== null && input.wildcardId === input.selfId) {
    errors.wildcardId = 'A product cannot reference itself as its own wildcard source.'
    return errors
  }
  const source = await Product.notTrashed().where('id', input.wildcardId).first()
  if (!source) {
    errors.wildcardId = 'Wildcard source not found.'
    return errors
  }
  if (!source.isWildcard) {
    errors.wildcardId = 'Selected source is not a wildcard product.'
    return errors
  }
  if (Number(source.categoryId) !== Number(input.categoryId)) {
    errors.wildcardId = 'Wildcard source must be in the same category.'
    return errors
  }
  return errors
}

export default class ProductsController {
  async index({ inertia, request }: HttpContext) {
    const categoryId = request.input('categoryId') ? Number(request.input('categoryId')) : undefined
    const search = request.input('search', '').toString().trim()

    const query = Product.notTrashed()
      .preload('category')
      .withCount('variants')
      .withCount('derivatives')
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

  async create({ inertia, request }: HttpContext) {
    const [categories, colors, sizes, wildcards] = await Promise.all([
      Category.notTrashed().orderBy('name', 'asc'),
      Color.query().orderBy('name', 'asc'),
      Size.query().orderBy('sort_order', 'asc'),
      // Surface wildcards so the form's "derive from wildcard" picker has
      // something to show. Preload category for the same-category check the
      // front-end performs to narrow the list.
      Product.notTrashed().where('is_wildcard', true).preload('category').orderBy('name', 'asc'),
    ])
    const prefilledCategoryId = request.input('categoryId')
      ? Number(request.input('categoryId'))
      : null
    return inertia.render('products/create', {
      categories: CategoryTransformer.transform(categories),
      colors: ColorTransformer.transform(colors),
      sizes: SizeTransformer.transform(sizes),
      wildcards: ProductTransformer.transform(wildcards),
      prefilledCategoryId,
    })
  }

  async store({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(createProductValidator)
    const category = await Category.findOrFail(payload.categoryId)

    const fieldErrors = await validateWildcardFields({
      selfId: null,
      categoryId: payload.categoryId,
      isWildcard: payload.isWildcard,
      wildcardId: payload.wildcardId ?? null,
    })
    if (Object.keys(fieldErrors).length) {
      session.flashErrors(fieldErrors)
      session.flashAll()
      return response.redirect().back()
    }

    const product = await Product.create({
      name: payload.name,
      code: payload.code,
      categoryId: payload.categoryId,
      description: payload.description ?? null,
      lowStockThreshold: payload.lowStockThreshold ?? null,
      isWildcard: payload.isWildcard ?? false,
      // Wildcards never have a source; the validator + cross-field check
      // would already have rejected that combo, but we belt-and-braces here
      // for any future code path that bypasses store().
      wildcardId: payload.isWildcard ? null : (payload.wildcardId ?? null),
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
      .preload('wildcardSource')
      // Preload `derivatives` for wildcards so the show page can list the
      // printed products that fan out from this blank. Cheap query: a single
      // self-join filtered by the small wildcard set.
      .preload('derivatives', (q) => q.whereNull('deleted_at').orderBy('name', 'asc'))
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
      derivatives: ProductTransformer.transform(product.derivatives ?? []),
    })
  }

  async edit({ inertia, params }: HttpContext) {
    const product = await Product.notTrashed()
      .where('id', Number(params.id))
      .preload('category')
      .preload('wildcardSource')
      .withCount('derivatives')
      .preload('variants', (q) => q.preload('color').preload('size'))
      .firstOrFail()

    const [colors, sizes, wildcards] = await Promise.all([
      Color.query().orderBy('name', 'asc'),
      Size.query().orderBy('sort_order', 'asc'),
      // Wildcards in the same category, excluding self (can't be your own
      // source). Pre-narrowed here instead of client-side filtering so the
      // edit page picker is honest about its options.
      Product.notTrashed()
        .where('is_wildcard', true)
        .where('category_id', product.categoryId)
        .whereNot('id', product.id)
        .preload('category')
        .orderBy('name', 'asc'),
    ])

    return inertia.render('products/edit', {
      product: ProductTransformer.transform(product),
      variants: VariantTransformer.transform(product.variants),
      colors: ColorTransformer.transform(colors),
      sizes: SizeTransformer.transform(sizes),
      wildcards: ProductTransformer.transform(wildcards),
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

    const fieldErrors = await validateWildcardFields({
      selfId: product.id,
      categoryId: product.categoryId,
      isWildcard: payload.isWildcard,
      wildcardId: payload.wildcardId ?? null,
    })
    // Toggling `is_wildcard` off is only safe when nothing else references
    // this product as its wildcard source. We check it here (vs. inside
    // `validateWildcardFields`) because it depends on the *previous* state,
    // which the create flow can never observe.
    if (payload.isWildcard === false && product.isWildcard === true && !fieldErrors.wildcardId) {
      const referencing = await Product.notTrashed()
        .where('wildcard_id', product.id)
        .count('* as total')
        .first()
      const total = Number(referencing?.$extras?.total ?? 0)
      if (total > 0) {
        fieldErrors.isWildcard = `Cannot turn off wildcard while ${total} product(s) reference it. Remove the wildcard source on those products first.`
      }
    }
    if (Object.keys(fieldErrors).length) {
      session.flashErrors(fieldErrors)
      session.flashAll()
      return response.redirect().back()
    }

    product.merge({
      name: payload.name,
      code: payload.code,
      description: payload.description ?? null,
      lowStockThreshold: payload.lowStockThreshold ?? null,
      // Only overwrite the wildcard fields when the form supplied them
      // (every form does today, but `payload.*` is optional in the
      // validator so we stay defensive).
      ...(payload.isWildcard !== undefined ? { isWildcard: payload.isWildcard } : {}),
      ...(payload.isWildcard
        ? { wildcardId: null }
        : payload.wildcardId !== undefined
          ? { wildcardId: payload.wildcardId }
          : {}),
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
    // Wildcards with active derivatives can't be archived — the FK is
    // RESTRICT, so the trash() call would succeed at the soft-delete level
    // but leave derivative products pointing at a soft-deleted parent. We
    // surface this explicitly instead.
    if (product.isWildcard) {
      const refs = await Product.notTrashed()
        .where('wildcard_id', product.id)
        .count('* as total')
        .first()
      const total = Number(refs?.$extras?.total ?? 0)
      if (total > 0) {
        session.flash(
          'error',
          `Cannot archive wildcard "${product.name}" — ${total} product(s) still derive from it.`
        )
        return response.redirect().back()
      }
    }
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
