<script setup lang="ts">
import { reactive } from 'vue'
import { Head, useForm } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import type { Data } from '@generated/data'
import PageHeader from '~/components/PageHeader.vue'
import DataTable from '~/components/DataTable.vue'
import Modal from '~/components/Modal.vue'
import ConfirmButton from '~/components/ConfirmButton.vue'

defineProps<{
  locations: Data.Location[]
}>()

const dialog = reactive({
  open: false,
  mode: 'create' as 'create' | 'edit',
  editingId: null as number | null,
})

const form = useForm({
  name: '',
  description: '',
})

function openCreate() {
  form.reset()
  dialog.mode = 'create'
  dialog.editingId = null
  dialog.open = true
}

function openEdit(loc: Data.Location) {
  form.name = loc.name
  form.description = loc.description ?? ''
  dialog.mode = 'edit'
  dialog.editingId = loc.id
  dialog.open = true
}

function submit() {
  const payload = form.transform((data) => ({ ...data, description: data.description || null }))
  if (dialog.mode === 'create') {
    payload.post(urlFor('locations.store'), { onSuccess: () => (dialog.open = false) })
  } else if (dialog.editingId !== null) {
    payload.put(urlFor('locations.update', { id: dialog.editingId }), {
      onSuccess: () => (dialog.open = false),
    })
  }
}

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'actions', label: '', align: 'right' as const, width: '180px' },
]
</script>

<template>
  <Head title="Locations" />
  <div class="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
    <PageHeader title="Locations" description="Physical places where stock is held.">
      <template #actions>
        <button type="button" class="btn-primary" @click="openCreate">+ New location</button>
      </template>
    </PageHeader>

    <DataTable :columns="columns" :rows="locations" :row-key="(row) => row.id" empty="No locations yet.">
      <template #[`cell:name`]="{ row }">
        <span class="font-medium text-slate-900">{{ row.name }}</span>
      </template>
      <template #[`cell:description`]="{ row }">
        <span class="text-slate-600 text-sm">{{ row.description ?? '—' }}</span>
      </template>
      <template #[`cell:actions`]="{ row }">
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="openEdit(row)">Edit</button>
          <ConfirmButton
            route="locations.destroy"
            :params="{ id: row.id }"
            :message="`Delete “${row.name}”?`"
          />
        </div>
      </template>
    </DataTable>

    <Modal
      :open="dialog.open"
      :title="dialog.mode === 'create' ? 'New location' : 'Edit location'"
      @close="dialog.open = false"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <label for="loc-name" class="label">Name</label>
          <input
            id="loc-name"
            v-model="form.name"
            required
            class="input"
            :data-invalid="form.errors.name ? 'true' : undefined"
          />
          <p v-if="form.errors.name" class="field-error">{{ form.errors.name }}</p>
        </div>
        <div>
          <label for="loc-description" class="label">Description</label>
          <textarea
            id="loc-description"
            v-model="form.description"
            rows="3"
            class="textarea"
            :data-invalid="form.errors.description ? 'true' : undefined"
          />
          <p v-if="form.errors.description" class="field-error">{{ form.errors.description }}</p>
        </div>
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
