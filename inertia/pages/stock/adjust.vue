<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { z } from 'zod'
import { urlFor } from '~/client'
import type { Data } from '@generated/data'
import {
  categorySchema,
  dataEnvelope,
  locationSchema,
  stockGridSchema,
  variantSchema,
} from '@contracts'
import { useValidatedProps } from '~/composables/use_validated_props'
import PageHeader from '~/components/PageHeader.vue'
import VariantSelector from '~/components/VariantSelector.vue'
import QuantityStepper from '~/components/QuantityStepper.vue'

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

const gridResponseSchema = dataEnvelope(stockGridSchema)

const initialLocationId =
  props.prefilledLocationId ?? props.locations[0]?.id ?? null

type Selection = {
  productId: number
  colorId: number | null
  locationId: number
}

const selection = ref<Selection | null>(null)
const variants = ref<Data.Variant[]>([])
const baselines = ref<Record<number, number>>({})
const drafts = ref<Record<number, number>>({})
const reason = ref<string>('')
const loading = ref(false)
const submitting = ref(false)

const selectedLocation = computed(
  () => props.locations.find((l) => l.id === selection.value?.locationId) ?? null
)
const selectedProductName = computed(() => variants.value[0]?.product?.name ?? null)
const selectedCategoryIcon = computed(
  () => variants.value[0]?.product?.category?.icon ?? null
)
const selectedColor = computed(() => {
  const cId = selection.value?.colorId
  if (!cId) return null
  return variants.value.find((v) => v.color?.id === cId)?.color ?? null
})

const pendingChanges = computed(() => {
  let n = 0
  for (const v of variants.value) {
    if (drafts.value[v.id] !== baselines.value[v.id]) n++
  }
  return n
})

async function loadGrid(sel: Selection) {
  loading.value = true
  try {
    const url = urlFor('stock.lookup.grid', {
      productId: sel.productId,
      locationId: sel.locationId,
    })
    const params = new URLSearchParams()
    if (sel.colorId) params.set('colorId', String(sel.colorId))
    const fullUrl = params.toString() ? `${url}?${params.toString()}` : url
    const res = await fetch(fullUrl, { headers: { Accept: 'application/json' } })
    const parsed = gridResponseSchema.safeParse(await res.json())
    if (!parsed.success) {
      // eslint-disable-next-line no-console
      console.error('[contracts] /stock/lookup/grid payload invalid:', parsed.error.issues)
      variants.value = []
      baselines.value = {}
      drafts.value = {}
      return
    }
    variants.value = parsed.data.data.variants as Data.Variant[]
    const nextBaselines: Record<number, number> = {}
    const nextDrafts: Record<number, number> = {}
    for (const v of variants.value) {
      const q = parsed.data.data.quantities[String(v.id)] ?? 0
      nextBaselines[v.id] = q
      nextDrafts[v.id] = q
    }
    baselines.value = nextBaselines
    drafts.value = nextDrafts
  } finally {
    loading.value = false
  }
}

watch(
  selection,
  (next) => {
    if (!next) {
      variants.value = []
      baselines.value = {}
      drafts.value = {}
      return
    }
    loadGrid(next)
  },
  { deep: true }
)

function onResolved(payload: { variant: Data.Variant; locationId: number }) {
  selection.value = {
    productId: payload.variant.productId,
    colorId: payload.variant.color?.id ?? null,
    locationId: payload.locationId,
  }
}

function onCleared() {
  selection.value = null
}

function setQuantity(variantId: number, value: number | null) {
  if (value === null) return
  drafts.value = { ...drafts.value, [variantId]: value }
}

function deltaFor(variantId: number): number {
  return (drafts.value[variantId] ?? 0) - (baselines.value[variantId] ?? 0)
}
function deltaLabelFor(variantId: number): string {
  const d = deltaFor(variantId)
  if (d === 0) return ''
  return `${d > 0 ? '+' : ''}${d}`
}
function deltaToneFor(variantId: number): string {
  const d = deltaFor(variantId)
  if (d === 0) return 'text-slate-300'
  return d > 0 ? 'text-emerald-600' : 'text-rose-600'
}

function submit() {
  if (!selection.value || pendingChanges.value === 0 || submitting.value) return
  submitting.value = true
  const adjustments = variants.value
    .filter((v) => drafts.value[v.id] !== baselines.value[v.id])
    .map((v) => ({ variantId: v.id, newQuantity: drafts.value[v.id] }))

  router.post(
    urlFor('stock.adjust.bulk'),
    {
      locationId: selection.value.locationId,
      adjustments,
      reason: reason.value.trim() || null,
    },
    {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        if (selection.value) loadGrid(selection.value)
        reason.value = ''
      },
      onFinish: () => {
        submitting.value = false
      },
    }
  )
}
</script>

