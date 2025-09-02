import { browser } from "$app/environment";

export interface ExperimentalFeatures {
  showArticleIcons: boolean;
  showCategoryIcons: boolean;
  /** When true, UI will render raw emojis instead of mapped SVG icons for article thumbnails. */
  useArticleEmojis: boolean;
  /** When true, category pills will display raw emojis instead of mapped SVG icons. */
  useCategoryEmojis: boolean;
  disableCategorySwipe: boolean;
  showChaosIndex: boolean;
  showWikipediaTooltips: boolean; // master toggle
  disableWikiTooltipsInHeadlines: boolean;
  /** When true, prefer Iconify icons over brand logo URLs for source favicons. */
  preferIconifyIcons: boolean;
  /** When true, disable automatic scrolling when clicking on story titles. */
  disableStoryScrolling: boolean;
  /** Controls where source icons appear: 'none' (disabled), 'inline' (within content), 'section-end' (at end of sections), or 'story-end' (at end of story) */
  sourceIconPosition: 'none' | 'inline' | 'section-end' | 'story-end';
  /** When true, collapse previously expanded stories when opening a new story (default behavior). When false, allow multiple stories to be expanded simultaneously. */
  collapseOtherStories: boolean;
  /** When true, enable the History Manager / Time Travel feature and show its UI. */
  enableTimeTravel: boolean;
  /** When true, show load-more controls and enable historical loading at the end of lists. When false, allow loading only from empty-state. */
  enableHistoricalLoadMore: boolean;
  /** When true, automatically top-up with recent historical stories when the current day has too few stories. */
  autoTopUpShortDays: boolean;
  /** Entity linking approach: 'wikidata' (Wikidata entity linking), 'dbpedia' (DBpedia-based linking), 'mixed' (both) */
  entityLinkingMode: 'wikidata' | 'dbpedia' | 'mixed';
}

const STORAGE_KEY = "kite-experimental-features";

const DEFAULT_FEATURES: ExperimentalFeatures = {
  showArticleIcons: false,
  showCategoryIcons: false,
  useArticleEmojis: false,
  useCategoryEmojis: false,
  disableCategorySwipe: false,
  showChaosIndex: false,
  showWikipediaTooltips: true,
  disableWikiTooltipsInHeadlines: false,
  preferIconifyIcons: false,
  disableStoryScrolling: false,
  sourceIconPosition: 'section-end',
  collapseOtherStories: true,
  enableTimeTravel: false,
  enableHistoricalLoadMore: false,
  autoTopUpShortDays: false,
  entityLinkingMode: 'mixed',
};

// Initialize experimental features state
const experimentalState = $state<ExperimentalFeatures>({ ...DEFAULT_FEATURES });

// Helper functions
function getInitialFeatures(): ExperimentalFeatures {
  if (!browser) return DEFAULT_FEATURES;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: any = JSON.parse(stored);
      // Migration: invert legacy hideTimeTravelIcon -> enableTimeTravel
      if (typeof parsed.hideTimeTravelIcon === 'boolean' && typeof parsed.enableTimeTravel === 'undefined') {
        parsed.enableTimeTravel = !parsed.hideTimeTravelIcon;
        delete parsed.hideTimeTravelIcon;
      }
      // Migration: old linking modes -> new identifiers
      if (parsed.entityLinkingMode === 'advanced') parsed.entityLinkingMode = 'wikidata';
      if (parsed.entityLinkingMode === 'pattern') parsed.entityLinkingMode = 'dbpedia';
      if (parsed.entityLinkingMode === 'both') parsed.entityLinkingMode = 'mixed';
      return { ...DEFAULT_FEATURES, ...parsed } as ExperimentalFeatures;
    }
  } catch (error) {
    console.warn(
      "Failed to read experimental features from localStorage:",
      error,
    );
  }

  return DEFAULT_FEATURES;
}

function saveFeatures(features: ExperimentalFeatures) {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(features));
  } catch (error) {
    console.warn(
      "Failed to save experimental features to localStorage:",
      error,
    );
  }
}

function loadFeatures() {
  const initial = getInitialFeatures();
  Object.assign(experimentalState, initial);
}

// Experimental features store API
export const experimental = {
  get showArticleIcons() {
    return experimentalState.showArticleIcons;
  },

  get useArticleEmojis() {
    return experimentalState.useArticleEmojis;
  },

  get showCategoryIcons() {
    return experimentalState.showCategoryIcons;
  },

  get useCategoryEmojis() {
    return experimentalState.useCategoryEmojis;
  },

  get disableCategorySwipe() {
    return experimentalState.disableCategorySwipe;
  },

  get showChaosIndex() {
    return experimentalState.showChaosIndex;
  },

  get showWikipediaTooltips() {
    return experimentalState.showWikipediaTooltips;
  },

  get disableWikiTooltipsInHeadlines() {
    return experimentalState.disableWikiTooltipsInHeadlines;
  },

  get preferIconifyIcons() {
    return experimentalState.preferIconifyIcons;
  },

  get disableStoryScrolling() {
    return experimentalState.disableStoryScrolling;
  },

  get sourceIconPosition() {
    return experimentalState.sourceIconPosition;
  },

  get collapseOtherStories() {
    return experimentalState.collapseOtherStories;
  },

  get enableTimeTravel() {
    return experimentalState.enableTimeTravel;
  },

  get enableHistoricalLoadMore() {
    return experimentalState.enableHistoricalLoadMore;
  },

  get autoTopUpShortDays() {
    return experimentalState.autoTopUpShortDays;
  },

  get entityLinkingMode() {
    return experimentalState.entityLinkingMode;
  },

  toggleFeature(featureName: keyof ExperimentalFeatures) {
    if (typeof experimentalState[featureName] === 'boolean') {
      (experimentalState[featureName] as boolean) = !(experimentalState[featureName] as boolean);
      saveFeatures(experimentalState);
    }
  },

  setFeature<K extends keyof ExperimentalFeatures>(featureName: K, value: ExperimentalFeatures[K]) {
    experimentalState[featureName] = value;
    saveFeatures(experimentalState);
  },

  setFeatures(newFeatures: Partial<ExperimentalFeatures>) {
    Object.assign(experimentalState, newFeatures);
    saveFeatures(experimentalState);
  },

  reset() {
    Object.assign(experimentalState, DEFAULT_FEATURES);
    if (browser) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.warn(
          "Failed to remove experimental features from localStorage:",
          error,
        );
      }
    }
  },

  init() {
    if (browser) {
      loadFeatures();
    }
  },
};
