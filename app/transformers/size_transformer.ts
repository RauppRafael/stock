import { BaseTransformer } from '@adonisjs/core/transformers'
import type Size from '#models/size'

export default class SizeTransformer extends BaseTransformer<Size> {
  toObject() {
    return this.pick(this.resource, ['id', 'name', 'code', 'sortOrder'])
  }
}
