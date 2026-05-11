<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { Head, useForm } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from 'vue-i18n'
import { urlFor } from '~/client'
import type { Data } from '@generated/data'
import PageHeader from '~/components/PageHeader.vue'
import AttributeMultiSelect from '~/components/AttributeMultiSelect.vue'
import CategoryPicker from '~/components/CategoryPicker.vue'
import Modal from '~/components/Modal.vue'
import EmojiPicker from '~/components/EmojiPicker.vue'
import { CATEGORY_EMOJIS } from '~/components/emoji_sets'

const { t } = useI18n()

const props = defineProps<{
  categories: Data.Category[]
  colors: Data.Color[]
  sizes: Data.Size[]
}>()

function categoryAttrs(c: Data.Category): string {
  const attrs = [
    c.hasColor ? t('common.labels.color').toLowerCase() : null,
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
  sizeIds: [] as number[],
})

const selectedCategory = computed<Data.Category | null>(
  () => props.categories.find((c) => c.id === form.categoryId) ?? null
)

watch(selectedCategory, (cat) => {
  if (!cat?.hasColor) form.colorIds = []
  if (!cat?.hasSize) form.sizeIds = []
})

const variantCount = computed(() => {
  if (!selectedCategory.value) return 0
  const colorCount = selectedCategory.value.hasColor ? form.colorIds.length || 0 : 1
  const sizeCount = selectedCategory.value.hasSize ? form.sizeIds.length || 0 : 1
  return colorCount * sizeCount
})

function submit() {
  if (form.processing) return
  form.transform((data) => ({
    ...data,
    code: data.code.toUpperCase(),
    description: data.description || null,
  })).post(urlFor('products.store'))
}

/**
 * Inline-create modals. Each one POSTs to the existing catalog route but
 * sends `X-Inline-Create` so the controller redirects back here (preserving
 * the user's product draft) instead of navigating to the catalog index.
 * After the redirect back, Inertia hands us a fresh `categories` / `colors`
 * / `sizes` prop, and we auto-select the row whose name matches what the
 * user just typed.
 */
const dialog = reactive({
  category: false,
  color: false,
  size: false,
})

const categoryForm = useForm({
  name: '',
  icon: '',
  hasColor: true,
  hasSize: true,
})
const colorForm = useForm({
  name: '',
  code: '',
  hexCode: '',
})
const sizeForm = useForm({
  name: '',
  code: '',
  sortOrder: 0,
})

function openCategoryModal() {
  categoryForm.reset()
  categoryForm.clearErrors()
  dialog.category = true
}
function openColorModal() {
  colorForm.reset()
  colorForm.clearErrors()
  dialog.color = true
}
function openSizeModal() {
  sizeForm.reset()
  sizeForm.clearErrors()
  dialog.size = true
}

/**
 * After an inline-create succeeds, Inertia redirects back here and refreshes
 * `props.categories` / `colors` / `sizes`. We identify the newly-inserted
 * row by diffing IDs against a snapshot taken before the submit — more
 * robust than matching on name (which would silently miss the new row if
 * the server normalised whitespace or accents differently).
 */
function findNewId<T extends { id: number }>(after: T[], before: Set<number>): number | null {
  const fresh = after.find((row) => !before.has(row.id))
  return fresh?.id ?? null
}

function submitCategory() {
  if (categoryForm.processing) return
  const before = new Set(props.categories.map((c) => c.id))
  categoryForm
    .transform((data) => ({ ...data, icon: data.icon || null }))
    .post(urlFor('categories.store'), {
      headers: { 'X-Inline-Create': '1' },
      preserveScroll: true,
      errorBag: 'category',
      onSuccess: () => {
        dialog.category = false
        const id = findNewId(props.categories, before)
        if (id !== null) form.categoryId = id
      },
    })
}

function submitColor() {
  if (colorForm.processing) return
  const before = new Set(props.colors.map((c) => c.id))
  colorForm
    .transform((data) => ({
      ...data,
      code: data.code.toUpperCase(),
      hexCode: data.hexCode || null,
    }))
    .post(urlFor('colors.store'), {
      headers: { 'X-Inline-Create': '1' },
      preserveScroll: true,
      errorBag: 'color',
      onSuccess: () => {
        dialog.color = false
        const id = findNewId(props.colors, before)
        if (id !== null && !form.colorIds.includes(id)) {
          form.colorIds = [...form.colorIds, id]
        }
      },
    })
}

