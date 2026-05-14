/**
 * Tokenized, diacritic-normalized substring matcher. Tight enough to avoid
 * the classic "abc matches A Big Cat" overreach of true subsequence fuzzies,
 * loose enough to handle out-of-order words, partial words, accents, and
 * case differences — i.e. "acai fold" matches "Fold Açaí Hoodie".
 *
 * Each whitespace-separated token in the query must appear as a contiguous
 * substring somewhere in the normalized haystack. Empty queries match
 * everything.
 */

const DIACRITICS = /[̀-ͯ]/g

function normalize(value: string): string {
  return value.normalize('NFD').replace(DIACRITICS, '').toLowerCase()
}

export function fuzzyTokens(query: string): string[] {
  const trimmed = query.trim()
  if (!trimmed) return []
  return normalize(trimmed).split(/\s+/).filter(Boolean)
}

export function fuzzyMatch(query: string, haystack: string): boolean {
  const tokens = fuzzyTokens(query)
  if (tokens.length === 0) return true
  const normalized = normalize(haystack)
  return tokens.every((token) => normalized.includes(token))
}

/**
 * Convenience for callers that need to match against multiple text fields —
 * joins the fields once and runs the same per-token check.
 */
export function fuzzyMatchAny(query: string, fields: (string | null | undefined)[]): boolean {
  const tokens = fuzzyTokens(query)
  if (tokens.length === 0) return true
  const normalized = normalize(fields.filter((f): f is string => !!f).join(' '))
  return tokens.every((token) => normalized.includes(token))
}
