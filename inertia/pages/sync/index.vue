<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { urlFor } from '~/client'
import type { Data } from '@generated/data'
import PageHeader from '~/components/PageHeader.vue'
import Modal from '~/components/Modal.vue'
import SyncVariantCell from '~/components/SyncVariantCell.vue'

const { t } = useI18n()

type ShopifyVariantInfo = {
  shopifyVariantId: string
  shopifyProductId: string
  shopifyProductTitle: string
  shopifyVariantTitle: string
  options: Array<{ name: string; value: string }>
  currentSku: string | null
  imageUrl: string | null
}
type LocalVariantDisplay = {
  productName: string
  category: { id: number; name: string } | null
  color: { name: string; hexCode: string | null } | null
  size: { name: string } | null
  imageUrl: string | null
}
type LinkRow = {
  localVariantId: number
  localProductId: number
  display: LocalVariantDisplay
  currentLinks: ShopifyVariantInfo[]
}
type PushTarget = {
  shopifyVariantId: string
  shopifyProductTitle: string
  shopifyVariantTitle: string
  shopifyQuantity: number | null
}
type PushRow = {
  localVariantId: number
  display: LocalVariantDisplay
  localTotal: number
  targets: PushTarget[]
}
type PullTarget = {
  shopifyVariantId: string
  shopifyProductTitle: string
  shopifyVariantTitle: string
  shopifyQuantity: number
  lastKnownQuantity: number | null
  delta: number
}
type PullRow = {
  localVariantId: number
  display: LocalVariantDisplay
  localTotal: number
  totalDecrement: number
  targets: PullTarget[]
}
type DiffPayload = {
  configured: boolean
  link?: { rows: LinkRow[]; candidates: ShopifyVariantInfo[] } | null
  push?: PushRow[] | null
  pull?: PullRow[] | null
  locations?: Data.Location[]
  categories?: Data.Category[]
  lastPullAt?: string | null
  lastPushAt?: string | null
}

const props = defineProps<{ configured: boolean }>()

type Tab = 'link' | 'push' | 'pull'
const tab = ref<Tab>('link')

const loading = ref(false)
const link = shallowRef<{ rows: LinkRow[]; candidates: ShopifyVariantInfo[] } | null>(null)
const push = shallowRef<PushRow[] | null>(null)
const pull = shallowRef<PullRow[] | null>(null)
const locations = shallowRef<Data.Location[]>([])
const categories = shallowRef<Data.Category[]>([])
const lastPullAt = ref<string | null>(null)
const lastPushAt = ref<string | null>(null)

/**
 * Filter state. `search` and `categoryId` apply across all three tabs;
 * `linkStatus` only narrows the Link tab (rows whose `currentLinks` array
 * is empty vs. non-empty). Filtering runs client-side against the diff
 * payload — small catalogs render instantly, and we avoid round-tripping
 * to Shopify just to narrow a view.
 */
const search = ref('')
const filterCategoryId = ref<number | null>(null)
type LinkStatusFilter = 'all' | 'linked' | 'unlinked'
const linkStatus = ref<LinkStatusFilter>('all')

function clearFilters() {
  search.value = ''
  filterCategoryId.value = null
  linkStatus.value = 'all'
}

const hasActiveFilters = computed(() => {
  return (
    search.value.trim().length > 0 ||
    filterCategoryId.value !== null ||
    (tab.value === 'link' && linkStatus.value !== 'all')
  )
})

/**
 * Match a display block against the active search + category filters.
 * Search is case-insensitive across product name, color name, size name,
 * and any linked Shopify product/variant title for that row.
 */
