import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Variant from '#models/variant'
import Stock from '#models/stock'
import ShopifySetting from '#models/shopify_setting'
import ShopifyVariantLink from '#models/shopify_variant_link'
import StockService from '#services/stock_service'
import ShopifyClient, { type ShopifyProduct, type ShopifyVariant } from '#services/shopify_client'
import { DateTime } from 'luxon'

/**
 * Orchestrates the three-way sync between local DB and Shopify with a
 * many-to-one model: one local variant can mirror multiple Shopify variants
 * (the duplicate-product case for M/W variants of the same SKU).
 *
 *   Link  → attach 1+ Shopify variants to a local variant. Matching at
 *           runtime is by Shopify GID, so this is purely a local DB write.
 *   Push  → write local total to every Shopify mirror of each variant,
 *           updating each link's last_known_quantity.
 *   Pull  → for each variant with linked mirrors, compute the per-link
 *           delta vs last_known_quantity; sum the negative deltas (sales);
 *           deduct the total from a local location chosen by the operator.
 *           Then auto-push the new total back to all mirrors so the
 *           duplicates land in lockstep again.
 *
 * The "last_known_quantity per link" model handles independent sales on
 * different duplicates correctly. A naive MIN-of-quantities or
 * compare-to-localTotal approach would mis-count when multiple duplicates
 * sell concurrently.
 *
 * Concurrency: each apply method runs inside `withSyncLock`, a MySQL named
 * lock (`GET_LOCK('shopify_sync', ...)`) bound to the wrapping DB
 * transaction. Two operators triggering /sync simultaneously serialise on
 * this lock — the second one bails out with a clear "another sync in
 * progress" error rather than racing.
 */

export class ShopifySyncError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShopifySyncError'
  }
}

export type ShopifyVariantInfo = {
  shopifyVariantId: string
  shopifyProductId: string
  shopifyProductTitle: string
  shopifyVariantTitle: string
  options: Array<{ name: string; value: string }>
  currentSku: string | null
  imageUrl: string | null
}

/**
 * Compact local-variant display data shared by all sync diff rows. Replaces
 * the old `displayName` / `sku` string fields so the front-end can render
 * a swatch + size box (matching the rest of the app) instead of an opaque
 * "Fold Hoodie - Nude - S" string.
 */
export type LocalVariantDisplay = {
  productName: string
  color: { name: string; hexCode: string | null } | null
  size: { name: string } | null
  imageUrl: string | null
}

export type LinkDiffRow = {
  localVariantId: number
  localProductId: number
  display: LocalVariantDisplay
  currentLinks: ShopifyVariantInfo[]
}

export type LinkDiff = {
  rows: LinkDiffRow[]
  candidates: ShopifyVariantInfo[]
}

export type PushDiffTarget = {
  shopifyVariantId: string
  shopifyProductTitle: string
  shopifyVariantTitle: string
  shopifyQuantity: number | null
}

export type PushDiffRow = {
  localVariantId: number
  display: LocalVariantDisplay
  localTotal: number
  targets: PushDiffTarget[]
}

export type PullDiffTarget = {
  shopifyVariantId: string
  shopifyProductTitle: string
  shopifyVariantTitle: string
  shopifyQuantity: number
  lastKnownQuantity: number | null
  delta: number
}

export type PullDiffRow = {
  localVariantId: number
  display: LocalVariantDisplay
  localTotal: number
  totalDecrement: number
  targets: PullDiffTarget[]
}

/** Input to applyLink: one entry per local variant + the Shopify variants to attach. */
export type LinkRequest = { localVariantId: number; shopifyVariantIds: string[] }

/** Input to applyPull: pick a local location for each variant being adjusted. */
export type PullApplication = { localVariantId: number; locationId: number }

export type ShopifySnapshot = {
  products: ShopifyProduct[]
  variantByGid: Map<string, ShopifyVariant & { productId: string; productTitle: string }>
}

