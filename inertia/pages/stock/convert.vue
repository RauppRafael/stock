<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { z } from 'zod'
import { urlFor } from '~/client'
import type { Data } from '@generated/data'
import {
  categorySchema,
  dataEnvelope,
  locationSchema,
  productSchema,
  variantSchema,
} from '@contracts'
import { useValidatedProps } from '~/composables/use_validated_props'
import PageHeader from '~/components/PageHeader.vue'
import VariantSelector from '~/components/VariantSelector.vue'
import QuantityStepper from '~/components/QuantityStepper.vue'

/**
 * Page for converting wildcard stock into a printed product. Picks one
 * wildcard variant + location on the left, lists eligible targets (printed
 * products derived from that wildcard with a matching color/size variant)
 * on the right, and writes a paired stock movement on submit.
 *
 * The target list is fetched from the wildcardTargets lookup keyed by the
 * resolved wildcard variant — keeping the list server-side authoritative
 * means the matching rule (same color, same size, derivative-of) lives in
 * one place (`WildcardService.targetsForWildcardVariant`).
 */
const props = defineProps<{
  categories: Data.Category[]
  locations: Data.Location[]
  prefilledVariant: Data.Variant | null
  prefilledLocationId: number | null
}>()

useValidatedProps(
  props,
  z.object({
    categories: z.array(categorySchema),
    locations: z.array(locationSchema),
    prefilledVariant: variantSchema.nullable(),
    prefilledLocationId: z.number().int().nullable(),
  })
)

const targetSchema = z.object({
  product: productSchema,
  targetVariantId: z.number().int().nonnegative(),
})
const targetsResponseSchema = dataEnvelope(targetSchema.array())
const stockResponseSchema = dataEnvelope(z.object({ quantity: z.number().int() }))

const initialLocationId = props.prefilledLocationId ?? props.locations[0]?.id ?? null

const wildcardVariant = ref<Data.Variant | null>(props.prefilledVariant ?? null)
const locationId = ref<number | null>(initialLocationId)
const wildcardOnHand = ref<number | null>(null)

type Target = z.infer<typeof targetSchema>
const targets = ref<Target[]>([])
const selectedTarget = ref<Target | null>(null)
const quantity = ref<number | null>(1)
const reason = ref('')
const loadingTargets = ref(false)
const loadingOnHand = ref(false)
const submitting = ref(false)

const selectedLocation = computed(
  () => props.locations.find((l) => l.id === locationId.value) ?? null
)

async function loadTargets(variantId: number) {
  loadingTargets.value = true
  try {
    const url = urlFor('stock.lookup.wildcardTargets', { wildcardVariantId: variantId })
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    const parsed = targetsResponseSchema.safeParse(await res.json())
    if (!parsed.success) {
      // eslint-disable-next-line no-console
      console.error('[contracts] wildcardTargets payload invalid:', parsed.error.issues)
      targets.value = []
      return
    }
    targets.value = parsed.data.data
    selectedTarget.value = targets.value[0] ?? null
  } finally {
    loadingTargets.value = false
  }
}

async function loadOnHand(variantId: number, locId: number) {
  loadingOnHand.value = true
  try {
    const url = urlFor('stock.lookup.quantity', { variantId, locationId: locId })
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    const parsed = stockResponseSchema.safeParse(await res.json())
    if (!parsed.success) {
      // eslint-disable-next-line no-console
      console.error('[contracts] stock.lookup.quantity payload invalid:', parsed.error.issues)
      wildcardOnHand.value = null
      return
    }
    wildcardOnHand.value = parsed.data.data.quantity
    // Clamp quantity to remaining stock so the operator can't queue an
    // impossible conversion. We don't want to silently snap to 0 either —
    // if nothing is in stock, leave it null and disable the submit button.
    if (wildcardOnHand.value === 0) {
      quantity.value = null
    } else if (quantity.value === null || quantity.value > wildcardOnHand.value) {
      quantity.value = Math.min(quantity.value ?? 1, wildcardOnHand.value)
    }
  } finally {
    loadingOnHand.value = false
  }
}

watch(
  [wildcardVariant, locationId],
  ([v, l]) => {
    if (!v || !l) {
      targets.value = []
      selectedTarget.value = null
      wildcardOnHand.value = null
      return
    }
    loadTargets(v.id)
    loadOnHand(v.id, l)
  },
  { immediate: true }
)

function onResolved(payload: { variant: Data.Variant; locationId: number }) {
  wildcardVariant.value = payload.variant
  locationId.value = payload.locationId
}

function onCleared() {
  wildcardVariant.value = null
}

const canSubmit = computed(() => {
  return (
    !submitting.value &&
    !!wildcardVariant.value &&
    !!locationId.value &&
    !!selectedTarget.value &&
    (quantity.value ?? 0) > 0 &&
    (wildcardOnHand.value ?? 0) >= (quantity.value ?? 0)
  )
})

function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  router.post(
    urlFor('stock.convert'),
    {
      wildcardVariantId: wildcardVariant.value!.id,
      targetVariantId: selectedTarget.value!.targetVariantId,
      locationId: locationId.value!,
      quantity: quantity.value!,
      reason: reason.value.trim() || null,
    },
    {
      preserveScroll: true,
      onFinish: () => (submitting.value = false),
    }
  )
}
</script>

