<script setup lang="ts">
import { onMounted } from 'vue'
import { Head, router, usePage } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import type { Data } from '@generated/data'

const page = usePage<Data.SharedProps>()

onMounted(() => {
  if (page.props.user) router.visit('/stock', { replace: true })
})
</script>

<template>
  <Head title="Stockroom" />

  <div class="min-h-screen flex items-center justify-center bg-slate-50">
    <div class="max-w-md w-full p-8 text-center">
      <h1 class="text-3xl font-semibold tracking-tight text-slate-900">Stockroom</h1>
      <p class="mt-3 text-slate-600">A focused inventory system for clothing brands.</p>
      <div v-if="!page.props.user" class="mt-8 flex justify-center">
        <Link route="session.create" class="btn-primary">Login</Link>
      </div>
    </div>
  </div>
</template>
