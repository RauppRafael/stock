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

type StockRow = Data.Stock

const props = defineProps<{
  stocks: StockRow[]
  categories: Data.Category[]
  locations: Data.Location[]
  products: Data.Product[]
  filters: {
    categoryId: number | null
    productId: number | null
    locationId: number | null
    lowOnly: boolean
  }
}>()

useValidatedProps(
  props,
  z.object({
    stocks: z.array(stockSchema),
    categories: z.array(categorySchema),
    locations: z.array(locationSchema),
    products: z.array(productSchema),
    filters: z.object({
      categoryId: z.number().int().nullable(),
      productId: z.number().int().nullable(),
      locationId: z.number().int().nullable(),
      lowOnly: z.boolean(),
    }),
  })
)

const filters = reactive({ ...props.filters })

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
          ...(next.lowOnly ? { lowOnly: 'true' } : {}),
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

const groups = computed<ProductGroup[]>(() => {
  const out: ProductGroup[] = []
  for (const row of props.stocks) {
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

const grandTotal = computed(() => props.stocks.reduce((s, r) => s + r.quantity, 0))

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
        <Link route="stock.adjust.create" class="btn-primary">{{
          $t('stock.index.newAdjustment')
        }}</Link>
      </template>
    </PageHeader>

    <div class="card p-4 mb-4">
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
          <select v-model.number="filters.productId" class="select" :disabled="!filters.categoryId">
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
        <div class="flex items-end">
          <label class="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              v-model="filters.lowOnly"
              type="checkbox"
              class="size-4 rounded border-slate-300"
            />
            {{ $t('stock.index.lowOnly') }}
          </label>
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
                      <div class="font-medium text-slate-900 whitespace-nowrap">
                        {{ pg.product.name }}
                      </div>
                      <div
                        class="text-xs text-slate-400 inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <span v-if="pg.product.category?.icon">
                          {{ pg.product.category.icon }}
                        </span>
                        {{ pg.product.category?.name }}
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
                    <td class="px-4 py-3">
                      <span
                        v-if="row.variant?.size"
                        class="inline-flex items-center gap-1 text-xs rounded-md bg-slate-100 text-slate-700 px-1.5 py-0.5 whitespace-nowrap font-medium"
                      >
                        {{ row.variant.size.name }}
                      </span>
                      <span v-else class="text-slate-300 text-xs">—</span>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <StockBadge
                        :quantity="row.quantity"
                        :threshold="row.variant?.product?.lowStockThreshold ?? null"
                      />
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