function submitSize() {
  if (sizeForm.processing) return
  const before = new Set(props.sizes.map((s) => s.id))
  sizeForm
    .transform((data) => ({ ...data, code: data.code.toUpperCase() }))
    .post(urlFor('sizes.store'), {
      headers: { 'X-Inline-Create': '1' },
      preserveScroll: true,
      errorBag: 'size',
      onSuccess: () => {
        dialog.size = false
        const id = findNewId(props.sizes, before)
        if (id !== null && !form.sizeIds.includes(id)) {
          form.sizeIds = [...form.sizeIds, id]
        }
      },
    })
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
        <label class="label">{{ $t('common.labels.category') }}</label>
        <CategoryPicker
          v-model="form.categoryId"
          :categories="categories"
          allow-add
          @add="openCategoryModal"
        />
        <p v-if="selectedCategory" class="text-xs text-slate-500 mt-2">
          {{ categoryAttrs(selectedCategory) }}
        </p>
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
              allow-add
              :add-label="$t('colors.new').replace(/^\+ ?/, '')"
              @add="openColorModal"
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
              v-if="selectedCategory.hasSize"
              v-model="form.sizeIds"
              :label="$t('common.labels.sizes')"
              :options="sizes"
              allow-add
              :add-label="$t('sizes.new').replace(/^\+ ?/, '')"
              @add="openSizeModal"
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

    <Modal :open="dialog.category" :title="$t('categories.newTitle')" @close="dialog.category = false">
      <form class="space-y-4" @submit.prevent="submitCategory">
        <div>
          <label for="cat-name-inline" class="label">{{ $t('common.labels.name') }}</label>
          <input
            id="cat-name-inline"
            v-model="categoryForm.name"
            required
            class="input"
            :data-invalid="categoryForm.errors.name ? 'true' : undefined"
          />
          <p v-if="categoryForm.errors.name" class="field-error">{{ categoryForm.errors.name }}</p>
        </div>
        <div>
          <label class="label">{{ $t('common.labels.icon') }}</label>
          <EmojiPicker
            v-model="categoryForm.icon"
            :emojis="CATEGORY_EMOJIS"
            :aria-label="$t('categories.iconLabel')"
          />
        </div>
        <fieldset class="space-y-2">
          <legend class="label mb-1">{{ $t('categories.attributesUsed') }}</legend>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="categoryForm.hasColor" type="checkbox" class="size-4 rounded border-slate-300" />
            {{ $t('common.labels.color') }}
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="categoryForm.hasSize" type="checkbox" class="size-4 rounded border-slate-300" />
            {{ $t('common.labels.size') }}
          </label>
        </fieldset>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="dialog.category = false">{{ $t('common.actions.cancel') }}</button>
          <button type="submit" class="btn-primary" :disabled="categoryForm.processing">
            {{ categoryForm.processing ? $t('common.actions.saving') : $t('common.actions.create') }}
          </button>
        </div>
      </form>
    </Modal>

    <Modal :open="dialog.color" :title="$t('colors.newTitle')" @close="dialog.color = false">
      <form class="space-y-4" @submit.prevent="submitColor">
        <div>
          <label for="color-name-inline" class="label">{{ $t('common.labels.name') }}</label>
          <input
            id="color-name-inline"
            v-model="colorForm.name"
            required
            class="input"
            :data-invalid="colorForm.errors.name ? 'true' : undefined"
          />
          <p v-if="colorForm.errors.name" class="field-error">{{ colorForm.errors.name }}</p>
        </div>
        <div>
          <label for="color-code-inline" class="label">{{ $t('colors.codeLabel') }}</label>
          <input
            id="color-code-inline"
            v-model="colorForm.code"
            required
            maxlength="8"
            placeholder="BLK"
            class="input uppercase"
            :data-invalid="colorForm.errors.code ? 'true' : undefined"
          />
          <p v-if="colorForm.errors.code" class="field-error">{{ colorForm.errors.code }}</p>
        </div>
        <div>
          <label for="color-hex-inline" class="label">{{ $t('colors.hexLabel') }}</label>
          <input
            id="color-hex-inline"
            v-model="colorForm.hexCode"
            placeholder="#FF6B6B"
            class="input"
            :data-invalid="colorForm.errors.hexCode ? 'true' : undefined"
          />
          <p v-if="colorForm.errors.hexCode" class="field-error">{{ colorForm.errors.hexCode }}</p>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="dialog.color = false">{{ $t('common.actions.cancel') }}</button>
          <button type="submit" class="btn-primary" :disabled="colorForm.processing">
            {{ colorForm.processing ? $t('common.actions.saving') : $t('common.actions.create') }}
          </button>
        </div>
      </form>
    </Modal>

    <Modal :open="dialog.size" :title="$t('sizes.newTitle')" @close="dialog.size = false">
      <form class="space-y-4" @submit.prevent="submitSize">
        <div>
          <label for="size-name-inline" class="label">{{ $t('common.labels.name') }}</label>
          <input
            id="size-name-inline"
            v-model="sizeForm.name"
            required
            class="input"
            :data-invalid="sizeForm.errors.name ? 'true' : undefined"
          />
          <p v-if="sizeForm.errors.name" class="field-error">{{ sizeForm.errors.name }}</p>
        </div>
        <div>
          <label for="size-code-inline" class="label">{{ $t('sizes.codeLabel') }}</label>
          <input
            id="size-code-inline"
            v-model="sizeForm.code"
            required
            maxlength="8"
            placeholder="M"
            class="input uppercase"
            :data-invalid="sizeForm.errors.code ? 'true' : undefined"
          />
          <p v-if="sizeForm.errors.code" class="field-error">{{ sizeForm.errors.code }}</p>
        </div>
        <div>
          <label for="size-sort-inline" class="label">{{ $t('common.labels.sortOrder') }}</label>
          <input
            id="size-sort-inline"
            v-model.number="sizeForm.sortOrder"
            type="number"
            min="0"
            class="input"
            :data-invalid="sizeForm.errors.sortOrder ? 'true' : undefined"
          />
          <p v-if="sizeForm.errors.sortOrder" class="field-error">{{ sizeForm.errors.sortOrder }}</p>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="dialog.size = false">{{ $t('common.actions.cancel') }}</button>
          <button type="submit" class="btn-primary" :disabled="sizeForm.processing">
            {{ sizeForm.processing ? $t('common.actions.saving') : $t('common.actions.create') }}
          </button>
        </div>
      </form>
    </Modal>
  </div>
</template>
