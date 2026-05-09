import { BaseTransformer } from '@adonisjs/core/transformers'
import type Color from '#models/color'

export default class ColorTransformer extends BaseTransformer<Color> {
  toObject() {
    return this.pick(this.resource, ['id', 'name', 'code', 'hexCode'])
  }
}
