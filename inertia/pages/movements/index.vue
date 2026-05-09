<script setup lang="ts">
import { reactive, watch } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { z } from 'zod'
import type { Data } from '@generated/data'
import {
  locationSchema,
  paginationSchema,
  productSchema,
  stockMovementSchema,
  userSchema,
} from '@contracts'
import { useValidatedProps } from '~/composables/use_validated_props'
import PageHeader from '~/components/PageHeader.vue'
import MovementRow from '~/components/MovementRow.vue'

const props = defineProps<{
  movements: Data.StockMovement[]
  pagination: { page: number; perPage: number; total: number; lastPage: number }
  locations: Data.Location[]
  products: Data.Product[]
  users: Data.User[]
  filters: {
    from: string | null
    to: string | null
    productId: number | null
    variantId: number | null
    locationId: number | null
    userId: number | null
  }
}>()

useValidatedProps(
  props,
  z.object({
    movements: z.array(stockMovementSchema),
    pagination: paginationSchema,
    locations: z.array(locationSchema),
    products: z.array(productSchema),
    users: z.array(userSchema),
    filters: z.object({
      from: z.string().nullable(),
      to: z.string().nullable(),
      productId: z.number().int().nullable(),
      variantId: z.number().int().nullable(),
      locationId: z.number().int().nullable(),
      userId: z.number().int().nullable(),
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
        '/movements',
        Object.fromEntries(
          Object.entries(next).filter(([, v]) => v !== null && v !== '')
        ),
        { preserveState: true, preserveScroll: true, replace: true }
      )
    }, 300)
  },
  { deep: true }
)

function changePage(page: number) {
  router.get(
    '/movements',
    {
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== null && v !== '')),
      page,
    },
    { preserveScroll: true }
  )
}
</script>

<template>
  <Head title="Stock movements" />
  <div class="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
    <PageHeader
      title="Stock movements"
      description="Append-only history of every stock change."
    >
      <template #actions>
        <Link route="stock.adjust.create" class="btn-secondary">+ New adjustment</Link>
      </template>
    </PageHeader>

    <div class="card p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
      <div>
        <label class="label">From</label>
        <input v-model="filters.from" type="date" class="input" />
      </div>
      <div>
        <label class="label">To</label>
        <input v-model="filters.to" type="date" class="input" />
      </div>
      <div>
        <label class="label">Product</label>
        <select v-model.number="filters.productId" class="select">
          <option :value="null">All</option>
          <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <div>
        <label class="label">Location</label>
        <select v-model.number="filters.locationId" class="select">
          <option :value="null">All</option>
          <option v-for="l in locations" :key="l.id" :value="l.id">{{ l.name }}</option>
        </select>
      </div>
      <div>
        <label class="label">User</label>
        <select v-model.number="filters.userId" class="select">
          <option :value="null">All</option>
          <option v-for="u in users" :key="u.id" :value="u.id">{{ u.email }}</option>
        </select>
      </div>
      <div>
        <label class="label">Variant ID</label>
        <input v-model.number="filters.variantId" type="number" class="input" placeholder="e.g. 42" />
      </div>
    </div>

    <div class="card overflow-hidden">
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
                No movements match these filters.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer
        v-if="pagination.lastPage > 1"
        class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-3 border-t border-slate-100 text-sm text-slate-600"
      >
        <span>
          Page {{ pagination.page }} of {{ pagination.lastPage }} · {{ pagination.total }} total
        </span>
        <div class="flex gap-2">
          <button
            type="button"
            class="btn-secondary text-xs"
            :disabled="pagination.page <= 1"
            @click="changePage(pagination.page - 1)"
          >
            Previous
          </button>
          <button
            type="button"
            class="btn-secondary text-xs"
            :disabled="pagination.page >= pagination.lastPage"
            @click="changePage(pagination.page + 1)"
          >
            Next
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>
