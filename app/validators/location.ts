import vine from '@vinejs/vine'
import { EMOJI_PATTERN } from '#validators/emoji'

const fields = {
  name: vine.string().trim().minLength(1).maxLength(100),
  description: vine.string().trim().maxLength(1000).nullable().optional(),
  icon: vine.string().trim().minLength(1).maxLength(8).regex(EMOJI_PATTERN).nullable().optional(),
}

export const createLocationValidator = vine.compile(
  vine.object({
    ...fields,
    name: fields.name.clone().unique({ table: 'locations', column: 'name' }),
  })
)

export const updateLocationValidator = vine.withMetaData<{ id: number }>().compile(
  vine.object({
    ...fields,
    name: fields.name.clone().unique(async (db, value, field) => {
      const row = await db
        .from('locations')
        .where('name', value)
        .whereNot('id', field.meta.id)
        .first()
      return !row
    }),
  })
)
