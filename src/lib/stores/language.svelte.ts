import { browser } from "$app/environment";
import locales from "$lib/locales";

export type SupportedLanguage =
  | "default"
  | "en"
  | "pt"
  | "it"
  | "fr"
  | "es"
  | "de"
  | "nl"
  | "zh"
  | "ja"
  | "hi"
  | "uk"
  | "pt-BR"
  | "ca"
  | "fi"
  | "ko"
  | "lb"
  | "nb"
  | "pl"
  | "ru"
  | "zh-Hans"
  | "sv"
  | "th"
  | "tr";

interface LanguageState {
  ui: SupportedLanguage;
  data: SupportedLanguage;
  strings: Record<string, any>;
  locale: string;
}

const state = $state<LanguageState>({
  ui: "en",
  data: "en",
  strings: {},
  locale: "en",
});

function save(key: "ui" | "data", value: SupportedLanguage) {
  if (browser) {
    localStorage.setItem(`language.${key}`, value);
  }
}

function load(key: "ui" | "data", defaultValue: SupportedLanguage): SupportedLanguage {
  if (browser) {
    return (localStorage.getItem(`language.${key}`) as SupportedLanguage) || defaultValue;
  }
  return defaultValue;
}

function isFirstVisit(): boolean {
  if (!browser) return false;
  return !localStorage.getItem('language.ui') && !localStorage.getItem('language.data');
}

// Minimum number of keys we expect in a complete locale
const MIN_LOCALE_KEYS = 400;

function isCompleteLocale(strings: Record<string, any>): boolean {
  const keyCount = Object.keys(strings).length;
  return keyCount >= MIN_LOCALE_KEYS;
}

async function loadStrings(lang: string) {
  if (browser) {
    console.log(`Loading locale strings for language: ${lang}`);
    
    try {
      // First, try remote API for potentially updated translations
      console.log(`Attempting to load from remote API...`);
      const response = await fetch(`/api/locale/${lang}`);
      if (response.ok) {
        const data = await response.json();
        if (data.strings && data.locale && isCompleteLocale(data.strings)) {
          // Remote data is complete, use it
          state.strings = data.strings;
          state.locale = data.locale;
          console.log(`✅ Successfully loaded locale: ${data.locale} with ${Object.keys(data.strings).length} strings from remote API`);
          return;
        } else {
          console.warn(`⚠️ Remote locale incomplete (${Object.keys(data.strings || {}).length} keys), falling back to local files`);
        }
      } else {
        console.warn(`⚠️ Remote locale request failed (${response.status}), falling back to local files`);
      }
    } catch (error) {
      console.warn('⚠️ Remote locale failed, falling back to local files:', error);
    }
    
    // Fallback to local complete files
    console.log(`Loading from local files...`);
    const localeData = locales[lang as keyof typeof locales];
    if (localeData) {
      state.strings = localeData;
      state.locale = lang;
      console.log(`✅ Successfully loaded locale: ${lang} with ${Object.keys(localeData).length} strings from local files`);
    } else {
      console.error(`Locale not found: ${lang}. Available locales:`, Object.keys(locales));
      // Fallback to English if locale not found
      state.strings = locales.en;
      state.locale = "en";
      console.log(`Fallback to English locale with ${Object.keys(locales.en).length} strings`);
    }
  }
}

function updateDocumentLanguage() {
  if (browser) {
    const lang = state.ui === "default" ? navigator.language.split("-")[0] : state.ui;
    document.documentElement.lang = lang;
  }
}

export const language = {
  get ui() {
    return state.ui;
  },
  get data() {
    return state.data;
  },
  get strings() {
    return state.strings;
  },
  get locale() {
    return state.locale;
  },

  setUI(lang: SupportedLanguage) {
    state.ui = lang;
    save("ui", lang);
    updateDocumentLanguage();
  },

  setData(lang: SupportedLanguage) {
    state.data = lang;
    save("data", lang);
    if (browser) {
      window.dispatchEvent(
        new CustomEvent("data-language-changed", {
          detail: { language: lang },
        })
      );
    }
  },

  reset() {
    state.ui = "en";
    state.data = "en";
    save("ui", "en");
    save("data", "en");
    updateDocumentLanguage();
    if (browser) {
      window.dispatchEvent(
        new CustomEvent("data-language-changed", {
          detail: { language: "en" },
        })
      );
    }
  },

  init(initialStrings: Record<string, any>) {
    state.ui = load("ui", "en");
    state.data = load("data", "en");
    state.strings = initialStrings;
    updateDocumentLanguage();
  },

  // Initialize with location-based defaults on first visit
  initWithLocationDefaults(initialStrings: Record<string, any>, suggestedUI?: string, suggestedData?: string) {
    const isFirst = isFirstVisit();
    
    if (isFirst && suggestedUI && suggestedData) {
      // Use location-based suggestions for first visit
      state.ui = suggestedUI as SupportedLanguage;
      state.data = suggestedData as SupportedLanguage;
      // Save the suggestions so they become the user's preference
      save("ui", state.ui);
      save("data", state.data);
    } else {
      // Load existing preferences or use defaults
      state.ui = load("ui", "en");
      state.data = load("data", "en");
    }
    
    state.strings = initialStrings;
    updateDocumentLanguage();
  },

  isFirstVisit,

  loadNewStrings: loadStrings,
};
