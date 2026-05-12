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

const { t } = useI18n()

defineProps<{
  colors: Data.Color[]
}>()

const dialog = reactive({
  open: false,
  mode: 'create' as 'create' | 'edit',
  editingId: null as number | null,
})

const form = useForm({
  name: '',
  code: '',
  hexCode: '',
})

function openCreate() {
  form.reset()
  dialog.mode = 'create'
  dialog.editingId = null
  dialog.open = true
}

function openEdit(color: Data.Color) {
  form.name = color.name
  form.code = color.code
  form.hexCode = color.hexCode ?? ''
  dialog.mode = 'edit'
  dialog.editingId = color.id
  dialog.open = true
}

function submit() {
  const payload = form.transform((data) => ({
    ...data,
    code: data.code.toUpperCase(),
    hexCode: data.hexCode || null,
  }))
  if (dialog.mode === 'create') {
    payload.post(urlFor('colors.store'), { onSuccess: () => (dialog.open = false) })
  } else if (dialog.editingId !== null) {
    payload.put(urlFor('colors.update', { id: dialog.editingId }), {
      onSuccess: () => (dialog.open = false),
    })
  }
}

const columns = computed(() => [
  { key: 'swatch', label: '', width: '60px' },
  { key: 'name', label: t('common.labels.name') },
  { key: 'code', label: t('common.labels.code'), width: '100px' },
  { key: 'hex', label: t('common.labels.hex') },
  { key: 'actions', label: '', align: 'right' as const, width: '180px' },
])
</script>

<template>
  <Head :title="$t('colors.title')" />
  <div class="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
    <PageHeader :title="$t('colors.title')" :description="$t('colors.description')">
      <template #actions>
        <button type="button" class="btn-primary" @click="openCreate">
          {{ $t('colors.new') }}
        </button>
      </template>
    </PageHeader>

    <DataTable
      :columns="columns"
      :rows="colors"
      :row-key="(row) => row.id"
      :empty="$t('colors.empty')"
    >
      <template #[`cell:swatch`]="{ row }">
        <span
          v-if="row.hexCode"
          class="block size-6 rounded-md ring-1 ring-slate-200"
          :style="{ background: row.hexCode }"
        />
        <span v-else class="block size-6 rounded-md bg-slate-100 ring-1 ring-slate-200" />
      </template>
      <template #[`cell:name`]="{ row }">
        <span class="font-medium text-slate-900">{{ row.name }}</span>
      </template>
      <template #[`cell:code`]="{ row }">
        <code class="text-xs font-mono text-slate-700">{{ row.code }}</code>
      </template>
      <template #[`cell:hex`]="{ row }">
        <code class="text-xs text-slate-500">{{ row.hexCode ?? '—' }}</code>
      </template>
      <template #[`cell:actions`]="{ row }">
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="openEdit(row)">
            {{ $t('common.actions.edit') }}
          </button>
          <ConfirmButton
            route="colors.destroy"
            :params="{ id: row.id }"
            :message="$t('colors.deleteConfirm', { name: row.name })"
          />
        </div>
      </template>
    </DataTable>

    <Modal
      :open="dialog.open"
      :title="dialog.mode === 'create' ? $t('colors.newTitle') : $t('colors.editTitle')"
      @close="dialog.open = false"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <label for="color-name" class="label">{{ $t('common.labels.name') }}</label>
          <input
            id="color-name"
            v-model="form.name"
            required
            class="input"
            :data-invalid="form.errors.name ? 'true' : undefined"
          />
          <p v-if="form.errors.name" class="field-error">{{ form.errors.name }}</p>
        </div>
        <div>
          <label for="color-code" class="label">{{ $t('colors.codeLabel') }}</label>
          <input
            id="color-code"
            v-model="form.code"
            required
            maxlength="8"
            placeholder="BLK"
            class="input uppercase"
            :data-invalid="form.errors.code ? 'true' : undefined"
          />
          <p v-if="form.errors.code" class="field-error">{{ form.errors.code }}</p>
        </div>
        <div>
          <label for="color-hex" class="label">{{ $t('colors.hexLabel') }}</label>
          <input
            id="color-hex"
            v-model="form.hexCode"
            placeholder="#FF6B6B"
            class="input"
            :data-invalid="form.errors.hexCode ? 'true' : undefined"
          />
          <p v-if="form.errors.hexCode" class="field-error">{{ form.errors.hexCode }}</p>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="dialog.open = false">
            {{ $t('common.actions.cancel') }}
          </button>
          <button type="submit" class="btn-primary" :disabled="form.processing">
            {{
              form.processing
                ? $t('common.actions.saving')
                : dialog.mode === 'create'
                  ? $t('common.actions.create')
                  : $t('common.actions.save')
            }}
          </button>
        </div>
      </form>
    </Modal>
  </div>
</template>
