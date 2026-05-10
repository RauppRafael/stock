import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import pt from './locales/pt.json'

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]['code']

const STORAGE_KEY = 'stockroom.locale'

function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'pt') return stored
  const nav = window.navigator?.language?.toLowerCase() ?? ''
  if (nav.startsWith('pt')) return 'pt'
  return 'en'
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: { en, pt },
})

export function setLocale(locale: Locale) {
  i18n.global.locale.value = locale
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, locale)
    document.documentElement.setAttribute('lang', locale)
  }
}
