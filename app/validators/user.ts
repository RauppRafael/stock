import vine from '@vinejs/vine'

const email = () => vine.string().trim().email().maxLength(254)
const password = () => vine.string().minLength(8).maxLength(72)
const fullName = () => vine.string().trim().minLength(1).maxLength(150)

export const createUserValidator = vine.compile(
  vine.object({
    fullName: fullName(),
    email: email().unique({ table: 'users', column: 'email' }),
    password: password(),
  })
)

export const updateUserValidator = vine.withMetaData<{ id: number }>().compile(
  vine.object({
    fullName: fullName().optional(),
    email: email()
      .unique(async (db, value, field) => {
        const row = await db
          .from('users')
          .where('email', value)
          .whereNot('id', field.meta.id)
          .first()
        return !row
      })
      .optional(),
    password: password().optional(),
  })
)