<template>
  <Head :title="$t('stock.convert.title')" />
  <div class="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
    <PageHeader :title="$t('stock.convert.title')" :description="$t('stock.convert.description')">
      <template #actions>
        <Link route="stock.index" class="btn-ghost">{{ $t('common.actions.cancel') }}</Link>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      <div class="card p-5">
        <h2 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          {{ $t('stock.convert.stepLocate') }}
        </h2>
        <div
          class="mb-4 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700 flex items-start gap-2"
        >
          <span class="text-base leading-none">🃏</span>
          <span>{{ $t('stock.convert.wildcardHint') }}</span>
        </div>
        <VariantSelector
          :categories="categories"
          :locations="locations"
          :initial-variant="prefilledVariant"
          :initial-location-id="initialLocationId"
          product-filter="wildcard"
          @variant-resolved="onResolved"
          @selection-cleared="onCleared"
        />
      </div>

      <div class="card p-5">
        <h2 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          {{ $t('stock.convert.stepTarget') }}
        </h2>

        <div
          v-if="!wildcardVariant || !locationId"
          class="text-sm text-slate-400 italic py-12 text-center"
        >
          {{ $t('stock.convert.pickToContinue') }}
        </div>

        <div v-else class="space-y-5">
          <div
            class="rounded-xl border border-slate-200 bg-gradient-to-br from-violet-50/40 to-white p-4"
          >
            <p class="text-base font-semibold text-slate-900 inline-flex items-center gap-2">
              <span aria-hidden="true">🃏</span>
              {{ wildcardVariant.product?.name }}
            </p>
            <div class="mt-2 flex flex-wrap gap-1.5 text-xs">
              <span
                class="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-slate-700 whitespace-nowrap"
              >
                <span v-if="selectedLocation?.icon">{{ selectedLocation.icon }}</span>
                {{ selectedLocation?.name }}
              </span>
              <span
                v-if="wildcardVariant.color"
                class="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-slate-700 whitespace-nowrap"
              >
                <span
                  v-if="wildcardVariant.color.hexCode"
                  class="size-2.5 rounded-full ring-1 ring-slate-200"
                  :style="{ background: wildcardVariant.color.hexCode }"
                />
                <span class="font-medium">{{ wildcardVariant.color.name }}</span>
              </span>
              <span
                v-if="wildcardVariant.size"
                class="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-slate-700 whitespace-nowrap font-medium"
              >
                {{ wildcardVariant.size.name }}
              </span>
            </div>
            <div class="mt-3 text-xs text-slate-500">
              {{ $t('stock.convert.wildcardOnHand') }}:
              <span class="font-semibold text-slate-800 tabular-nums ml-1">
                <template v-if="loadingOnHand">…</template>
                <template v-else>{{ wildcardOnHand ?? 0 }}</template>
              </span>
            </div>
          </div>

          <div>
            <p class="label">{{ $t('stock.convert.targetLabel') }}</p>
            <div v-if="loadingTargets" class="text-xs text-slate-400 italic py-6 text-center">
              {{ $t('common.actions.loading') }}
            </div>
            <div v-else-if="!targets.length" class="text-xs text-slate-400 italic py-6 text-center">
              {{ $t('stock.convert.noTargets') }}
            </div>
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                v-for="t in targets"
                :key="t.product.id"
                type="button"
                class="text-left rounded-lg border px-3 py-2 transition"
                :class="
                  selectedTarget?.product.id === t.product.id
                    ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                    : 'border-slate-200 bg-white hover:border-slate-400'
                "
                @click="selectedTarget = t"
              >
                <span class="block text-sm font-medium text-slate-900">
                  {{ t.product.name }}
                </span>
                <code class="block text-[10px] font-mono text-slate-500 mt-0.5">{{
                  t.product.code
                }}</code>
              </button>
            </div>
          </div>

          <div v-if="targets.length">
            <p class="label">{{ $t('stock.convert.quantityLabel') }}</p>
            <QuantityStepper
              :model-value="quantity"
              :current="0"
              :max="wildcardOnHand ?? 0"
              hide-footer
              @update:model-value="(value) => (quantity = value)"
            />
            <p v-if="wildcardOnHand !== null" class="text-xs text-slate-500 mt-1 tabular-nums">
              {{ $t('stock.convert.maxHint', { max: wildcardOnHand }) }}
            </p>
          </div>

          <div v-if="targets.length">
            <label for="convert-reason" class="label">{{
              $t('stock.adjust.reasonOptional')
            }}</label>
            <textarea
              id="convert-reason"
              v-model="reason"
              rows="2"
              maxlength="1000"
              class="textarea"
              :placeholder="$t('stock.convert.reasonPlaceholder')"
            />
          </div>

          <button type="button" class="btn-primary w-full" :disabled="!canSubmit" @click="submit">
            <template v-if="submitting">{{ $t('common.actions.saving') }}</template>
            <template v-else-if="!targets.length">{{
              $t('stock.convert.noTargetsAction')
            }}</template>
            <template v-else-if="(wildcardOnHand ?? 0) === 0">{{
              $t('stock.convert.outOfStock')
            }}</template>
            <template v-else>{{ $t('stock.convert.submit', { count: quantity ?? 0 }) }}</template>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
