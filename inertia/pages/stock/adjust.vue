<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Head } from '@inertiajs/vue3'
import { Form } from '@adonisjs/inertia/vue'
import { z } from 'zod'
import { urlFor } from '~/client'
import type { Data } from '@generated/data'
import { categorySchema, locationSchema, variantSchema } from '@contracts'
import { useValidatedProps } from '~/composables/use_validated_props'
import PageHeader from '~/components/PageHeader.vue'
import VariantSelector from '~/components/VariantSelector.vue'
import VariantSummary from '~/components/VariantSummary.vue'
import QuantityStepper from '~/components/QuantityStepper.vue'

const props = defineProps<{
  categories: Data.Category[]
  locations: Data.Location[]
  prefilledVariant: Data.Variant | null
  prefilledLocationId: number | null
  prefilledQuantity: number | null
}>()

useValidatedProps(
  props,
  z.object({
    categories: z.array(categorySchema),
    locations: z.array(locationSchema),
    prefilledVariant: variantSchema.nullable(),
    prefilledLocationId: z.number().int().nullable(),
    prefilledQuantity: z.number().int().nullable(),
  })
)

const initialLocationId =
  props.prefilledLocationId ?? props.locations[0]?.id ?? null

const variant = ref<Data.Variant | null>(props.prefilledVariant)
const locationId = ref<number | null>(initialLocationId)
const currentQuantity = ref<number | null>(props.prefilledQuantity)
const newQuantity = ref<number | null>(null)
const reason = ref<string>('')

const selectedLocation = computed(
  () => props.locations.find((l) => l.id === locationId.value)
)
const locationName = computed(() => selectedLocation.value?.name)
const locationIcon = computed(() => selectedLocation.value?.icon ?? null)

watch([variant, locationId], async ([v, loc]) => {
  if (!v || !loc) {
    currentQuantity.value = null
    return
  }
  const url = urlFor('stock.lookup.quantity', { variantId: v.id, locationId: loc })
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  const json = (await res.json()) as { data: { quantity: number } }
  currentQuantity.value = json.data.quantity
  if (newQuantity.value === null) newQuantity.value = json.data.quantity
})

function onResolved(payload: { variant: Data.Variant; locationId: number }) {
  variant.value = payload.variant
  locationId.value = payload.locationId
  newQuantity.value = null
}

function onCleared() {
  variant.value = null
  currentQuantity.value = null
  newQuantity.value = null
}
</script>

<template>
  <Head :title="$t('stock.adjust.title')" />
  <div class="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
    <PageHeader
      :title="$t('stock.adjust.title')"
      :description="$t('stock.adjust.description')"
    />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      <div class="card p-5">
        <h2 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          {{ $t('stock.adjust.stepLocate') }}
        </h2>
        <VariantSelector
          :categories="categories"
          :locations="locations"
          :initial-variant="prefilledVariant"
          :initial-location-id="initialLocationId"
          @variant-resolved="onResolved"
          @selection-cleared="onCleared"
        />
      </div>

      <div class="card p-5">
        <h2 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          {{ $t('stock.adjust.stepQuantity') }}
        </h2>

        <div
          v-if="!variant || !locationId"
          class="text-sm text-slate-400 italic py-12 text-center"
        >
          {{ $t('stock.adjust.pickToContinue') }}
        </div>

        <div v-else class="space-y-5">
          <VariantSummary
            :variant="variant"
            :location-name="locationName"
            :location-icon="locationIcon"
            :current-quantity="currentQuantity"
          />

          <Form
            route="stock.adjust"
            method="post"
            class="space-y-4"
            #default="{ processing, errors }"
          >
            <input type="hidden" name="variantId" :value="variant.id" />
            <input type="hidden" name="locationId" :value="locationId" />

            <div>
              <label class="label">{{ $t('stock.adjust.newQuantity') }}</label>
              <QuantityStepper
                v-model="newQuantity"
                :current="currentQuantity"
                :invalid="!!errors.newQuantity"
              />
              <input type="hidden" name="newQuantity" :value="newQuantity ?? ''" />
              <p v-if="errors.newQuantity" class="field-error">{{ errors.newQuantity }}</p>
            </div>

            <div>
              <label for="reason" class="label">{{ $t('stock.adjust.reasonOptional') }}</label>
              <textarea
                id="reason"
                v-model="reason"
                name="reason"
                rows="3"
                maxlength="1000"
                :placeholder="$t('stock.adjust.reasonPlaceholder')"
                class="textarea"
                :data-invalid="errors.reason ? 'true' : undefined"
              />
              <p v-if="errors.reason" class="field-error">{{ errors.reason }}</p>
            </div>

            <button
              type="submit"
              class="btn-primary w-full"
              :disabled="
                processing || newQuantity === null || newQuantity === currentQuantity
              "
            >
              {{ processing ? $t('common.actions.saving') : $t('stock.adjust.save') }}
            </button>
          </Form>
        </div>
      </div>
    </div>
  </div>
</template>
