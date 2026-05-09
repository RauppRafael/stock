import { BaseTransformer } from '@adonisjs/core/transformers'
import type Location from '#models/location'

export default class LocationTransformer extends BaseTransformer<Location> {
  toObject() {
    return this.pick(this.resource, ['id', 'name', 'description'])
  }
}
