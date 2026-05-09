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
        <Link route="products.index" class="btn-ghost">Back</Link>
        <Link route="products.edit" :params="{ id: product.id }" class="btn-secondary">Edit</Link>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
      <div class="card p-4">
        <p class="text-xs uppercase tracking-wider text-slate-500">Total on hand</p>
        <p class="text-2xl font-semibold mt-1 text-slate-900">{{ totalOnHand }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-wider text-slate-500">Variants</p>
        <p class="text-2xl font-semibold mt-1 text-slate-900">{{ variants.length }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-wider text-slate-500">Low stock threshold</p>
        <p class="text-2xl font-semibold mt-1 text-slate-900">
          {{ product.lowStockThreshold ?? '—' }}
        </p>
      </div>
    </div>

    <p v-if="product.description" class="text-sm text-slate-600 mb-6">{{ product.description }}</p>

    <div class="card overflow-hidden mb-8">
      <header class="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 class="font-semibold text-slate-800">Variants &amp; stock</h2>
        <Link route="stock.adjust.create" class="btn-secondary text-xs">Adjust stock</Link>
      </header>
      <div class="overflow-x-auto">
      <table class="w-full text-sm min-w-[640px]">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-4 py-2 text-left">Variant</th>
            <th class="px-4 py-2 text-left">SKU</th>
            <th class="px-4 py-2 text-left">Stock by location</th>
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
                  Not stocked anywhere
                </span>
              </div>
            </td>
          </tr>
          <tr v-if="!variants.length">
            <td colspan="3" class="px-4 py-10 text-center text-sm text-slate-400 italic">
              No variants yet.
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <div class="card overflow-hidden">
      <header class="px-5 py-3 border-b border-slate-100">
        <h2 class="font-semibold text-slate-800">Recent movements</h2>
      </header>
      <div class="overflow-x-auto">
      <table class="w-full min-w-[800px]">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-4 py-2 text-left">Date</th>
            <th class="px-4 py-2 text-left">Variant</th>
            <th class="px-4 py-2 text-left">Location</th>
            <th class="px-4 py-2 text-right">Change</th>
            <th class="px-4 py-2 text-right">Δ</th>
            <th class="px-4 py-2 text-left">User</th>
            <th class="px-4 py-2 text-left">Reason</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <MovementRow v-for="m in movements" :key="m.id" :movement="m" />
          <tr v-if="!movements.length">
            <td colspan="7" class="px-4 py-10 text-center text-sm text-slate-400 italic">
              No movements yet for this product.
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  </div>
</template>
