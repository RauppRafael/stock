<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { z } from 'zod'
import type { Data } from '@generated/data'
import { categorySchema, locationSchema, productSchema, stockSchema } from '@contracts'
import { useValidatedProps } from '~/composables/use_validated_props'
import PageHeader from '~/components/PageHeader.vue'
import StockBadge from '~/components/StockBadge.vue'
import ImageZoom from '~/components/ImageZoom.vue'
import { fuzzyMatchAny } from '~/utils/fuzzy_match'

type StockRow = Data.Stock

const props = defineProps<{
  stocks: StockRow[]
  categories: Data.Category[]
  locations: Data.Location[]
  products: Data.Product[]
  /**
   * Map of `${variantId}:${locationId}` → wildcard pool quantity. Only
   * populated for printed-product variants whose source wildcard holds
   * stock of matching color/size at that location. Empty when there are no
   * wildcards in play.
   */
  pools: Record<string, number>
  filters: {
    categoryId: number | null
    productId: number | null
    locationId: number | null
    stockStatus: StockStatusFilter
  }
}>()

type StockStatusFilter = 'all' | 'inStock' | 'outOfStock'
const STOCK_STATUS_OPTIONS: StockStatusFilter[] = ['all', 'inStock', 'outOfStock']

useValidatedProps(
  props,
  z.object({
    stocks: z.array(stockSchema),
    categories: z.array(categorySchema),
    locations: z.array(locationSchema),
    products: z.array(productSchema),
    pools: z.record(z.string(), z.number().int()),
    filters: z.object({
      categoryId: z.number().int().nullable(),
      productId: z.number().int().nullable(),
      locationId: z.number().int().nullable(),
      stockStatus: z.enum(['all', 'inStock', 'outOfStock']),
    }),
  })
)

function poolFor(row: StockRow): number {
  return props.pools[`${row.variantId}:${row.locationId}`] ?? 0
}

const filters = reactive({ ...props.filters })
// Client-side fuzzy search over the rendered rows. Lives outside `filters`
// because it doesn't round-trip to the server — the table is already grouped
// in-memory and narrowing locally feels instant.
const search = ref('')

// Reset productId when category changes — otherwise the previous category's
// product carries over, the server filters by an impossible (category, product)
// pair, and the table goes empty with no visible cause.
watch(
  () => filters.categoryId,
  (next, prev) => {
    if (next !== prev && filters.productId !== null) filters.productId = null
  }
)

let timer: ReturnType<typeof setTimeout> | null = null

watch(
  filters,
  (next) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      router.get(
        '/stock',
        {
          ...(next.categoryId ? { categoryId: next.categoryId } : {}),
          ...(next.productId ? { productId: next.productId } : {}),
          ...(next.locationId ? { locationId: next.locationId } : {}),
          ...(next.stockStatus !== 'all' ? { stockStatus: next.stockStatus } : {}),
        },
        { preserveState: true, preserveScroll: true, replace: true }
      )
    }, 300)
  },
  { deep: true }
)

// Server returns rows pre-sorted by (category, product, location, color, size)
// so rows sharing a (product, location, color) tuple are contiguous. Build a
// three-level grouping here for rowspan rendering: product → locations →
// colors → rows.
type ColorGroup = {
  key: string
  color: NonNullable<StockRow['variant']>['color'] | null
  rows: StockRow[]
}
type LocationGroup = {
  key: string
  location: StockRow['location']
  colors: ColorGroup[]
  rowCount: number
}
type ProductGroup = {
  key: string
  product: NonNullable<NonNullable<StockRow['variant']>['product']>
  locations: LocationGroup[]
  rowCount: number
}

const filteredStocks = computed<StockRow[]>(() => {
  if (!search.value.trim()) return props.stocks
  return props.stocks.filter((row) =>
    fuzzyMatchAny(search.value, [
      row.variant?.product?.name,
      row.variant?.product?.code,
      row.variant?.product?.category?.name,
      row.variant?.color?.name,
      row.variant?.size?.name,
      row.location?.name,
    ])
  )
})

