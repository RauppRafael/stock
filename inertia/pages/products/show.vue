<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import type { Data } from '@generated/data'
import PageHeader from '~/components/PageHeader.vue'
import StockBadge from '~/components/StockBadge.vue'
import MovementRow from '~/components/MovementRow.vue'

const props = defineProps<{
  product: Data.Product
  variants: Data.Variant[]
  stocks: Data.Stock[]
  movements: Data.StockMovement[]
}>()

const stocksByVariant = computed(() => {
  const map = new Map<number, Data.Stock[]>()
  for (const s of props.stocks) {
    if (!s.variantId) continue
    if (!map.has(s.variantId)) map.set(s.variantId, [])
    map.get(s.variantId)!.push(s)
  }
  return map
})

const totalOnHand = computed(() => props.stocks.reduce((sum, s) => sum + s.quantity, 0))
</script>

<template>
  <Head :title="product.name" />
  <div class="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
    <PageHeader :title="product.name" :description="product.category?.name ?? undefined">
      <template #actions>
        <Link route="products.index" class="btn-ghost">{{ $t('common.actions.back') }}</Link>
        <Link route="products.edit" :params="{ id: product.id }" class="btn-secondary">{{ $t('common.actions.edit') }}</Link>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
      <div class="card p-4">
        <p class="text-xs uppercase tracking-wider text-slate-500">{{ $t('products.show.totalOnHand') }}</p>
        <p class="text-2xl font-semibold mt-1 text-slate-900">{{ totalOnHand }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-wider text-slate-500">{{ $t('common.labels.variants') }}</p>
        <p class="text-2xl font-semibold mt-1 text-slate-900">{{ variants.length }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-wider text-slate-500">{{ $t('products.show.lowStockThreshold') }}</p>
        <p class="text-2xl font-semibold mt-1 text-slate-900">
          {{ product.lowStockThreshold ?? '—' }}
        </p>
      </div>
    </div>

    <p v-if="product.description" class="text-sm text-slate-600 mb-6">{{ product.description }}</p>

    <div class="card overflow-hidden mb-8">
      <header class="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 class="font-semibold text-slate-800">{{ $t('products.show.variantsAndStock') }}</h2>
        <Link route="stock.adjust.create" class="btn-secondary text-xs">{{ $t('nav.items.adjustStock') }}</Link>
      </header>
      <div class="overflow-x-auto">
      <table class="w-full text-sm min-w-[640px]">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-4 py-2 text-left">{{ $t('common.labels.variant') }}</th>
            <th class="px-4 py-2 text-left">{{ $t('common.labels.sku') }}</th>
            <th class="px-4 py-2 text-left">{{ $t('products.show.stockByLocation') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="variant in variants" :key="variant.id">
            <td class="px-4 py-3">
              <div class="font-medium text-slate-800">{{ variant.displayName }}</div>
            </td>
            <td class="px-4 py-3">
              <code class="text-xs text-slate-500">{{ variant.skuCode }}</code>
            </td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="s in stocksByVariant.get(variant.id) ?? []"
                  :key="s.id"
                  class="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                >
                  <span class="text-slate-500">{{ s.location?.name }}</span>
                  <StockBadge
                    :quantity="s.quantity"
                    :threshold="product.lowStockThreshold ?? null"
                  />
                </span>
                <span
                  v-if="!(stocksByVariant.get(variant.id) ?? []).length"
                  class="text-xs text-slate-300 italic"
                >
                  {{ $t('common.empty.notStocked') }}
                </span>
              </div>
            </td>
          </tr>
          <tr v-if="!variants.length">
            <td colspan="3" class="px-4 py-10 text-center text-sm text-slate-400 italic">
              {{ $t('products.show.noVariants') }}
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <div class="card overflow-hidden">
      <header class="px-5 py-3 border-b border-slate-100">
        <h2 class="font-semibold text-slate-800">{{ $t('movements.recent') }}</h2>
      </header>
      <div class="overflow-x-auto">
      <table class="w-full min-w-[800px]">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-4 py-2 text-left">{{ $t('common.labels.date') }}</th>
            <th class="px-4 py-2 text-left">{{ $t('common.labels.product') }}</th>
            <th class="px-4 py-2 text-left">{{ $t('common.labels.variant') }}</th>
            <th class="px-4 py-2 text-left">{{ $t('common.labels.location') }}</th>
            <th class="px-4 py-2 text-center">{{ $t('common.labels.change') }}</th>
            <th class="px-4 py-2 text-left">{{ $t('common.labels.user') }}</th>
            <th class="px-4 py-2 text-left">{{ $t('common.labels.reason') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <MovementRow v-for="m in movements" :key="m.id" :movement="m" />
          <tr v-if="!movements.length">
            <td colspan="7" class="px-4 py-10 text-center text-sm text-slate-400 italic">
              {{ $t('movements.emptyForProduct') }}
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  </div>
</template>
