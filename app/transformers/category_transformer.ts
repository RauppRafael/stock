import { BaseTransformer } from '@adonisjs/core/transformers'
import type Category from '#models/category'

export default class CategoryTransformer extends BaseTransformer<Category> {
  toObject() {
    const c = this.resource
    return {
      ...this.pick(c, ['id', 'name', 'icon']),
      // MySQL returns BOOLEAN columns as 0/1 — coerce so the front-end can
      // rely on `=== true` checks, not just truthiness.
      hasColor: Boolean(c.hasColor),
      hasSize: Boolean(c.hasSize),
    }
  }
}