const groups = computed<ProductGroup[]>(() => {
  const out: ProductGroup[] = []
  for (const row of filteredStocks.value) {
    const product = row.variant?.product
    if (!product) continue
    const productKey = String(product.id)
    let pg = out[out.length - 1]
    if (!pg || pg.key !== productKey) {
      pg = { key: productKey, product, locations: [], rowCount: 0 }
      out.push(pg)
    }
    const location = row.location ?? null
    const locationKey = location ? `l:${location.id}` : 'l:none'
    let lg = pg.locations[pg.locations.length - 1]
    if (!lg || lg.key !== locationKey) {
      lg = { key: locationKey, location, colors: [], rowCount: 0 }
      pg.locations.push(lg)
    }
    const color = row.variant?.color ?? null
    const colorKey = color ? `c:${color.id}` : 'c:none'
    let cg = lg.colors[lg.colors.length - 1]
    if (!cg || cg.key !== colorKey) {
      cg = { key: colorKey, color, rows: [] }
      lg.colors.push(cg)
    }
    cg.rows.push(row)
    lg.rowCount += 1
    pg.rowCount += 1
  }
  return out
})

function totalFor(group: {
  colors?: ColorGroup[]
  locations?: LocationGroup[]
  rows?: StockRow[]
}) {
  if (group.rows) return group.rows.reduce((s, r) => s + r.quantity, 0)
  if (group.colors) {
    return group.colors.reduce((s, cg) => s + cg.rows.reduce((ss, r) => ss + r.quantity, 0), 0)
  }
  if (group.locations) {
    return group.locations.reduce(
      (s, lg) =>
        s + lg.colors.reduce((ss, cg) => ss + cg.rows.reduce((sss, r) => sss + r.quantity, 0), 0),
      0
    )
  }
  return 0
}

const grandTotal = computed(() => filteredStocks.value.reduce((s, r) => s + r.quantity, 0))

// Rowspan'd cells (product/location/color) live on the first <tr> of their
// group, so a CSS `tr:hover` only highlights them when that first row is the
// one being hovered. Track the hovered leaf row in JS and decide per-cell
// whether it should light up — that way hovering any row makes the whole
// "logical row" feel cohesive. Rows may not have a real `id` (synthesized
// zero-quantity rows for never-adjusted variants), so key by (variantId,
// locationId) instead.
function rowKey(row: StockRow) {
  return `${row.variantId}-${row.locationId}`
}
const hoveredRowKey = ref<string | null>(null)
function isColorHovered(cg: ColorGroup) {
  return hoveredRowKey.value != null && cg.rows.some((r) => rowKey(r) === hoveredRowKey.value)
}
function isLocationHovered(lg: LocationGroup) {
  return lg.colors.some(isColorHovered)
}
function isProductHovered(pg: ProductGroup) {
  return pg.locations.some(isLocationHovered)
}

function rowClick(row: StockRow) {
  if (!row.variantId || !row.locationId) return
  router.get('/stock/adjust', { variantId: row.variantId, locationId: row.locationId })
}
</script>

