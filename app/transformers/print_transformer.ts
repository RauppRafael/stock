import { BaseTransformer } from '@adonisjs/core/transformers'
import type Print from '#models/print'

export default class PrintTransformer extends BaseTransformer<Print> {
  toObject() {
    return this.pick(this.resource, ['id', 'name', 'code'])
  }
}
