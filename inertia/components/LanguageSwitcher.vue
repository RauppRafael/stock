<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES, setLocale, type Locale } from '~/i18n'

const { locale } = useI18n()

function onChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as Locale
  setLocale(value)
}
</script>

<template>
  <select
    :value="locale"
    :aria-label="$t('common.labels.language')"
    class="bg-slate-800 text-slate-200 text-xs rounded px-2 py-1 border border-slate-700 hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
    @change="onChange"
  >
    <option v-for="l in SUPPORTED_LOCALES" :key="l.code" :value="l.code">
      {{ l.label }}
    </option>
  </select>
</template>
