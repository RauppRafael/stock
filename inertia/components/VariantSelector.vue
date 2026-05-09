<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { urlFor } from '~/client'
import type { Data } from '@generated/data'
import { dataEnvelope, productSchema, variantSchema } from '@contracts'

// Response shapes for the JSON lookup endpoints. Validated at runtime so
// any back-end shape change shows up here as a console error instead of
// `select.options` being silently empty.
const productsResponseSchema = dataEnvelope(productSchema.array())
const variantsResponseSchema = dataEnvelope(variantSchema.array())

const props = defineProps<{
  categories: Data.Category[]
  locations: Data.Location[]
  /** When provided, pre-selects every dropdown to match this variant. */
  initialVariant?: Data.Variant | null
  initialLocationId?: number | null
}>()

const emit = defineEmits<{
  variantResolved: [payload: { variant: Data.Variant; locationId: number }]
  selectionCleared: []
}>()

const locationId = ref<number | null>(props.initialLocationId ?? null)
const categoryId = ref<number | null>(props.initialVariant?.product?.categoryId ?? null)
const productId = ref<number | null>(props.initialVariant?.productId ?? null)

const colorId = ref<number | null>(props.initialVariant?.color?.id ?? null)
const printId = ref<number | null>(props.initialVariant?.print?.id ?? null)
const sizeId = ref<number | null>(props.initialVariant?.size?.id ?? null)

const products = ref<Data.Product[]>([])
const variants = ref<Data.Variant[]>([])
const loadingProducts = ref(false)
const loadingVariants = ref(false)

const category = computed<Data.Category | null>(
  () => props.categories.find((c) => c.id === categoryId.value) ?? null
)

/**
 * Watchers stay disabled during the initial preload pass so a passed-in
 * variant doesn't get clobbered by its own `categoryId` watcher firing
 * the cascading-reset path.
 */
const ready = ref(false)

watch(categoryId, async (next) => {
  if (!ready.value) return
  productId.value = null
  variants.value = []
  colorId.value = null
  printId.value = null
  sizeId.value = null
  if (!next) {
    products.value = []
    return
  }
  await loadProducts(next)
  // Auto-pick the first product so the user lands on a fully-resolved
  // variant after one click; the productId watcher then picks first
  // attributes in turn.
  if (products.value.length > 0 && productId.value === null) {
    productId.value = products.value[0].id
  }
})

watch(productId, async (next) => {
  if (!ready.value) return
  variants.value = []
  colorId.value = null
  printId.value = null
  sizeId.value = null
  if (!next) return
  await loadVariants(next)
  autoPickFirstAttributes()
})

watch([colorId, printId, sizeId, locationId], () => {
  if (!ready.value) return
  emitResolved()
})

async function loadProducts(catId: number) {
  loadingProducts.value = true
  try {
    const url = urlFor('stock.lookup.products', { categoryId: catId })
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    const parsed = productsResponseSchema.safeParse(await res.json())
    if (!parsed.success) {
      // eslint-disable-next-line no-console
      console.error('[contracts] /stock/lookup/products payload invalid:', parsed.error.issues)
      products.value = []
      return
    }
    products.value = parsed.data.data as Data.Product[]
  } finally {
    loadingProducts.value = false
  }
}

async function loadVariants(prodId: number) {
  loadingVariants.value = true
  try {
    const url = urlFor('stock.lookup.variants', { productId: prodId })
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    const parsed = variantsResponseSchema.safeParse(await res.json())
    if (!parsed.success) {
      // eslint-disable-next-line no-console
      console.error('[contracts] /stock/lookup/variants payload invalid:', parsed.error.issues)
      variants.value = []
      return
    }
    variants.value = parsed.data.data as Data.Variant[]
  } finally {
    loadingVariants.value = false
  }
}

