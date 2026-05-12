import { BaseTransformer } from '@adonisjs/core/transformers'
import type Product from '#models/product'
import CategoryTransformer from '#transformers/category_transformer'

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
    return {
      ...this.pick(p, [
        'id',
        'name',
        'code',
        'description',
        'lowStockThreshold',
        'categoryId',
        'imageUrl',
      ]),
      variantCount,
      category: p.category ? CategoryTransformer.transform(p.category).depth(6) : null,
    }
  }
}
