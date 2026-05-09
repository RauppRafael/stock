<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  quantity: number
  threshold?: number | null
}>()

const tone = computed(() => {
  if (props.quantity <= 0) return 'out'
  if (props.threshold != null && props.quantity <= props.threshold) return 'low'
  return 'ok'
})

const label = computed(() => {
  if (tone.value === 'out') return 'Out of stock'
  if (tone.value === 'low') return 'Low stock'
  return 'In stock'
})
</script>

<template>
  <span
    class="badge"
    :class="{
      'bg-rose-100 text-rose-700': tone === 'out',
      'bg-amber-100 text-amber-700': tone === 'low',
      'bg-emerald-100 text-emerald-700': tone === 'ok',
    }"
    :title="label"
  >
    <span
      class="size-1.5 rounded-full mr-1"
      :class="{
        'bg-rose-500': tone === 'out',
        'bg-amber-500': tone === 'low',
        'bg-emerald-500': tone === 'ok',
      }"
    />
    {{ quantity }}
  </span>
</template>
