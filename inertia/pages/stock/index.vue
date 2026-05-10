<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { z } from 'zod'
import type { Data } from '@generated/data'
import {
  categorySchema,
  locationSchema,
  productSchema,
  stockSchema,
} from '@contracts'
import { useI18n } from 'vue-i18n'
import { useValidatedProps } from '~/composables/use_validated_props'
import PageHeader from '~/components/PageHeader.vue'
import DataTable from '~/components/DataTable.vue'
import StockBadge from '~/components/StockBadge.vue'

const { t } = useI18n()

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

const columns = computed(() => [
  { key: 'product', label: t('stock.index.columns.product') },
  { key: 'variant', label: t('stock.index.columns.variant') },
  { key: 'location', label: t('stock.index.columns.location') },
  { key: 'quantity', label: t('stock.index.columns.onHand'), align: 'right' as const, width: '160px' },
])

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
        <Link route="stock.adjust.create" class="btn-primary">{{ $t('stock.index.newAdjustment') }}</Link>
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
            <input v-model="filters.lowOnly" type="checkbox" class="size-4 rounded border-slate-300" />
            {{ $t('stock.index.lowOnly') }}
          </label>
        </div>
      </div>
    </div>

    <DataTable
      :columns="columns"
      :rows="stocks"
      :row-key="(row) => row.id"
      :empty="$t('stock.index.empty')"
      row-clickable
      @row-click="rowClick"
    >
      <template #[`cell:product`]="{ row }">
        <div class="font-medium text-slate-900 whitespace-nowrap">{{ row.variant?.product?.name }}</div>
        <div class="text-xs text-slate-400 inline-flex items-center gap-1 whitespace-nowrap">
          <span v-if="row.variant?.product?.category?.icon">
            {{ row.variant.product.category.icon }}
          </span>
          {{ row.variant?.product?.category?.name }}
        </div>
      </template>
      <template #[`cell:variant`]="{ row }">
        <div class="flex flex-wrap gap-1 text-xs">
          <span
            v-if="row.variant?.color"
            class="inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-700 px-1.5 py-0.5 whitespace-nowrap"
          >
            <span
              v-if="row.variant.color.hexCode"
              class="size-2.5 rounded-full ring-1 ring-slate-200"
              :style="{ background: row.variant.color.hexCode }"
            />
            <span class="text-slate-500">{{ $t('common.labels.color') }}:</span>
            <span class="font-medium">{{ row.variant.color.name }}</span>
          </span>
          <span
            v-if="row.variant?.print"
            class="inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-700 px-1.5 py-0.5 whitespace-nowrap"
          >
            <span class="text-slate-500">{{ $t('common.labels.print') }}:</span>
            <span class="font-medium">{{ row.variant.print.name }}</span>
          </span>
          <span
            v-if="row.variant?.size"
            class="inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-700 px-1.5 py-0.5 whitespace-nowrap"
          >
            <span class="text-slate-500">{{ $t('common.labels.size') }}:</span>
            <span class="font-medium">{{ row.variant.size.name }}</span>
          </span>
          <span v-if="!row.variant?.color && !row.variant?.print && !row.variant?.size" class="text-slate-300">—</span>
        </div>
      </template>
      <template #[`cell:location`]="{ row }">
        <span class="inline-flex items-center gap-1 whitespace-nowrap">
          <span v-if="row.location?.icon">{{ row.location.icon }}</span>
          {{ row.location?.name }}
        </span>
      </template>
      <template #[`cell:quantity`]="{ row }">
        <StockBadge
          :quantity="row.quantity"
          :threshold="row.variant?.product?.lowStockThreshold ?? null"
        />
      </template>
    </DataTable>
  </div>
</template>
