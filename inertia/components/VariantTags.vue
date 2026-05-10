<script setup lang="ts">
import type { Data } from '@generated/data'

defineProps<{
  variant: Data.Variant | null | undefined
}>()
</script>

<template>
  <div class="flex flex-wrap gap-1 text-xs">
    <span
      v-if="variant?.color"
      class="inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-700 px-1.5 py-0.5 whitespace-nowrap"
    >
      <span
        v-if="variant.color.hexCode"
        class="size-2.5 rounded-full ring-1 ring-slate-200"
        :style="{ background: variant.color.hexCode }"
      />
      <span class="text-slate-500">{{ $t('common.labels.color') }}:</span>
      <span class="font-medium">{{ variant.color.name }}</span>
    </span>
    <span
      v-if="variant?.print"
      class="inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-700 px-1.5 py-0.5 whitespace-nowrap"
    >
      <span class="text-slate-500">{{ $t('common.labels.print') }}:</span>
      <span class="font-medium">{{ variant.print.name }}</span>
    </span>
    <span
      v-if="variant?.size"
      class="inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-700 px-1.5 py-0.5 whitespace-nowrap"
    >
      <span class="text-slate-500">{{ $t('common.labels.size') }}:</span>
      <span class="font-medium">{{ variant.size.name }}</span>
    </span>
    <span v-if="!variant?.color && !variant?.print && !variant?.size" class="text-slate-300">—</span>
  </div>
</template>