/**
 * Local DB snapshot shared across the three diff builders. Extracted as a
 * type so the controller can hold a single value and hand it to each builder
 * instead of every builder re-querying the catalog independently.
 */
export type LocalSnapshot = {
  variants: Variant[]
  totalByVariantId: Map<number, number>
}

/**
 * Lock-acquire timeout in seconds. Operator-driven syncs are slow (Shopify
 * catalog walk) and shouldn't overlap; bailing fast lets the second operator
 * know to wait rather than queueing on the lock for minutes.
 */
const SYNC_LOCK_TIMEOUT_SEC = 5

export default class ShopifySyncService {
  constructor(private client: ShopifyClient = new ShopifyClient()) {}

  /**
   * Acquire a MySQL named lock for the duration of `fn`, run inside one
   * transaction. The lock is connection-bound, so we explicitly release it
   * before returning the connection to the pool.
   *
   * MySQL's `GET_LOCK(name, timeout)` returns 1 on acquire, 0 on timeout,
   * NULL on error. Each result row comes back as an object whose key is the
   * SELECT alias.
   */
  private async withSyncLock<T>(fn: (trx: TransactionClientContract) => Promise<T>): Promise<T> {
    return db.transaction(async (trx) => {
      const acquireResult = await trx.rawQuery(`SELECT GET_LOCK('shopify_sync', ?) AS locked`, [
        SYNC_LOCK_TIMEOUT_SEC,
      ])
      // mysql2 returns [rows, fields] from raw. Lucid's rawQuery exposes the
      // tuple; the first element is the rows array.
      const rows = Array.isArray(acquireResult) ? acquireResult[0] : acquireResult
      const lockedValue = Array.isArray(rows)
        ? rows[0]?.locked
        : (rows as { locked?: unknown })?.locked
      const locked = Number(lockedValue) === 1
      if (!locked) {
        throw new ShopifySyncError(
          'Another sync is already in progress — please wait a moment and try again.'
        )
      }
      try {
        return await fn(trx)
      } finally {
        // Release before the connection is returned to the pool so a stuck
        // lock can't outlive this request.
        await trx.rawQuery(`SELECT RELEASE_LOCK('shopify_sync')`)
      }
    })
  }

  /**
   * Ensures we have a Shopify location ID stored. The settings row is
   * pre-seeded by migration, so `findOrFail(1)` is safe.
   */
  async resolveSyncLocationId(): Promise<string> {
    const settings = await ShopifySetting.findOrFail(1)
    if (settings.shopifyLocationId) return settings.shopifyLocationId

    const primary = await this.client.getPrimaryLocationId()
    settings.shopifyLocationId = primary
    await settings.save()
    return primary
  }

  /**
   * Snapshot every Shopify variant in the catalog, keyed by GID for lookups.
   * Public so the controller can take exactly one snapshot per /sync/diff
   * request and hand the same value to all three diff builders — building
   * each diff independently used to trigger three parallel catalog walks.
   */
  async snapshotShopify(): Promise<ShopifySnapshot> {
    const locationId = await this.resolveSyncLocationId()
    const products: ShopifyProduct[] = []
    const variantByGid = new Map<
      string,
      ShopifyVariant & { productId: string; productTitle: string }
    >()
    for await (const p of this.client.iterateProducts(locationId)) {
      products.push(p)
      for (const v of p.variants) {
        variantByGid.set(v.id, { ...v, productId: p.id, productTitle: p.title })
      }
    }
    return { products, variantByGid }
  }

