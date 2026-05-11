import { BaseTransformer } from '@adonisjs/core/transformers'
import type Variant from '#models/variant'
import ProductTransformer from '#transformers/product_transformer'
import ColorTransformer from '#transformers/color_transformer'
import SizeTransformer from '#transformers/size_transformer'

export default class VariantTransformer extends BaseTransformer<Variant> {
  toObject() {
    const v = this.resource
    return {
      ...this.pick(v, ['id', 'productId', 'colorId', 'sizeId', 'skuCode', 'displayName']),
      product: v.product ? ProductTransformer.transform(v.product).depth(6) : null,
      color: v.color ? ColorTransformer.transform(v.color).depth(6) : null,
      size: v.size ? SizeTransformer.transform(v.size).depth(6) : null,
    }
  }
}
