import vine from '@vinejs/vine'

const fields = {
  name: vine.string().trim().minLength(1).maxLength(80),
  code: vine
    .string()
    .trim()
    .minLength(1)
    .maxLength(8)
    .regex(/^[A-Z0-9]+$/),
  hexCode: vine
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .optional(),
}

export const createColorValidator = vine.compile(
  vine.object({
    ...fields,
    name: fields.name.unique({ table: 'colors', column: 'name' }),
    code: fields.code.unique({ table: 'colors', column: 'code' }),
  })
)

export const updateColorValidator = vine.withMetaData<{ id: number }>().compile(
  vine.object({
    ...fields,
    name: fields.name.unique(async (db, value, field) => {
      const row = await db
        .from('colors')
        .where('name', value)
        .whereNot('id', field.meta.id)
        .first()
      return !row
    }),
    code: fields.code.unique(async (db, value, field) => {
      const row = await db
        .from('colors')
        .where('code', value)
        .whereNot('id', field.meta.id)
        .first()
      return !row
    }),
  })
)