  /**
   * Local snapshot: every active Variant + its links + total stock keyed by
   * id. Sorted by product / color / size so the diff reads naturally. Public
   * for the same reason as `snapshotShopify` — share one snapshot across the
   * three diff builders per request.
   */
  async snapshotLocal(): Promise<LocalSnapshot> {
    const variants = await Variant.query()
      .preload('color')
      .preload('size')
      .preload('product', (p) => p.preload('category'))
      .preload('shopifyVariantLinks')
      .whereHas('product', (p) => p.whereNull('deleted_at'))

    variants.sort((a, b) => {
      const pa = a.product?.name ?? ''
      const pb = b.product?.name ?? ''
      if (pa !== pb) return pa.localeCompare(pb)
      const ca = a.color?.name ?? null
      const cb = b.color?.name ?? null
      if (ca === null && cb !== null) return 1
      if (ca !== null && cb === null) return -1
      if (ca !== null && cb !== null && ca !== cb) return ca.localeCompare(cb)
      const sa = a.size?.sortOrder ?? 0
      const sb = b.size?.sortOrder ?? 0
      if (sa !== sb) return sa - sb
      return (a.size?.name ?? '').localeCompare(b.size?.name ?? '')
    })

    const variantIds = variants.map((v) => v.id)
    const totals = variantIds.length
      ? await Stock.query()
          .whereIn('variant_id', variantIds)
          .select('variant_id')
          .sum('quantity as total')
          .groupBy('variant_id')
      : []
    const totalByVariantId = new Map<number, number>()
    for (const row of totals) {
      const id = Number(row.$extras.variant_id ?? row.variantId)
      totalByVariantId.set(id, Number(row.$extras.total ?? 0))
    }
    return { variants, totalByVariantId }
  }

  private shopifyInfo(
    v: ShopifyVariant & { productId: string; productTitle: string }
  ): ShopifyVariantInfo {
    return {
      shopifyVariantId: v.id,
      shopifyProductId: v.productId,
      shopifyProductTitle: v.productTitle,
      shopifyVariantTitle: v.title,
      options: v.selectedOptions,
      currentSku: v.sku,
      imageUrl: v.imageUrl,
    }
  }

  private displayFor(v: Variant): LocalVariantDisplay {
    return {
      productName: v.product?.name ?? '—',
      color: v.color ? { name: v.color.name, hexCode: v.color.hexCode } : null,
      size: v.size ? { name: v.size.name } : null,
      imageUrl: v.imageUrl ?? null,
    }
  }

  /**
   * Build all three diffs from a single pair of snapshots. This is the
   * canonical entry point for /sync/diff — calling the three builders
   * individually used to trigger three independent Shopify catalog walks,
   * tripling API cost on every page load.
   */
  async buildAllDiffs(): Promise<{
    link: LinkDiff
    push: PushDiffRow[]
    pull: PullDiffRow[]
  }> {
    const [local, shopify] = await Promise.all([this.snapshotLocal(), this.snapshotShopify()])
    return {
      link: await this.buildLinkDiff(local, shopify),
      push: await this.buildPushDiff(local, shopify),
      pull: await this.buildPullDiff(local, shopify),
    }
  }

  async buildLinkDiff(local?: LocalSnapshot, shopify?: ShopifySnapshot): Promise<LinkDiff> {
    const [resolvedLocal, resolvedShopify] = await Promise.all([
      local ? Promise.resolve(local) : this.snapshotLocal(),
      shopify ? Promise.resolve(shopify) : this.snapshotShopify(),
    ])

    const linkedShopifyGids = new Set<string>()
    for (const v of resolvedLocal.variants) {
      for (const link of v.shopifyVariantLinks ?? []) {
        linkedShopifyGids.add(link.shopifyVariantId)
      }
    }

    const rows: LinkDiffRow[] = resolvedLocal.variants.map((v) => ({
      localVariantId: v.id,
      localProductId: v.productId,
      display: this.displayFor(v),
      currentLinks: (v.shopifyVariantLinks ?? [])
        .map((link) => {
          const sv = resolvedShopify.variantByGid.get(link.shopifyVariantId)
          if (!sv) {
            // Linked locally but not found on Shopify (variant deleted, or
            // running against a different store). Surface it with a placeholder
            // so the operator can decide to remove the link.
            return {
              shopifyVariantId: link.shopifyVariantId,
              shopifyProductId: link.shopifyProductId,
              shopifyProductTitle: '(not on Shopify)',
              shopifyVariantTitle: link.shopifyVariantId,
              options: [],
              currentSku: null,
              imageUrl: link.imageUrl,
            }
          }
          return this.shopifyInfo(sv)
        })
        .sort((a, b) => a.shopifyProductTitle.localeCompare(b.shopifyProductTitle)),
    }))

    const candidates: ShopifyVariantInfo[] = []
    for (const v of resolvedShopify.variantByGid.values()) {
      if (linkedShopifyGids.has(v.id)) continue
      candidates.push(this.shopifyInfo(v))
    }

    return { rows, candidates }
  }

