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
import { CATEGORY_EMOJIS } from '~/components/emoji_sets'

const { t } = useI18n()

const props = defineProps<{
  categories: Data.Category[]
}>()

const dialog = reactive({ open: false, mode: 'create' as 'create' | 'edit', editingId: null as number | null })

const form = useForm({
  name: '',
  icon: '',
  hasColor: false,
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

const columns = computed(() => [
  { key: 'icon', label: '', width: '60px' },
  { key: 'name', label: t('common.labels.name') },
  { key: 'attributes', label: t('nav.groups.attributes') },
  { key: 'actions', label: '', align: 'right' as const, width: '180px' },
])
</script>

<template>
  <Head :title="$t('categories.title')" />
  <div class="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
    <PageHeader
      :title="$t('categories.title')"
      :description="$t('categories.description')"
    >
      <template #actions>
        <button type="button" class="btn-primary" @click="openCreate">{{ $t('categories.new') }}</button>
      </template>
    </PageHeader>

    <DataTable
      :columns="columns"
      :rows="categories"
      :row-key="(row) => row.id"
      :empty="$t('categories.empty')"
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
            {{ $t('common.labels.color').toLowerCase() }}
          </span>
          <span
            v-if="row.hasSize"
            class="badge bg-slate-100 text-slate-700"
          >
            {{ $t('common.labels.size').toLowerCase() }}
          </span>
          <span
            v-if="!row.hasColor && !row.hasSize"
            class="text-slate-300 italic"
          >
            {{ $t('common.noAttributes') }}
          </span>
        </div>
      </template>
      <template #[`cell:actions`]="{ row }">
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="openEdit(row)">{{ $t('common.actions.edit') }}</button>
          <ConfirmButton
            route="categories.destroy"
            :params="{ id: row.id }"
            :message="$t('categories.archiveConfirm', { name: row.name })"
            :label="$t('common.actions.archive')"
          />
        </div>
      </template>
    </DataTable>

    <Modal
      :open="dialog.open"
      :title="dialog.mode === 'create' ? $t('categories.newTitle') : $t('categories.editTitle')"
      @close="dialog.open = false"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <label for="cat-name" class="label">{{ $t('common.labels.name') }}</label>
          <input
            id="cat-name"
            v-model="form.name"
            required
            class="input"
            :data-invalid="form.errors.name ? 'true' : undefined"
          />
          <p v-if="form.errors.name" class="field-error">{{ form.errors.name }}</p>
        </div>
        <div>
          <label class="label">{{ $t('common.labels.icon') }}</label>
          <EmojiPicker v-model="form.icon" :emojis="CATEGORY_EMOJIS" :aria-label="$t('categories.iconLabel')" />
          <p v-if="form.errors.icon" class="field-error">{{ form.errors.icon }}</p>
        </div>
        <fieldset class="space-y-2">
          <legend class="label mb-1">{{ $t('categories.attributesUsed') }}</legend>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.hasColor" type="checkbox" class="size-4 rounded border-slate-300" />
            {{ $t('common.labels.color') }}
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.hasSize" type="checkbox" class="size-4 rounded border-slate-300" />
            {{ $t('common.labels.size') }}
          </label>
        </fieldset>
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
