<script setup lang="ts" generic="Row">
type Column = {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  width?: string
}

defineProps<{
  columns: Column[]
  rows: Row[]
  rowKey: (row: Row) => string | number
  empty?: string
  rowClickable?: boolean
}>()

const emit = defineEmits<{
  rowClick: [row: Row]
}>()
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
              }"
              :style="col.width ? { width: col.width } : {}"
            >
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr
            v-for="row in rows"
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