  /**
   * For each local variant with at least one link, list the linked Shopify
   * variants whose quantity disagrees with the local total. Variants whose
   * mirrors all already match are omitted.
   */
  async buildPushDiff(local?: LocalSnapshot, shopify?: ShopifySnapshot): Promise<PushDiffRow[]> {
    const [resolvedLocal, resolvedShopify] = await Promise.all([
      local ? Promise.resolve(local) : this.snapshotLocal(),
      shopify ? Promise.resolve(shopify) : this.snapshotShopify(),
    ])
    const rows: PushDiffRow[] = []
    for (const v of resolvedLocal.variants) {
      const links = v.shopifyVariantLinks ?? []
      if (!links.length) continue
      const localTotal = resolvedLocal.totalByVariantId.get(v.id) ?? 0
      const targets: PushDiffTarget[] = []
      for (const link of links) {
        const sv = resolvedShopify.variantByGid.get(link.shopifyVariantId)
        if (!sv) continue
        if (sv.onHandAtLocation === localTotal) continue
        targets.push({
          shopifyVariantId: sv.id,
          shopifyProductTitle: sv.productTitle,
          shopifyVariantTitle: sv.title,
          shopifyQuantity: sv.onHandAtLocation,
        })
      }
      if (!targets.length) continue
      rows.push({
        localVariantId: v.id,
        display: { ...this.displayFor(v), imageUrl: v.imageUrl ?? links[0]?.imageUrl ?? null },
        localTotal,
        targets,
      })
    }
    return rows
  }

  /**
   * For each local variant, compute the per-link delta vs last_known_quantity
   * and sum the negative ones (sales). Positive deltas (manual upward edits
   * in Shopify admin) are ignored — they'll be overwritten by the next push.
   * Links with null last_known_quantity contribute 0 (we just learned about
   * them; next push baselines them).
   */
  async buildPullDiff(local?: LocalSnapshot, shopify?: ShopifySnapshot): Promise<PullDiffRow[]> {
    const [resolvedLocal, resolvedShopify] = await Promise.all([
      local ? Promise.resolve(local) : this.snapshotLocal(),
      shopify ? Promise.resolve(shopify) : this.snapshotShopify(),
    ])
    const rows: PullDiffRow[] = []
    for (const v of resolvedLocal.variants) {
      const links = v.shopifyVariantLinks ?? []
      if (!links.length) continue
      const localTotal = resolvedLocal.totalByVariantId.get(v.id) ?? 0
      const targets: PullDiffTarget[] = []
      let totalDecrement = 0
      for (const link of links) {
        const sv = resolvedShopify.variantByGid.get(link.shopifyVariantId)
        if (!sv || sv.onHandAtLocation === null) continue
        const baseline = link.lastKnownQuantity ?? null
        const delta = baseline === null ? 0 : sv.onHandAtLocation - baseline
        if (delta < 0) totalDecrement += -delta
        targets.push({
          shopifyVariantId: sv.id,
          shopifyProductTitle: sv.productTitle,
          shopifyVariantTitle: sv.title,
          shopifyQuantity: sv.onHandAtLocation,
          lastKnownQuantity: baseline,
          delta,
        })
      }
      if (totalDecrement === 0) continue
      rows.push({
        localVariantId: v.id,
        display: { ...this.displayFor(v), imageUrl: v.imageUrl ?? links[0]?.imageUrl ?? null },
        localTotal,
        totalDecrement,
        targets,
      })
    }
    return rows
  }

