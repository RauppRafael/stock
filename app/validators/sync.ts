import vine from '@vinejs/vine'

/**
 * Each entry pairs one local variant with the Shopify variants to attach.
 * Multiple Shopify GIDs per local supports the duplicate-product case (same
 * SKU mirrored on Shopify with different photography).
 */
export const syncLinkValidator = vine.compile(
  vine.object({
    requests: vine
      .array(
        vine.object({
          localVariantId: vine
            .number()
            .withoutDecimals()
            .positive()
            .exists({ table: 'variants', column: 'id' }),
          shopifyVariantIds: vine
            .array(vine.string().trim().minLength(1).maxLength(64))
            .minLength(1),
        })
      )
      .minLength(1),
  })
)

export const syncPushValidator = vine.compile(
  vine.object({
    variantIds: vine
      .array(vine.number().withoutDecimals().positive().exists({ table: 'variants', column: 'id' }))
      .minLength(1),
  })
)

export const syncPullValidator = vine.compile(
  vine.object({
    applications: vine
      .array(
        vine.object({
          localVariantId: vine
            .number()
            .withoutDecimals()
            .positive()
            .exists({ table: 'variants', column: 'id' }),
          locationId: vine
            .number()
            .withoutDecimals()
            .positive()
            .exists({ table: 'locations', column: 'id' }),
        })
      )
      .minLength(1),
  })
)

/**
 * Remove existing pairings. Keyed by Shopify variant GID, which is UNIQUE
 * in `shopify_variant_links` so we can target rows unambiguously without
 * needing the local variant id.
 */
export const syncUnlinkValidator = vine.compile(
  vine.object({
    shopifyVariantIds: vine.array(vine.string().trim().minLength(1).maxLength(64)).minLength(1),
  })
)
