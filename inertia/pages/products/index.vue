<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from 'vue-i18n'
import type { Data } from '@generated/data'
import PageHeader from '~/components/PageHeader.vue'
import DataTable from '~/components/DataTable.vue'
import ConfirmButton from '~/components/ConfirmButton.vue'

const { t } = useI18n()

const props = defineProps<{
  products: Data.Product[]
  categories: Data.Category[]
  filters: { categoryId: number | null; search: string }
}>()

const filters = reactive({ ...props.filters })

let timer: ReturnType<typeof setTimeout> | null = null
watch(filters, (next) => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    router.get(
      '/products',
      {
        ...(next.categoryId ? { categoryId: next.categoryId } : {}),
        ...(next.search ? { search: next.search } : {}),
      },
      { preserveState: true, preserveScroll: true, replace: true }
    )
  }, 300)
}, { deep: true })

const columns = computed(() => [
  { key: 'name', label: t('common.labels.name') },
  { key: 'category', label: t('common.labels.category') },
  { key: 'description', label: t('common.labels.description') },
  { key: 'threshold', label: t('products.index.lowThreshold'), align: 'right' as const, width: '140px' },
  { key: 'actions', label: '', align: 'right' as const, width: '180px' },
])
</script>

<template>
  <Head :title="$t('products.index.title')" />
  <div class="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
    <PageHeader :title="$t('products.index.title')" :description="$t('products.index.description')">
      <template #actions>
        <Link route="products.create" class="btn-primary">{{ $t('products.index.newProduct') }}</Link>
      </template>
    </PageHeader>

    <div class="card p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div>
        <label class="label">{{ $t('common.labels.search') }}</label>
        <input v-model="filters.search" :placeholder="$t('common.placeholders.searchByName')" class="input" />
      </div>
      <div>
        <label class="label">{{ $t('common.labels.category') }}</label>
        <select v-model.number="filters.categoryId" class="select">
          <option :value="null">{{ $t('common.allCategories') }}</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
    </div>

    <DataTable
      :columns="columns"
      :rows="products"
      :row-key="(row) => row.id"
      :empty="$t('products.index.empty')"
    >
      <template #[`cell:name`]="{ row }">
        <Link route="products.show" :params="{ id: row.id }" class="font-medium text-slate-900 hover:text-brand-700">
          {{ row.name }}
        </Link>
      </template>
      <template #[`cell:category`]="{ row }">
        {{ row.category?.name ?? '—' }}
      </template>
      <template #[`cell:description`]="{ row }">
        <span class="text-xs text-slate-500 line-clamp-2">{{ row.description ?? '' }}</span>
      </template>
      <template #[`cell:threshold`]="{ row }">
        <span v-if="row.lowStockThreshold !== null" class="tabular-nums">{{ row.lowStockThreshold }}</span>
        <span v-else class="text-slate-300">—</span>
      </template>
      <template #[`cell:actions`]="{ row }">
        <div class="flex justify-end gap-2">
          <Link route="products.edit" :params="{ id: row.id }" class="btn-secondary">{{ $t('common.actions.edit') }}</Link>
          <ConfirmButton
            route="products.destroy"
            :params="{ id: row.id }"
            :message="$t('products.index.archiveConfirm', { name: row.name })"
            :label="$t('common.actions.archive')"
          />
        </div>
      </template>
    </DataTable>
  </div>
</template>
