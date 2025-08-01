import { browser } from "$app/environment";

export type ThemeOption = "light" | "dark" | "system";

interface ThemeState {
  current: ThemeOption;
}

// Initialize theme state
const themeState = $state<ThemeState>({
  current: "system",
});

// Helper functions
function applyTheme(theme: ThemeOption) {
  if (!browser) return;

  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  root.classList.toggle("dark", isDark);

  // Update theme-color meta tag
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", isDark ? "#1f2937" : "#ffffff");
  }
}

function saveTheme(theme: ThemeOption) {
  if (!browser) return;
  localStorage.setItem("theme", theme);
}

function loadTheme(): ThemeOption {
  if (!browser) return "system";

  const stored = localStorage.getItem("theme") as ThemeOption;
  return stored || "system";
}

// Theme store API
export const theme = {
  get current() {
    return themeState.current;
  },

  set(theme: ThemeOption) {
    themeState.current = theme;
    applyTheme(theme);
    saveTheme(theme);
  },

  reset() {
    themeState.current = "system";
    applyTheme("system");
    saveTheme("system");
  },

  init() {
    if (!browser) return;

    const storedTheme = loadTheme();
    themeState.current = storedTheme;
    applyTheme(storedTheme);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", () => {
      if (themeState.current === "system") {
        applyTheme("system");
      }
    });
  },
};
