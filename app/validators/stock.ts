import vine from '@vinejs/vine'

export const adjustStockValidator = vine.compile(
  vine.object({
    variantId: vine
      .number()
      .withoutDecimals()
      .positive()
      .exists({ table: 'variants', column: 'id' }),
    locationId: vine
      .number()
      .withoutDecimals()
      .positive()
      .exists({ table: 'locations', column: 'id' }),
    newQuantity: vine.number().withoutDecimals().min(0).max(1_000_000),
    reason: vine.string().trim().maxLength(1000).nullable().optional(),
  })
)

export const bulkAdjustStockValidator = vine.compile(
  vine.object({
    locationId: vine
      .number()
      .withoutDecimals()
      .positive()
      .exists({ table: 'locations', column: 'id' }),
    adjustments: vine
      .array(
        vine.object({
          variantId: vine
            .number()
            .withoutDecimals()
            .positive()
            .exists({ table: 'variants', column: 'id' }),
          newQuantity: vine.number().withoutDecimals().min(0).max(1_000_000),
        })
      )
      .minLength(1),
    reason: vine.string().trim().maxLength(1000).nullable().optional(),
  })
)

export const stockLookupGridParamsValidator = vine.compile(
  vine.object({
    productId: vine.number().withoutDecimals().positive(),
    locationId: vine.number().withoutDecimals().positive(),
  })
)

export const stockLookupGridQueryValidator = vine.compile(
  vine.object({
    colorId: vine.number().withoutDecimals().positive().optional(),
  })
)

export const stockIndexFiltersValidator = vine.compile(
  vine.object({
    categoryId: vine.number().withoutDecimals().positive().optional(),
    productId: vine.number().withoutDecimals().positive().optional(),
    locationId: vine.number().withoutDecimals().positive().optional(),
    stockStatus: vine.enum(['all', 'inStock', 'outOfStock'] as const).optional(),
  })
)

export const stockLookupVariantParamsValidator = vine.compile(
  vine.object({
    variantId: vine.number().withoutDecimals().positive(),
    locationId: vine.number().withoutDecimals().positive(),
  })
)

export const stockLookupCategoryParamsValidator = vine.compile(
  vine.object({
    categoryId: vine.number().withoutDecimals().positive(),
  })
)

export const stockLookupProductParamsValidator = vine.compile(
  vine.object({
    productId: vine.number().withoutDecimals().positive(),
  })
)

/**
 * Convert-page payload. We re-check the business invariants inside
 * `WildcardService.convert` (so the service is safe even when called
 * directly), but enforcing positive ints + existence here gets the obvious
 * mistakes out of the way before we open a transaction.
 */
export const convertWildcardValidator = vine.compile(
  vine.object({
    wildcardVariantId: vine
      .number()
      .withoutDecimals()
      .positive()
      .exists({ table: 'variants', column: 'id' }),
    targetVariantId: vine
      .number()
      .withoutDecimals()
      .positive()
      .exists({ table: 'variants', column: 'id' }),
    locationId: vine
      .number()
      .withoutDecimals()
      .positive()
      .exists({ table: 'locations', column: 'id' }),
    quantity: vine.number().withoutDecimals().min(1).max(1_000_000),
  })
)

export const wildcardTargetsParamsValidator = vine.compile(
  vine.object({
    wildcardVariantId: vine.number().withoutDecimals().positive(),
  })
)
