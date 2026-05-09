import { BaseTransformer } from '@adonisjs/core/transformers'
import type Product from '#models/product'
import CategoryTransformer from '#transformers/category_transformer'

export default class ProductTransformer extends BaseTransformer<Product> {
  toObject() {
    const p = this.resource
    return {
      ...this.pick(p, ['id', 'name', 'code', 'description', 'lowStockThreshold', 'categoryId']),
      category: p.category ? CategoryTransformer.transform(p.category).depth(6) : null,
    }
  }
}
