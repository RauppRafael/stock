import { z } from 'zod'

/**
 * Wire-shape contracts for everything the back-end ships to the front-end.
 *
 * These are the source of truth for what the SPA expects to receive in
 * Inertia props and JSON responses. The corresponding back-end transformers
 * (`app/transformers/*_transformer.ts`) MUST produce values that satisfy
 * these schemas — pages call `Schema.parse(props)` at mount time so
 * back/front drift fails loudly at the boundary instead of silently
 * surfacing as `undefined` deep inside a template.
 *
 * Validation here is intentionally permissive on shape (we don't enforce
 * positive integers, unique constraints, etc. — that's the back-end's job
 * via VineJS). It only asserts the JSON-serialized type contract.
 */

const id = z.number().int().nonnegative()

export const colorSchema = z.object({
  id,
  name: z.string(),
  code: z.string(),
  hexCode: z.string().nullable(),
})
export type Color = z.infer<typeof colorSchema>

export const sizeSchema = z.object({
  id,
  name: z.string(),
  code: z.string(),
  sortOrder: z.number().int(),
})
export type Size = z.infer<typeof sizeSchema>

export const locationSchema = z.object({
  id,
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
})
export type Location = z.infer<typeof locationSchema>

export const categorySchema = z.object({
  id,
  name: z.string(),
  icon: z.string().nullable(),
  hasColor: z.boolean(),
  hasSize: z.boolean(),
})
export type Category = z.infer<typeof categorySchema>

export const wildcardSourceSummarySchema = z.object({
  id,
  name: z.string(),
  code: z.string(),
})
export type WildcardSourceSummary = z.infer<typeof wildcardSourceSummarySchema>

export const productSchema = z.object({
  id,
  name: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  lowStockThreshold: z.number().int().nullable(),
  categoryId: id,
  imageUrl: z.string().nullable(),
  isWildcard: z.boolean(),
  // The blank a printed product derives from. Null when this product is a
  // standalone catalog item or is itself a wildcard.
  wildcardId: id.nullable(),
  // Slim summary, only present when the back-end preloaded `wildcardSource`.
  wildcardSource: wildcardSourceSummarySchema.nullable(),
  variantCount: z.number().int().nullable(),
  // Number of printed products derived from this wildcard. Null when not
  // loaded; 0 when loaded with no derivatives.
  derivativesCount: z.number().int().nullable(),
  category: categorySchema.nullable(),
})
export type Product = z.infer<typeof productSchema>

export const variantSchema = z.object({
  id,
  productId: id,
  colorId: id.nullable(),
  sizeId: id.nullable(),
  skuCode: z.string().nullable(),
  displayName: z.string(),
  imageUrl: z.string().nullable(),
  product: productSchema.nullable(),
  color: colorSchema.nullable(),
  size: sizeSchema.nullable(),
})
export type Variant = z.infer<typeof variantSchema>

export const stockSchema = z.object({
  // Null when the row was synthesized server-side for a (variant, location)
  // pair that has never been adjusted — it isn't persisted yet, so there's
  // no primary key. Front-end keys off (variantId, locationId) instead.
  id: id.nullable(),
  variantId: id,
  locationId: id,
  quantity: z.number().int(),
  variant: variantSchema.nullable(),
  location: locationSchema.nullable(),
})
export type Stock = z.infer<typeof stockSchema>

export const userSchema = z.object({
  id,
  fullName: z.string(),
  email: z.string(),
  initials: z.string(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
})
export type User = z.infer<typeof userSchema>

export const stockMovementSchema = z.object({
  id,
  variantId: id,
  locationId: id,
  previousQuantity: z.number().int(),
  newQuantity: z.number().int(),
  delta: z.number().int(),
  reason: z.string().nullable(),
  userId: id.nullable(),
  source: z.string(),
  createdAt: z.string().nullable(),
  variant: variantSchema.nullable(),
  location: locationSchema.nullable(),
  user: userSchema.nullable(),
})
export type StockMovement = z.infer<typeof stockMovementSchema>

/**
 * Helpers for paginated list shapes returned by the API.
 */
export const paginationSchema = z.object({
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  lastPage: z.number().int().nonnegative(),
})
export type Pagination = z.infer<typeof paginationSchema>

/**
 * `data: T` envelope for the JSON lookup endpoints (stock.lookup.*).
 */
export function dataEnvelope<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ data: schema })
}

