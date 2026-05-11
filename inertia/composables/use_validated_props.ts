import { onMounted } from 'vue'
import type { z } from 'zod'

/**
 * Runtime-validate the page's incoming props against a Zod schema.
 *
 * Call from a page's `<script setup>`:
 *
 *   const props = defineProps<…>()
 *   useValidatedProps(props, pageSchema)
 *
 * The Zod schemas live in `shared/contracts/` and mirror the back-end
 * transformer outputs, so a back-end change that drops or renames a field
 * surfaces here as a console error instead of an undefined-deref later.
 *
 * Behavior:
 *   - Dev: any parse failure logs a noisy `console.error` with Zod issues
 *     so the regression is obvious.
 *   - Prod: same — front-end is internal so we want to know if data drifts.
 *     Swap to `safeParse + skip` here if you ever ship this externally.
 */
export function useValidatedProps<S extends z.ZodTypeAny>(props: unknown, schema: S): void {
  onMounted(() => {
    const result = schema.safeParse(props)
    if (!result.success) {
      console.error('[contracts] Page props failed schema validation:', result.error.issues)
    }
  })
}
