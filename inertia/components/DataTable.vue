<script setup lang="ts" generic="Row">
import { computed, ref } from 'vue'

type SortValue = string | number | null | undefined

type Column = {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  width?: string
  sort?: (row: Row) => SortValue
}

const props = defineProps<{
  columns: Column[]
  rows: Row[]
  rowKey: (row: Row) => string | number
  empty?: string
  rowClickable?: boolean
}>()

const emit = defineEmits<{
  rowClick: [row: Row]
}>()

const sortKey = ref<string | null>(null)
const sortDir = ref<'asc' | 'desc'>('asc')

function toggleSort(col: Column) {
  if (!col.sort) return
  if (sortKey.value !== col.key) {
    sortKey.value = col.key
    sortDir.value = 'asc'
    return
  }
  if (sortDir.value === 'asc') {
    sortDir.value = 'desc'
    return
  }
  // third click clears
  sortKey.value = null
  sortDir.value = 'asc'
}

const sortedRows = computed(() => {
  const col = props.columns.find((c) => c.key === sortKey.value)
  if (!col?.sort) return props.rows
  const accessor = col.sort
  const dir = sortDir.value === 'asc' ? 1 : -1
  // Copy first — Array.sort mutates, and we don't want to reorder the prop.
  return [...props.rows].sort((a, b) => {
    const av = accessor(a)
    const bv = accessor(b)
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv)) * dir
  })
})
</script>

<template>
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              class="px-4 py-2.5 font-semibold whitespace-nowrap"
              :class="{
                'text-right': col.align === 'right',
                'text-center': col.align === 'center',
                'text-left': !col.align || col.align === 'left',
                'cursor-pointer select-none hover:text-slate-900': !!col.sort,
              }"
              :style="col.width ? { width: col.width } : {}"
              :aria-sort="
                col.sort
                  ? sortKey === col.key
                    ? sortDir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                  : undefined
              "
              @click="col.sort && toggleSort(col)"
            >
              <span
                class="inline-flex items-center gap-1"
                :class="{
                  'flex-row-reverse': col.align === 'right',
                  'justify-center': col.align === 'center',
                }"
              >
                {{ col.label }}
                <span v-if="col.sort" class="text-slate-400">
                  <svg
                    v-if="sortKey === col.key && sortDir === 'asc'"
                    xmlns="http://www.w3.org/2000/svg"
                    class="size-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M6 15l6-6 6 6" />
                  </svg>
                  <svg
                    v-else-if="sortKey === col.key && sortDir === 'desc'"
                    xmlns="http://www.w3.org/2000/svg"
                    class="size-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                  <svg
                    v-else
                    xmlns="http://www.w3.org/2000/svg"
                    class="size-3 text-slate-300"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M8 9l4-4 4 4" />
                    <path d="M8 15l4 4 4-4" />
                  </svg>
                </span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr
            v-for="row in sortedRows"
            :key="rowKey(row)"
            class="transition"
            :class="rowClickable ? 'cursor-pointer hover:bg-slate-50' : ''"
            @click="rowClickable && emit('rowClick', row)"
          >
            <td
              v-for="col in columns"
              :key="col.key"
              class="px-4 py-3"
              :class="{
                'text-right': col.align === 'right',
                'text-center': col.align === 'center',
              }"
            >
              <slot :name="`cell:${col.key}`" :row="row" :column="col" />
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td
              :colspan="columns.length"
              class="px-4 py-10 text-center text-sm text-slate-400 italic"
            >
              {{ empty ?? $t('common.empty.noRecords') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
