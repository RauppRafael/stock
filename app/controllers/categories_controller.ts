import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/category'
import Product from '#models/product'
import CategoryTransformer from '#transformers/category_transformer'
import { createCategoryValidator, updateCategoryValidator } from '#validators/category'

export default class CategoriesController {
  async index({ inertia }: HttpContext) {
    const categories = await Category.notTrashed().orderBy('name', 'asc')
    return inertia.render('catalog/categories/index', {
      categories: CategoryTransformer.transform(categories),
    })
  }

  async store({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(createCategoryValidator)
    await Category.create(payload)
    session.flash('success', 'Category created.')
    return response.redirect().toRoute('categories.index')
  }

  async update({ request, response, session, params }: HttpContext) {
    const category = await Category.findOrFail(Number(params.id))
    const payload = await request.validateUsing(updateCategoryValidator, {
      meta: { id: category.id },
    })
    category.merge(payload)
    await category.save()
    session.flash('success', 'Category updated.')
    return response.redirect().toRoute('categories.index')
  }

  async destroy({ response, session, params }: HttpContext) {
    const category = await Category.findOrFail(Number(params.id))
    const activeCount = await Product.query()
      .where('category_id', category.id)
      .whereNull('deleted_at')
      .count('* as total')
      .first()
    if (activeCount && Number(activeCount.$extras.total) > 0) {
      session.flash('error', 'Cannot archive a category with active products.')
      return response.redirect().toRoute('categories.index')
    }
    await category.trash()
    session.flash('success', 'Category archived.')
    return response.redirect().toRoute('categories.index')
  }
}
