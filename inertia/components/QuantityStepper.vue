<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  modelValue: number | null
  current: number | null
  max?: number
  invalid?: boolean
  /** Hide the "was N / Δ" caption below the stepper. */
  hideFooter?: boolean
  /** Render the stepper at a tighter size for use inside dense lists. */
  compact?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const { t } = useI18n()

const max = computed(() => props.max ?? 1_000_000)

function set(value: number) {
  const clamped = Math.max(0, Math.min(max.value, Math.floor(value)))
  emit('update:modelValue', clamped)
}

function bump(by: number) {
  const base = props.modelValue ?? props.current ?? 0
  set(base + by)
}

const delta = computed(() => {
  if (props.modelValue === null || props.current === null) return null
  return props.modelValue - props.current
})

const deltaTone = computed(() => {
  if (delta.value === null || delta.value === 0) return 'text-slate-400'
  return delta.value > 0 ? 'text-emerald-600' : 'text-rose-600'
})

const deltaLabel = computed(() => {
  if (delta.value === null) return ''
  if (delta.value === 0) return t('quantityStepper.noChange')
  return `${delta.value > 0 ? '+' : ''}${delta.value}`
})
</script>

<template>
  <div :class="hideFooter ? '' : 'space-y-2'">
    <div
      class="grid grid-cols-[auto_1fr_auto] items-stretch gap-0 rounded-xl border bg-white"
      :class="[invalid ? 'border-rose-500' : 'border-slate-300']"
    >
      <button
        type="button"
        class="text-slate-600 hover:bg-slate-50 active:bg-slate-100 rounded-l-xl font-light disabled:opacity-30 disabled:cursor-not-allowed"
        :class="compact ? 'px-3 py-2 text-xl' : 'px-4 py-3 text-2xl'"
        :disabled="(modelValue ?? 0) <= 0"
        :aria-label="$t('quantityStepper.decrement')"
        @click="bump(-1)"
      >
        −
      </button>
      <input
        :value="modelValue"
        type="number"
        inputmode="numeric"
        min="0"
        :max="max"
        class="no-spin w-full text-center font-semibold tabular-nums tracking-tight bg-transparent border-x border-slate-200 focus:outline-none focus:bg-brand-50/30 px-2"
        :class="compact ? 'text-xl' : 'text-3xl'"
        @input="
          (e) => {
            const value = (e.target as HTMLInputElement).value
            emit('update:modelValue', value === '' ? null : Number(value))
          }
        "
      />
      <button
        type="button"
        class="text-slate-600 hover:bg-slate-50 active:bg-slate-100 rounded-r-xl font-light"
        :class="compact ? 'px-3 py-2 text-xl' : 'px-4 py-3 text-2xl'"
        :aria-label="$t('quantityStepper.increment')"
        @click="bump(1)"
      >
        +
      </button>
    </div>

    <div v-if="!hideFooter" class="flex items-center justify-between text-xs text-slate-500 px-1">
      <span v-if="current !== null">{{ $t('quantityStepper.was', { value: current }) }}</span>
      <span v-else>&nbsp;</span>
      <span class="font-semibold tabular-nums" :class="deltaTone">{{ deltaLabel }}</span>
    </div>
  </div>
</template>
