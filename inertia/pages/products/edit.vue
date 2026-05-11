<script setup lang="ts">
import { computed } from 'vue'
import { Head, useForm } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { urlFor } from '~/client'
import type { Data } from '@generated/data'
import PageHeader from '~/components/PageHeader.vue'
import AttributeMultiSelect from '~/components/AttributeMultiSelect.vue'

const props = defineProps<{
  product: Data.Product
  variants: Data.Variant[]
  colors: Data.Color[]
  sizes: Data.Size[]
}>()

function uniqueAttributeIds(attr: 'color' | 'size'): number[] {
  const ids = new Set<number>()
  for (const v of props.variants) {
    const value = v[attr]
    if (value) ids.add(value.id)
  }
  return [...ids]
}

const form = useForm({
  name: props.product.name,
  code: props.product.code,
  description: props.product.description ?? '',
  lowStockThreshold: props.product.lowStockThreshold,
  colorIds: uniqueAttributeIds('color'),
  sizeIds: uniqueAttributeIds('size'),
})

const category = computed(() => props.product.category)

function submit() {
  form.transform((data) => ({
    ...data,
    code: data.code.toUpperCase(),
    description: data.description || null,
  })).put(urlFor('products.update', { id: props.product.id }))
}
</script>

<template>
  <Head :title="$t('products.edit.title', { name: product.name })" />
  <div class="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
    <PageHeader
      :title="$t('products.edit.title', { name: product.name })"
      :description="$t('products.edit.description')"
    >
      <template #actions>
        <Link route="products.show" :params="{ id: product.id }" class="btn-ghost">{{ $t('common.actions.cancel') }}</Link>
      </template>
    </PageHeader>

    <form class="card p-4 sm:p-6 space-y-6" @submit.prevent="submit">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="sm:col-span-2">
          <label for="name" class="label">{{ $t('common.labels.name') }}</label>
          <input
            id="name"
            v-model="form.name"
            required
            class="input"
            :data-invalid="form.errors.name ? 'true' : undefined"
          />
          <p v-if="form.errors.name" class="field-error">{{ form.errors.name }}</p>
        </div>
        <div>
          <label for="code" class="label">{{ $t('common.labels.code') }}</label>
          <input
            id="code"
            v-model="form.code"
            required
            maxlength="16"
            class="input uppercase"
            :data-invalid="form.errors.code ? 'true' : undefined"
          />
          <p v-if="form.errors.code" class="field-error">{{ form.errors.code }}</p>
        </div>
      </div>

      <div>
        <label for="lowStockThreshold" class="label">{{ $t('products.show.lowStockThreshold') }}</label>
        <input
          id="lowStockThreshold"
          v-model.number="form.lowStockThreshold"
          type="number"
          min="0"
          class="input"
          :placeholder="$t('common.placeholders.optional')"
        />
      </div>

      <div>
        <label for="description" class="label">{{ $t('common.labels.description') }}</label>
        <textarea id="description" v-model="form.description" rows="3" class="textarea" />
      </div>

      <template v-if="category">
        <hr class="border-slate-100" />
        <div>
          <h2 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">{{ $t('common.labels.variants') }}</h2>
          <p class="text-xs text-slate-500 mb-4">
            {{ $t('products.edit.variantsHint') }}
          </p>

          <div class="space-y-5">
            <AttributeMultiSelect
              v-if="category.hasColor"
              v-model="form.colorIds"
              :label="$t('common.labels.colors')"
              :options="colors"
            >
              <template #option="{ option, selected }">
                <span class="inline-flex items-center gap-1.5">
                  <span
                    v-if="option.hexCode"
                    class="size-3 rounded-full ring-1"
                    :class="selected ? 'ring-white/40' : 'ring-slate-200'"
                    :style="{ background: option.hexCode }"
                  />
                  {{ option.name }}
                </span>
              </template>
            </AttributeMultiSelect>

            <AttributeMultiSelect
              v-if="category.hasSize"
              v-model="form.sizeIds"
              :label="$t('common.labels.sizes')"
              :options="sizes"
            />
          </div>
        </div>
      </template>

      <div class="flex justify-end gap-2">
        <Link route="products.show" :params="{ id: product.id }" class="btn-ghost">{{ $t('common.actions.cancel') }}</Link>
        <button type="submit" class="btn-primary" :disabled="form.processing">
          {{ form.processing ? $t('common.actions.saving') : $t('common.actions.saveChanges') }}
        </button>
      </div>
    </form>
  </div>
</template>
