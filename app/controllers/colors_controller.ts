import type { HttpContext } from '@adonisjs/core/http'
import Color from '#models/color'
import ColorTransformer from '#transformers/color_transformer'
import { createColorValidator, updateColorValidator } from '#validators/color'

export default class ColorsController {
  async index({ inertia }: HttpContext) {
    const colors = await Color.query().orderBy('name', 'asc')
    return inertia.render('catalog/colors/index', {
      colors: ColorTransformer.transform(colors),
    })
  }

  async store({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(createColorValidator)
    await Color.create(payload)
    session.flash('success', 'Color created.')
    return response.redirect().toRoute('colors.index')
  }

  async update({ request, response, session, params }: HttpContext) {
    const color = await Color.findOrFail(Number(params.id))
    const payload = await request.validateUsing(updateColorValidator, {
      meta: { id: color.id },
    })
    color.merge(payload)
    await color.save()
    session.flash('success', 'Color updated.')
    return response.redirect().toRoute('colors.index')
  }

  async destroy({ response, session, params }: HttpContext) {
    const color = await Color.findOrFail(Number(params.id))
    await color.delete()
    session.flash('success', 'Color deleted.')
    return response.redirect().toRoute('colors.index')
  }
}
