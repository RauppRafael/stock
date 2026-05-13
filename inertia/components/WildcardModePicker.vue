<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Data } from '@generated/data'

/**
 * Three-way radio picker for the wildcard relationship on the product
 * create/edit forms. Models the three legal states explicitly so the user
 * doesn't have to discover them by combining an isWildcard checkbox with a
 * "wildcard source" dropdown:
 *
 *   - standalone : own stock only
 *   - derives    : printed product sharing a wildcard's pool
 *   - wildcard   : the printless base whose stock is pooled into derivatives
 *
 * The component never owns persistent state — it round-trips two booleans
 * via v-model so the parent's form helper stays the source of truth.
 *
 * The "derives" option is hidden when the category has no wildcards yet,
 * so the user isn't presented a choice with nothing to pick. The "wildcard"
 * option can be locked (greyed out + helper text) when the product is
 * already a wildcard with active derivatives — toggling it off would orphan
 * those references.
 */

type Mode = 'standalone' | 'derives' | 'wildcard'

const props = defineProps<{
  isWildcard: boolean
  wildcardId: number | null
  wildcards: Data.Product[]
  /** True when the product is currently a wildcard with derivatives. */
  lockedWildcard?: boolean
  /** Used to render a small warning under the "wildcard" option when locked. */
  lockedReason?: string
  errorIsWildcard?: string
  errorWildcardId?: string
}>()

const emit = defineEmits<{
  'update:isWildcard': [value: boolean]
  'update:wildcardId': [value: number | null]
}>()

const { t } = useI18n()

const mode = computed<Mode>(() => {
  if (props.isWildcard) return 'wildcard'
  if (props.wildcardId !== null) return 'derives'
  return 'standalone'
})

function setMode(next: Mode) {
  if (next === 'wildcard') {
    emit('update:wildcardId', null)
    emit('update:isWildcard', true)
    return
  }
  if (next === 'derives') {
    // Default to the first option when entering this mode without a prior
    // pick. Skipping the default would land the user on a "Choose one"
    // empty state right after they selected the option — extra friction.
    const fallback = props.wildcardId ?? props.wildcards[0]?.id ?? null
    emit('update:isWildcard', false)
    emit('update:wildcardId', fallback)
    return
  }
  emit('update:isWildcard', false)
  emit('update:wildcardId', null)
}

/**
 * If the parent supplies a list with no entries, snap out of "derives"
 * to keep the model in a coherent state. Happens when the user picks a
 * category that has no wildcards yet.
 */
watch(
  () => props.wildcards.length,
  (next) => {
    if (next === 0 && mode.value === 'derives') setMode('standalone')
  }
)
</script>

<template>
  <div class="space-y-2">
    <!-- Standalone -->
    <label
      class="flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition"
      :class="
        mode === 'standalone'
          ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
          : 'border-slate-200 bg-white hover:border-slate-300'
      "
    >
      <input
        type="radio"
        class="mt-0.5 size-4"
        :checked="mode === 'standalone'"
        @change="setMode('standalone')"
      />
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-slate-900">
          {{ t('products.wildcard.modes.standaloneLabel') }}
        </div>
        <div class="text-xs text-slate-500 mt-0.5">
          {{ t('products.wildcard.modes.standaloneHelp') }}
        </div>
      </div>
    </label>

    <!-- Derives -->
    <label
      v-if="wildcards.length > 0"
      class="flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition"
      :class="
        mode === 'derives'
          ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500'
          : 'border-slate-200 bg-white hover:border-slate-300'
      "
    >
      <input
        type="radio"
        class="mt-0.5 size-4"
        :checked="mode === 'derives'"
        @change="setMode('derives')"
      />
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-slate-900 inline-flex items-center gap-1.5">
          <span aria-hidden="true">🃏</span>
          {{ t('products.wildcard.modes.derivesLabel') }}
        </div>
        <div class="text-xs text-slate-500 mt-0.5">
          {{ t('products.wildcard.modes.derivesHelp') }}
        </div>
        <div v-if="mode === 'derives'" class="mt-3">
          <select
            :value="wildcardId ?? ''"
            class="select"
            :data-invalid="errorWildcardId ? 'true' : undefined"
            @change="
              (e) => {
                const v = (e.target as HTMLSelectElement).value
                emit('update:wildcardId', v === '' ? null : Number(v))
              }
            "
          >
            <option value="">{{ t('products.wildcard.pickSource') }}</option>
            <option v-for="w in wildcards" :key="w.id" :value="w.id">
              {{ w.name }} ({{ w.code }})
            </option>
          </select>
          <p v-if="errorWildcardId" class="field-error">{{ errorWildcardId }}</p>
        </div>
      </div>
    </label>

    <!-- Wildcard -->
    <label
      class="flex items-start gap-3 rounded-lg border px-3 py-2.5 transition"
      :class="[
        lockedWildcard && mode !== 'wildcard'
          ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-70'
          : 'cursor-pointer',
        mode === 'wildcard'
          ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500'
          : 'border-slate-200 bg-white hover:border-slate-300',
      ]"
    >
      <input
        type="radio"
        class="mt-0.5 size-4"
        :checked="mode === 'wildcard'"
        :disabled="lockedWildcard && mode !== 'wildcard'"
        @change="setMode('wildcard')"
      />
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-slate-900 inline-flex items-center gap-1.5">
          <span aria-hidden="true">🃏</span>
          {{ t('products.wildcard.modes.wildcardLabel') }}
        </div>
        <div class="text-xs text-slate-500 mt-0.5">
          {{ t('products.wildcard.modes.wildcardHelp') }}
        </div>
        <div
          v-if="lockedWildcard && mode === 'wildcard' && lockedReason"
          class="mt-2 text-xs text-amber-700 inline-flex items-start gap-1"
        >
          <span aria-hidden="true">🔒</span>
          <span>{{ lockedReason }}</span>
        </div>
      </div>
    </label>

    <p v-if="errorIsWildcard" class="field-error">{{ errorIsWildcard }}</p>
  </div>
</template>
