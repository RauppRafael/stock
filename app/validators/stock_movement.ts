import vine from '@vinejs/vine'

export const stockMovementFiltersValidator = vine.compile(
  vine.object({
    from: vine.string().optional(),
    to: vine.string().optional(),
    productId: vine.number().withoutDecimals().positive().optional(),
    variantId: vine.number().withoutDecimals().positive().optional(),
    locationId: vine.number().withoutDecimals().positive().optional(),
    userId: vine.number().withoutDecimals().positive().optional(),
    page: vine.number().withoutDecimals().min(1).optional(),
  })
)
