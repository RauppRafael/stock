import { randomUUID } from 'node:crypto'
import shopifyConfig, { adminGraphqlUrl, isConfigured, tokenEndpointUrl } from '#config/shopify'

/**
 * Thin wrapper around Shopify's Admin GraphQL API. We use GraphQL (not REST)
 * because Shopify is steadily deprecating REST endpoints and the relevant
 * inventory + variant mutations are GraphQL-only on recent versions.
 *
 * Errors surface in three layers — HTTP, GraphQL `errors[]`, and per-mutation
 * `userErrors[]`. Each one is mapped to a `ShopifyClientError` with enough
 * context for the SyncService to bubble up cleanly to the diff UI.
 *
 * Token handling:
 *   - Module-scoped cache (shared across `ShopifyClient` instances in this
 *     process) avoids minting a new 24h token per request.
 *   - In-flight promise coalesces simultaneous mint attempts so two
 *     concurrent operators don't both hit the OAuth endpoint on a cold start.
 *   - 401 on the GraphQL endpoint invalidates the cache and retries once,
 *     so a rotated secret or reinstalled app self-heals on the next call.
 *
 * Rate-limit handling is intentionally minimal: a single back-off retry on
 * `THROTTLED`. Operator-driven syncs don't need a global queue.
 */

export class ShopifyClientError extends Error {
  readonly userErrors: ShopifyUserError[]
  constructor(message: string, userErrors: ShopifyUserError[] = []) {
    super(message)
    this.name = 'ShopifyClientError'
    this.userErrors = userErrors
  }
}

export class ShopifyNotConfiguredError extends ShopifyClientError {
  constructor() {
    super(
      'Shopify is not configured: set SHOPIFY_SHOP_DOMAIN, SHOPIFY_CLIENT_ID, and SHOPIFY_CLIENT_SECRET'
    )
    this.name = 'ShopifyNotConfiguredError'
  }
}

export type ShopifyUserError = { field?: string[] | null; message: string; code?: string | null }

export type ShopifyLocation = {
  id: string
  name: string
  isActive: boolean
}

export type ShopifyVariantOption = { name: string; value: string }

export type ShopifyVariant = {
  id: string
  sku: string | null
  title: string
  selectedOptions: ShopifyVariantOption[]
  inventoryItemId: string
  imageUrl: string | null
  /**
   * On-hand at the queried location, when available. Null when no inventory
   * level exists for this (item, location) pair on Shopify's side.
   */
  onHandAtLocation: number | null
}

export type ShopifyProduct = {
  id: string
  title: string
  featuredImageUrl: string | null
  variants: ShopifyVariant[]
}

type GraphqlResponse<T> = {
  data?: T
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>
  extensions?: { cost?: unknown }
}

/**
 * Refresh the access token a minute early so an in-flight request never
 * presents a token that expires before the response comes back.
 */
const TOKEN_REFRESH_SAFETY_MS = 60_000

/**
 * Shopify's `inventorySetOnHandQuantities` accepts up to 250 items per call.
 * Larger batches return a userErrors-style rejection.
 */
const INVENTORY_BATCH_SIZE = 250

/** Module-scoped token cache + inflight promise for mint coalescing. */
let cachedAccessToken: string | null = null
let cachedAccessTokenExpiresAt = 0
let tokenMintInflight: Promise<string> | null = null

/** Test/dev helper to force a fresh mint on the next call. */
export function invalidateShopifyTokenCache(): void {
  cachedAccessToken = null
  cachedAccessTokenExpiresAt = 0
  tokenMintInflight = null
}

export default class ShopifyClient {
  /**
   * Exchange the app's client credentials for a 24h Admin API access token.
   * Concurrent callers share a single in-flight mint via `tokenMintInflight`
   * so a cold-process thundering herd doesn't fire N parallel OAuth requests.
   *
   * The app must already be installed on the store for this endpoint to
   * succeed — the Dev Dashboard's Custom Distribution install link handles
   * that one-time step. An uninstalled app returns 401 here.
   */
  private async ensureAccessToken(): Promise<string> {
    if (!isConfigured()) throw new ShopifyNotConfiguredError()
    const now = Date.now()
    if (cachedAccessToken && now < cachedAccessTokenExpiresAt - TOKEN_REFRESH_SAFETY_MS) {
      return cachedAccessToken
    }
    if (tokenMintInflight) return tokenMintInflight

    tokenMintInflight = this.mintAccessToken().finally(() => {
      tokenMintInflight = null
    })
    return tokenMintInflight
  }

