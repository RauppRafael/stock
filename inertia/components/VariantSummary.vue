<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Data } from '@generated/data'

defineProps<{
  variant: Data.Variant
  locationName?: string
  locationIcon?: string | null
  currentQuantity: number | null
}>()

const { t } = useI18n()
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
    <div class="flex items-start gap-4">
      <div
        v-if="variant.size"
        class="size-12 shrink-0 rounded-md bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center text-sm font-semibold text-slate-700 tabular-nums"
        :title="t('variantSummary.sizeTitle', { name: variant.size.name })"
      >
        {{ variant.size.name }}
      </div>

      <div class="flex-1 min-w-0">
        <p class="text-base font-semibold text-slate-900">
          {{ variant.product?.name ?? variant.displayName }}
        </p>
        <p class="text-xs text-slate-500 font-mono mt-0.5">{{ variant.skuCode }}</p>

        <div class="mt-3 flex flex-wrap gap-1.5 text-xs">
          <span
            v-if="variant.product?.category?.name"
            class="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-slate-700 whitespace-nowrap"
          >
            <span v-if="variant.product.category.icon">{{ variant.product.category.icon }}</span>
            {{ variant.product.category.name }}
          </span>
          <span
            v-if="variant.color"
            class="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-slate-700 whitespace-nowrap"
          >
            <span
              v-if="variant.color.hexCode"
              class="size-2.5 rounded-full ring-1 ring-slate-200"
              :style="{ background: variant.color.hexCode }"
            />
            <span class="text-slate-500">{{ $t('common.labels.color') }}:</span>
            <span class="font-medium">{{ variant.color.name }}</span>
          </span>
        </div>
      </div>
    </div>

    <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
      <i18n-t keypath="variantSummary.atLocation" tag="span" class="text-slate-500">
        <template #location>
          <span class="font-medium text-slate-700 inline-flex items-center gap-1">
            <span v-if="locationIcon">{{ locationIcon }}</span>
            {{ locationName ?? '—' }}
          </span>
        </template>
      </i18n-t>
      <span class="text-slate-500">
        {{ $t('variantSummary.currentOnHand') }}
        <span v-if="currentQuantity !== null" class="font-semibold text-slate-900 tabular-nums">
          {{ currentQuantity }}
        </span>
        <span v-else class="text-slate-400">…</span>
      </span>
    </div>
  </div>
</template>
