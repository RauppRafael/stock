<script setup lang="ts">
import { computed, reactive } from 'vue'
import { Head, useForm } from '@inertiajs/vue3'
import { useI18n } from 'vue-i18n'
import { urlFor } from '~/client'
import type { Data } from '@generated/data'
import PageHeader from '~/components/PageHeader.vue'
import DataTable from '~/components/DataTable.vue'
import Modal from '~/components/Modal.vue'
import ConfirmButton from '~/components/ConfirmButton.vue'
import EmojiPicker from '~/components/EmojiPicker.vue'
import { LOCATION_EMOJIS } from '~/components/emoji_sets'

const { t } = useI18n()

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
  icon: '',
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
  form.icon = loc.icon ?? ''
  dialog.mode = 'edit'
  dialog.editingId = loc.id
  dialog.open = true
}

function submit() {
  const payload = form.transform((data) => ({
    ...data,
    description: data.description || null,
    icon: data.icon || null,
  }))
  if (dialog.mode === 'create') {
    payload.post(urlFor('locations.store'), { onSuccess: () => (dialog.open = false) })
  } else if (dialog.editingId !== null) {
    payload.put(urlFor('locations.update', { id: dialog.editingId }), {
      onSuccess: () => (dialog.open = false),
    })
  }
}

const columns = computed(() => [
  { key: 'icon', label: '', width: '60px' },
  { key: 'name', label: t('common.labels.name') },
  { key: 'description', label: t('common.labels.description') },
  { key: 'actions', label: '', align: 'right' as const, width: '180px' },
])
</script>

<template>
  <Head :title="$t('locations.title')" />
  <div class="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
    <PageHeader :title="$t('locations.title')" :description="$t('locations.description')">
      <template #actions>
        <button type="button" class="btn-primary" @click="openCreate">{{ $t('locations.new') }}</button>
      </template>
    </PageHeader>

    <DataTable :columns="columns" :rows="locations" :row-key="(row) => row.id" :empty="$t('locations.empty')">
      <template #[`cell:icon`]="{ row }">
        <span class="text-2xl leading-none">{{ row.icon ?? '·' }}</span>
      </template>
      <template #[`cell:name`]="{ row }">
        <span class="font-medium text-slate-900">{{ row.name }}</span>
      </template>
      <template #[`cell:description`]="{ row }">
        <span class="text-slate-600 text-sm">{{ row.description ?? '—' }}</span>
      </template>
      <template #[`cell:actions`]="{ row }">
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="openEdit(row)">{{ $t('common.actions.edit') }}</button>
          <ConfirmButton
            route="locations.destroy"
            :params="{ id: row.id }"
            :message="$t('locations.deleteConfirm', { name: row.name })"
          />
        </div>
      </template>
    </DataTable>

    <Modal
      :open="dialog.open"
      :title="dialog.mode === 'create' ? $t('locations.newTitle') : $t('locations.editTitle')"
      @close="dialog.open = false"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <label for="loc-name" class="label">{{ $t('common.labels.name') }}</label>
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
          <label class="label">{{ $t('common.labels.icon') }}</label>
          <EmojiPicker v-model="form.icon" :emojis="LOCATION_EMOJIS" :aria-label="$t('locations.iconLabel')" />
          <p v-if="form.errors.icon" class="field-error">{{ form.errors.icon }}</p>
        </div>
        <div>
          <label for="loc-description" class="label">{{ $t('common.labels.description') }}</label>
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
          <button type="button" class="btn-ghost" @click="dialog.open = false">{{ $t('common.actions.cancel') }}</button>
          <button type="submit" class="btn-primary" :disabled="form.processing">
            {{ form.processing ? $t('common.actions.saving') : dialog.mode === 'create' ? $t('common.actions.create') : $t('common.actions.save') }}
          </button>
        </div>
      </form>
    </Modal>
  </div>
</template>
