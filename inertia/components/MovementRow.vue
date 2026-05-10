<script setup lang="ts">
import { computed } from 'vue'
import { DateTime } from 'luxon'
import { router } from '@inertiajs/vue3'
import { useI18n } from 'vue-i18n'
import type { Data } from '@generated/data'
import VariantTags from '~/components/VariantTags.vue'

const props = defineProps<{
  movement: Data.StockMovement
}>()

const { t } = useI18n()

const canAdjust = computed(
  () => !!(props.movement.variantId && props.movement.locationId)
)

function adjust() {
  if (!canAdjust.value) return
  router.get('/stock/adjust', {
    variantId: props.movement.variantId,
    locationId: props.movement.locationId,
  })
}

const datePart = computed(() => {
  if (!props.movement.createdAt) return null
  const dt = DateTime.fromISO(props.movement.createdAt)
  return dt.isValid ? dt.toFormat('dd/MM/yyyy') : null
})

const timePart = computed(() => {
  if (!props.movement.createdAt) return null
  const dt = DateTime.fromISO(props.movement.createdAt)
  return dt.isValid ? dt.toFormat('HH:mm') : null
})

const deltaTone = computed(() => {
  if (props.movement.delta > 0) return 'text-emerald-600'
  if (props.movement.delta < 0) return 'text-rose-600'
  return 'text-slate-500'
})

const deltaSign = computed(() => (props.movement.delta > 0 ? '+' : ''))
</script>

<template>
  <tr
    class="text-sm transition"
    :class="canAdjust ? 'cursor-pointer hover:bg-slate-50' : ''"
    @click="adjust"
  >
    <td class="px-4 py-2.5 text-slate-600">
      <div v-if="datePart" class="text-xs whitespace-nowrap">{{ datePart }}</div>
      <div v-if="timePart" class="text-[11px] text-slate-400 whitespace-nowrap">{{ timePart }}</div>
      <span v-if="!datePart && !timePart">—</span>
    </td>
    <td class="px-4 py-2.5">
      <div class="font-medium text-slate-900 whitespace-nowrap">
        {{ movement.variant?.product?.name ?? t('movements.fallbackVariant', { id: movement.variantId }) }}
      </div>
      <div
        v-if="movement.variant?.product?.category?.name"
        class="text-xs text-slate-400 inline-flex items-center gap-1 whitespace-nowrap"
      >
        <span v-if="movement.variant.product.category.icon">
          {{ movement.variant.product.category.icon }}
        </span>
        {{ movement.variant.product.category.name }}
      </div>
    </td>
    <td class="px-4 py-2.5">
      <VariantTags :variant="movement.variant" />
    </td>
    <td class="px-4 py-2.5 text-slate-700 whitespace-nowrap">
      <span class="inline-flex items-center gap-1">
        <span v-if="movement.location?.icon">{{ movement.location.icon }}</span>
        {{ movement.location?.name ?? '—' }}
      </span>
    </td>
    <td class="px-4 py-2.5 text-center tabular-nums whitespace-nowrap">
      <div>
        <span class="text-slate-500">{{ movement.previousQuantity }}</span>
        <span class="text-slate-300 mx-1">→</span>
        <span class="font-semibold text-slate-900">{{ movement.newQuantity }}</span>
      </div>
      <div class="text-xs font-semibold" :class="deltaTone">
        {{ deltaSign }}{{ movement.delta }}
      </div>
    </td>
    <td class="px-4 py-2.5 text-slate-700">{{ movement.user?.fullName ?? '—' }}</td>
    <td class="px-4 py-2.5 text-slate-600 max-w-xs">
      <span v-if="movement.reason" class="text-xs">{{ movement.reason }}</span>
      <span v-else class="text-slate-300 italic text-xs">{{ $t('common.empty.noReason') }}</span>
    </td>
  </tr>
</template>
