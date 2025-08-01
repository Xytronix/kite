import { browser } from "$app/environment";
import { DEFAULT_SECTIONS, type SectionConfig } from "$lib/constants/sections";

const STORAGE_KEY = "kite-sections";

// Initialize sections state
const sectionsState = $state<SectionConfig[]>([]);

// Helper functions
function getInitialSections(): SectionConfig[] {
  if (!browser) return [...DEFAULT_SECTIONS];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate structure and merge with defaults
      if (Array.isArray(parsed)) {
        return DEFAULT_SECTIONS.map((defaultSection) => {
          const storedSection = parsed.find(
            (s: any) => s.id === defaultSection.id,
          );
          return storedSection
            ? { ...defaultSection, ...storedSection }
            : defaultSection;
        });
      }
    }
  } catch (error) {
    console.warn("Failed to read sections from localStorage:", error);
  }

  return [...DEFAULT_SECTIONS];
}

function saveSections(sections: SectionConfig[]) {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
  } catch (error) {
    console.warn("Failed to save sections to localStorage:", error);
  }
}

function loadSections() {
  const initial = getInitialSections();
  sectionsState.splice(0, sectionsState.length, ...initial);
}

// Auto-initialize when browser is available
if (browser) {
  loadSections();
}

// Sections store API
export const sections = {
  get list() {
    return sectionsState;
  },

  get order() {
    return sectionsState.map((s) => s.id);
  },

  get settings() {
    return sectionsState.reduce(
      (acc, section) => {
        acc[section.id] = section.enabled;
        return acc;
      },
      {} as Record<string, boolean>,
    );
  },

  toggleSection(sectionId: string) {
    const section = sectionsState.find((s) => s.id === sectionId);
    if (section) {
      section.enabled = !section.enabled;
      saveSections(sectionsState);
    }
  },

  setOrder(sectionId: string, newOrder: number) {
    const section = sectionsState.find((s) => s.id === sectionId);
    if (section) {
      section.order = newOrder;
      saveSections(sectionsState);
    }
  },

  moveSectionUp(sectionId: string) {
    const index = sectionsState.findIndex((s) => s.id === sectionId);
    if (index > 0) {
      const temp = sectionsState[index];
      sectionsState[index] = sectionsState[index - 1];
      sectionsState[index - 1] = temp;
      saveSections(sectionsState);
    }
  },

  moveSectionDown(sectionId: string) {
    const index = sectionsState.findIndex((s) => s.id === sectionId);
    if (index < sectionsState.length - 1) {
      const temp = sectionsState[index];
      sectionsState[index] = sectionsState[index + 1];
      sectionsState[index + 1] = temp;
      saveSections(sectionsState);
    }
  },

  reorderSections(newOrder: SectionConfig[]) {
    sectionsState.splice(0, sectionsState.length, ...newOrder);
    saveSections(sectionsState);
  },

  enableAll() {
    sectionsState.forEach(section => {
      section.enabled = true;
    });
    saveSections(sectionsState);
  },

  reset() {
    sectionsState.splice(0, sectionsState.length, ...DEFAULT_SECTIONS);
    saveSections(sectionsState);
  },

  init() {
    if (browser) {
      loadSections();
    }
  },
};
