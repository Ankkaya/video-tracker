import { createI18n } from 'vue-i18n';
import zhCN from './zh-CN';
import enUS from './en-US';

export const STORAGE_KEY_LANGUAGE = 'videotracker-language';

export type Language = 'zh-CN' | 'en-US';

export const SUPPORTED_LANGUAGES: Record<Language, string> = {
  'zh-CN': '中文',
  'en-US': 'English',
};

export function getDefaultLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LANGUAGE);
    if (saved && (saved === 'zh-CN' || saved === 'en-US')) {
      return saved as Language;
    }
  } catch (e) {
    // Ignore localStorage errors
  }

  const browserLang = navigator.language;
  if (browserLang.startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en-US';
}

export function setLanguage(lang: Language) {
  localStorage.setItem(STORAGE_KEY_LANGUAGE, lang);
}

const i18n = createI18n({
  legacy: false,
  locale: getDefaultLanguage(),
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
});

export default i18n;
