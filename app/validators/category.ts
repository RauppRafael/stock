import vine from '@vinejs/vine'

const fields = {
  name: vine.string().trim().minLength(1).maxLength(100),
  icon: vine.string().trim().minLength(1).maxLength(8).nullable().optional(),
  hasColor: vine.boolean(),
  hasPrint: vine.boolean(),
  hasSize: vine.boolean(),
}

export const createCategoryValidator = vine.compile(
  vine.object({
    ...fields,
    name: fields.name.unique({ table: 'categories', column: 'name' }),
  })
)

export const updateCategoryValidator = vine.withMetaData<{ id: number }>().compile(
  vine.object({
    ...fields,
    name: fields.name.unique(async (db, value, field) => {
      const row = await db
        .from('categories')
        .where('name', value)
        .whereNot('id', field.meta.id)
        .first()
      return !row
    }),
  })
)
