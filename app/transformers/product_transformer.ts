import { BaseTransformer } from '@adonisjs/core/transformers'
import type Product from '#models/product'
import CategoryTransformer from '#transformers/category_transformer'

/**
 * Slim summary returned when this product was preloaded as another
 * product's `wildcardSource`. Kept narrow so an "edit printed product"
 * page can render "comes from: <wildcard>" without dragging the wildcard's
 * full variant graph along.
 */
type WildcardSourceSummary = {
  id: number
  name: string
  code: string
}

export default class ProductTransformer extends BaseTransformer<Product> {
  toObject() {
    const p = this.resource
    // `variants_count` is populated by `.withCount('variants')`. When variants
    // are eagerly preloaded instead, fall back to the array length. Otherwise
    // the field is null so consumers can tell "not loaded" from "zero".
    const rawCount = p.$extras?.variants_count
    const variantCount =
      rawCount !== undefined && rawCount !== null
        ? Number(rawCount)
        : Array.isArray(p.variants)
          ? p.variants.length
          : null

    // `derivatives_count` mirrors the same pattern. Used by the products
    // list / show pages to render "N printed products derived from this
    // wildcard" without an additional query.
    const rawDerivativesCount = p.$extras?.derivatives_count
    const derivativesCount =
      rawDerivativesCount !== undefined && rawDerivativesCount !== null
        ? Number(rawDerivativesCount)
        : Array.isArray(p.derivatives)
          ? p.derivatives.length
          : null

    const wildcardSource: WildcardSourceSummary | null = p.wildcardSource
      ? { id: p.wildcardSource.id, name: p.wildcardSource.name, code: p.wildcardSource.code }
      : null

    return {
      ...this.pick(p, [
        'id',
        'name',
        'code',
        'description',
        'lowStockThreshold',
        'categoryId',
        'imageUrl',
        'wildcardId',
      ]),
      // MySQL returns BOOLEAN columns as 0/1 — coerce so the front-end
      // contracts (which expect a true boolean) parse cleanly.
      isWildcard: Boolean(p.isWildcard),
      variantCount,
      derivativesCount,
      wildcardSource,
      category: p.category ? CategoryTransformer.transform(p.category).depth(6) : null,
    }
  }
}
