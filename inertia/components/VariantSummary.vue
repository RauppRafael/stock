<script setup lang="ts">
import { computed } from 'vue'
import type { Data } from '@generated/data'

const props = defineProps<{
  variant: Data.Variant
  locationName?: string
  currentQuantity: number | null
}>()

const tags = computed(() => {
  const list: { label: string; key: string; render?: 'color' | 'size' }[] = []
  if (props.variant.product?.category?.name) {
    list.push({ key: 'category', label: props.variant.product.category.name })
  }
  if (props.variant.color) {
    list.push({ key: 'color', label: props.variant.color.name, render: 'color' })
  }
  if (props.variant.print) {
    list.push({ key: 'print', label: props.variant.print.name })
  }
  if (props.variant.size) {
    list.push({ key: 'size', label: props.variant.size.name, render: 'size' })
  }
  return list
})
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
    <div class="flex items-start gap-4">
      <div
        v-if="variant.size"
        class="size-16 shrink-0 rounded-lg bg-slate-900 text-white flex items-center justify-center text-2xl font-bold tracking-tight"
        :title="`Size ${variant.size.name}`"
      >
        {{ variant.size.name }}
      </div>
      <div
        v-else-if="variant.color?.hexCode"
        class="size-16 shrink-0 rounded-lg ring-1 ring-slate-200"
        :style="{ background: variant.color.hexCode }"
        :title="variant.color.name"
      />
      <div
        v-else
        class="size-16 shrink-0 rounded-lg bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center text-slate-400 text-xs font-mono"
      >
        SKU
      </div>

      <div class="flex-1 min-w-0">
        <p class="text-base font-semibold text-slate-900">
          {{ variant.product?.name ?? variant.displayName }}
        </p>
        <p class="text-xs text-slate-500 font-mono mt-0.5">{{ variant.skuCode }}</p>

        <div class="mt-3 flex flex-wrap gap-1.5">
          <span
            v-for="tag in tags"
            :key="tag.key"
            class="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-xs text-slate-700"
          >
            <span
              v-if="tag.render === 'color' && variant.color?.hexCode"
              class="size-2.5 rounded-full ring-1 ring-slate-200"
              :style="{ background: variant.color.hexCode }"
            />
            {{ tag.label }}
          </span>
        </div>
      </div>
    </div>

    <div
      class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-sm"
    >
      <span class="text-slate-500">
        At <span class="font-medium text-slate-700">{{ locationName ?? '—' }}</span>
      </span>
      <span class="text-slate-500">
        Current on-hand:
        <span v-if="currentQuantity !== null" class="font-semibold text-slate-900 tabular-nums">
          {{ currentQuantity }}
        </span>
        <span v-else class="text-slate-400">…</span>
      </span>
    </div>
  </div>
</template>