<template>
  <Head :title="$t('stock.adjust.title')" />
  <div class="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
    <PageHeader
      :title="$t('stock.adjust.title')"
      :description="$t('stock.adjust.description')"
    />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      <div class="card p-5">
        <h2 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          {{ $t('stock.adjust.stepLocate') }}
        </h2>
        <VariantSelector
          :categories="categories"
          :locations="locations"
          :initial-variant="prefilledVariant"
          :initial-location-id="initialLocationId"
          hide-size
          @variant-resolved="onResolved"
          @selection-cleared="onCleared"
        />
      </div>

      <div class="card p-5">
        <h2 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          {{ $t('stock.adjust.stepQuantity') }}
        </h2>

        <div
          v-if="!selection"
          class="text-sm text-slate-400 italic py-12 text-center"
        >
          {{ $t('stock.adjust.pickToContinue') }}
        </div>

        <div v-else-if="loading" class="text-sm text-slate-400 italic py-12 text-center">
          {{ $t('stock.adjust.loadingGrid') }}
        </div>

        <div v-else-if="variants.length === 0" class="text-sm text-slate-400 italic py-12 text-center">
          {{ $t('stock.adjust.noVariantsForSelection') }}
        </div>

        <div v-else class="space-y-5">
          <div class="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
            <p class="text-base font-semibold text-slate-900 inline-flex items-center gap-2">
              <span v-if="selectedCategoryIcon">{{ selectedCategoryIcon }}</span>
              {{ selectedProductName }}
            </p>
            <div class="mt-2 flex flex-wrap gap-1.5 text-xs">
              <span
                class="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-slate-700 whitespace-nowrap"
              >
                <span v-if="selectedLocation?.icon">{{ selectedLocation.icon }}</span>
                {{ selectedLocation?.name }}
              </span>
              <span
                v-if="selectedColor"
                class="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-slate-700 whitespace-nowrap"
              >
                <span
                  v-if="selectedColor.hexCode"
                  class="size-2.5 rounded-full ring-1 ring-slate-200"
                  :style="{ background: selectedColor.hexCode }"
                />
                <span class="font-medium">{{ selectedColor.name }}</span>
              </span>
            </div>
          </div>

          <ul class="divide-y divide-slate-100 rounded-xl border border-slate-200">
            <li
              v-for="v in variants"
              :key="v.id"
              class="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
            >
              <div class="flex items-center gap-3 min-w-0 sm:flex-1">
                <div
                  class="size-9 shrink-0 rounded-md bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center text-sm font-semibold text-slate-700 tabular-nums"
                >
                  {{ v.size?.name ?? '—' }}
                </div>
                <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs tabular-nums min-w-0">
                  <span>
                    <span class="text-slate-400">{{ $t('stock.adjust.initialLabel') }}:</span>
                    <span class="ml-1 text-slate-700 font-medium">{{ baselines[v.id] ?? 0 }}</span>
                  </span>
                  <span v-if="deltaLabelFor(v.id)">
                    <span class="text-slate-400">{{ $t('stock.adjust.changeLabel') }}:</span>
                    <span class="ml-1 font-semibold" :class="deltaToneFor(v.id)">{{ deltaLabelFor(v.id) }}</span>
                  </span>
                </div>
              </div>
              <div class="w-full sm:w-36 sm:shrink-0">
                <QuantityStepper
                  :model-value="drafts[v.id] ?? 0"
                  :current="baselines[v.id] ?? 0"
                  compact
                  hide-footer
                  @update:model-value="(value) => setQuantity(v.id, value)"
                />
              </div>
            </li>
          </ul>

          <div>
            <label for="reason" class="label">{{ $t('stock.adjust.reasonOptional') }}</label>
            <textarea
              id="reason"
              v-model="reason"
              rows="3"
              maxlength="1000"
              :placeholder="$t('stock.adjust.reasonPlaceholder')"
              class="textarea"
            />
          </div>

          <button
            type="button"
            class="btn-primary w-full"
            :disabled="submitting || pendingChanges === 0"
            @click="submit"
          >
            <template v-if="submitting">{{ $t('common.actions.saving') }}</template>
            <template v-else-if="pendingChanges === 0">
              {{ $t('stock.adjust.noChanges') }}
            </template>
            <template v-else>
              {{ $t('stock.adjust.saveAllPending', { count: pendingChanges }) }}
            </template>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