  /**
   * Attach one or more Shopify variants to each local variant. Pure DB write
   * — matching at runtime is by Shopify variant GID, so we don't need to
   * write anything back to Shopify on link.
   *
   * Also copies the Shopify image into the local variant's image_url (and
   * its product's) when those are still empty, so the rest of the UI gets a
   * sensible default picture without the operator having to upload anything.
   *
   * Variants are preloaded with one `whereIn` instead of one query per
   * request, so a 100-variant link operation is a few SELECTs, not 100.
   */
  async applyLink(requests: LinkRequest[]): Promise<{ linked: number }> {
    if (!requests.length) return { linked: 0 }
    const totalPairs = requests.reduce((sum, r) => sum + r.shopifyVariantIds.length, 0)
    if (totalPairs === 0) return { linked: 0 }

    const shopify = await this.snapshotShopify()
    const variantIds = requests.map((r) => r.localVariantId)

    return this.withSyncLock(async (trx) => {
      // Preload every variant we'll touch in one round-trip.
      const variants = await Variant.query({ client: trx })
        .whereIn('id', variantIds)
        .preload('product')
        .preload('color')
        .preload('size')
        .preload('shopifyVariantLinks')
      const variantById = new Map<number, Variant>()
      for (const v of variants) variantById.set(v.id, v)

      let linked = 0
      for (const req of requests) {
        if (!req.shopifyVariantIds.length) continue
        const variant = variantById.get(req.localVariantId)
        if (!variant) {
          throw new ShopifySyncError(`Local variant ${req.localVariantId} not found`)
        }
        const existing = new Set((variant.shopifyVariantLinks ?? []).map((l) => l.shopifyVariantId))

        for (const gid of req.shopifyVariantIds) {
          if (existing.has(gid)) continue
          const sv = shopify.variantByGid.get(gid)
          if (!sv) {
            throw new ShopifySyncError(`Shopify variant ${gid} not found — refresh the page`)
          }

          await ShopifyVariantLink.create(
            {
              variantId: variant.id,
              shopifyVariantId: sv.id,
              shopifyProductId: sv.productId,
              lastKnownQuantity: sv.onHandAtLocation,
              imageUrl: sv.imageUrl,
            },
            { client: trx }
          )

          // Denormalised canonical image on the variant + product when empty,
          // so non-sync UI surfaces (Stock page etc.) have something to show.
          let variantDirty = false
          let productDirty = false
          if (!variant.imageUrl && sv.imageUrl) {
            variant.imageUrl = sv.imageUrl
            variantDirty = true
          }
          if (variant.product && !variant.product.imageUrl && sv.imageUrl) {
            variant.product.imageUrl = sv.imageUrl
            productDirty = true
          }
          if (variantDirty) await variant.useTransaction(trx).save()
          if (productDirty) await variant.product.useTransaction(trx).save()

          linked++
        }
      }
      return { linked }
    })
  }

  /**
   * Remove existing variant↔Shopify pairings. Pure DB delete — Shopify
   * holds no state we need to undo, since we never write SKUs back.
   *
   * The denormalised `imageUrl` on variants/products is intentionally left
   * alone: the operator may still want the image after unlinking, and we
   * can't tell whether they're unlinking-to-relink or removing entirely.
   */
  async applyUnlink(shopifyVariantIds: string[]): Promise<{ unlinked: number }> {
    if (!shopifyVariantIds.length) return { unlinked: 0 }
    return this.withSyncLock(async (trx) => {
      const unlinked = await ShopifyVariantLink.query({ client: trx })
        .whereIn('shopify_variant_id', shopifyVariantIds)
        .delete()
      // Lucid returns an array of affected counts per executed query; coerce
      // to a single number so the controller can flash a clean count.
      const count = Array.isArray(unlinked) ? Number(unlinked[0] ?? 0) : Number(unlinked ?? 0)
      return { unlinked: count }
    })
  }

