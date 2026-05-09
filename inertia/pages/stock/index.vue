<script setup lang="ts">
import { reactive, watch } from 'vue'
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
import { useValidatedProps } from '~/composables/use_validated_props'
import PageHeader from '~/components/PageHeader.vue'
import DataTable from '~/components/DataTable.vue'
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

const columns = [
  { key: 'product', label: 'Product' },
  { key: 'variant', label: 'Variant' },
  { key: 'sku', label: 'SKU' },
  { key: 'location', label: 'Location' },
  { key: 'quantity', label: 'On hand', align: 'right' as const, width: '160px' },
]

function rowClick(row: StockRow) {
  if (!row.variantId || !row.locationId) return
  router.get('/stock/adjust', { variantId: row.variantId, locationId: row.locationId })
}
</script>

<template>
  <Head title="Stock" />
  <div class="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
    <PageHeader title="Stock" description="Live on-hand quantities by variant and location.">
      <template #actions>
        <Link route="stock.adjust.create" class="btn-primary">+ Adjust stock</Link>
      </template>
    </PageHeader>

    <div class="card p-4 mb-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label class="label">Category</label>
          <select v-model.number="filters.categoryId" class="select">
            <option :value="null">All categories</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div>
          <label class="label">Product</label>
          <select v-model.number="filters.productId" class="select" :disabled="!filters.categoryId">
            <option :value="null">All products</option>
            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div>
          <label class="label">Location</label>
          <select v-model.number="filters.locationId" class="select">
            <option :value="null">All locations</option>
            <option v-for="l in locations" :key="l.id" :value="l.id">{{ l.name }}</option>
          </select>
        </div>
        <div class="flex items-end">
          <label class="inline-flex items-center gap-2 text-sm text-slate-700">
            <input v-model="filters.lowOnly" type="checkbox" class="size-4 rounded border-slate-300" />
            Low / out of stock only
          </label>
        </div>
      </div>
    </div>

    <DataTable
      :columns="columns"
      :rows="stocks"
      :row-key="(row) => row.id"
      empty="No stock matches the current filters."
      row-clickable
      @row-click="rowClick"
    >
      <template #[`cell:product`]="{ row }">
        <div class="font-medium text-slate-900">{{ row.variant?.product?.name }}</div>
        <div class="text-xs text-slate-400 inline-flex items-center gap-1">
          <span v-if="row.variant?.product?.category?.icon">
            {{ row.variant.product.category.icon }}
          </span>
          {{ row.variant?.product?.category?.name }}
        </div>
      </template>
      <template #[`cell:variant`]="{ row }">
        <div class="text-sm text-slate-700">{{ row.variant?.displayName }}</div>
      </template>
      <template #[`cell:sku`]="{ row }">
        <code class="text-xs text-slate-500">{{ row.variant?.skuCode }}</code>
      </template>
      <template #[`cell:location`]="{ row }">
        {{ row.location?.name }}
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
