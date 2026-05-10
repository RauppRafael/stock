<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { toast, Toaster } from 'vue-sonner'
import type { Data } from '@generated/data'
import { Link, Form } from '@adonisjs/inertia/vue'
import LanguageSwitcher from '~/components/LanguageSwitcher.vue'

const page = usePage<Data.SharedProps>()

const mobileMenuOpen = ref(false)

watch(
  () => page.url,
  () => {
    toast.dismiss()
    mobileMenuOpen.value = false
  }
)

watch(
  () => page.props.flash,
  (flashMessages) => {
    if (flashMessages.error) {
      toast.error(flashMessages.error)
    }
    if (flashMessages.success) {
      toast.success(flashMessages.success)
    }
  },
  { immediate: true }
)

const isAuthed = computed(() => !!page.props.user)

const navGroups = [
  {
    labelKey: 'nav.groups.operations',
    items: [
      { labelKey: 'nav.items.stock', route: 'stock.index', matches: ['/stock'] },
      { labelKey: 'nav.items.adjustStock', route: 'stock.adjust.create', matches: ['/stock/adjust'] },
      { labelKey: 'nav.items.movements', route: 'movements.index', matches: ['/movements'] },
    ],
  },
  {
    labelKey: 'nav.groups.catalog',
    items: [
      { labelKey: 'nav.items.products', route: 'products.index', matches: ['/products'] },
      { labelKey: 'nav.items.categories', route: 'categories.index', matches: ['/categories'] },
      { labelKey: 'nav.items.locations', route: 'locations.index', matches: ['/locations'] },
    ],
  },
  {
    labelKey: 'nav.groups.attributes',
    items: [
      { labelKey: 'nav.items.colors', route: 'colors.index', matches: ['/colors'] },
      { labelKey: 'nav.items.prints', route: 'prints.index', matches: ['/prints'] },
      { labelKey: 'nav.items.sizes', route: 'sizes.index', matches: ['/sizes'] },
    ],
  },
] as const

/**
 * Highlight the most-specific nav item that matches the current URL. With
 * naive prefix matching, `/stock/adjust` would light up both Stock and
 * Adjust stock — picking the longest matching pattern resolves that.
 */
const activeRoute = computed(() => {
  const url = page.url
  let bestRoute: string | null = null
  let bestSpecificity = -1
  for (const group of navGroups) {
    for (const item of group.items) {
      for (const m of item.matches) {
        const matched = url === m || url.startsWith(m + '/') || url.startsWith(m + '?')
        if (matched && m.length > bestSpecificity) {
          bestSpecificity = m.length
          bestRoute = item.route
        }
      }
    }
  }
  return bestRoute
})

function isActive(item: { route: string }): boolean {
  return activeRoute.value === item.route
}
</script>

<template>
  <div v-if="isAuthed" class="min-h-screen lg:flex lg:h-screen">
    <!-- Mobile top bar -->
    <header
      class="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-slate-900 text-slate-100 px-4 h-14 shadow-sm"
    >
      <Link route="stock.index" class="text-base font-semibold tracking-tight">{{ $t('app.name') }}</Link>
      <button
        type="button"
        class="p-2 -mr-2 rounded-md hover:bg-slate-800"
        :aria-expanded="mobileMenuOpen"
        :aria-label="$t('nav.toggle')"
        @click="mobileMenuOpen = !mobileMenuOpen"
      >
        <svg
          v-if="!mobileMenuOpen"
          xmlns="http://www.w3.org/2000/svg"
          class="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          class="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </header>

    <!-- Backdrop for mobile drawer -->
    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="mobileMenuOpen"
        class="lg:hidden fixed inset-0 z-30 bg-slate-900/50"
        @click="mobileMenuOpen = false"
      />
    </Transition>

    <!-- Sidebar (drawer on mobile, static on lg+) -->
    <aside
      class="bg-slate-900 text-slate-100 flex flex-col fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ease-out lg:static lg:w-60 lg:translate-x-0 lg:shrink-0"
      :class="mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
    >
      <div class="px-5 py-4 border-b border-slate-800">
        <Link route="stock.index" class="block text-lg font-semibold tracking-tight">{{ $t('app.name') }}</Link>
        <p class="text-xs text-slate-400 mt-0.5">{{ $t('app.tagline') }}</p>
      </div>

      <nav class="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        <div v-for="group in navGroups" :key="group.labelKey">
          <div class="px-2 text-[11px] uppercase tracking-wider text-slate-500 mb-1.5 font-semibold">
            {{ $t(group.labelKey) }}
          </div>
          <ul class="space-y-0.5">
            <li v-for="item in group.items" :key="item.route">
              <Link
                :route="item.route"
                class="flex items-center px-3 py-2 lg:py-1.5 text-sm rounded-md transition"
                :class="
                  isActive(item)
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                "
              >
                {{ $t(item.labelKey) }}
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      <div class="px-3 pt-2 pb-3">
        <LanguageSwitcher />
      </div>
      <div class="px-3 py-3 border-t border-slate-800">
        <div class="flex items-center gap-3">
          <div
            class="size-8 shrink-0 rounded-full bg-brand-600 text-white text-xs font-semibold flex items-center justify-center"
          >
            {{ page.props.user?.initials }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-slate-400 truncate">{{ page.props.user?.email }}</p>
          </div>
          <Form route="session.destroy">
            <button type="submit" class="text-xs text-slate-400 hover:text-white">{{ $t('common.actions.logout') }}</button>
          </Form>
        </div>
      </div>
    </aside>

    <main class="flex-1 min-w-0 lg:overflow-y-auto">
      <slot />
    </main>
  </div>

  <main v-else class="min-h-screen">
    <slot />
  </main>

  <Toaster position="top-right" rich-colors />
</template>
