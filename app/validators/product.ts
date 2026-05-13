import vine from '@vinejs/vine'

const positiveInt = () => vine.number().withoutDecimals().positive()

const productCode = () =>
  vine
    .string()
    .trim()
    .minLength(1)
    .maxLength(16)
    .regex(/^[A-Z0-9]+$/)

/**
 * Wildcard fields live here as pure shape + `exists` checks. The richer
 * cross-field rules — mutual exclusion, same-category, self-reference,
 * toggle-off-while-in-use — live in `products_controller.ts` so they can
 * flash field-specific errors and run with full request context. Keeping
 * them out of the validator avoids re-implementing Vine's `createRule`
 * plumbing for what is fundamentally controller logic.
 */
export const createProductValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(150),
    code: productCode().unique({ table: 'products', column: 'code' }),
    categoryId: positiveInt().exists({ table: 'categories', column: 'id' }),
    description: vine.string().trim().maxLength(2000).nullable().optional(),
    lowStockThreshold: vine.number().withoutDecimals().min(0).max(1_000_000).nullable().optional(),
    colorIds: vine.array(positiveInt().exists({ table: 'colors', column: 'id' })).optional(),
    sizeIds: vine.array(positiveInt().exists({ table: 'sizes', column: 'id' })).optional(),
    isWildcard: vine.boolean().optional(),
    wildcardId: positiveInt().exists({ table: 'products', column: 'id' }).nullable().optional(),
  })
)

export const updateProductValidator = vine.withMetaData<{ id: number }>().compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(150),
    code: productCode().unique(async (db, value, field) => {
      const row = await db
        .from('products')
        .where('code', value)
        .whereNot('id', field.meta.id)
        .first()
      return !row
    }),
    description: vine.string().trim().maxLength(2000).nullable().optional(),
    lowStockThreshold: vine.number().withoutDecimals().min(0).max(1_000_000).nullable().optional(),
    /**
     * On update we let users add new color/size combinations to the
     * product (the controller diffs against existing variants). Categories
     * are immutable after creation to keep variants coherent.
     */
    colorIds: vine.array(positiveInt().exists({ table: 'colors', column: 'id' })).optional(),
    sizeIds: vine.array(positiveInt().exists({ table: 'sizes', column: 'id' })).optional(),
    isWildcard: vine.boolean().optional(),
    wildcardId: positiveInt().exists({ table: 'products', column: 'id' }).nullable().optional(),
  })
)