function matchesDisplayFilters(
  display: LocalVariantDisplay,
  extraSearchHaystack: string[] = []
): boolean {
  if (filterCategoryId.value !== null && display.category?.id !== filterCategoryId.value) {
    return false
  }
  const q = search.value.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    display.productName,
    display.color?.name ?? '',
    display.size?.name ?? '',
    display.category?.name ?? '',
    ...extraSearchHaystack,
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

/**
 * Per-local-variant array of Shopify GIDs pending to be linked. Each row
 * accumulates picks across multiple "Add" actions before submission.
 */
const linkPending = reactive<Record<number, string[]>>({})
const pushPicks = reactive<Record<number, boolean>>({})
const pullPicks = reactive<Record<number, { picked: boolean; locationId: number | null }>>({})

/** Picker modal state. */
const pickerForVariantId = ref<number | null>(null)
const pickerSelected = ref<Set<string>>(new Set())
const pickerSearch = ref('')

/**
 * The raw, unfiltered row lists — used for the per-tab counts and to drive
 * the per-row pick state, which is keyed by `localVariantId` regardless of
 * whether a row is currently filtered out.
 */
const allLinkRows = computed(() => link.value?.rows ?? [])
const allPushRows = computed(() => push.value ?? [])
const allPullRows = computed(() => pull.value ?? [])

const linkRows = computed(() => {
  return allLinkRows.value.filter((row) => {
    if (linkStatus.value === 'linked' && row.currentLinks.length === 0) return false
    if (linkStatus.value === 'unlinked' && row.currentLinks.length > 0) return false
    const linkedTitles = row.currentLinks.flatMap((l) => [
      l.shopifyProductTitle,
      l.shopifyVariantTitle,
    ])
    return matchesDisplayFilters(row.display, linkedTitles)
  })
})
const linkCandidates = computed(() => {
  const list = link.value?.candidates ?? []
  return [...list].sort((a, b) => {
    const pt = a.shopifyProductTitle.localeCompare(b.shopifyProductTitle)
    if (pt !== 0) return pt
    return a.shopifyVariantTitle.localeCompare(b.shopifyVariantTitle)
  })
})
const pushRows = computed(() => {
  return allPushRows.value.filter((row) =>
    matchesDisplayFilters(
      row.display,
      row.targets.flatMap((t) => [t.shopifyProductTitle, t.shopifyVariantTitle])
    )
  )
})
const pullRows = computed(() => {
  return allPullRows.value.filter((row) =>
    matchesDisplayFilters(
      row.display,
      row.targets.flatMap((t) => [t.shopifyProductTitle, t.shopifyVariantTitle])
    )
  )
})

const pickedLinkCount = computed(() =>
  Object.values(linkPending).reduce((sum, ids) => sum + ids.length, 0)
)
const pickedPushCount = computed(() => Object.values(pushPicks).filter(Boolean).length)
const pickedPullCount = computed(
  () => Object.values(pullPicks).filter((p) => p.picked && p.locationId !== null).length
)

const linkSubmitting = ref(false)
const pushSubmitting = ref(false)
const pullSubmitting = ref(false)

function formatTimestamp(iso: string | null): string {
  if (!iso) return t('sync.never')
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

async function loadDiff() {
  if (!props.configured) return
  loading.value = true
  try {
    const res = await fetch('/sync/diff', { headers: { Accept: 'application/json' } })
    const json = (await res.json().catch(() => null)) as {
      data?: DiffPayload
      error?: string
    } | null
    if (!res.ok || !json) {
      toast.error(json?.error ?? `Sync failed (HTTP ${res.status})`)
      return
    }
    const data = json.data ?? { configured: false }
    if (!data.configured) return
    link.value = data.link ?? null
    push.value = data.push ?? null
    pull.value = data.pull ?? null
    locations.value = data.locations ?? []
    categories.value = data.categories ?? []
    lastPullAt.value = data.lastPullAt ?? null
    lastPushAt.value = data.lastPushAt ?? null

    for (const k of Object.keys(linkPending)) delete linkPending[Number(k)]
    for (const k of Object.keys(pushPicks)) delete pushPicks[Number(k)]
    for (const k of Object.keys(pullPicks)) delete pullPicks[Number(k)]
    for (const r of link.value?.rows ?? []) linkPending[r.localVariantId] = []
    for (const r of push.value ?? []) pushPicks[r.localVariantId] = false
    for (const r of pull.value ?? [])
      pullPicks[r.localVariantId] = { picked: false, locationId: null }
  } catch (err) {
    toast.error(
      `Network error loading sync data — ${err instanceof Error ? err.message : String(err)}`
    )
  } finally {
    loading.value = false
  }
}

onMounted(loadDiff)

/** Open the picker modal pre-filtered for one local variant. */
function openPicker(variantId: number) {
  pickerForVariantId.value = variantId
  pickerSelected.value = new Set()
  pickerSearch.value = ''
}

function closePicker() {
  pickerForVariantId.value = null
  pickerSelected.value = new Set()
  pickerSearch.value = ''
}

/** Variants already linked or already pending for the current picker target. */
const pickerExcluded = computed(() => {
  const v = pickerForVariantId.value
  if (v === null) return new Set<string>()
  const row = linkRows.value.find((r) => r.localVariantId === v)
  const linked = new Set((row?.currentLinks ?? []).map((l) => l.shopifyVariantId))
  for (const id of linkPending[v] ?? []) linked.add(id)
  return linked
})

const pickerOptions = computed(() => {
  const q = pickerSearch.value.trim().toLowerCase()
  const excluded = pickerExcluded.value
  return linkCandidates.value.filter((c) => {
    if (excluded.has(c.shopifyVariantId)) return false
    if (!q) return true
    return (
      c.shopifyProductTitle.toLowerCase().includes(q) ||
      c.shopifyVariantTitle.toLowerCase().includes(q) ||
      (c.currentSku?.toLowerCase().includes(q) ?? false)
    )
  })
})

function togglePickerSelection(gid: string) {
  if (pickerSelected.value.has(gid)) pickerSelected.value.delete(gid)
  else pickerSelected.value.add(gid)
  // Trigger reactivity — Sets in computed don't watch mutations.
  pickerSelected.value = new Set(pickerSelected.value)
}

function commitPicker() {
  const v = pickerForVariantId.value
  if (v === null) return
  const next = [...(linkPending[v] ?? []), ...pickerSelected.value]
  linkPending[v] = next
  closePicker()
}

function removePending(variantId: number, gid: string) {
  linkPending[variantId] = (linkPending[variantId] ?? []).filter((id) => id !== gid)
}

/** Lookup candidate info by gid for chip rendering of pending links. */
const candidateByGid = computed(() => {
  const map = new Map<string, ShopifyVariantInfo>()
  for (const c of linkCandidates.value) map.set(c.shopifyVariantId, c)
  return map
})

function submitLink() {
  const requests = Object.entries(linkPending)
    .filter(([, ids]) => ids.length > 0)
    .map(([localVariantId, ids]) => ({
      localVariantId: Number(localVariantId),
      shopifyVariantIds: ids,
    }))
  if (!requests.length) return
  linkSubmitting.value = true
  router.post(
    urlFor('sync.link'),
    { requests },
    {
      // Inertia reuses this component on redirect-to-same-URL so onMounted
      // doesn't fire again. We refresh the diff manually so the table reflects
      // the latest links/totals.
      onSuccess: () => loadDiff(),
      onFinish: () => (linkSubmitting.value = false),
    }
  )
}

/**
 * Pending unlink confirmation. Holding the target in state lets the Modal
 * render the resolved local + Shopify names, and lets Cancel be a no-op
 * without prompting again on accidental re-clicks of the chip's ✕.
 */
const unlinkConfirm = ref<{ gid: string; pairLabel: string } | null>(null)
const unlinkSubmitting = ref(false)

function localVariantLabel(row: LinkRow): string {
  const parts = [row.display.productName]
  if (row.display.color) parts.push(row.display.color.name)
  if (row.display.size) parts.push(row.display.size.name)
  return parts.join(' / ')
}

function requestUnlink(row: LinkRow, gid: string, shopifyTitle: string) {
  unlinkConfirm.value = {
    gid,
    pairLabel: `${localVariantLabel(row)} ↔ ${shopifyTitle}`,
  }
}

function cancelUnlink() {
  if (unlinkSubmitting.value) return
  unlinkConfirm.value = null
}

function confirmUnlink() {
  if (!unlinkConfirm.value) return
  const gid = unlinkConfirm.value.gid
  unlinkSubmitting.value = true
  router.post(
    urlFor('sync.unlink'),
    { shopifyVariantIds: [gid] },
    {
      onSuccess: () => loadDiff(),
      onFinish: () => {
        unlinkSubmitting.value = false
        unlinkConfirm.value = null
      },
    }
  )
}

function submitPush() {
  const variantIds = Object.entries(pushPicks)
    .filter(([, on]) => on)
    .map(([id]) => Number(id))
  if (!variantIds.length) return
  pushSubmitting.value = true
  router.post(
    urlFor('sync.push'),
    { variantIds },
    {
      onSuccess: () => loadDiff(),
      onFinish: () => (pushSubmitting.value = false),
    }
  )
}

function submitPull() {
  const applications = Object.entries(pullPicks)
    .filter(([, p]) => p.picked && p.locationId !== null)
    .map(([id, p]) => ({ localVariantId: Number(id), locationId: p.locationId as number }))
  if (!applications.length) return
  pullSubmitting.value = true
  router.post(
    urlFor('sync.pull'),
    { applications },
    {
      onSuccess: () => loadDiff(),
      onFinish: () => (pullSubmitting.value = false),
    }
  )
}

function pickerVariantTitle(): string {
  const v = pickerForVariantId.value
  if (v === null) return ''
  const row = linkRows.value.find((r) => r.localVariantId === v)
  if (!row) return ''
  const parts = [row.display.productName]
  if (row.display.color) parts.push(row.display.color.name)
  if (row.display.size) parts.push(row.display.size.name)
  return parts.join(' · ')
}
</script>

<template>
  <Head :title="$t('sync.title')" />
  <div class="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
    <PageHeader :title="$t('sync.title')" :description="$t('sync.description')">
      <template #actions>
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="btn-secondary text-xs"
            :disabled="loading || !props.configured"
            @click="loadDiff"
          >
            {{ loading ? $t('common.actions.loading') : $t('sync.refresh') }}
          </button>
          <div class="text-xs text-slate-500 text-right space-y-0.5">
            <div>{{ $t('sync.lastPullAt', { when: formatTimestamp(lastPullAt) }) }}</div>
            <div>{{ $t('sync.lastPushAt', { when: formatTimestamp(lastPushAt) }) }}</div>
          </div>
        </div>
      </template>
    </PageHeader>

    <!-- Not configured: friendly setup state -->
    <div v-if="!props.configured" class="card p-6">
      <h2 class="text-lg font-semibold text-slate-900 mb-2">
        {{ $t('sync.notConfigured.title') }}
      </h2>
      <p class="text-sm text-slate-600 whitespace-pre-line">
        {{ $t('sync.notConfigured.body') }}
      </p>
      <pre
        class="mt-4 bg-slate-50 border border-slate-200 rounded-md p-3 text-xs text-slate-700 overflow-x-auto"
      >
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
SHOPIFY_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SHOPIFY_CLIENT_SECRET=shpss_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SHOPIFY_API_VERSION=2025-10</pre
      >
    </div>

    <div v-else>
      <!-- Tabs -->
      <div class="flex gap-1 border-b border-slate-200 mb-4">
        <button
          v-for="t in ['link', 'push', 'pull'] as Tab[]"
          :key="t"
          type="button"
          class="px-4 py-2 text-sm font-medium border-b-2 transition"
          :class="
            tab === t
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          "
          @click="tab = t"
        >
          {{ $t(`sync.tabs.${t}`) }}
          <!-- Badges count unfiltered totals so the operator can see "5 to push"
               regardless of an active filter. -->
          <span
            v-if="t === 'push' && allPushRows.length"
            class="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-sky-100 text-sky-800 text-[10px] font-semibold"
          >
            {{ allPushRows.length }}
          </span>
          <span
            v-else-if="t === 'pull' && allPullRows.length"
            class="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-violet-100 text-violet-800 text-[10px] font-semibold"
          >
            {{ allPullRows.length }}
          </span>
        </button>
      </div>

      <!-- Filter bar: search + category apply across all tabs; link-status
           is shown only on the Link tab. Filtering happens client-side.
           Explicit widths because `.input`/`.select` both set `w-full`, so
           without caps the search input swallows the row. -->
      <div class="card p-3 mb-4 flex flex-wrap items-center gap-2">
        <input
          v-model="search"
          type="search"
          class="input flex-1 min-w-[14rem] basis-64"
          :placeholder="$t('sync.filters.searchPlaceholder')"
        />
        <select v-model.number="filterCategoryId" class="select w-auto max-w-xs">
          <option :value="null">{{ $t('sync.filters.allCategories') }}</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">
            {{ c.icon ? `${c.icon} ` : '' }}{{ c.name }}
          </option>
        </select>
        <div
          v-if="tab === 'link'"
          class="inline-flex rounded-md border border-slate-200 overflow-hidden text-xs shrink-0"
        >
          <button
            v-for="opt in (['all', 'linked', 'unlinked'] as LinkStatusFilter[])"
            :key="opt"
            type="button"
            class="px-3 py-1.5 transition"
            :class="
              linkStatus === opt
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            "
            @click="linkStatus = opt"
          >
            {{ $t(`sync.filters.linkStatus.${opt}`) }}
          </button>
        </div>
        <button
          v-if="hasActiveFilters"
          type="button"
          class="btn-ghost text-xs shrink-0"
          @click="clearFilters"
        >
          {{ $t('common.actions.clear') }}
        </button>
      </div>

      <!-- LINK TAB -->
      <section v-show="tab === 'link'" class="space-y-4">
        <p class="text-sm text-slate-600">{{ $t('sync.link.intro') }}</p>

        <div v-if="loading && !link" class="card p-6 text-center text-sm text-slate-400 italic">
          {{ $t('sync.loadingTab') }}
        </div>
        <div
          v-else-if="!linkRows.length && hasActiveFilters"
          class="card p-6 text-center text-sm text-slate-400 italic"
        >
          {{ $t('sync.filters.noMatches') }}
        </div>
        <div
          v-else-if="!linkRows.length"
          class="card p-6 text-center text-sm text-slate-400 italic"
        >
          {{ linkCandidates.length ? $t('sync.link.emptyNoLocal') : $t('sync.link.empty') }}
        </div>

        <div v-else class="card overflow-hidden">
          <table class="w-full">
            <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th class="px-4 py-2 text-left">{{ $t('common.labels.variant') }}</th>
                <th class="px-4 py-2 text-left">{{ $t('sync.link.currentLinks') }}</th>
                <th class="px-4 py-2 text-right w-44"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="row in linkRows" :key="row.localVariantId">
                <td class="px-4 py-3 text-sm">
                  <SyncVariantCell
                    :product-name="row.display.productName"
                    :color="row.display.color"
                    :size="row.display.size"
                    :image-url="row.display.imageUrl"
                  />
                </td>
                <td class="px-4 py-3 text-sm">
                  <div class="flex flex-wrap gap-1.5">
                    <span
                      v-for="cl in row.currentLinks"
                      :key="cl.shopifyVariantId"
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-xs border border-emerald-200"
                    >
                      {{ cl.shopifyProductTitle }} — {{ cl.shopifyVariantTitle }}
                      <button
                        type="button"
                        class="ml-1 text-emerald-700 hover:text-emerald-900"
                        :aria-label="$t('sync.link.unlinkTitle')"
                        :title="$t('sync.link.unlinkTitle')"
                        @click="
                          requestUnlink(
                            row,
                            cl.shopifyVariantId,
                            `${cl.shopifyProductTitle} — ${cl.shopifyVariantTitle}`
                          )
                        "
                      >
                        ✕
                      </button>
                    </span>
                    <span
                      v-for="gid in linkPending[row.localVariantId] ?? []"
                      :key="gid"
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-xs border border-amber-200"
                    >
                      {{ candidateByGid.get(gid)?.shopifyProductTitle ?? '?' }} —
                      {{ candidateByGid.get(gid)?.shopifyVariantTitle ?? gid }}
                      <span class="text-[10px] opacity-70">{{ $t('sync.link.pendingChip') }}</span>
                      <button
                        type="button"
                        class="ml-1 text-amber-700 hover:text-amber-900"
                        :aria-label="$t('common.actions.delete')"
                        @click="removePending(row.localVariantId, gid)"
                      >
                        ✕
                      </button>
                    </span>
                    <span
                      v-if="
                        row.currentLinks.length === 0 &&
                        (linkPending[row.localVariantId]?.length ?? 0) === 0
                      "
                      class="text-xs text-slate-400 italic"
                    >
                      {{ $t('sync.link.noLinks') }}
                    </span>
                  </div>
                </td>
                <td class="px-4 py-3 text-right">
                  <button
                    type="button"
                    class="btn-secondary text-xs"
                    @click="openPicker(row.localVariantId)"
                  >
                    {{ $t('sync.link.addPairing') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="linkRows.length" class="flex justify-end">
          <button
            type="button"
            class="btn-primary"
            :disabled="linkSubmitting || pickedLinkCount === 0"
            @click="submitLink"
          >
            <template v-if="pickedLinkCount === 0">{{ $t('sync.link.applyNone') }}</template>
            <template v-else>{{
              $t('sync.link.applyButton', { count: pickedLinkCount })
            }}</template>
          </button>
        </div>
      </section>

      <!-- PUSH TAB -->
      <section v-show="tab === 'push'" class="space-y-4">
        <p class="text-sm text-slate-600">{{ $t('sync.push.intro') }}</p>

        <div v-if="loading && !push" class="card p-6 text-center text-sm text-slate-400 italic">
          {{ $t('sync.loadingTab') }}
        </div>
        <div
          v-else-if="!pushRows.length && hasActiveFilters && allPushRows.length"
          class="card p-6 text-center text-sm text-slate-400 italic"
        >
          {{ $t('sync.filters.noMatches') }}
        </div>
        <div
          v-else-if="!pushRows.length"
          class="card p-6 text-center text-sm text-slate-400 italic"
        >
          {{ $t('sync.push.empty') }}
        </div>

        <div v-else class="card overflow-hidden">
          <table class="w-full">
            <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th class="px-2 py-2 w-10"></th>
                <th class="px-4 py-2 text-left">{{ $t('sync.push.columns.variant') }}</th>
                <th class="px-4 py-2 text-right">{{ $t('sync.push.columns.local') }}</th>
                <th class="px-4 py-2 text-left">{{ $t('sync.push.columns.mirrors') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="row in pushRows" :key="row.localVariantId">
                <td class="px-2 py-3">
                  <input v-model="pushPicks[row.localVariantId]" type="checkbox" class="size-4" />
                </td>
                <td class="px-4 py-3 text-sm">
                  <SyncVariantCell
                    :product-name="row.display.productName"
                    :color="row.display.color"
                    :size="row.display.size"
                    :image-url="row.display.imageUrl"
                  />
                </td>
                <td class="px-4 py-3 text-right text-sm tabular-nums">{{ row.localTotal }}</td>
                <td class="px-4 py-3 text-sm space-y-1">
                  <div
                    v-for="tg in row.targets"
                    :key="tg.shopifyVariantId"
                    class="flex items-center justify-between gap-3 text-xs"
                  >
                    <span class="text-slate-600 truncate">
                      {{ tg.shopifyProductTitle }} — {{ tg.shopifyVariantTitle }}
                    </span>
                    <span class="tabular-nums whitespace-nowrap">
                      <span class="text-slate-500">{{ tg.shopifyQuantity ?? '—' }}</span>
                      <span class="text-slate-400 mx-1">→</span>
                      <span class="font-semibold text-emerald-700">{{ row.localTotal }}</span>
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="pushRows.length" class="flex justify-end">
          <button
            type="button"
            class="btn-primary"
            :disabled="pushSubmitting || pickedPushCount === 0"
            @click="submitPush"
          >
            <template v-if="pickedPushCount === 0">{{ $t('sync.push.applyNone') }}</template>
            <template v-else>{{
              $t('sync.push.applyButton', { count: pickedPushCount })
            }}</template>
          </button>
        </div>
      </section>

      <!-- PULL TAB -->
      <section v-show="tab === 'pull'" class="space-y-4">
        <p class="text-sm text-slate-600">{{ $t('sync.pull.intro') }}</p>
        <p class="text-xs text-slate-500 italic">{{ $t('sync.pull.autoPushNote') }}</p>

        <div v-if="loading && !pull" class="card p-6 text-center text-sm text-slate-400 italic">
          {{ $t('sync.loadingTab') }}
        </div>
        <div
          v-else-if="!pullRows.length && hasActiveFilters && allPullRows.length"
          class="card p-6 text-center text-sm text-slate-400 italic"
        >
          {{ $t('sync.filters.noMatches') }}
        </div>
        <div
          v-else-if="!pullRows.length"
          class="card p-6 text-center text-sm text-slate-400 italic"
        >
          {{ $t('sync.pull.empty') }}
        </div>

        <div v-else class="card overflow-hidden">
          <table class="w-full">
            <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th class="px-2 py-2 w-10"></th>
                <th class="px-4 py-2 text-left">{{ $t('sync.pull.columns.variant') }}</th>
                <th class="px-4 py-2 text-right">{{ $t('sync.pull.columns.local') }}</th>
                <th class="px-4 py-2 text-left">{{ $t('sync.pull.columns.deltas') }}</th>
                <th class="px-4 py-2 text-right">{{ $t('sync.pull.columns.total') }}</th>
                <th class="px-4 py-2 text-left w-56">{{ $t('sync.pull.columns.location') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="row in pullRows" :key="row.localVariantId">
                <td class="px-2 py-3">
                  <input
                    v-model="pullPicks[row.localVariantId].picked"
                    type="checkbox"
                    class="size-4"
                  />
                </td>
                <td class="px-4 py-3 text-sm">
                  <SyncVariantCell
                    :product-name="row.display.productName"
                    :color="row.display.color"
                    :size="row.display.size"
                    :image-url="row.display.imageUrl"
                  />
                </td>
                <td class="px-4 py-3 text-right text-sm tabular-nums">{{ row.localTotal }}</td>
                <td class="px-4 py-3 text-xs space-y-1">
                  <div
                    v-for="tg in row.targets"
                    :key="tg.shopifyVariantId"
                    class="flex items-center justify-between gap-2"
                  >
                    <span class="text-slate-600 truncate">
                      {{ tg.shopifyProductTitle }} — {{ tg.shopifyVariantTitle }}
                    </span>
                    <span class="whitespace-nowrap tabular-nums">
                      <template v-if="tg.lastKnownQuantity === null">
                        <span class="text-amber-700">{{
                          $t('sync.pull.noBaseline', { title: tg.shopifyQuantity })
                        }}</span>
                      </template>
                      <template v-else-if="tg.delta < 0">
                        <span class="text-rose-600 font-semibold">{{ tg.delta }}</span>
                        <span class="text-slate-400 ml-1"
                          >({{ tg.lastKnownQuantity }} → {{ tg.shopifyQuantity }})</span
                        >
                      </template>
                      <template v-else>
                        <span class="text-slate-400">±0</span>
                      </template>
                    </span>
                  </div>
                </td>
                <td class="px-4 py-3 text-right text-sm font-semibold text-rose-700 tabular-nums">
                  −{{ row.totalDecrement }}
                </td>
                <td class="px-4 py-3">
                  <select
                    v-model.number="pullPicks[row.localVariantId].locationId"
                    class="select w-full"
                  >
                    <option :value="null">{{ $t('sync.pull.pickLocation') }}</option>
                    <option v-for="l in locations" :key="l.id" :value="l.id">
                      {{ l.icon ? `${l.icon} ` : '' }}{{ l.name }}
                    </option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="pullRows.length" class="flex justify-end">
          <button
            type="button"
            class="btn-primary"
            :disabled="pullSubmitting || pickedPullCount === 0"
            @click="submitPull"
          >
            <template v-if="pickedPullCount === 0">{{ $t('sync.pull.applyNone') }}</template>
            <template v-else>{{
              $t('sync.pull.applyButton', { count: pickedPullCount })
            }}</template>
          </button>
        </div>
      </section>
    </div>
  </div>

  <!-- Add-Shopify-pairing modal -->
  <Modal
    :open="pickerForVariantId !== null"
    :title="$t('sync.link.modalTitle', { name: pickerVariantTitle() })"
    @close="closePicker"
  >
    <div class="space-y-3">
      <input
        v-model="pickerSearch"
        type="search"
        class="input w-full"
        :placeholder="$t('sync.link.modalSearch')"
      />
      <div class="max-h-96 overflow-y-auto border border-slate-200 rounded-md">
        <ul v-if="pickerOptions.length" class="divide-y divide-slate-100">
          <li
            v-for="c in pickerOptions"
            :key="c.shopifyVariantId"
            class="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer"
            @click="togglePickerSelection(c.shopifyVariantId)"
          >
            <input
              type="checkbox"
              class="size-4 shrink-0"
              :checked="pickerSelected.has(c.shopifyVariantId)"
              @click.stop="togglePickerSelection(c.shopifyVariantId)"
            />
            <!-- Fixed-size image slot keeps every row the same height so the
                 checkbox + text column line up regardless of which Shopify
                 variants have featured images. `loading="lazy"` defers
                 offscreen fetches; `decoding="async"` keeps decode work off
                 the main thread so scrolling stays smooth. -->
            <div
              class="size-10 shrink-0 rounded border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center"
            >
              <img
                v-if="c.imageUrl"
                :src="c.imageUrl"
                :alt="c.shopifyVariantTitle"
                class="size-10 object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-slate-900 truncate">
                {{ c.shopifyProductTitle }}
              </div>
              <div class="text-xs text-slate-500 truncate">
                {{ c.shopifyVariantTitle }}<span v-if="c.currentSku"> · {{ c.currentSku }}</span>
              </div>
            </div>
          </li>
        </ul>
        <p v-else class="px-3 py-6 text-center text-sm text-slate-400 italic">
          {{ $t('sync.link.modalEmpty') }}
        </p>
      </div>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-ghost" @click="closePicker">
          {{ $t('common.actions.cancel') }}
        </button>
        <button
          type="button"
          class="btn-primary"
          :disabled="pickerSelected.size === 0"
          @click="commitPicker"
        >
          <template v-if="pickerSelected.size === 0">{{ $t('sync.link.modalAddNone') }}</template>
          <template v-else>{{ $t('sync.link.modalAdd', { count: pickerSelected.size }) }}</template>
        </button>
      </div>
    </div>
  </Modal>

  <!-- Unlink confirmation modal -->
  <Modal :open="unlinkConfirm !== null" :title="$t('sync.link.unlinkTitle')" @close="cancelUnlink">
    <p class="text-sm text-slate-700">
      {{ $t('sync.link.unlinkConfirm', { name: unlinkConfirm?.pairLabel ?? '' }) }}
    </p>
    <div class="flex justify-end gap-2 mt-4">
      <button type="button" class="btn-ghost" :disabled="unlinkSubmitting" @click="cancelUnlink">
        {{ $t('common.actions.cancel') }}
      </button>
      <button
        type="button"
        class="btn-primary bg-rose-600 hover:bg-rose-700 focus:ring-rose-500"
        :disabled="unlinkSubmitting"
        @click="confirmUnlink"
      >
        {{ unlinkSubmitting ? $t('common.actions.saving') : $t('sync.link.unlinkTitle') }}
      </button>
    </div>
  </Modal>
</template>
