<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES, setLocale, type Locale } from '~/i18n'

const { locale } = useI18n()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const current = computed(
  () => SUPPORTED_LOCALES.find((l) => l.code === locale.value) ?? SUPPORTED_LOCALES[0]
)

function pick(code: Locale) {
  if (code !== locale.value) setLocale(code)
  open.value = false
}

function onDocClick(event: MouseEvent) {
  if (!root.value) return
  if (!root.value.contains(event.target as Node)) open.value = false
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', onDocClick)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      :aria-label="$t('common.labels.language')"
      :aria-expanded="open"
      aria-haspopup="listbox"
      class="w-full inline-flex items-center justify-between gap-2 rounded-md bg-slate-800/60 hover:bg-slate-800 ring-1 ring-slate-700 px-2.5 py-1.5 text-xs text-slate-200 transition"
      @click="open = !open"
    >
      <span class="inline-flex items-center gap-2 min-w-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="size-4 shrink-0 text-slate-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
        </svg>
        <span class="truncate">{{ current.label }}</span>
      </span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="size-3 text-slate-400 transition"
        :class="open ? 'rotate-180' : ''"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <ul
        v-if="open"
        role="listbox"
        class="absolute bottom-full left-0 right-0 mb-1 rounded-md bg-slate-800 ring-1 ring-slate-700 shadow-lg overflow-hidden py-1 z-10"
      >
        <li v-for="l in SUPPORTED_LOCALES" :key="l.code">
          <button
            type="button"
            role="option"
            :aria-selected="locale === l.code"
            class="w-full inline-flex items-center gap-2 px-2.5 py-1.5 text-xs text-left transition"
            :class="
              locale === l.code
                ? 'bg-slate-700/60 text-white'
                : 'text-slate-300 hover:bg-slate-700/40 hover:text-white'
            "
            @click="pick(l.code)"
          >
            <span class="size-3 inline-flex items-center justify-center text-emerald-400">
              <svg
                v-if="locale === l.code"
                xmlns="http://www.w3.org/2000/svg"
                class="size-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M5 12l5 5L20 7" />
              </svg>
            </span>
            <span>{{ l.label }}</span>
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>
