<script setup lang="ts" generic="T extends { id: number; name: string }">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  options: T[]
  modelValue: number[]
  description?: string
  /** Show a dashed "+ Add" pill at the end that emits `add`. */
  allowAdd?: boolean
  /** Label for the add pill (defaults to a localized "+ New"). */
  addLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number[]]
  add: []
}>()

const selected = computed(() => new Set(props.modelValue))

function toggle(id: number) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  emit('update:modelValue', [...next])
}

function selectAll() {
  emit('update:modelValue', props.options.map((o) => o.id))
}

function clear() {
  emit('update:modelValue', [])
}
</script>

<template>
  <fieldset class="space-y-2">
    <div class="flex items-end justify-between gap-2">
      <div>
        <legend class="label">{{ label }}</legend>
        <p v-if="description" class="text-xs text-slate-500 -mt-1">{{ description }}</p>
      </div>
      <div class="flex gap-1 text-xs">
        <button
          type="button"
          class="text-brand-600 hover:text-brand-700 font-medium"
          @click="selectAll"
        >
          {{ $t('common.actions.selectAll') }}
        </button>
        <span class="text-slate-300">·</span>
        <button
          type="button"
          class="text-slate-500 hover:text-slate-700 font-medium"
          @click="clear"
        >
          {{ $t('common.actions.selectNone') }}
        </button>
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="option in options"
        :key="option.id"
        type="button"
        class="px-3 py-1.5 text-sm rounded-full border transition"
        :class="
          selected.has(option.id)
            ? 'bg-brand-600 border-brand-600 text-white'
            : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
        "
        @click="toggle(option.id)"
      >
        <slot name="option" :option="option" :selected="selected.has(option.id)">
          {{ option.name }}
        </slot>
      </button>
      <button
        v-if="allowAdd"
        type="button"
        class="px-3 py-1.5 text-sm rounded-full border border-dashed border-slate-300 text-slate-500 hover:border-brand-500 hover:text-brand-700 transition inline-flex items-center gap-1"
        @click="emit('add')"
      >
        <span class="text-base leading-none">+</span>
        {{ addLabel ?? $t('common.actions.create') }}
      </button>
      <p v-if="!options.length && !allowAdd" class="text-sm text-slate-400 italic">{{ $t('common.empty.noOptions') }}</p>
    </div>
  </fieldset>
</template>