/**
 * Per-size grid lookup payload — variants matching the (product, location,
 * color?) tuple paired with the on-hand quantity at that location.
 * Quantities are keyed by variant id and serialised as numeric strings on
 * the wire (JS object keys), so we accept either form.
 */
export const stockGridSchema = z.object({
  variants: z.array(variantSchema),
  quantities: z.record(z.string(), z.number().int()),
})
export type StockGrid = z.infer<typeof stockGridSchema>

/**
 * /sync page props. Diffs are rendered server-side from a single Shopify
 * catalog walk. `configured: false` short-circuits the whole UI to a setup
 * empty state. `link`/`push`/`pull` are nullable so a Shopify failure can
 * still render the page (with a flashed error) instead of 500ing.
 */
/**
 * A Shopify variant that's either already linked to a local variant or
 * available as a candidate to link. Shared shape across Link/Push/Pull
 * payloads.
 */
export const shopifyVariantInfoSchema = z.object({
  shopifyVariantId: z.string(),
  shopifyProductId: z.string(),
  shopifyProductTitle: z.string(),
  shopifyVariantTitle: z.string(),
  options: z.array(z.object({ name: z.string(), value: z.string() })),
  currentSku: z.string().nullable(),
  imageUrl: z.string().nullable(),
})

/**
 * Compact display data for a local variant — replaces the old flat
 * `displayName` / `sku` fields so the UI can render a color swatch + size
 * box matching the rest of the app.
 */
export const localVariantDisplaySchema = z.object({
  productName: z.string(),
  category: z.object({ id, name: z.string() }).nullable(),
  color: z
    .object({
      name: z.string(),
      hexCode: z.string().nullable(),
    })
    .nullable(),
  size: z.object({ name: z.string() }).nullable(),
  imageUrl: z.string().nullable(),
})

export const syncLinkRowSchema = z.object({
  localVariantId: id,
  localProductId: id,
  display: localVariantDisplaySchema,
  // Current Shopify pairings for this local variant. Empty array = unlinked.
  currentLinks: z.array(shopifyVariantInfoSchema),
})

export const syncLinkDiffSchema = z.object({
  rows: z.array(syncLinkRowSchema),
  // Shopify variants not yet linked to any local variant — pickable from the
  // "Add Shopify pairing" modal.
  candidates: z.array(shopifyVariantInfoSchema),
})

/**
 * Push row — one local variant whose total disagrees with one or more of its
 * Shopify mirrors. `targets` lists only the mirrors that disagree so the UI
 * can show exactly what's being changed.
 */
export const syncPushTargetSchema = z.object({
  shopifyVariantId: z.string(),
  shopifyProductTitle: z.string(),
  shopifyVariantTitle: z.string(),
  shopifyQuantity: z.number().int().nullable(),
})

export const syncPushRowSchema = z.object({
  localVariantId: id,
  display: localVariantDisplaySchema,
  // Effective total written to every linked Shopify mirror — printed
  // variant's own stock plus any wildcard pool contribution.
  localTotal: z.number().int(),
  wildcardPool: z.number().int(),
  targets: z.array(syncPushTargetSchema),
})

/**
 * Pull row — one local variant whose Shopify mirrors collectively decreased
 * (sales). `totalDecrement` is the sum of negative deltas across all mirrors
 * vs their last-known qty, applied to a local location chosen by the user.
 */
export const syncPullTargetSchema = z.object({
  shopifyVariantId: z.string(),
  shopifyProductTitle: z.string(),
  shopifyVariantTitle: z.string(),
  shopifyQuantity: z.number().int(),
  lastKnownQuantity: z.number().int().nullable(),
  delta: z.number().int(),
})

export const syncPullRowSchema = z.object({
  localVariantId: id,
  display: localVariantDisplaySchema,
  localTotal: z.number().int(),
  wildcardPool: z.number().int(),
  totalDecrement: z.number().int(),
  targets: z.array(syncPullTargetSchema),
})

export const syncIndexSchema = z.object({
  configured: z.boolean(),
  link: z
    .object({
      rows: z.array(syncLinkRowSchema),
      candidates: z.array(shopifyVariantInfoSchema),
    })
    .nullable(),
  push: z.array(syncPushRowSchema).nullable(),
  pull: z.array(syncPullRowSchema).nullable(),
  locations: z.array(locationSchema),
  categories: z.array(categorySchema),
  lastPullAt: z.string().nullable(),
  lastPushAt: z.string().nullable(),
})
export type SyncIndexProps = z.infer<typeof syncIndexSchema>
