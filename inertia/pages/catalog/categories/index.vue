<script setup lang="ts">
import { reactive } from 'vue'
import { Head, useForm } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import type { Data } from '@generated/data'
import PageHeader from '~/components/PageHeader.vue'
import DataTable from '~/components/DataTable.vue'
import Modal from '~/components/Modal.vue'
import ConfirmButton from '~/components/ConfirmButton.vue'

const props = defineProps<{
  categories: Data.Category[]
}>()

const dialog = reactive({ open: false, mode: 'create' as 'create' | 'edit', editingId: null as number | null })

const form = useForm({
  name: '',
  icon: '',
  hasColor: false,
  hasPrint: false,
  hasSize: false,
})

function openCreate() {
  form.reset()
  dialog.mode = 'create'
  dialog.editingId = null
  dialog.open = true
}

function openEdit(cat: Data.Category) {
  form.name = cat.name
  form.icon = cat.icon ?? ''
  form.hasColor = cat.hasColor
  form.hasPrint = cat.hasPrint
  form.hasSize = cat.hasSize
  dialog.mode = 'edit'
  dialog.editingId = cat.id
  dialog.open = true
}

function submit() {
  const payload = form.transform((data) => ({ ...data, icon: data.icon || null }))
  if (dialog.mode === 'create') {
    payload.post(urlFor('categories.store'), { onSuccess: () => (dialog.open = false) })
  } else if (dialog.editingId !== null) {
    payload.put(urlFor('categories.update', { id: dialog.editingId }), {
      onSuccess: () => (dialog.open = false),
    })
  }
}

const columns = [
  { key: 'icon', label: '', width: '60px' },
  { key: 'name', label: 'Name' },
  { key: 'attributes', label: 'Attributes' },
  { key: 'actions', label: '', align: 'right' as const, width: '180px' },
]
</script>

<template>
  <Head title="Categories" />
  <div class="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
    <PageHeader
      title="Categories"
      description="Each category declares which attributes its products use."
    >
      <template #actions>
        <button type="button" class="btn-primary" @click="openCreate">+ New category</button>
      </template>
    </PageHeader>

    <DataTable
      :columns="columns"
      :rows="categories"
      :row-key="(row) => row.id"
      empty="No categories yet."
    >
      <template #[`cell:icon`]="{ row }">
        <span class="text-2xl leading-none">{{ row.icon ?? '·' }}</span>
      </template>
      <template #[`cell:name`]="{ row }">
        <span class="font-medium text-slate-900">{{ row.name }}</span>
      </template>
      <template #[`cell:attributes`]="{ row }">
        <div class="flex flex-wrap gap-1.5 text-xs">
          <span
            v-if="row.hasColor"
            class="badge bg-slate-100 text-slate-700"
          >
            color
          </span>
          <span
            v-if="row.hasPrint"
            class="badge bg-slate-100 text-slate-700"
          >
            print
          </span>
          <span
            v-if="row.hasSize"
            class="badge bg-slate-100 text-slate-700"
          >
            size
          </span>
          <span
            v-if="!row.hasColor && !row.hasPrint && !row.hasSize"
            class="text-slate-300 italic"
          >
            no attributes
          </span>
        </div>
      </template>
      <template #[`cell:actions`]="{ row }">
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="openEdit(row)">Edit</button>
          <ConfirmButton
            route="categories.destroy"
            :params="{ id: row.id }"
            :message="`Archive “${row.name}”?`"
            label="Archive"
          />
        </div>
      </template>
    </DataTable>

    <Modal
      :open="dialog.open"
      :title="dialog.mode === 'create' ? 'New category' : 'Edit category'"
      @close="dialog.open = false"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <div class="grid grid-cols-[5rem_1fr] gap-3">
          <div>
            <label for="cat-icon" class="label">Icon</label>
            <input
              id="cat-icon"
              v-model="form.icon"
              maxlength="8"
              placeholder="🧥"
              class="input text-center text-xl"
              :data-invalid="form.errors.icon ? 'true' : undefined"
            />
          </div>
          <div>
            <label for="cat-name" class="label">Name</label>
            <input
              id="cat-name"
              v-model="form.name"
              required
              class="input"
              :data-invalid="form.errors.name ? 'true' : undefined"
            />
          </div>
        </div>
        <p v-if="form.errors.name" class="field-error">{{ form.errors.name }}</p>
        <p v-if="form.errors.icon" class="field-error">{{ form.errors.icon }}</p>
        <fieldset class="space-y-2">
          <legend class="label mb-1">Attributes used by products in this category</legend>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.hasColor" type="checkbox" class="size-4 rounded border-slate-300" />
            Color
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.hasPrint" type="checkbox" class="size-4 rounded border-slate-300" />
            Print
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.hasSize" type="checkbox" class="size-4 rounded border-slate-300" />
            Size
          </label>
        </fieldset>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="dialog.open = false">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="form.processing">
            {{ form.processing ? 'Saving…' : dialog.mode === 'create' ? 'Create' : 'Save' }}
          </button>
        </div>
      </form>
    </Modal>
  </div>
</template>