<template>
  <Head :title="$t('stock.index.title')" />
  <div class="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
    <PageHeader :title="$t('stock.index.title')" :description="$t('stock.index.description')">
      <template #actions>
        <Link route="stock.convert.create" class="btn-secondary">
          <span aria-hidden="true" class="mr-1">🃏</span>
          {{ $t('stock.convert.headerAction') }}
        </Link>
        <Link route="stock.adjust.create" class="btn-primary">{{
          $t('stock.index.newAdjustment')
        }}</Link>
      </template>
    </PageHeader>

    <div class="card p-4 mb-4 space-y-3">
      <div>
        <label class="label">{{ $t('common.labels.search') }}</label>
        <input
          v-model="search"
          type="search"
          class="input"
          :placeholder="$t('stock.index.searchPlaceholder')"
        />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label class="label">{{ $t('common.labels.category') }}</label>
          <select v-model.number="filters.categoryId" class="select">
            <option :value="null">{{ $t('common.allCategories') }}</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div>
          <label class="label">{{ $t('common.labels.product') }}</label>
          <select v-model.number="filters.productId" class="select">
            <option :value="null">{{ $t('common.allProducts') }}</option>
            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div>
          <label class="label">{{ $t('common.labels.location') }}</label>
          <select v-model.number="filters.locationId" class="select">
            <option :value="null">{{ $t('common.allLocations') }}</option>
            <option v-for="l in locations" :key="l.id" :value="l.id">{{ l.name }}</option>
          </select>
        </div>
        <div>
          <label class="label">{{ $t('stock.index.stockStatus.label') }}</label>
          <div
            class="inline-flex rounded-md border border-slate-200 overflow-hidden text-xs w-full"
          >
            <button
              v-for="opt in STOCK_STATUS_OPTIONS"
              :key="opt"
              type="button"
              class="flex-1 px-3 py-2 transition whitespace-nowrap"
              :class="
                filters.stockStatus === opt
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              "
              @click="filters.stockStatus = opt"
            >
              {{ $t(`stock.index.stockStatus.${opt}`) }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <th class="px-4 py-2.5 font-semibold text-left whitespace-nowrap">
                {{ $t('stock.index.columns.product') }}
              </th>
              <th class="px-4 py-2.5 font-semibold text-left whitespace-nowrap">
                {{ $t('stock.index.columns.location') }}
              </th>
              <th class="px-4 py-2.5 font-semibold text-left whitespace-nowrap">
                {{ $t('common.labels.color') }}
              </th>
              <th class="px-4 py-2.5 font-semibold text-left whitespace-nowrap">
                {{ $t('common.labels.size') }}
              </th>
              <th
                class="px-4 py-2.5 font-semibold text-right whitespace-nowrap"
                style="width: 160px"
              >
                {{ $t('stock.index.columns.onHand') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(pg, pgIdx) in groups" :key="pg.key">
              <template v-for="(lg, lgIdx) in pg.locations" :key="lg.key">
                <template v-for="(cg, cgIdx) in lg.colors" :key="cg.key">
                  <tr
                    v-for="(row, rIdx) in cg.rows"
                    :key="rowKey(row)"
                    class="cursor-pointer transition"
                    :class="{
                      'border-t-2 border-slate-200':
                        pgIdx > 0 && lgIdx === 0 && cgIdx === 0 && rIdx === 0,
                      'border-t border-slate-100':
                        (lgIdx > 0 || cgIdx > 0) &&
                        rIdx === 0 &&
                        !(pgIdx > 0 && lgIdx === 0 && cgIdx === 0 && rIdx === 0),
                      'bg-slate-50': hoveredRowKey === rowKey(row),
                    }"
                    @mouseenter="hoveredRowKey = rowKey(row)"
                    @mouseleave="hoveredRowKey = null"
                    @click="rowClick(row)"
                  >
                    <td
                      v-if="lgIdx === 0 && cgIdx === 0 && rIdx === 0"
                      :rowspan="pg.rowCount"
                      class="px-4 py-3 align-top border-r border-slate-100 transition"
                      :class="{ 'bg-slate-50': isProductHovered(pg) }"
                    >
                      <div
                        class="font-medium text-slate-900 whitespace-nowrap inline-flex items-center gap-1.5"
                      >
                        <span
                          v-if="pg.product.isWildcard"
                          class="text-base leading-none"
                          aria-hidden="true"
                          :title="$t('products.wildcard.label')"
                          >🃏</span
                        >
                        {{ pg.product.name }}
                      </div>
                      <div
                        v-if="pg.product.wildcardSource"
                        class="text-[10px] text-violet-700 mt-0.5 inline-flex items-center gap-0.5 whitespace-nowrap"
                        :title="$t('products.wildcard.derivedFromTitle')"
                      >
                        🃏 <span class="font-mono">{{ pg.product.wildcardSource.code }}</span>
                      </div>
                      <div
                        class="text-xs text-slate-400 inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <span v-if="pg.product.category?.icon">
                          {{ pg.product.category.icon }}
                        </span>
                        {{ pg.product.category?.name }}
                      </div>
                      <div
                        v-if="pg.product.imageUrl"
                        class="hidden lg:block mt-2"
                        @click.stop
                      >
                        <ImageZoom
                          :src="pg.product.imageUrl"
                          :alt="pg.product.name"
                          thumb-class="size-20 rounded-md object-cover border border-slate-200"
                          :thumb-width="192"
                        />
                      </div>
                      <div class="mt-1 text-xs text-slate-500 whitespace-nowrap">
                        {{ $t('stock.index.total') }}:
                        <span class="font-semibold text-slate-700">{{ totalFor(pg) }}</span>
                      </div>
                    </td>
                    <td
                      v-if="cgIdx === 0 && rIdx === 0"
                      :rowspan="lg.rowCount"
                      class="px-4 py-3 align-top border-r border-slate-100 transition"
                      :class="{ 'bg-slate-50': isLocationHovered(lg) }"
                    >
                      <span
                        v-if="lg.location"
                        class="inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <span v-if="lg.location.icon">{{ lg.location.icon }}</span>
                        {{ lg.location.name }}
                      </span>
                      <span v-else class="text-slate-300 text-xs">—</span>
                      <div class="mt-1 text-xs text-slate-500 whitespace-nowrap">
                        {{ $t('stock.index.total') }}:
                        <span class="font-semibold text-slate-700">{{ totalFor(lg) }}</span>
                      </div>
                    </td>
                    <td
                      v-if="rIdx === 0"
                      :rowspan="cg.rows.length"
                      class="px-4 py-3 align-top border-r border-slate-100 transition"
                      :class="{ 'bg-slate-50': isColorHovered(cg) }"
                    >
                      <span
                        v-if="cg.color"
                        class="inline-flex items-center gap-1.5 text-xs rounded-md bg-slate-100 text-slate-700 px-1.5 py-0.5 whitespace-nowrap"
                      >
                        <span
                          v-if="cg.color.hexCode"
                          class="size-2.5 rounded-full ring-1 ring-slate-200"
                          :style="{ background: cg.color.hexCode }"
                        />
                        <span class="font-medium">{{ cg.color.name }}</span>
                      </span>
                      <span v-else class="text-slate-300 text-xs">—</span>
                      <div class="mt-1 text-xs text-slate-500 whitespace-nowrap">
                        {{ $t('stock.index.total') }}:
                        <span class="font-semibold text-slate-700">{{ totalFor(cg) }}</span>
                      </div>
                    </td>
                    <td class="px-4 py-1.5">
                      <span
                        v-if="row.variant?.size"
                        class="inline-flex items-center gap-1 text-xs rounded-md bg-slate-100 text-slate-700 px-1.5 py-0.5 whitespace-nowrap font-medium"
                      >
                        {{ row.variant.size.name }}
                      </span>
                      <span v-else class="text-slate-300 text-xs">—</span>
                    </td>
                    <td class="px-4 py-1.5 text-right">
                      <div class="inline-flex items-center gap-1.5">
                        <span
                          v-if="poolFor(row) > 0"
                          class="text-[10px] text-violet-700 inline-flex items-center gap-0.5 whitespace-nowrap"
                          :title="
                            $t('stock.index.wildcardPoolTooltip', {
                              pool: poolFor(row),
                              total: row.quantity + poolFor(row),
                            })
                          "
                        >
                          🃏
                          {{ $t('stock.index.wildcardPoolChip', { pool: poolFor(row) }) }}
                        </span>
                        <StockBadge
                          :quantity="row.quantity"
                          :threshold="row.variant?.product?.lowStockThreshold ?? null"
                        />
                      </div>
                    </td>
                  </tr>
                </template>
              </template>
            </template>
            <tr v-if="!groups.length">
              <td colspan="5" class="px-4 py-10 text-center text-sm text-slate-400 italic">
                {{ $t('stock.index.empty') }}
              </td>
            </tr>
            <tr v-else class="bg-slate-50 border-t-2 border-slate-200">
              <td
                colspan="4"
                class="px-4 py-3 text-right text-xs uppercase tracking-wide font-semibold text-slate-600"
              >
                {{ $t('stock.index.grandTotal') }}
              </td>
              <td class="px-4 py-3 text-right font-semibold text-slate-700">
                {{ grandTotal }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
