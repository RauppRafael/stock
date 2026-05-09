import type { HttpContext } from '@adonisjs/core/http'
import Size from '#models/size'
import SizeTransformer from '#transformers/size_transformer'
import { createSizeValidator, updateSizeValidator } from '#validators/size'

export default class SizesController {
  async index({ inertia }: HttpContext) {
    const sizes = await Size.query().orderBy('sort_order', 'asc').orderBy('name', 'asc')
    return inertia.render('catalog/sizes/index', {
      sizes: SizeTransformer.transform(sizes),
    })
  }

  async store({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(createSizeValidator)
    await Size.create(payload)
    session.flash('success', 'Size created.')
    return response.redirect().toRoute('sizes.index')
  }

  async update({ request, response, session, params }: HttpContext) {
    const size = await Size.findOrFail(Number(params.id))
    const payload = await request.validateUsing(updateSizeValidator, { meta: { id: size.id } })
    size.merge(payload)
    await size.save()
    session.flash('success', 'Size updated.')
    return response.redirect().toRoute('sizes.index')
  }

  async destroy({ response, session, params }: HttpContext) {
    const size = await Size.findOrFail(Number(params.id))
    await size.delete()
    session.flash('success', 'Size deleted.')
    return response.redirect().toRoute('sizes.index')
  }
}
