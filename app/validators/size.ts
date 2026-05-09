import vine from '@vinejs/vine'

const fields = {
  name: vine.string().trim().minLength(1).maxLength(40),
  code: vine
    .string()
    .trim()
    .minLength(1)
    .maxLength(8)
    .regex(/^[A-Z0-9]+$/),
  sortOrder: vine.number().withoutDecimals().min(0).max(9999),
}

export const createSizeValidator = vine.compile(
  vine.object({
    ...fields,
    name: fields.name.unique({ table: 'sizes', column: 'name' }),
    code: fields.code.unique({ table: 'sizes', column: 'code' }),
  })
)

export const updateSizeValidator = vine.withMetaData<{ id: number }>().compile(
  vine.object({
    ...fields,
    name: fields.name.unique(async (db, value, field) => {
      const row = await db
        .from('sizes')
        .where('name', value)
        .whereNot('id', field.meta.id)
        .first()
      return !row
    }),
    code: fields.code.unique(async (db, value, field) => {
      const row = await db
        .from('sizes')
        .where('code', value)
        .whereNot('id', field.meta.id)
        .first()
      return !row
    }),
  })
)