function uniqueAttribute<T extends { id: number; name: string }>(
  attr: 'color' | 'print' | 'size'
): T[] {
  const seen = new Map<number, T>()
  for (const v of variants.value) {
    const value = v[attr] as T | null
    if (value && !seen.has(value.id)) seen.set(value.id, value)
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
}

const colorOptions = computed(() => uniqueAttribute<Data.Color>('color'))
const printOptions = computed(() => uniqueAttribute<Data.Print>('print'))
const sizeOptions = computed(() => uniqueAttribute<Data.Size>('size'))

/**
 * Pre-pick the first available value for each attribute axis the category
 * uses, so the user lands on a fully-resolved variant after picking a
 * product instead of clicking through 1–3 more pickers.
 */
function autoPickFirstAttributes() {
  if (!category.value) return
  if (category.value.hasColor && colorId.value === null) {
    colorId.value = colorOptions.value[0]?.id ?? null
  }
  if (category.value.hasPrint && printId.value === null) {
    printId.value = printOptions.value[0]?.id ?? null
  }
  if (category.value.hasSize && sizeId.value === null) {
    sizeId.value = sizeOptions.value[0]?.id ?? null
  }
}

function emitResolved() {
  if (!locationId.value || !category.value) {
    emit('selectionCleared')
    return
  }
  const wantsColor = category.value.hasColor
  const wantsPrint = category.value.hasPrint
  const wantsSize = category.value.hasSize
  if (wantsColor && !colorId.value) return emit('selectionCleared')
  if (wantsPrint && !printId.value) return emit('selectionCleared')
  if (wantsSize && !sizeId.value) return emit('selectionCleared')

  const match = variants.value.find(
    (v) =>
      (wantsColor ? v.color?.id === colorId.value : true) &&
      (wantsPrint ? v.print?.id === printId.value : true) &&
      (wantsSize ? v.size?.id === sizeId.value : true)
  )
  if (match) {
    emit('variantResolved', { variant: match, locationId: locationId.value })
  } else {
    emit('selectionCleared')
  }
}

onMounted(async () => {
  // Hydrate products + variants the parent's initial selection already implies.
  if (categoryId.value) await loadProducts(categoryId.value)
  if (productId.value) await loadVariants(productId.value)
  ready.value = true
  emitResolved()
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="label">Location</label>
      <select v-model.number="locationId" class="select">
        <option :value="null">Select a location…</option>
        <option v-for="loc in locations" :key="loc.id" :value="loc.id">{{ loc.name }}</option>
      </select>
    </div>

    <div v-if="locationId">
      <label class="label">Category</label>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="cat in categories"
          :key="cat.id"
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition"
          :class="
            categoryId === cat.id
              ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600'
              : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
          "
          @click="categoryId = cat.id"
        >
          <span v-if="cat.icon" class="text-base leading-none">{{ cat.icon }}</span>
          <span class="font-medium">{{ cat.name }}</span>
        </button>
      </div>
    </div>

    <div v-if="categoryId">
      <label class="label">Product</label>
      <select v-model.number="productId" class="select" :disabled="loadingProducts">
        <option :value="null">
          {{ loadingProducts ? 'Loading…' : 'Select a product…' }}
        </option>
        <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
      <p
        v-if="!loadingProducts && categoryId && !products.length"
        class="text-xs text-slate-400 italic mt-1"
      >
        No products in this category yet.
      </p>
    </div>

    <template v-if="productId && category">
      <div v-if="category.hasColor">
        <label class="label">Color</label>
        <div v-if="loadingVariants" class="text-xs text-slate-400 italic">Loading…</div>
        <div v-else-if="colorOptions.length" class="flex flex-wrap gap-2">
          <button
            v-for="opt in colorOptions"
            :key="opt.id"
            type="button"
            class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition"
            :class="
              colorId === opt.id
                ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600'
                : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
            "
            @click="colorId = opt.id"
          >
            <span
              class="size-4 rounded-full ring-1 ring-slate-200"
              :style="{ background: opt.hexCode ?? '#e2e8f0' }"
            />
            {{ opt.name }}
          </button>
        </div>
        <p v-else class="text-xs text-slate-400 italic">No colors for this product.</p>
      </div>

      <div v-if="category.hasPrint">
        <label class="label">Print</label>
        <select v-model.number="printId" class="select" :disabled="loadingVariants">
          <option :value="null">
            {{ loadingVariants ? 'Loading…' : 'Select a print…' }}
          </option>
          <option v-for="opt in printOptions" :key="opt.id" :value="opt.id">
            {{ opt.name }}
          </option>
        </select>
      </div>

      <div v-if="category.hasSize">
        <label class="label">Size</label>
        <select v-model.number="sizeId" class="select" :disabled="loadingVariants">
          <option :value="null">
            {{ loadingVariants ? 'Loading…' : 'Select a size…' }}
          </option>
          <option v-for="opt in sizeOptions" :key="opt.id" :value="opt.id">
            {{ opt.name }}
          </option>
        </select>
      </div>
    </template>
  </div>
</template>
