<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  ariaLabel?: string
  emojis: readonly string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function pick(emoji: string) {
  emit('update:modelValue', emoji)
}

function clear() {
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="space-y-2">
    <div
      class="rounded-md border border-slate-300 bg-white p-2 grid grid-cols-9 gap-1 text-xl max-h-40 overflow-y-auto"
      :aria-label="ariaLabel ?? $t('common.labels.icon')"
    >
      <button
        v-for="emoji in props.emojis"
        :key="emoji"
        type="button"
        class="size-8 rounded-md flex items-center justify-center transition leading-none"
        :class="
          modelValue === emoji
            ? 'bg-brand-100 ring-2 ring-brand-500'
            : 'hover:bg-slate-100'
        "
        :title="emoji"
        @click="pick(emoji)"
      >
        {{ emoji }}
      </button>
    </div>

    <div class="flex items-center justify-between text-xs text-slate-500">
      <span v-if="modelValue" class="inline-flex items-center gap-1.5">
        {{ $t('common.selected') }} <span class="text-base leading-none">{{ modelValue }}</span>
      </span>
      <span v-else class="italic text-slate-400">{{ $t('common.empty.noIcon') }}</span>
      <button
        v-if="modelValue"
        type="button"
        class="text-slate-500 hover:text-slate-700 font-medium"
        @click="clear"
      >
        {{ $t('common.actions.clear') }}
      </button>
    </div>
  </div>
</template>
