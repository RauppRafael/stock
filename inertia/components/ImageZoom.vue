<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { shopifyThumb } from '~/utils/shopify_image'

const props = withDefaults(
  defineProps<{
    src: string | null | undefined
    alt: string
    thumbClass?: string
    thumbWidth?: number
    fullWidth?: number
  }>(),
  {
    thumbClass: 'size-10 rounded object-cover border border-slate-200',
    thumbWidth: 96,
    fullWidth: 1200,
  }
)

const open = ref(false)

const thumbUrl = computed(() => shopifyThumb(props.src ?? null, props.thumbWidth))
const fullUrl = computed(() => shopifyThumb(props.src ?? null, props.fullWidth))

function openZoom(event: MouseEvent) {
  // Stop the click from triggering parent row/list handlers (e.g. the picker
  // modal's `<li>` selection toggle) — the image is its own affordance.
  event.stopPropagation()
  open.value = true
}

function close() {
  open.value = false
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) close()
}

watch(open, (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : ''
  if (isOpen) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <template v-if="thumbUrl">
    <button
      type="button"
      class="shrink-0 rounded focus:outline-none focus:ring-2 focus:ring-slate-400"
      :aria-label="alt"
      @click="openZoom"
    >
      <img :src="thumbUrl" :alt="alt" :class="thumbClass" loading="lazy" decoding="async" />
    </button>
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
          class="fixed inset-0 z-50 bg-slate-900/80 flex items-center justify-center p-4 sm:p-8 cursor-zoom-out"
          role="dialog"
          aria-modal="true"
          :aria-label="alt"
          @click="close"
        >
          <img
            :src="fullUrl ?? thumbUrl"
            :alt="alt"
            class="max-h-full max-w-full object-contain rounded shadow-2xl cursor-default"
            decoding="async"
            @click.stop
          />
        </div>
      </Transition>
    </Teleport>
  </template>
</template>
