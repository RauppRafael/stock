import type { HttpContext } from '@adonisjs/core/http'
import Location from '#models/location'
import LocationTransformer from '#transformers/location_transformer'
import { createLocationValidator, updateLocationValidator } from '#validators/location'

export default class LocationsController {
  async index({ inertia }: HttpContext) {
    const locations = await Location.query().orderBy('name', 'asc')
    return inertia.render('catalog/locations/index', {
      locations: LocationTransformer.transform(locations),
    })
  }

  async store({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(createLocationValidator)
    await Location.create(payload)
    session.flash('success', 'Location created.')
    return response.redirect().toRoute('locations.index')
  }

  async update({ request, response, session, params }: HttpContext) {
    const location = await Location.findOrFail(Number(params.id))
    const payload = await request.validateUsing(updateLocationValidator, {
      meta: { id: location.id },
    })
    location.merge(payload)
    await location.save()
    session.flash('success', 'Location updated.')
    return response.redirect().toRoute('locations.index')
  }

  async destroy({ response, session, params }: HttpContext) {
    const location = await Location.findOrFail(Number(params.id))
    await location.delete()
    session.flash('success', 'Location deleted.')
    return response.redirect().toRoute('locations.index')
  }
}
