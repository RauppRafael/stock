import vine from '@vinejs/vine'

const fields = {
  name: vine.string().trim().minLength(1).maxLength(80),
  code: vine
    .string()
    .trim()
    .minLength(1)
    .maxLength(8)
    .regex(/^[A-Z0-9]+$/),
}

export const createPrintValidator = vine.compile(
  vine.object({
    name: fields.name.clone().unique({ table: 'prints', column: 'name' }),
    code: fields.code.clone().unique({ table: 'prints', column: 'code' }),
  })
)

export const updatePrintValidator = vine.withMetaData<{ id: number }>().compile(
  vine.object({
    name: fields.name.clone().unique(async (db, value, field) => {
      const row = await db
        .from('prints')
        .where('name', value)
        .whereNot('id', field.meta.id)
        .first()
      return !row
    }),
    code: fields.code.clone().unique(async (db, value, field) => {
      const row = await db
        .from('prints')
        .where('code', value)
        .whereNot('id', field.meta.id)
        .first()
      return !row
    }),
  })
)
