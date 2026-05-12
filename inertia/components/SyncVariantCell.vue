<script setup lang="ts">
/**
 * Compact variant cell used in the /sync tables. Mirrors the swatch + size
 * box pattern from VariantSummary / VariantSelector elsewhere in the app:
 * a small color circle showing the hex, and a rounded box with the size
 * letter. Falls back to slate-200 for colors with no hex.
 */
defineProps<{
  productName: string
  color: { name: string; hexCode: string | null } | null
  size: { name: string } | null
  imageUrl?: string | null
}>()
</script>

<template>
  <div class="flex items-center gap-2 min-w-0">
    <img
      v-if="imageUrl"
      :src="imageUrl"
      :alt="productName"
      class="size-8 rounded object-cover border border-slate-200 shrink-0"
    />
    <span class="text-sm text-slate-900 font-medium truncate">{{ productName }}</span>
    <span
      v-if="color"
      class="inline-flex items-center gap-1.5 rounded-md bg-slate-100 text-slate-700 px-1.5 py-0.5 text-xs whitespace-nowrap shrink-0"
    >
      <span
        class="size-2.5 rounded-full ring-1 ring-slate-200 shrink-0"
        :style="{ background: color.hexCode ?? '#cbd5e1' }"
      />
      <span class="font-medium">{{ color.name }}</span>
    </span>
    <span
      v-if="size"
      class="inline-flex items-center justify-center min-w-[1.75rem] h-6 px-1.5 rounded-md bg-slate-100 ring-1 ring-slate-200 text-xs font-semibold text-slate-700 tabular-nums shrink-0"
    >
      {{ size.name }}
    </span>
  </div>
</template>
