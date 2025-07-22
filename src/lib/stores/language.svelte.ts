import { browser } from "$app/environment";

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
  data: "default",
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

async function loadStrings(lang: string) {
  if (browser) {
    try {
      const response = await fetch(`/api/locale/${lang}`);
      if (response.ok) {
        const data = await response.json();
        state.strings = data.strings;
        state.locale = data.locale;
      }
    } catch (error) {
      console.warn("Failed to load locale data:", error);
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

  init(initialStrings: Record<string, any>) {
    state.ui = load("ui", "en");
    state.data = load("data", "default");
    state.strings = initialStrings;
    updateDocumentLanguage();
  },

  loadNewStrings: loadStrings,
};
