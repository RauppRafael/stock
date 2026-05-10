<script setup lang="ts">
import { computed, watch } from 'vue'
import { Head, useForm } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from 'vue-i18n'
import { urlFor } from '~/client'
import type { Data } from '@generated/data'
import PageHeader from '~/components/PageHeader.vue'
import AttributeMultiSelect from '~/components/AttributeMultiSelect.vue'

const { t } = useI18n()

const props = defineProps<{
  categories: Data.Category[]
  colors: Data.Color[]
  prints: Data.Print[]
  sizes: Data.Size[]
}>()

function categoryAttrs(c: Data.Category): string {
  const attrs = [
    c.hasColor ? t('common.labels.color').toLowerCase() : null,
    c.hasPrint ? t('common.labels.print').toLowerCase() : null,
    c.hasSize ? t('common.labels.size').toLowerCase() : null,
  ].filter((x): x is string => !!x)
  return attrs.length ? attrs.join(' / ') : t('common.noAttributes')
}

const form = useForm({
  name: '',
  code: '',
  categoryId: null as number | null,
  description: '',
  lowStockThreshold: null as number | null,
  colorIds: [] as number[],
  printIds: [] as number[],
  sizeIds: [] as number[],
})

const selectedCategory = computed<Data.Category | null>(
  () => props.categories.find((c) => c.id === form.categoryId) ?? null
)

watch(selectedCategory, (cat) => {
  if (!cat?.hasColor) form.colorIds = []
  if (!cat?.hasPrint) form.printIds = []
  if (!cat?.hasSize) form.sizeIds = []
})

const variantCount = computed(() => {
  if (!selectedCategory.value) return 0
  const colorCount = selectedCategory.value.hasColor ? form.colorIds.length || 0 : 1
  const printCount = selectedCategory.value.hasPrint ? form.printIds.length || 0 : 1
  const sizeCount = selectedCategory.value.hasSize ? form.sizeIds.length || 0 : 1
  return colorCount * printCount * sizeCount
})

function submit() {
  form.transform((data) => ({
    ...data,
    code: data.code.toUpperCase(),
    description: data.description || null,
  })).post(urlFor('products.store'))
}
</script>

<template>
  <Head :title="$t('products.create.title')" />
  <div class="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
    <PageHeader :title="$t('products.create.title')" :description="$t('products.create.description')">
      <template #actions>
        <Link route="products.index" class="btn-ghost">{{ $t('common.actions.cancel') }}</Link>
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
            :placeholder="$t('products.create.namePlaceholder')"
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
            :placeholder="$t('products.create.codePlaceholder')"
          />
          <p v-if="form.errors.code" class="field-error">{{ form.errors.code }}</p>
        </div>
      </div>

      <div>
        <label for="categoryId" class="label">{{ $t('common.labels.category') }}</label>
        <select
          id="categoryId"
          v-model.number="form.categoryId"
          required
          class="select"
          :data-invalid="form.errors.categoryId ? 'true' : undefined"
        >
          <option :value="null">{{ $t('common.selectACategory') }}</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">
            {{ c.name }} ({{ categoryAttrs(c) }})
          </option>
        </select>
        <p v-if="form.errors.categoryId" class="field-error">{{ form.errors.categoryId }}</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="lowStockThreshold" class="label">{{ $t('products.create.lowStockThreshold') }}</label>
          <input
            id="lowStockThreshold"
            v-model.number="form.lowStockThreshold"
            type="number"
            min="0"
            class="input"
            :placeholder="$t('common.placeholders.optional')"
          />
          <p v-if="form.errors.lowStockThreshold" class="field-error">{{ form.errors.lowStockThreshold }}</p>
        </div>
      </div>

      <div>
        <label for="description" class="label">{{ $t('common.labels.description') }}</label>
        <textarea
          id="description"
          v-model="form.description"
          rows="3"
          class="textarea"
          :placeholder="$t('common.placeholders.optional')"
        />
        <p v-if="form.errors.description" class="field-error">{{ form.errors.description }}</p>
      </div>

      <template v-if="selectedCategory">
        <hr class="border-slate-100" />

        <div>
          <h2 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">{{ $t('common.labels.variants') }}</h2>
          <i18n-t keypath="products.create.variantsHint" tag="p" class="text-xs text-slate-500 mb-4" :plural="variantCount">
            <template #count>
              <span class="font-semibold text-slate-700">{{ variantCount }}</span>
            </template>
          </i18n-t>

          <div class="space-y-5">
            <AttributeMultiSelect
              v-if="selectedCategory.hasColor"
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
              v-if="selectedCategory.hasPrint"
              v-model="form.printIds"
              :label="$t('common.labels.prints')"
              :options="prints"
            />

            <AttributeMultiSelect
              v-if="selectedCategory.hasSize"
              v-model="form.sizeIds"
              :label="$t('common.labels.sizes')"
              :options="sizes"
            />
          </div>
        </div>
      </template>

      <div class="flex justify-end gap-2">
        <Link route="products.index" class="btn-ghost">{{ $t('common.actions.cancel') }}</Link>
        <button
          type="submit"
          class="btn-primary"
          :disabled="form.processing || !form.categoryId || variantCount === 0"
        >
          {{ form.processing ? $t('products.create.submitting') : $t('products.create.submit') }}
        </button>
      </div>
    </form>
  </div>
</template>
