<script setup lang="ts">
import { computed } from 'vue'
import { DateTime } from 'luxon'
import { useI18n } from 'vue-i18n'
import type { Data } from '@generated/data'

const props = defineProps<{
  movement: Data.StockMovement
}>()

const { t } = useI18n()

const formattedDate = computed(() => {
  if (!props.movement.createdAt) return '—'
  const dt = DateTime.fromISO(props.movement.createdAt)
  return dt.isValid ? dt.toFormat('dd/MM/yyyy HH:mm') : '—'
})

const deltaTone = computed(() => {
  if (props.movement.delta > 0) return 'text-emerald-600'
  if (props.movement.delta < 0) return 'text-rose-600'
  return 'text-slate-500'
})

const deltaSign = computed(() => (props.movement.delta > 0 ? '+' : ''))
</script>

<template>
  <tr class="text-sm">
    <td class="px-4 py-2.5 whitespace-nowrap text-slate-600">{{ formattedDate }}</td>
    <td class="px-4 py-2.5">
      <div class="font-medium text-slate-800">
        {{ movement.variant?.displayName ?? t('movements.fallbackVariant', { id: movement.variantId }) }}
      </div>
      <div class="text-xs text-slate-400">{{ movement.variant?.skuCode }}</div>
    </td>
    <td class="px-4 py-2.5 text-slate-700">{{ movement.location?.name ?? '—' }}</td>
    <td class="px-4 py-2.5 text-right tabular-nums">
      <span class="text-slate-500">{{ movement.previousQuantity }}</span>
      <span class="text-slate-300 mx-1">→</span>
      <span class="font-semibold text-slate-900">{{ movement.newQuantity }}</span>
    </td>
    <td class="px-4 py-2.5 text-right tabular-nums font-semibold" :class="deltaTone">
      {{ deltaSign }}{{ movement.delta }}
    </td>
    <td class="px-4 py-2.5 text-slate-700">{{ movement.user?.email ?? '—' }}</td>
    <td class="px-4 py-2.5 text-slate-600 max-w-xs">
      <span v-if="movement.reason" class="text-xs">{{ movement.reason }}</span>
      <span v-else class="text-slate-300 italic text-xs">{{ $t('common.empty.noReason') }}</span>
    </td>
  </tr>
</template>