  private async mintAccessToken(): Promise<string> {
    const body = new URLSearchParams({
      client_id: shopifyConfig.clientId!,
      client_secret: shopifyConfig.clientSecret!,
      grant_type: 'client_credentials',
    })
    const endpoint = tokenEndpointUrl()
    let res: Response
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body,
      })
    } catch (err) {
      // Node's `fetch failed` is opaque — unwrap the cause (DNS / TLS /
      // ECONNREFUSED) so the toast and terminal include something actionable.
      const cause = (err as { cause?: unknown }).cause
      const causeMsg =
        cause instanceof Error ? `${cause.name}: ${cause.message}` : cause ? String(cause) : ''
      throw new ShopifyClientError(
        `Network error reaching ${endpoint}${causeMsg ? ` — ${causeMsg}` : ''}. ` +
          `Check SHOPIFY_SHOP_DOMAIN (must be the *.myshopify.com host, no https:// prefix).`
      )
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new ShopifyClientError(
        `Shopify token exchange failed (${res.status}): ${text.slice(0, 500)}. ` +
          `Make sure the app is installed on the store and the client_id/client_secret are correct.`
      )
    }
    const json = (await res.json()) as {
      access_token?: string
      expires_in?: number
    }
    if (!json.access_token || !json.expires_in) {
      throw new ShopifyClientError('Shopify token exchange returned unexpected payload')
    }
    cachedAccessToken = json.access_token
    cachedAccessTokenExpiresAt = Date.now() + json.expires_in * 1000
    return cachedAccessToken
  }

  /**
   * Low-level GraphQL request. Handles three retry conditions:
   *   - 401 (token invalidated server-side): clear cache, re-mint, retry once.
   *   - `THROTTLED` user-error: sleep 1s, retry once.
   * Anything else propagates as a `ShopifyClientError`.
   */
  async request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    if (!isConfigured()) throw new ShopifyNotConfiguredError()

    const fire = async (token: string): Promise<Response> => {
      return fetch(adminGraphqlUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
          'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      })
    }

    let token = await this.ensureAccessToken()
    let res = await fire(token)
    if (res.status === 401) {
      // Token was valid client-side but rejected — likely rotated secret or
      // reinstalled app. Force a fresh mint and retry once.
      invalidateShopifyTokenCache()
      token = await this.ensureAccessToken()
      res = await fire(token)
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new ShopifyClientError(`Shopify HTTP ${res.status}: ${text.slice(0, 500)}`)
    }

    let body = (await res.json()) as GraphqlResponse<T>
    if (
      body.errors?.some(
        (e) => (e.extensions as { code?: string } | undefined)?.code === 'THROTTLED'
      )
    ) {
      await new Promise((r) => setTimeout(r, 1000))
      res = await fire(token)
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new ShopifyClientError(`Shopify HTTP ${res.status}: ${text.slice(0, 500)}`)
      }
      body = (await res.json()) as GraphqlResponse<T>
    }
    if (body.errors?.length) {
      throw new ShopifyClientError(
        `Shopify GraphQL: ${body.errors.map((e) => e.message).join('; ')}`
      )
    }
    if (!body.data) throw new ShopifyClientError('Shopify GraphQL: empty response')
    return body.data
  }

  /**
   * Iterate every product + variant in the store. Yields page-by-page so the
   * caller can stream/diff without buffering the whole catalog in memory.
   * `locationId` is required so we can fetch the on-hand quantity at the same
   * Shopify location we'd later push to — that's the value the pull-diff
   * compares against local totals.
   *
   * Inner variants(first: 250) caps per-product variants at 250 (Shopify's
   * documented max for the connection). A product with more variants throws
   * a clear error rather than silently dropping the tail.
   */
  async *iterateProducts(locationId: string, pageSize = 50): AsyncIterable<ShopifyProduct> {
    const query = `
      query Products($cursor: String, $pageSize: Int!, $locationId: ID!) {
        products(first: $pageSize, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              title
              featuredImage { url }
              variants(first: 250) {
                pageInfo { hasNextPage }
                edges {
                  node {
                    id
                    sku
                    title
                    selectedOptions { name value }
                    image { url }
                    inventoryItem {
                      id
                      inventoryLevel(locationId: $locationId) {
                        quantities(names: ["on_hand"]) { name quantity }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `
    type ProductsResponse = {
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null }
        edges: Array<{
          node: {
            id: string
            title: string
            featuredImage: { url: string } | null
            variants: {
              pageInfo: { hasNextPage: boolean }
              edges: Array<{
                node: {
                  id: string
                  sku: string | null
                  title: string
                  selectedOptions: ShopifyVariantOption[]
                  image: { url: string } | null
                  inventoryItem: {
                    id: string
                    inventoryLevel: {
                      quantities: Array<{ name: string; quantity: number }>
                    } | null
                  }
                }
              }>
            }
          }
        }>
      }
    }
    let cursor: string | null = null
    while (true) {
      const data: ProductsResponse = await this.request<ProductsResponse>(query, {
        cursor,
        pageSize,
        locationId,
      })

      for (const edge of data.products.edges) {
        const p = edge.node
        if (p.variants.pageInfo.hasNextPage) {
          throw new ShopifyClientError(
            `Product "${p.title}" has more than 250 variants — pagination of the inner ` +
              `variants connection isn't implemented. Open an issue if your catalog hits this.`
          )
        }
        yield {
          id: p.id,
          title: p.title,
          featuredImageUrl: p.featuredImage?.url ?? null,
          variants: p.variants.edges.map(({ node: v }) => ({
            id: v.id,
            sku: v.sku ?? null,
            title: v.title,
            selectedOptions: v.selectedOptions,
            imageUrl: v.image?.url ?? p.featuredImage?.url ?? null,
            inventoryItemId: v.inventoryItem.id,
            onHandAtLocation:
              v.inventoryItem.inventoryLevel?.quantities.find((q) => q.name === 'on_hand')
                ?.quantity ?? null,
          })),
        }
      }

      if (!data.products.pageInfo.hasNextPage) break
      cursor = data.products.pageInfo.endCursor
      if (!cursor) break
    }
  }

  async listLocations(): Promise<ShopifyLocation[]> {
    const data = await this.request<{
      locations: { edges: Array<{ node: { id: string; name: string; isActive: boolean } }> }
    }>(`query { locations(first: 50) { edges { node { id name isActive } } } }`)
    return data.locations.edges.map((e) => e.node)
  }

  /**
   * Returns a default Shopify location ID to sync against. Used once, on first
   * sync, to populate `shopify_settings.shopify_location_id`.
   *
   * `Shop.primaryLocation` was removed from the Admin GraphQL API, and
   * `Location.isPrimary` isn't on every plan / version either, so we just
   * take the first active location. If the merchant has multiple and wants
   * a different one, they can override the stored value (a settings UI is a
   * follow-up — for now they can update `shopify_settings.shopify_location_id`
   * directly in MySQL).
   */
  async getPrimaryLocationId(): Promise<string> {
    const locations = await this.listLocations()
    const active = locations.filter((l) => l.isActive)
    if (!active.length) {
      throw new ShopifyClientError('No active locations in Shopify — configure one in admin.')
    }
    return active[0].id
  }

  /**
   * Sets the on-hand inventory level for many (inventoryItem, location) pairs.
   * Chunks into batches of ≤250 because Shopify rejects larger calls; each
   * batch gets its own UUID `referenceDocumentUri` so the audit trail in
   * Shopify links cleanly back to one sync action and replays don't collide.
   */
  async setOnHandQuantities(
    locationId: string,
    items: Array<{ inventoryItemId: string; quantity: number }>,
    reason: string = 'correction'
  ): Promise<void> {
    if (!items.length) return
    const mutation = `
      mutation Set($input: InventorySetOnHandQuantitiesInput!) {
        inventorySetOnHandQuantities(input: $input) {
          inventoryAdjustmentGroup { id }
          userErrors { field message code }
        }
      }
    `
    for (let i = 0; i < items.length; i += INVENTORY_BATCH_SIZE) {
      const slice = items.slice(i, i + INVENTORY_BATCH_SIZE)
      const data = await this.request<{
        inventorySetOnHandQuantities: {
          inventoryAdjustmentGroup: { id: string } | null
          userErrors: ShopifyUserError[]
        }
      }>(mutation, {
        input: {
          reason,
          referenceDocumentUri: `logistics://stockroom/sync/${randomUUID()}`,
          setQuantities: slice.map((it) => ({
            inventoryItemId: it.inventoryItemId,
            locationId,
            quantity: it.quantity,
          })),
        },
      })
      const errs = data.inventorySetOnHandQuantities.userErrors
      if (errs.length) {
        throw new ShopifyClientError(
          `Failed to set inventory: ${errs.map((e) => e.message).join('; ')}`,
          errs
        )
      }
    }
  }
}
