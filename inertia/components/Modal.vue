<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch } from 'vue'

const props = defineProps<{
  open: boolean
  title: string
}>()

const emit = defineEmits<{ close: [] }>()

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) emit('close')
}

watch(
  () => props.open,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
  }
)

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 bg-slate-900/50"
        @click.self="emit('close')"
      >
        <div class="flex min-h-full items-start justify-center p-4 sm:p-8">
          <div
            class="relative bg-white rounded-lg shadow-xl w-full max-w-lg ring-1 ring-slate-200"
            @click.stop
          >
            <header class="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h2 class="text-base font-semibold text-slate-900">{{ title }}</h2>
              <button
                type="button"
                class="text-slate-400 hover:text-slate-700"
                :aria-label="$t('common.actions.close')"
                @click="emit('close')"
              >
                ✕
              </button>
            </header>
            <div class="px-5 py-4">
              <slot />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