  /**
   * Write local total to every Shopify mirror for each variant and update
   * `last_known_quantity` on each link so the next pull computes deltas
   * relative to this push.
   *
   * Ordering matters for crash safety: DB-side state (baselines + lastPushAt)
   * is written first inside the trx, then the Shopify mutation runs LAST as
   * the final step before commit. Two failure modes to consider:
   *
   *   - Shopify call fails / throws → trx rolls back. Baselines revert to
   *     their old values, Shopify is untouched. Fully consistent.
   *
   *   - Shopify call succeeds, MySQL commit fails (network blip in the gap
   *     between Shopify returning and our commit landing) → Shopify holds
   *     the new value, baselines revert. Next pull would compute
   *     `delta = newShopifyValue − oldBaseline`; for a push-down that's a
   *     phantom negative delta which would silently deduct from local
   *     stock. This window is microseconds long (a single MySQL COMMIT)
   *     vs. the seconds-long window of the inverse ordering, where a
   *     successful Shopify push then any failing UPDATE inside the trx
   *     would have caused the same corruption.
   *
   * Accepts an optional `shopifySnapshot` so callers that already walked the
   * catalog (e.g. applyPull's auto-push) don't pay for a second walk.
   */
  async applyPush(
    variantIds: number[],
    shopifySnapshot?: ShopifySnapshot
  ): Promise<{ pushed: number }> {
    if (!variantIds.length) return { pushed: 0 }
    const locationId = await this.resolveSyncLocationId()
    const shopify = shopifySnapshot ?? (await this.snapshotShopify())

    return this.withSyncLock(async (trx) => {
      const variants = await Variant.query({ client: trx })
        .whereIn('id', variantIds)
        .preload('shopifyVariantLinks')

      const totals = await Stock.query({ client: trx })
        .whereIn('variant_id', variantIds)
        .select('variant_id')
        .sum('quantity as total')
        .groupBy('variant_id')
      const totalByVariantId = new Map<number, number>()
      for (const row of totals) {
        totalByVariantId.set(
          Number(row.$extras.variant_id ?? row.variantId),
          Number(row.$extras.total ?? 0)
        )
      }

      const items: Array<{ inventoryItemId: string; quantity: number }> = []
      const linkUpdates: Array<{ linkId: number; quantity: number }> = []
      for (const v of variants) {
        const localTotal = totalByVariantId.get(v.id) ?? 0
        for (const link of v.shopifyVariantLinks ?? []) {
          const sv = shopify.variantByGid.get(link.shopifyVariantId)
          if (!sv) continue
          items.push({ inventoryItemId: sv.inventoryItemId, quantity: localTotal })
          linkUpdates.push({ linkId: link.id, quantity: localTotal })
        }
      }

      if (!items.length) return { pushed: 0 }

      // Write baselines + lastPushAt FIRST inside the trx. These are
      // unbuilt commits — they only become visible after the trx commits,
      // which happens after the Shopify call below. If the Shopify call
      // throws, none of these writes leave the trx.
      for (const u of linkUpdates) {
        await ShopifyVariantLink.query({ client: trx })
          .where('id', u.linkId)
          .update({ last_known_quantity: u.quantity })
      }
      const settings = await ShopifySetting.findOrFail(1, { client: trx })
      settings.lastPushAt = DateTime.now()
      await settings.useTransaction(trx).save()

      // Shopify call is the LAST step before commit. A throw here unwinds
      // the trx and reverts the baselines; success means the only
      // remaining failure point is the MySQL commit itself (microseconds).
      await this.client.setOnHandQuantities(locationId, items, 'correction')

      return { pushed: items.length }
    })
  }

