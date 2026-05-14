/**
 * Request a sized version of a Shopify CDN image. Shopify's CDN renders a
 * downscaled JPEG/WebP when `width` is in the query string, which keeps
 * thumbnail decode work tiny — the alternative is the browser pulling the
 * raw multi-megapixel original and downscaling it per tile during scroll,
 * which shows up in perf traces as 100–400ms RasterTasks and stuttery
 * scrolling on the /sync tables.
 *
 * Returns the original URL unchanged if it doesn't parse or isn't an
 * http(s) URL — the caller should still render that, just unoptimised.
 */
export function shopifyThumb(url: string | null, width: number): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return url
    u.searchParams.set('width', String(width))
    return u.toString()
  } catch {
    return url
  }
}
