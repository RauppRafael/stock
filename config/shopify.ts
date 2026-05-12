import env from '#start/env'

/**
 * Shopify Admin API config.
 *
 * As of Jan 2026 Shopify retired legacy custom apps with permanent `shpat_`
 * tokens. New apps live in the Dev Dashboard (dev.shopify.com) and
 * authenticate via OAuth 2.0 client credentials: we exchange the app's
 * `client_id` + `client_secret` for a 24-hour Admin API access token, then
 * refresh as needed (handled in `ShopifyClient.ensureAccessToken`).
 *
 * The app must be installed on the store first — install link is generated
 * from the Dev Dashboard's Distribution → Custom distribution flow.
 */
const DEFAULT_API_VERSION = '2025-10'

const shopifyConfig = {
  shopDomain: env.get('SHOPIFY_SHOP_DOMAIN'),
  clientId: env.get('SHOPIFY_CLIENT_ID'),
  clientSecret: env.get('SHOPIFY_CLIENT_SECRET'),
  apiVersion: env.get('SHOPIFY_API_VERSION') ?? DEFAULT_API_VERSION,
}

export function isConfigured(): boolean {
  return Boolean(shopifyConfig.shopDomain && shopifyConfig.clientId && shopifyConfig.clientSecret)
}

function assertConfigured(): void {
  if (!isConfigured()) {
    throw new Error(
      'Shopify is not configured: set SHOPIFY_SHOP_DOMAIN, SHOPIFY_CLIENT_ID, and SHOPIFY_CLIENT_SECRET'
    )
  }
}

/**
 * GraphQL Admin API endpoint for the configured shop. Throws if Shopify is
 * not configured — callers should gate on `isConfigured()` first.
 */
export function adminGraphqlUrl(): string {
  assertConfigured()
  return `https://${shopifyConfig.shopDomain}/admin/api/${shopifyConfig.apiVersion}/graphql.json`
}

/**
 * OAuth token endpoint used by the client credentials grant. Always lives at
 * the shop's `*.myshopify.com` host regardless of the API version.
 */
export function tokenEndpointUrl(): string {
  assertConfigured()
  return `https://${shopifyConfig.shopDomain}/admin/oauth/access_token`
}

export default shopifyConfig