  /**
   * Pull negative deltas into local stock at a user-picked location, then
   * auto-push the new total back to all linked Shopify variants so the
   * duplicates land in lockstep.
   *
   * Each variant's deduction is one atomic operation: StockService.adjust
   * runs inside the same trx as the per-link last_known_quantity updates so
   * a crash between the two can't leave us partially-applied (which would
   * double-deduct on the next pull).
   *
   * Auto-push runs after the pull commits, in its own withSyncLock scope —
   * but reuses the existing Shopify snapshot to avoid a second catalog walk.
   * If auto-push fails, the local adjustments stand; the operator sees the
   * still-mismatched mirrors on the Push tab and can re-push manually.
   */
  async applyPull(
    applications: PullApplication[],
    userId: number | null
  ): Promise<{ adjusted: number; autoPushed: number }> {
    if (!applications.length) return { adjusted: 0, autoPushed: 0 }
    const shopify = await this.snapshotShopify()
    const stockService = new StockService()

    const variantsToRepush: number[] = []
    let adjusted = 0

    await this.withSyncLock(async (trx) => {
      const variantIds = applications.map((a) => a.localVariantId)
      const variants = await Variant.query({ client: trx })
        .whereIn('id', variantIds)
        .preload('shopifyVariantLinks')
      const variantById = new Map<number, Variant>()
      for (const v of variants) variantById.set(v.id, v)

      for (const app of applications) {
        const variant = variantById.get(app.localVariantId)
        const links = variant?.shopifyVariantLinks ?? []
        if (!variant || !links.length) continue

        let totalDecrement = 0
        const linkUpdates: Array<{ linkId: number; quantity: number }> = []
        for (const link of links) {
          const sv = shopify.variantByGid.get(link.shopifyVariantId)
          if (!sv || sv.onHandAtLocation === null) continue
          const baseline = link.lastKnownQuantity ?? null
          const delta = baseline === null ? 0 : sv.onHandAtLocation - baseline
          if (delta < 0) totalDecrement += -delta
          // Always advance the baseline to what we just observed, even for
          // non-decrementing links — otherwise the next pull would recompute
          // the same delta.
          linkUpdates.push({ linkId: link.id, quantity: sv.onHandAtLocation })
        }
        if (totalDecrement === 0) continue

        // The "next < 0" guard reads with forUpdate so a concurrent local
        // adjuster can't slip a change in between this check and the write.
        const targetStock = await Stock.query({ client: trx })
          .where('variant_id', variant.id)
          .andWhere('location_id', app.locationId)
          .forUpdate()
          .first()
        const current = targetStock?.quantity ?? 0
        const next = current - totalDecrement
        if (next < 0) {
          throw new ShopifySyncError(
            `Cannot deduct ${totalDecrement} from variant ${variant.id} — picked location only has ${current}. ` +
              `Pick a different location with more stock or split the deduction manually.`
          )
        }

        const totalRow = await Stock.query({ client: trx })
          .where('variant_id', variant.id)
          .sum('quantity as total')
          .first()
        const localTotalBefore = Number(totalRow?.$extras.total ?? 0)

        // Atomic with the link baseline writes: same trx.
        await stockService.adjust({
          variantId: variant.id,
          locationId: app.locationId,
          newQuantity: next,
          userId,
          reason: `Shopify pull (Δ -${totalDecrement} across ${links.length} mirror(s); local ${localTotalBefore}→${localTotalBefore - totalDecrement})`,
          source: 'shopify_pull',
          trx,
        })

        for (const u of linkUpdates) {
          await ShopifyVariantLink.query({ client: trx })
            .where('id', u.linkId)
            .update({ last_known_quantity: u.quantity })
        }

        adjusted++
        variantsToRepush.push(variant.id)
      }

      const settings = await ShopifySetting.findOrFail(1, { client: trx })
      settings.lastPullAt = DateTime.now()
      await settings.useTransaction(trx).save()
    })

    // Auto-push outside the pull's lock scope so the lock isn't held during
    // the second Shopify round-trip. Re-acquires its own lock + reuses the
    // catalog snapshot we already paid for.
    let autoPushed = 0
    if (variantsToRepush.length) {
      const result = await this.applyPush(variantsToRepush, shopify)
      autoPushed = result.pushed
    }

    return { adjusted, autoPushed }
  }
}
