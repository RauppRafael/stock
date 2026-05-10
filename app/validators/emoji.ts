/**
 * Matches a string composed of pictographic codepoints (emoji), optionally
 * with variation selectors (U+FE0F) and zero-width joiner (U+200D) sequences.
 * Sufficient as a soft guard against plaintext entries from the icon field.
 */
export const EMOJI_PATTERN =
  /^(\p{Extended_Pictographic}(\u{FE0F}|\u{200D}\p{Extended_Pictographic})*)+$/u
