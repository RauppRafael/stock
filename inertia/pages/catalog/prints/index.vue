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
  prints: Data.Print[]
}>()

const dialog = reactive({
  open: false,
  mode: 'create' as 'create' | 'edit',
  editingId: null as number | null,
})

const form = useForm({ name: '', code: '' })

function openCreate() {
  form.reset()
  dialog.mode = 'create'
  dialog.editingId = null
  dialog.open = true
}

function openEdit(p: Data.Print) {
  form.name = p.name
  form.code = p.code
  dialog.mode = 'edit'
  dialog.editingId = p.id
  dialog.open = true
}

function submit() {
  const payload = form.transform((data) => ({ ...data, code: data.code.toUpperCase() }))
  if (dialog.mode === 'create') {
    payload.post(urlFor('prints.store'), { onSuccess: () => (dialog.open = false) })
  } else if (dialog.editingId !== null) {
    payload.put(urlFor('prints.update', { id: dialog.editingId }), {
      onSuccess: () => (dialog.open = false),
    })
  }
}

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'code', label: 'Code', width: '120px' },
  { key: 'actions', label: '', align: 'right' as const, width: '180px' },
]
</script>

<template>
  <Head title="Prints" />
  <div class="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
    <PageHeader title="Prints" description="Reusable print attribute applied to product variants.">
      <template #actions>
        <button type="button" class="btn-primary" @click="openCreate">+ New print</button>
      </template>
    </PageHeader>

    <DataTable :columns="columns" :rows="prints" :row-key="(row) => row.id" empty="No prints yet.">
      <template #[`cell:name`]="{ row }">
        <span class="font-medium text-slate-900">{{ row.name }}</span>
      </template>
      <template #[`cell:code`]="{ row }">
        <code class="text-xs font-mono text-slate-700">{{ row.code }}</code>
      </template>
      <template #[`cell:actions`]="{ row }">
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="openEdit(row)">Edit</button>
          <ConfirmButton
            route="prints.destroy"
            :params="{ id: row.id }"
            :message="`Delete “${row.name}”?`"
          />
        </div>
      </template>
    </DataTable>

    <Modal
      :open="dialog.open"
      :title="dialog.mode === 'create' ? 'New print' : 'Edit print'"
      @close="dialog.open = false"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <label for="print-name" class="label">Name</label>
          <input
            id="print-name"
            v-model="form.name"
            required
            class="input"
            :data-invalid="form.errors.name ? 'true' : undefined"
          />
          <p v-if="form.errors.name" class="field-error">{{ form.errors.name }}</p>
        </div>
        <div>
          <label for="print-code" class="label">Code (used in SKUs, A–Z / 0–9, max 8)</label>
          <input
            id="print-code"
            v-model="form.code"
            required
            maxlength="8"
            placeholder="PUFF"
            class="input uppercase"
            :data-invalid="form.errors.code ? 'true' : undefined"
          />
          <p v-if="form.errors.code" class="field-error">{{ form.errors.code }}</p>
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
