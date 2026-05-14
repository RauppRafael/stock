<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

const props = defineProps<{
  open: boolean
  title: string
}>()

const emit = defineEmits<{ close: [] }>()

const titleId = useId()
const panel = ref<HTMLElement | null>(null)
let lastFocused: HTMLElement | null = null
// Drag-release outside the panel (e.g. selecting text that ends up over the
// backdrop) would otherwise count as a backdrop click and close the modal.
// We only close when the press *started* on the backdrop too.
let downOnBackdrop = false

/**
 * Selector for elements that should participate in the Tab focus trap.
 * Disabled controls and items removed from the tab order are excluded.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusableElements(): HTMLElement[] {
  if (!panel.value) return []
  return Array.from(panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('aria-hidden')
  )
}

function onKey(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  if (event.key !== 'Tab') return
  const focusables = focusableElements()
  if (focusables.length === 0) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement as HTMLElement | null
  if (event.shiftKey && active === first) {
    last.focus()
    event.preventDefault()
  } else if (!event.shiftKey && active === last) {
    first.focus()
    event.preventDefault()
  }
}

watch(
  () => props.open,
  async (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) {
      lastFocused = document.activeElement as HTMLElement | null
      // Wait for the panel to mount, then focus the first form control
      // (input/select/textarea) so search-style modals land on the textbox.
      // The close ✕ in the header is technically the first focusable element,
      // but focusing it would make the user reach for the mouse to start typing.
      await nextTick()
      const focusables = focusableElements()
      const firstField = focusables.find(
        (el) =>
          (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'hidden') ||
          el.tagName === 'SELECT' ||
          el.tagName === 'TEXTAREA'
      )
      ;(firstField ?? focusables[0] ?? panel.value)?.focus()
    } else if (lastFocused && document.contains(lastFocused)) {
      lastFocused.focus()
      lastFocused = null
    }
  }
)

function onBackdropMouseDown(event: MouseEvent) {
  downOnBackdrop = event.target === event.currentTarget
}

function onBackdropMouseUp(event: MouseEvent) {
  const upOnBackdrop = event.target === event.currentTarget
  if (downOnBackdrop && upOnBackdrop) {
    emit('close')
  }
  downOnBackdrop = false
}

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
      <div v-if="open" class="fixed inset-0 z-50 bg-slate-900/50">
        <div
          class="flex min-h-full items-start sm:items-center justify-center p-4 sm:p-8"
          @mousedown="onBackdropMouseDown"
          @mouseup="onBackdropMouseUp"
        >
          <div
            ref="panel"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="titleId"
            tabindex="-1"
            class="relative bg-white rounded-lg shadow-xl w-full max-w-lg ring-1 ring-slate-200 focus:outline-none"
            @click.stop
          >
            <header class="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h2 :id="titleId" class="text-base font-semibold text-slate-900">{{ title }}</h2>
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
