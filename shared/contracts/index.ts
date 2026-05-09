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

export const printSchema = z.object({
  id,
  name: z.string(),
  code: z.string(),
})
export type Print = z.infer<typeof printSchema>

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
})
export type Location = z.infer<typeof locationSchema>

export const categorySchema = z.object({
  id,
  name: z.string(),
  icon: z.string().nullable(),
  hasColor: z.boolean(),
  hasPrint: z.boolean(),
  hasSize: z.boolean(),
})
export type Category = z.infer<typeof categorySchema>

export const productSchema = z.object({
  id,
  name: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  lowStockThreshold: z.number().int().nullable(),
  categoryId: id,
  category: categorySchema.nullable(),
})
export type Product = z.infer<typeof productSchema>

export const variantSchema = z.object({
  id,
  productId: id,
  colorId: id.nullable(),
  printId: id.nullable(),
  sizeId: id.nullable(),
  skuCode: z.string().nullable(),
  displayName: z.string(),
  product: productSchema.nullable(),
  color: colorSchema.nullable(),
  print: printSchema.nullable(),
  size: sizeSchema.nullable(),
})
export type Variant = z.infer<typeof variantSchema>

export const stockSchema = z.object({
  id,
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
