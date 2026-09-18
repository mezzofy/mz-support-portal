/**
 * i18n Configuration — Support Console
 * English (default), Simplified Chinese, Traditional Chinese.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'

export const SUPPORTED_LANGUAGES = {
  en: 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
} as const

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES

const DEFAULT_LANGUAGE: SupportedLanguage = 'en'

const getSavedLanguage = (): SupportedLanguage => {
  try {
    const saved = localStorage.getItem('support-language')
    if (saved && saved in SUPPORTED_LANGUAGES) return saved as SupportedLanguage
  } catch {
    /* ignore */
  }
  return DEFAULT_LANGUAGE
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-CN': { translation: zhCN },
    'zh-TW': { translation: zhTW },
  },
  lng: getSavedLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: true,
  },
})

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem('support-language', lng)
  } catch {
    /* ignore */
  }
  document.documentElement.lang = lng
})

export default i18n
