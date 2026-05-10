<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Form } from '@adonisjs/inertia/vue'
</script>

<template>
  <Head :title="$t('common.actions.login')" />

  <div class="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
    <div class="card w-full max-w-md p-6 sm:p-8">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900">{{ $t('auth.title') }}</h1>
        <p class="mt-1 text-sm text-slate-500">{{ $t('auth.subtitle') }}</p>
      </div>

      <Form route="session.store" #default="{ processing, errors }" class="space-y-4">
        <div>
          <label for="email" class="label">{{ $t('auth.email') }}</label>
          <input
            id="email"
            type="email"
            name="email"
            autocomplete="username"
            required
            class="input"
            :data-invalid="errors.email ? 'true' : undefined"
          />
          <p v-if="errors.email" class="field-error">{{ errors.email }}</p>
        </div>

        <div>
          <label for="password" class="label">{{ $t('auth.password') }}</label>
          <input
            id="password"
            type="password"
            name="password"
            autocomplete="current-password"
            required
            class="input"
            :data-invalid="errors.password ? 'true' : undefined"
          />
          <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
        </div>

        <button type="submit" class="btn-primary w-full" :disabled="processing">
          {{ processing ? $t('auth.signingIn') : $t('common.actions.login') }}
        </button>
      </Form>

      <i18n-t keypath="auth.needAccess" tag="p" class="mt-6 text-center text-xs text-slate-400">
        <template #command>
          <code class="font-mono">user:create</code>
        </template>
      </i18n-t>
    </div>
  </div>
</template>
