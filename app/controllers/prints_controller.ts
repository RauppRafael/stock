import type { HttpContext } from '@adonisjs/core/http'
import Print from '#models/print'
import PrintTransformer from '#transformers/print_transformer'
import { createPrintValidator, updatePrintValidator } from '#validators/print'

export default class PrintsController {
  async index({ inertia }: HttpContext) {
    const prints = await Print.query().orderBy('name', 'asc')
    return inertia.render('catalog/prints/index', {
      prints: PrintTransformer.transform(prints),
    })
  }

  async store({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(createPrintValidator)
    await Print.create(payload)
    session.flash('success', 'Print created.')
    return response.redirect().toRoute('prints.index')
  }

  async update({ request, response, session, params }: HttpContext) {
    const print = await Print.findOrFail(Number(params.id))
    const payload = await request.validateUsing(updatePrintValidator, {
      meta: { id: print.id },
    })
    print.merge(payload)
    await print.save()
    session.flash('success', 'Print updated.')
    return response.redirect().toRoute('prints.index')
  }

  async destroy({ response, session, params }: HttpContext) {
    const print = await Print.findOrFail(Number(params.id))
    await print.delete()
    session.flash('success', 'Print deleted.')
    return response.redirect().toRoute('prints.index')
  }
}
