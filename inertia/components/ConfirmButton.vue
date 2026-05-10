<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import type { RouteName } from '~/types'

const props = defineProps<{
  route: RouteName
  params?: Record<string, string | number>
  method?: 'delete' | 'post' | 'put' | 'patch'
  message: string
  label?: string
  variant?: 'danger' | 'ghost'
}>()

function ask() {
  if (!confirm(props.message)) return
  // We deliberately drive the navigation imperatively rather than via the
  // <Form> component: an earlier `<Form @submit.prevent>` wrapper let
  // Inertia submit even when the user cancelled, because Inertia's submit
  // hook doesn't always check `event.defaultPrevented`.
  const url = urlFor(props.route, props.params as never)
  router.visit(url, { method: props.method ?? 'delete', preserveScroll: true })
}
</script>

<template>
  <button
    type="button"
    :class="variant === 'ghost' ? 'btn-ghost' : 'btn-danger'"
    @click="ask"
  >
    <slot>{{ label ?? $t('common.actions.delete') }}</slot>
  </button>
</template>
