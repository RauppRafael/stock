<script setup lang="ts">
import type { Data } from '@generated/data'

defineProps<{
  modelValue: number | null
  categories: Data.Category[]
  /** Show a dashed "+ Add" tile that emits `add` when clicked. */
  allowAdd?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
  add: []
}>()

function pick(id: number) {
  emit('update:modelValue', id)
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="cat in categories"
      :key="cat.id"
      type="button"
      class="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition"
      :class="
        modelValue === cat.id
          ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600'
          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
      "
      @click="pick(cat.id)"
    >
      <span v-if="cat.icon" class="text-base leading-none">{{ cat.icon }}</span>
      <span class="font-medium">{{ cat.name }}</span>
    </button>
    <button
      v-if="allowAdd"
      type="button"
      class="inline-flex items-center gap-1 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-brand-500 hover:text-brand-700 transition"
      @click="emit('add')"
    >
      <span class="text-base leading-none">+</span>
      <span class="font-medium">{{ $t('categories.new').replace(/^\+ ?/, '') }}</span>
    </button>
  </div>
</template>
