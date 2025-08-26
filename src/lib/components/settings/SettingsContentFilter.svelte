<script lang="ts">
  import { s } from "$lib/client/localization.svelte";
  import Select from "$lib/components/Select.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import { smartContentFilter } from "$lib/stores/smartContentFilter.svelte";
  import {
    createSafeAction,
    createSafeAsyncAction,
  } from "$lib/utils/scrollLock";
  import Icon from "@iconify/svelte";
  import { tick } from "svelte";

  // UI control state variables
  let showImportConfirmation = $state(false);
  let fileInput: HTMLInputElement;
  let selectedFileName = $state<string | null>(null);
  let pendingImportData = $state<string | null>(null);
  let importWarning = $state<string | undefined>();
  let systemMessage = $state<{
    type: "success" | "warning" | "error";
    title: string;
    description?: string;
  } | null>(null);
  let isResetConfirming = $state(false);
  let resetTimeout: NodeJS.Timeout | null = null;

  // Section collapse/expand state
  let showBasicPresets = $state(true);
  let showSpecializedPresets = $state(true);
  let showContentQuality = $state(false);
  let showFilters = $state(true);
  let showTopicsSubjects = $state(false);
  let showNewsTypes = $state(false);
  let showGeographicScope = $state(false);
  let showWellnessMental = $state(false);
  let showCustomKeywords = $state(false);
  let showActiveFilters = $state(true);
  let showAdvancedSimilarity = $state(false);
  let showFilterScope = $state(false);
  let showFilterScopeMode = $state(false);
  let showAdvancedWeights = $state(false);
  let showSystemControls = $state(false);
  let showGlobalWeights = $state(true);
  let showPerCategoryOverrides = $state(true);
  let showPresets = $state(true);

  // Manual override tracking - prevents auto-expand when user manually collapsed sections
  // Only track sections that are actually collapsible
  let manuallyCollapsedContentQuality = $state(false);
  let manuallyCollapsedTopicsSubjects = $state(false);
  let manuallyCollapsedNewsTypes = $state(false);
  let manuallyCollapsedWellnessMental = $state(false);
  let manuallyCollapsedCustomKeywords = $state(false);
  let manuallyCollapsedFilterScope = $state(false);
  let manuallyCollapsedAdvancedSimilarity = $state(false);

  // Track previous filter states to detect changes
  // Initialize to null to detect first-time changes properly
  let previousContentQualityFilters = $state<boolean | null>(null);
  let previousTopicsSubjectsFilters = $state<boolean | null>(null);
  let previousNewsTypesFilters = $state<boolean | null>(null);
  let previousWellnessFilters = $state<boolean | null>(null);
  let previousCustomKeywordsFilters = $state<boolean | null>(null);
  let previousFilterScopeFilters = $state<boolean | null>(null);
  let previousAdvancedSimilarityFilters = $state<boolean | null>(null);

  // Auto-collapse/expand section flags based on active filters (mirrors old SettingsSmartFilter behavior)
  const hasContentQualityFilters = $derived(
    smartContentFilter.preferences.filterLowQuality ||
      smartContentFilter.preferences.filterPromotional ||
      smartContentFilter.preferences.filterOpinions ||
      smartContentFilter.preferences.filterRepetitive ||
      smartContentFilter.preferences.filterSocialMediaDrama,
  );

  const hasTopicsSubjectsFilters = $derived(
    smartContentFilter.preferences.filterPolitics ||
      smartContentFilter.preferences.filterSports ||
      smartContentFilter.preferences.filterFinancial ||
      smartContentFilter.preferences.filterTechnology ||
      smartContentFilter.preferences.filterEntertainment ||
      smartContentFilter.preferences.filterCelebrity ||
      smartContentFilter.preferences.filterWeather,
  );

  const hasNewsTypesFilters = $derived(
    smartContentFilter.preferences.filterBreakingNews ||
      smartContentFilter.preferences.filterLocalNews ||
      smartContentFilter.preferences.filterInternationalNews,
  );

  const hasWellnessFilters = $derived(
    smartContentFilter.preferences.filterNegativeNews ||
      smartContentFilter.preferences.filterViolence ||
      smartContentFilter.preferences.filterAnxietyInducing ||
      smartContentFilter.preferences.filterEconomicPessimism,
  );

  const hasCustomKeywordsFilters = $derived(
    smartContentFilter.customKeywords.length > 0,
  );

  const hasContentSimilarityActive = $derived(
    smartContentFilter.preferences.filterContentSimilarity &&
      smartContentFilter.preferences.contentSimilarityThreshold > 0,
  );

  const hasFilterScopeFilters = $derived(
    smartContentFilter.filterScope !== 'all' ||
      smartContentFilter.filterMode !== 'hide' ||
      smartContentFilter.showFilteredCount !== true ||
      smartContentFilter.preferences.filterSensitivity !== 'balanced',
  );

  const hasAdvancedSimilarityFilters = $derived(
    smartContentFilter.preferences.filterContentSimilarity &&
      smartContentFilter.preferences.contentSimilarityThreshold > 0,
  );

  // Initialize sections based on current filter state on component mount
  $effect(() => {
    // Only run once on mount when previous states are null
    if (previousContentQualityFilters === null && previousTopicsSubjectsFilters === null && previousNewsTypesFilters === null && previousWellnessFilters === null && previousCustomKeywordsFilters === null && previousFilterScopeFilters === null && previousAdvancedSimilarityFilters === null) {
      // Auto-expand sections that have active filters on initial load
      if (hasContentQualityFilters && !manuallyCollapsedContentQuality) {
        showContentQuality = true;
      }
      
      if (hasTopicsSubjectsFilters && !manuallyCollapsedTopicsSubjects) {
        showTopicsSubjects = true;
      }
      
      if (hasNewsTypesFilters && !manuallyCollapsedNewsTypes) {
        showNewsTypes = true;
      }
      
      if (hasWellnessFilters && !manuallyCollapsedWellnessMental) {
        showWellnessMental = true;
      }
      
      if (hasCustomKeywordsFilters && !manuallyCollapsedCustomKeywords) {
        showCustomKeywords = true;
      }
      
      if (hasFilterScopeFilters && !manuallyCollapsedFilterScope) {
        showFilterScope = true;
      }
      
      if (hasAdvancedSimilarityFilters && !manuallyCollapsedAdvancedSimilarity) {
        showAdvancedSimilarity = true;
      }
    }
  });

  // Smart auto-expand when filters become active (but respect manual overrides)
  $effect(() => {
    // Handle initial state and transitions
    const currentContentQualityFilters = hasContentQualityFilters;
    const currentTopicsSubjectsFilters = hasTopicsSubjectsFilters;
    const currentNewsTypesFilters = hasNewsTypesFilters;
    const currentWellnessFilters = hasWellnessFilters;
    const currentCustomKeywordsFilters = hasCustomKeywordsFilters;
    const currentFilterScopeFilters = hasFilterScopeFilters;
    const currentAdvancedSimilarityFilters = hasAdvancedSimilarityFilters;
    
    // Skip if this is the very first run and we haven't initialized previous states
    if (previousContentQualityFilters === null && previousTopicsSubjectsFilters === null && previousNewsTypesFilters === null && previousWellnessFilters === null && previousCustomKeywordsFilters === null && previousFilterScopeFilters === null && previousAdvancedSimilarityFilters === null) {
      previousContentQualityFilters = currentContentQualityFilters;
      previousTopicsSubjectsFilters = currentTopicsSubjectsFilters;
      previousNewsTypesFilters = currentNewsTypesFilters;
      previousWellnessFilters = currentWellnessFilters;
      previousCustomKeywordsFilters = currentCustomKeywordsFilters;
      previousFilterScopeFilters = currentFilterScopeFilters;
      previousAdvancedSimilarityFilters = currentAdvancedSimilarityFilters;
      return;
    }
    
    // Auto-expand logic - When transitioning from inactive to active
    if (currentContentQualityFilters && 
        previousContentQualityFilters === false && 
        !manuallyCollapsedContentQuality) {
      showContentQuality = true;
    }
    
    if (currentTopicsSubjectsFilters && 
        previousTopicsSubjectsFilters === false && 
        !manuallyCollapsedTopicsSubjects) {
      showTopicsSubjects = true;
    }
    
    if (currentNewsTypesFilters && 
        previousNewsTypesFilters === false && 
        !manuallyCollapsedNewsTypes) {
      showNewsTypes = true;
    }
    
    if (currentWellnessFilters && 
        previousWellnessFilters === false && 
        !manuallyCollapsedWellnessMental) {
      showWellnessMental = true;
    }
    
    if (currentCustomKeywordsFilters && 
        previousCustomKeywordsFilters === false && 
        !manuallyCollapsedCustomKeywords) {
      showCustomKeywords = true;
    }
    
    if (currentFilterScopeFilters && 
        previousFilterScopeFilters === false && 
        !manuallyCollapsedFilterScope) {
      showFilterScope = true;
    }
    
    if (currentAdvancedSimilarityFilters && 
        previousAdvancedSimilarityFilters === false && 
        !manuallyCollapsedAdvancedSimilarity) {
      showAdvancedSimilarity = true;
    }

    // Auto-collapse logic - Enable auto-collapse when all filters become inactive
    if (previousContentQualityFilters === true && !currentContentQualityFilters && !manuallyCollapsedContentQuality) {
      showContentQuality = false;
    }
    if (previousTopicsSubjectsFilters === true && !currentTopicsSubjectsFilters && !manuallyCollapsedTopicsSubjects) {
      showTopicsSubjects = false;
    }
    if (previousNewsTypesFilters === true && !currentNewsTypesFilters && !manuallyCollapsedNewsTypes) {
      showNewsTypes = false;
    }
    if (previousWellnessFilters === true && !currentWellnessFilters && !manuallyCollapsedWellnessMental) {
      showWellnessMental = false;
    }
    if (previousCustomKeywordsFilters === true && !currentCustomKeywordsFilters && !manuallyCollapsedCustomKeywords) {
      showCustomKeywords = false;
    }
    if (previousFilterScopeFilters === true && !currentFilterScopeFilters && !manuallyCollapsedFilterScope) {
      showFilterScope = false;
    }
    if (previousAdvancedSimilarityFilters === true && !currentAdvancedSimilarityFilters && !manuallyCollapsedAdvancedSimilarity) {
      showAdvancedSimilarity = false;
    }

    // Reset manual override flags when filters transition from active to inactive
    if (previousContentQualityFilters === true && !currentContentQualityFilters) {
      manuallyCollapsedContentQuality = false;
    }
    if (previousTopicsSubjectsFilters === true && !currentTopicsSubjectsFilters) {
      manuallyCollapsedTopicsSubjects = false;
    }
    if (previousNewsTypesFilters === true && !currentNewsTypesFilters) {
      manuallyCollapsedNewsTypes = false;
    }
    if (previousWellnessFilters === true && !currentWellnessFilters) {
      manuallyCollapsedWellnessMental = false;
    }
    if (previousCustomKeywordsFilters === true && !currentCustomKeywordsFilters) {
      manuallyCollapsedCustomKeywords = false;
    }
    if (previousFilterScopeFilters === true && !currentFilterScopeFilters) {
      manuallyCollapsedFilterScope = false;
    }
    if (previousAdvancedSimilarityFilters === true && !currentAdvancedSimilarityFilters) {
      manuallyCollapsedAdvancedSimilarity = false;
    }

    // Update previous states for next comparison
    previousContentQualityFilters = currentContentQualityFilters;
    previousTopicsSubjectsFilters = currentTopicsSubjectsFilters;
    previousNewsTypesFilters = currentNewsTypesFilters;
    previousWellnessFilters = currentWellnessFilters;
    previousCustomKeywordsFilters = currentCustomKeywordsFilters;
    previousFilterScopeFilters = currentFilterScopeFilters;
    previousAdvancedSimilarityFilters = currentAdvancedSimilarityFilters;
  });
  // Performance optimizations - Memoized computations with reduced re-calculations
  let memoizedFilterCounts = $state(new Map<string, number>());
  let lastPreferencesUpdate = $state(0);

  // Derived reactive state for detecting active filters
  const hasActiveFilters = $derived(
    smartContentFilter.isEnabled &&
      (smartContentFilter.preferences.filterLowQuality ||
        smartContentFilter.preferences.filterPromotional ||
        smartContentFilter.preferences.filterOpinions ||
        smartContentFilter.preferences.filterRepetitive ||
        smartContentFilter.preferences.filterSocialMediaDrama ||
        smartContentFilter.preferences.filterPolitics ||
        smartContentFilter.preferences.filterSports ||
        smartContentFilter.preferences.filterFinancial ||
        smartContentFilter.preferences.filterTechnology ||
        smartContentFilter.preferences.filterEntertainment ||
        smartContentFilter.preferences.filterCelebrity ||
        smartContentFilter.preferences.filterWeather ||
        smartContentFilter.preferences.filterBreakingNews ||
        smartContentFilter.preferences.filterLocalNews ||
        smartContentFilter.preferences.filterInternationalNews ||
        smartContentFilter.preferences.filterNegativeNews ||
        smartContentFilter.preferences.filterViolence ||
        smartContentFilter.preferences.filterAnxietyInducing ||
        smartContentFilter.preferences.filterEconomicPessimism ||
        (smartContentFilter.preferences.filterContentSimilarity &&
          smartContentFilter.preferences.contentSimilarityThreshold > 0) ||
        smartContentFilter.customKeywords.length > 0),
  );

  // Performance optimization: Update memoization timestamp when preferences change
  $effect(() => {
    // Watch for changes in smartContentFilter to invalidate memoization
    smartContentFilter.preferences;
    lastPreferencesUpdate = Date.now();
  });

  // Lazy loading state for sections to avoid rendering heavy sections when collapsed
  let loadedSections = $state(
    new Set<string>(["main-toggle", "quick-setup", "active-filters"]),
  );

  // Function to lazily load section content
  function ensureSectionLoaded(sectionId: string) {
    if (!loadedSections.has(sectionId)) {
      loadedSections = new Set([...loadedSections, sectionId]);
    }
  }

  // Define content filter presets - separated into basic and specialized
  const basicPresets = [
    {
      id: "balanced",
      label: "Quality Focus",
      tooltip: "Moderate filtering focusing on content quality and readability",
      icon: "tabler:award",
      preferences: {
        filterLowQuality: true,
        filterViolence: true,
        filterSocialMediaDrama: true,
        filterPromotional: true,
        minimumQuality: 0.3,
        minimumSentiment: 0.3,
      },
    },
    {
      id: "politics-free",
      label: "Politics-Free",
      tooltip: "Remove political content and partisan discussions",
      icon: "tabler:ban",
      preferences: {
        filterPolitics: true,
        filterBreakingNews: true,
        filterOpinions: true,
        minimumSentiment: 0.3,
      },
    },
    {
      id: "strict",
      label: "High Standards",
      tooltip: "Aggressive filtering for premium-quality content only",
      icon: "tabler:shield-check",
      preferences: {
        filterLowQuality: true,
        filterViolence: true,
        filterNegativeNews: true,
        filterSocialMediaDrama: true,
        filterPromotional: true,
        filterOpinions: true,
        minimumQuality: 0.5,
        minimumSentiment: 0.4,
        minimumRelevance: 0.3,
      },
    },
  ];

  const specializedPresets = [
    {
      id: "professional",
      label: "Professional Focus",
      tooltip:
        "Filter entertainment and non-work content, focus on business news",
      icon: "tabler:briefcase",
      preferences: {
        filterCelebrity: true,
        filterEntertainment: true,
        filterSports: true,
        filterSocialMediaDrama: true,
        filterWeather: true,
        filterLocalNews: true,
        filterPromotional: true,
        minimumQuality: 0.4,
        // Add category-based sensitivity overrides
        categoryOverrides: {
          politics: 70,
          celebrity: 85,
          entertainment: 30,
          sports: 50,
          technology: 25,
          socialMediaDrama: 80,
        },
      },
    },
    {
      id: "essentials",
      label: "News Essentials",
      tooltip: "Only essential news, filter noise and information overload",
      icon: "tabler:bolt",
      preferences: {
        filterBreakingNews: true,
        filterRepetitive: true,
        filterSocialMediaDrama: true,
        filterPromotional: true,
        minimumQuality: 0.4,
      },
    },
    {
      id: "global",
      label: "Global Focus",
      tooltip: "International perspective, filter local and trivial content",
      icon: "tabler:world",
      preferences: {
        filterLocalNews: true,
        filterWeather: true,
        filterSports: true,
        filterCelebrity: true,
        minimumRelevance: 0.3,
      },
    },
    {
      id: "news-purist",
      label: "News Purist",
      tooltip: "Focus on substantive journalism only",
      icon: "tabler:news",
      preferences: {
        filterCelebrity: true,
        filterEntertainment: true,
        filterSports: true,
        filterSocialMediaDrama: true,
        // Add category-based sensitivity overrides
        categoryOverrides: {
          celebrity: 80,
          entertainment: 75,
          politics: 45,
          sports: 70,
          technology: 50,
          socialMediaDrama: 85,
        },
      },
    },
    {
      id: "wellness-focused",
      label: "Wellness Focus",
      tooltip: "Protect mental health, reduce anxiety",
      icon: "tabler:brain",
      preferences: {
        filterViolence: true,
        filterNegativeNews: true,
        filterAnxietyInducing: true,
        filterEconomicPessimism: true,
        filterSocialMediaDrama: true,
        minimumSentiment: 0.5,
        // Add category-based sensitivity overrides
        categoryOverrides: {
          politics: 55,
          celebrity: 35,
          sports: 25,
          technology: 50,
          socialMediaDrama: 75,
        },
      },
    },
  ];

  // Track which presets are active (including category overrides)
  const isPresetActive = (presetId: string): boolean => {
    const allPresets = [...basicPresets, ...specializedPresets];
    const preset = allPresets.find((p) => p.id === presetId);
    if (!preset) return false;

    // Check if current preferences match this preset
    const preferencesMatch = Object.entries(preset.preferences).every(
      ([key, value]) => {
        if (key === "categoryOverrides") {
          // Special handling for category overrides
          const currentOverrides =
            smartContentFilter.preferences.categoryOverrides;
          const presetOverrides = value as Record<string, number>;

          if (!currentOverrides && !presetOverrides) return true;
          if (!currentOverrides || !presetOverrides) return false;

          // Check if all preset overrides match current ones
          return Object.entries(presetOverrides).every(
            ([category, sensitivity]) => {
              return currentOverrides[category] === sensitivity;
            },
          );
        } else {
          const currentValue =
            smartContentFilter.preferences[
              key as keyof typeof smartContentFilter.preferences
            ];
          return currentValue === value;
        }
      },
    );

    return preferencesMatch;
  };

  // Get all currently active presets
  const getActivePresets = () => {
    const allPresets = [...basicPresets, ...specializedPresets];
    return allPresets.filter((preset) => isPresetActive(preset.id));
  };

  // Track active presets and detect modifications
  const activePresets = $derived.by(() => {
    return getActivePresets();
  });

  // Legacy support for single active preset (for backward compatibility)
  const activePreset = $derived.by(() => {
    return activePresets.length > 0 ? activePresets[0] : null;
  });

  // Check if current settings have been modified from any active preset
  const isPresetModified = $derived.by(() => {
    if (activePresets.length === 0) return false;

    // For simplicity, we'll consider settings modified if there are additional filters
    // beyond what the active presets define
    const hasAdditionalFilters =
      smartContentFilter.customKeywords.length > 0 ||
      (smartContentFilter.preferences.filterContentSimilarity &&
        smartContentFilter.preferences.contentSimilarityThreshold > 0);

    return hasAdditionalFilters;
  });

  // Reset to original presets
  function resetToActivePresets() {
    // Clear all settings first
    smartContentFilter.resetPreferences();
    smartContentFilter.clearCustomKeywords();

    // Reapply active presets
    const currentActivePresets = getActivePresets();
    currentActivePresets.forEach((preset) => {
      togglePreset(preset.id);
    });
  }

  // Legacy function for backward compatibility
  function resetToActivePreset() {
    resetToActivePresets();
  }

  // Define filter groups with their associated filters and individual filter icons
  const filterGroups = {
    "Content Quality": {
      icon: "tabler:shield-check",
      filters: [
        "filterLowQuality",
        "filterPromotional",
        "filterOpinions",
        "filterRepetitive",
        "filterSocialMediaDrama",
      ],
    },
    "Topics & Subjects": {
      icon: "tabler:tags",
      filters: [
        "filterPolitics",
        "filterSports",
        "filterFinancial",
        "filterTechnology",
        "filterEntertainment",
        "filterCelebrity",
        "filterWeather",
      ],
    },
    "News Types": {
      icon: "tabler:news",
      filters: [
        "filterBreakingNews",
        "filterLocalNews",
        "filterInternationalNews",
      ],
    },
    "Wellness & Mental Health": {
      icon: "tabler:brain",
      filters: [
        "filterNegativeNews",
        "filterViolence",
        "filterAnxietyInducing",
        "filterEconomicPessimism",
      ],
    },
  };

  // Individual filter icons mapping
  const filterIcons = {
    filterPolitics: "heroicons:megaphone",
    filterSports: "tabler:ball-football",
    filterFinancial: "tabler:chart-line",
    filterTechnology: "tabler:device-laptop",
    filterEntertainment: "tabler:movie",
    filterCelebrity: "tabler:star",
    filterWeather: "tabler:cloud",
    filterLowQuality: "tabler:thumb-down",
    filterPromotional: "tabler:ad",
    filterOpinions: "tabler:message-circle",
    filterRepetitive: "tabler:repeat",
    filterSocialMediaDrama: "tabler:brand-x",
    filterBreakingNews: "tabler:urgent",
    filterLocalNews: "tabler:map-pin",
    filterInternationalNews: "tabler:globe",
    filterNegativeNews: "tabler:mood-sad",
    filterViolence: "emojione-monotone:raised-fist",
    filterAnxietyInducing: "fluent-emoji-high-contrast:fearful-face",
    filterEconomicPessimism: "tabler:trending-down",
  };

  // Get active filter groups
  const getActiveFilterGroups = () => {
    const activeGroups = [];

    for (const [groupName, groupData] of Object.entries(filterGroups)) {
      const activeFiltersInGroup = groupData.filters.filter(
        (filterKey) =>
          smartContentFilter.preferences[
            filterKey as keyof typeof smartContentFilter.preferences
          ],
      );

      if (activeFiltersInGroup.length > 0) {
        // For groups with only one active filter, use the specific filter's icon
        let displayIcon = groupData.icon;
        if (activeFiltersInGroup.length === 1) {
          const singleFilter = activeFiltersInGroup[0];
          if (filterIcons[singleFilter as keyof typeof filterIcons]) {
            displayIcon = filterIcons[singleFilter as keyof typeof filterIcons];
          }
        }

        activeGroups.push({
          name: groupName,
          icon: displayIcon,
          activeCount: activeFiltersInGroup.length,
          totalCount: groupData.filters.length,
          activeFilters: activeFiltersInGroup,
        });
      }
    }

    // Add custom keywords as a group if any exist
    if (smartContentFilter.customKeywords.length > 0) {
      activeGroups.push({
        name: "Custom Keywords",
        icon: "tabler:key",
        activeCount: smartContentFilter.customKeywords.length,
        totalCount: smartContentFilter.customKeywords.length,
        activeFilters: smartContentFilter.customKeywords,
      });
    }

    // Add content similarity as a group if active
    if (
      smartContentFilter.preferences.filterContentSimilarity &&
      smartContentFilter.preferences.contentSimilarityThreshold > 0
    ) {
      activeGroups.push({
        name: "Content Similarity",
        icon: "tabler:copy",
        activeCount: 1,
        totalCount: 1,
        activeFilters: [
          `${smartContentFilter.preferences.contentSimilarityThreshold}% threshold`,
        ],
      });
    }

    return activeGroups;
  };

  // Track active filter groups
  const activeFilterGroups = $derived.by(() => {
    return getActiveFilterGroups();
  });

  // Reset a specific filter group - with scroll preservation
  const resetFilterGroup = createSafeAction((groupName: string) => {
    if (groupName === "Custom Keywords") {
      smartContentFilter.clearCustomKeywords();
    } else if (groupName === "Content Similarity") {
      smartContentFilter.updatePreference("filterContentSimilarity", false);
      smartContentFilter.setContentSimilarityThreshold(0);
    } else {
      // Find the group and reset all its filters
      const group = filterGroups[groupName as keyof typeof filterGroups];
      if (group) {
        group.filters.forEach((filterKey) => {
          smartContentFilter.updatePreference(
            filterKey as keyof typeof smartContentFilter.preferences,
            false,
          );
        });
      }
    }
  });

  // Handle clicks without scroll jumping
  function handleFilterClick(e: Event, action: () => void) {
    e.preventDefault();
    e.stopPropagation();
    action();
  }

  // Helper function to create properly aligned dropdown button classes
  function getDropdownButtonClasses(isActive: boolean = false) {
    const baseClasses =
      "flex items-center justify-between w-full px-4 py-2 text-left rounded-lg border transition-all duration-200";
    const activeClasses = isActive
      ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300"
      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-600";

    return `${baseClasses} ${activeClasses}`;
  }

  // Clear all active filters and settings (no confirmation) - with scroll preservation
  const clearAllFilters = createSafeAction(() => {
    // Only clear filters that are currently active (true)
    Object.keys(filterGroups).forEach((groupName) => {
      const group = filterGroups[groupName as keyof typeof filterGroups];
      group.filters.forEach((filterKey) => {
        const currentValue =
          smartContentFilter.preferences[
            filterKey as keyof typeof smartContentFilter.preferences
          ];
        if (currentValue === true) {
          smartContentFilter.updatePreference(
            filterKey as keyof typeof smartContentFilter.preferences,
            false,
          );
        }
      });
    });

    // Clear custom keywords only if they exist
    if (smartContentFilter.customKeywords.length > 0) {
      smartContentFilter.clearCustomKeywords();
    }

    // Reset content similarity only if currently active
    if (smartContentFilter.preferences.filterContentSimilarity === true) {
      smartContentFilter.updatePreference("filterContentSimilarity", false);
    }

    // Reset similarity threshold only if it's greater than 0
    if (smartContentFilter.preferences.contentSimilarityThreshold > 0) {
      smartContentFilter.setContentSimilarityThreshold(0);
    }
  });

  // Apply a preset (allow multiple presets to be combined) - with scroll preservation
  const togglePreset = createSafeAction((presetId: string) => {
    const allPresets = [...basicPresets, ...specializedPresets];
    const preset = allPresets.find((p) => p.id === presetId);
    if (!preset) return;

    if (isPresetActive(presetId)) {
      // Deactivate this preset only, keep others active
      deactivatePreset(presetId);
    } else {
      // Apply new preset without resetting (allow combination)
      Object.entries(preset.preferences).forEach(([key, value]) => {
        if (key === "categoryOverrides") {
          // Special handling for category overrides
          const overrides = value as Record<string, number>;
          Object.entries(overrides).forEach(([category, sensitivity]) => {
            smartContentFilter.updateCategoryOverride(category, sensitivity);
          });
        } else {
          smartContentFilter.updatePreference(
            key as keyof typeof smartContentFilter.preferences,
            value,
          );
        }
      });
    }
  });

  // Get reason why preset cannot be activated
  function getDeactivationReason(presetId: string): string {
    const conflicts = getPresetConflicts(presetId);
    if (conflicts.length > 0) {
      return `Conflicts with active preset${conflicts.length > 1 ? "s" : ""}: ${conflicts.join(", ")}. Deactivate conflicting presets first.`;
    }
    return "";
  }

  // Deactivate a specific preset without affecting unrelated filters
  function deactivatePreset(presetId: string) {
    const allPresets = [...basicPresets, ...specializedPresets];
    const preset = allPresets.find((p) => p.id === presetId);
    if (!preset) return;

    // Get current state before any changes
    const currentPreferences = { ...smartContentFilter.preferences };
    const currentCustomKeywords = [...smartContentFilter.customKeywords];

    // Get all currently active presets (excluding the one we're deactivating)
    const otherActivePresets = allPresets.filter(
      (p) => p.id !== presetId && isPresetActive(p.id),
    );

    // Create maps of what should remain active from other presets
    const requiredByOtherPresets = new Map<string, any>();
    const requiredCategoryOverrides = new Map<string, number>();

    // Collect all preferences required by other active presets
    otherActivePresets.forEach((otherPreset) => {
      Object.entries(otherPreset.preferences).forEach(([key, value]) => {
        if (key === "categoryOverrides") {
          const overrides = value as Record<string, number>;
          Object.entries(overrides).forEach(([category, sensitivity]) => {
            requiredCategoryOverrides.set(category, sensitivity);
          });
        } else {
          requiredByOtherPresets.set(key, value);
        }
      });
    });

    // Don't reset everything - just selectively remove this preset's settings

    // Restore custom keywords (they're never part of presets, so keep them as-is)
    // No action needed for custom keywords

    // Only deactivate the specific preferences from this preset
    Object.entries(preset.preferences).forEach(([key, value]) => {
      if (key === "categoryOverrides") {
        const overrides = value as Record<string, number>;
        Object.keys(overrides).forEach((category) => {
          // Only remove category override if it's not required by another preset
          if (!requiredCategoryOverrides.has(category)) {
            smartContentFilter.updateCategoryOverride(category, undefined);
          }
        });
      } else if (typeof value === "boolean" && value === true) {
        // Only deactivate boolean preferences that were set to true by this preset
        // and are not required by other active presets
        if (!requiredByOtherPresets.has(key)) {
          smartContentFilter.updatePreference(
            key as keyof typeof smartContentFilter.preferences,
            false,
          );
        }
      } else if (typeof value === "number") {
        // For numeric preferences, only reset if not required by other presets
        const isRequiredByOther = otherActivePresets.some((otherPreset) =>
          otherPreset.preferences.hasOwnProperty(key),
        );
        if (!isRequiredByOther) {
          // Reset to default value (0 for most numeric preferences)
          smartContentFilter.updatePreference(
            key as keyof typeof smartContentFilter.preferences,
            0,
          );
        }
      }
    });
  }

  // Detect conflicts between presets
  function getPresetConflicts(presetId: string): string[] {
    const allPresets = [...basicPresets, ...specializedPresets];
    const preset = allPresets.find((p) => p.id === presetId);
    if (!preset) return [];

    const conflicts: string[] = [];

    for (const otherPreset of allPresets) {
      if (otherPreset.id === presetId || !isPresetActive(otherPreset.id))
        continue;

      // Check for overlapping settings
      const hasConflict = Object.keys(preset.preferences).some((key) => {
        if (key === "categoryOverrides") {
          const presetOverrides =
            (preset.preferences as any).categoryOverrides || {};
          const otherOverrides =
            (otherPreset.preferences as any).categoryOverrides || {};

          return Object.keys(presetOverrides).some(
            (category) =>
              otherOverrides[category] !== undefined &&
              otherOverrides[category] !== presetOverrides[category],
          );
        }

        return (
          (otherPreset.preferences as any)[key] !== undefined &&
          (otherPreset.preferences as any)[key] !==
            (preset.preferences as any)[key]
        );
      });

      if (hasConflict) {
        conflicts.push(otherPreset.label);
      }
    }

    return conflicts;
  }

  // Check if a preset can be activated (no conflicts)
  function canActivatePreset(presetId: string): boolean {
    return getPresetConflicts(presetId).length === 0;
  }

  // Helper functions for active filters management
  function getActiveFilterCount(): number {
    let count = 0;

    // Count boolean filter preferences
    const booleanFilters = [
      "filterPolitics",
      "filterNegativeNews",
      "filterLowQuality",
      "filterViolence",
      "filterCelebrity",
      "filterSports",
      "filterFinancial",
      "filterEntertainment",
      "filterTechnology",
      "filterOpinions",
      "filterAnxietyInducing",
      "filterSocialMediaDrama",
      "filterPromotional",
      "filterBreakingNews",
      "filterWeather",
      "filterLocalNews",
      "filterInternationalNews",
      "filterEconomicPessimism",
      "filterRepetitive",
    ];

    for (const filter of booleanFilters) {
      if (
        smartContentFilter.preferences[
          filter as keyof typeof smartContentFilter.preferences
        ]
      ) {
        count++;
      }
    }

    // Count content similarity if enabled
    if (
      smartContentFilter.preferences.filterContentSimilarity &&
      smartContentFilter.preferences.contentSimilarityThreshold > 0
    ) {
      count++;
    }

    // Count custom keywords
    count += smartContentFilter.customKeywords.length;

    return count;
  }

  interface FilterTag {
    key: string;
    value: boolean | string;
    label: string;
    icon: string;
  }

  function getActiveFilterTags(): FilterTag[] {
    const tags: FilterTag[] = [];

    // Define filter mappings with icons and labels
    const filterMappings = [
      { key: "filterPolitics", label: "Politics", icon: "heroicons:megaphone" },
      {
        key: "filterNegativeNews",
        label: "Negative News",
        icon: "tabler:mood-sad",
      },
      {
        key: "filterLowQuality",
        label: "Low Quality",
        icon: "tabler:thumb-down",
      },
      {
        key: "filterViolence",
        label: "Violence",
        icon: "emojione-monotone:raised-fist",
      },
      { key: "filterCelebrity", label: "Celebrity", icon: "tabler:star" },
      { key: "filterSports", label: "Sports", icon: "tabler:ball-football" },
      {
        key: "filterFinancial",
        label: "Financial",
        icon: "tabler:chart-line",
      },
      {
        key: "filterEntertainment",
        label: "Entertainment",
        icon: "tabler:movie",
      },
      {
        key: "filterTechnology",
        label: "Technology",
        icon: "tabler:device-laptop",
      },
      {
        key: "filterOpinions",
        label: "Opinions",
        icon: "tabler:message-circle",
      },
      {
        key: "filterAnxietyInducing",
        label: "Anxiety-Inducing",
        icon: "fluent-emoji-high-contrast:fearful-face",
      },
      {
        key: "filterSocialMediaDrama",
        label: "Social Media Drama",
        icon: "social-media-icons",
      },
      { key: "filterPromotional", label: "Promotional", icon: "tabler:ad" },
      {
        key: "filterBreakingNews",
        label: "Breaking News",
        icon: "tabler:urgent",
      },
      { key: "filterWeather", label: "Weather", icon: "tabler:cloud" },
      { key: "filterLocalNews", label: "Local News", icon: "tabler:map-pin" },
      {
        key: "filterInternationalNews",
        label: "International News",
        icon: "tabler:globe",
      },
      {
        key: "filterEconomicPessimism",
        label: "Economic Pessimism",
        icon: "tabler:trending-down",
      },
      {
        key: "filterRepetitive",
        label: "Repetitive Coverage",
        icon: "tabler:repeat",
      },
    ];

    // Add active boolean filters
    for (const mapping of filterMappings) {
      if (
        smartContentFilter.preferences[
          mapping.key as keyof typeof smartContentFilter.preferences
        ]
      ) {
        tags.push({
          key: mapping.key,
          value: true,
          label: mapping.label,
          icon: mapping.icon,
        });
      }
    }

    // Add content similarity filter if active
    if (
      smartContentFilter.preferences.filterContentSimilarity &&
      smartContentFilter.preferences.contentSimilarityThreshold > 0
    ) {
      tags.push({
        key: "filterContentSimilarity",
        value: true,
        label: `Content Similarity (${smartContentFilter.preferences.contentSimilarityThreshold}%)`,
        icon: "tabler:copy",
      });
    }

    return tags;
  }

  // Remove individual filter with scroll preservation
  const removeFilter = createSafeAction(
    (key: string, value: boolean | string) => {
      if (key === "filterContentSimilarity") {
        smartContentFilter.updatePreference("filterContentSimilarity", false);
      } else {
        smartContentFilter.updatePreference(
          key as keyof typeof smartContentFilter.preferences,
          false,
        );
      }
    },
  );

  // System Controls Functions
  // Export configuration
  function exportConfiguration() {
    const config = smartContentFilter.exportConfig();
    const blob = new Blob([config], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kite-content-filters-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    systemMessage = {
      type: "success",
      title:
        s("settings.contentFilter.export.success") ||
        "Configuration exported successfully",
      description:
        s("settings.contentFilter.export.success.description") ||
        "Your filter settings have been saved to a JSON file",
    };

    // Clear message after 5 seconds
    setTimeout(() => {
      if (systemMessage?.type === "success") systemMessage = null;
    }, 5000);
  }

  // Handle file selection
  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      systemMessage = {
        type: "error",
        title: "File too large",
        description: "Configuration files must be smaller than 10MB.",
      };
      return;
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith(".json")) {
      systemMessage = {
        type: "error",
        title: "Invalid file type",
        description: "Please select a JSON configuration file.",
      };
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        // Pre-validate the import
        const result = smartContentFilter.importConfig(content);
        if (result.errorKey) {
          systemMessage = {
            type: "error",
            title: s(result.errorKey) || result.errorKey,
            description:
              s("settings.contentFilter.import.error.description") ||
              "Unable to import configuration. Please check the file format.",
          };
          return;
        }

        // Store the data and show confirmation
        pendingImportData = content;
        importWarning = result.warningKey
          ? s(result.warningKey) || result.warningKey
          : undefined;
        selectedFileName = file.name;
        showImportConfirmation = true;
      } catch (error) {
        systemMessage = {
          type: "error",
          title: "File reading error",
          description:
            "Failed to read the configuration file. Please try again.",
        };
        console.error("File reading error:", error);
      }
    };

    reader.onerror = () => {
      systemMessage = {
        type: "error",
        title: "File reading failed",
        description:
          "Could not read the selected file. Please try a different file.",
      };
    };

    reader.readAsText(file);
  }

  // Confirm import
  function confirmImport() {
    if (pendingImportData) {
      smartContentFilter.importConfig(pendingImportData);
      systemMessage = {
        type: "success",
        title:
          s("settings.contentFilter.import.success") ||
          "Configuration imported successfully",
        description:
          s("settings.contentFilter.import.success.description") ||
          "Your filter settings have been restored from the file",
      };

      // Clear message after 5 seconds
      setTimeout(() => {
        if (systemMessage?.type === "success") systemMessage = null;
      }, 5000);

      showImportConfirmation = false;
      pendingImportData = undefined;
      importWarning = undefined;
      selectedFileName = null;
      // Reset file input
      if (fileInput) fileInput.value = "";
    }
  }

  // Cancel import
  function cancelImport() {
    showImportConfirmation = false;
    pendingImportData = undefined;
    importWarning = undefined;
    selectedFileName = null;
    // Reset file input
    if (fileInput) fileInput.value = "";
  }

  // Handle reset button click (first click shows confirmation)
  function handleResetClick() {
    if (isResetConfirming) {
      // Second click - actually reset
      resetToDefaults();
    } else {
      // First click - show confirmation
      isResetConfirming = true;
      // Reset confirmation state after 3 seconds
      if (resetTimeout) clearTimeout(resetTimeout);
      resetTimeout = setTimeout(() => {
        isResetConfirming = false;
      }, 3000);
    }
  }

  // Reset to defaults
  function resetToDefaults() {
    smartContentFilter.reset();
    isResetConfirming = false;
    if (resetTimeout) {
      clearTimeout(resetTimeout);
      resetTimeout = null;
    }

    systemMessage = {
      type: "success",
      title:
        s("settings.contentFilter.reset.success") ||
        "Settings reset successfully",
      description:
        s("settings.contentFilter.reset.success.description") ||
        "All filter settings have been restored to their default values",
    };

    // Clear message after 5 seconds
    setTimeout(() => {
      if (systemMessage?.type === "success") systemMessage = null;
    }, 5000);
  }

  // Enhanced cleanup on component destroy
  $effect(() => {
    return () => {
      // Clear all timeouts
      if (resetTimeout) {
        clearTimeout(resetTimeout);
      }

      // Clear system message timeout if needed
      if (systemMessage?.type === "success") {
        systemMessage = null;
      }

      // Clear announcements for memory optimization
      announcements = [];

      // Reset any pending import data
      pendingImportData = null;
      showImportConfirmation = false;
    };
  });

  // Custom Keywords Functions
  let newKeywordInput = $state("");

  const addCustomKeyword = createSafeAction(() => {
    const input = newKeywordInput.trim();
    if (input) {
      // Check if input contains commas (multiple keywords)
      if (input.includes(",")) {
        const keywords = input
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k.length > 0);

        keywords.forEach((keyword) => {
          if (validateKeyword(keyword)) {
            smartContentFilter.addCustomKeyword(keyword);
          }
        });
      } else {
        // Single keyword
        if (validateKeyword(input)) {
          smartContentFilter.addCustomKeyword(input);
        }
      }
      newKeywordInput = "";
    }
  });

  // Remove individual custom keyword with scroll preservation
  const removeCustomKeyword = createSafeAction((keyword: string) => {
    smartContentFilter.removeCustomKeyword(keyword);
  });

  // Clear all custom keywords with scroll preservation
  const clearAllCustomKeywords = createSafeAction(() => {
    smartContentFilter.clearCustomKeywords();
  });

  function normalizeKeyword(keyword: string): string {
    return keyword.toLowerCase().trim();
  }

  function validateKeyword(keyword: string): boolean {
    const normalized = normalizeKeyword(keyword);
    return (
      normalized.length > 0 &&
      normalized.length <= 50 &&
      !smartContentFilter.customKeywords.includes(normalized)
    );
  }

  // Enhanced validation for numeric inputs
  function validateNumericRange(
    value: number,
    min: number,
    max: number,
  ): number {
    if (isNaN(value)) return min;
    return Math.max(min, Math.min(max, value));
  }

  // Safe slider input handler with validation
  function handleSliderInput(
    event: Event,
    updateFunction: (value: number) => void,
    min: number = 0,
    max: number = 100,
  ) {
    try {
      const value = parseInt((event.target as HTMLInputElement).value);
      const validatedValue = validateNumericRange(value, min, max);
      updateFunction(validatedValue);
    } catch (error) {
      console.warn("Invalid slider input:", error);
      // Reset to minimum value on error
      updateFunction(min);
    }
  }

  // Accessibility state and functions
  let announcements = $state<string[]>([]);
  let lastAnnouncementId = $state(0);

  // Screen reader announcement function
  function announceToScreenReader(message: string) {
    announcements.push(message);
    lastAnnouncementId++;

    // Clean up old announcements after 3 seconds
    setTimeout(() => {
      announcements = announcements.slice(1);
    }, 3000);
  }

  // Enhanced keyboard navigation for section toggles
  function handleSectionKeyDown(
    event: KeyboardEvent,
    toggleFunction: () => void,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleFunction();
    }
  }

  // Enhanced keyboard navigation for filter toggles
  function handleFilterKeyDown(event: KeyboardEvent, filterKey: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const newValue =
        !smartContentFilter.preferences[
          filterKey as keyof typeof smartContentFilter.preferences
        ];
      smartContentFilter.togglePreference(filterKey as any);

      // Announce the change
      const filterName = filterKey
        .replace("filter", "")
        .replace(/([A-Z])/g, " $1")
        .toLowerCase();
      announceToScreenReader(
        `${filterName} filter ${newValue ? "enabled" : "disabled"}`,
      );
    }
  }

  // Enhanced keyboard navigation for preset buttons
  function handlePresetKeyDown(event: KeyboardEvent, presetId: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const wasActive = isPresetActive(presetId);
      togglePreset(presetId);

      // Find preset name for announcement
      const preset = [...basicPresets, ...specializedPresets].find(
        (p) => p.id === presetId,
      );
      const presetName = preset?.label || presetId;
      announceToScreenReader(
        `${presetName} preset ${wasActive ? "deactivated" : "activated"}`,
      );
    }
  }

  // Skip link navigation
  function skipToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element) {
      element.focus();
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Enhanced focus management for form inputs
  function handleInputKeyDown(
    event: KeyboardEvent,
    submitFunction: () => void,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      submitFunction();
    }
  }

  // Improved keyboard navigation helper for complex controls
  function handleComplexControlKeyDown(
    event: KeyboardEvent,
    actions: {
      onEnter?: () => void;
      onSpace?: () => void;
      onArrowLeft?: () => void;
      onArrowRight?: () => void;
      onEscape?: () => void;
    },
  ) {
    switch (event.key) {
      case "Enter":
        if (actions.onEnter) {
          event.preventDefault();
          actions.onEnter();
        }
        break;
      case " ":
        if (actions.onSpace) {
          event.preventDefault();
          actions.onSpace();
        }
        break;
      case "ArrowLeft":
        if (actions.onArrowLeft) {
          event.preventDefault();
          actions.onArrowLeft();
        }
        break;
      case "ArrowRight":
        if (actions.onArrowRight) {
          event.preventDefault();
          actions.onArrowRight();
        }
        break;
      case "Escape":
        if (actions.onEscape) {
          event.preventDefault();
          actions.onEscape();
        }
        break;
    }
  }

  // Standardized button classes for consistent sizing
  const getButtonClasses = (isActive: boolean, canActivate: boolean = true) => {
    const baseClasses =
      "flex h-full w-full flex-col items-center justify-start space-y-2 rounded-lg border px-3 py-3 text-center transition-all duration-200";
    const activeClasses = isActive
      ? "border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-100"
      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-600";
    const disabledClasses =
      !canActivate && !isActive
        ? "cursor-not-allowed opacity-60"
        : "cursor-pointer";

    return `${baseClasses} ${activeClasses} ${disabledClasses}`;
  };

  // Simplified button classes for filter buttons
  const getFilterButtonClasses = (isActive: boolean) => {
    return getButtonClasses(isActive, true);
  };

  // Extended button classes for similarity presets with larger icons
  const getSimilarityPresetButtonClasses = (
    isActive: boolean,
    canActivate: boolean = true,
  ) => {
    const baseClasses =
      "flex h-full w-full flex-col items-center justify-start space-y-2 rounded-lg border px-3 py-3 text-center transition-all duration-200";
    const activeClasses = isActive
      ? "border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-100"
      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-600";
    const disabledClasses =
      !canActivate && !isActive
        ? "cursor-not-allowed opacity-60"
        : "cursor-pointer";

    return `${baseClasses} ${activeClasses} ${disabledClasses}`;
  };

  // Focus management for modal dialogs
  function manageFocusForModal(isOpen: boolean, modalId: string) {
    if (isOpen) {
      // Focus the first focusable element in the modal
      setTimeout(() => {
        const modal = document.getElementById(modalId);
        if (modal) {
          const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          );
          if (focusableElements.length > 0) {
            (focusableElements[0] as HTMLElement).focus();
          }
        }
      }, 0);
    }
  }

  // Watch for modal state changes to manage focus
  $effect(() => {
    manageFocusForModal(showImportConfirmation, "import-confirmation-modal");
  });

  // Integration Testing & Production Helpers
  let testMode = $state(false);
  let testResults = $state<
    Array<{ test: string; passed: boolean; message?: string }>
  >([]);

  // Test all component functionality (for development/QA)
  async function runIntegrationTests() {
    if (!testMode) return;

    testResults = [];
    const addTestResult = (test: string, passed: boolean, message?: string) => {
      testResults.push({ test, passed, message });
    };

    // Test 1: Main toggle functionality
    try {
      const initialState = smartContentFilter.isEnabled;
      smartContentFilter.toggleEnabled();
      const newState = smartContentFilter.isEnabled;
      addTestResult(
        "Main Toggle",
        initialState !== newState,
        "Toggle state changed correctly",
      );
      smartContentFilter.toggleEnabled(); // Reset
    } catch (error) {
      addTestResult("Main Toggle", false, `Error: ${error}`);
    }

    // Test 2: Filter preferences
    try {
      const testFilters = [
        "filterPolitics",
        "filterSports",
        "filterLowQuality",
      ];
      let allPassed = true;

      for (const filter of testFilters) {
        const initial =
          smartContentFilter.preferences[
            filter as keyof typeof smartContentFilter.preferences
          ];
        smartContentFilter.togglePreference(filter as any);
        const updated =
          smartContentFilter.preferences[
            filter as keyof typeof smartContentFilter.preferences
          ];
        if (initial === updated) {
          allPassed = false;
          break;
        }
        smartContentFilter.togglePreference(filter as any); // Reset
      }

      addTestResult("Filter Toggles", allPassed, "All filter toggles working");
    } catch (error) {
      addTestResult("Filter Toggles", false, `Error: ${error}`);
    }

    // Test 3: Custom keywords
    try {
      const testKeyword = "test-keyword-" + Date.now();
      const initialCount = smartContentFilter.customKeywords.length;
      smartContentFilter.addCustomKeyword(testKeyword);
      const afterAdd = smartContentFilter.customKeywords.length;
      smartContentFilter.removeCustomKeyword(testKeyword);
      const afterRemove = smartContentFilter.customKeywords.length;

      addTestResult(
        "Custom Keywords",
        afterAdd === initialCount + 1 && afterRemove === initialCount,
        "Add/remove keywords working",
      );
    } catch (error) {
      addTestResult("Custom Keywords", false, `Error: ${error}`);
    }

    // Test 4: Section visibility and lazy loading
    try {
      ensureSectionLoaded("content-quality");
      ensureSectionLoaded("topics-subjects");
      const isLoaded =
        loadedSections.has("content-quality") &&
        loadedSections.has("topics-subjects");
      addTestResult("Lazy Loading", isLoaded, "Sections load on demand");
    } catch (error) {
      addTestResult("Lazy Loading", false, `Error: ${error}`);
    }

    // Test 5: Accessibility features
    try {
      announceToScreenReader("Test announcement");
      const hasAnnouncements = announcements.length > 0;
      addTestResult(
        "Accessibility",
        hasAnnouncements,
        "Screen reader announcements working",
      );
    } catch (error) {
      addTestResult("Accessibility", false, `Error: ${error}`);
    }

    console.log("Integration test results:", testResults);
  }

  // Production polish: Responsive design utilities
  const responsiveBreakpoints = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
  };

  let screenSize = $state("lg");

  // Update screen size for responsive behavior
  function updateScreenSize() {
    if (typeof window !== "undefined") {
      const width = window.innerWidth;
      if (width < responsiveBreakpoints.sm) screenSize = "xs";
      else if (width < responsiveBreakpoints.md) screenSize = "sm";
      else if (width < responsiveBreakpoints.lg) screenSize = "md";
      else if (width < responsiveBreakpoints.xl) screenSize = "lg";
      else screenSize = "xl";
    }
  }

  // Monitor window resize for responsive behavior
  $effect(() => {
    if (typeof window !== "undefined") {
      updateScreenSize();
      window.addEventListener("resize", updateScreenSize);
      return () => window.removeEventListener("resize", updateScreenSize);
    }
  });

  // Enhanced grid layout function for consistent button sizing
  const getGridClasses = (itemCount: number) => {
    // Dynamic grid calculation based on optimal distribution
    let cols: number;

    if (itemCount <= 1) {
      cols = 1;
    } else if (itemCount <= 2) {
      cols = 2; // 2 items take full width
    } else if (itemCount <= 3) {
      cols = 3;
    } else if (itemCount <= 4) {
      cols = 4; // 4 items in single row
    } else if (itemCount === 5) {
      cols = 3; // 5 items: 3-2 layout (better than 4-1)
    } else if (itemCount <= 8) {
      cols = 4; // 6-8 items: 4-2, 4-3, 4-4 layouts
    } else {
      // For 9+ items, always use 4 columns to maximize space
      cols = 4;
    }

    // Map to static Tailwind classes that force equal row heights
    const gridClassMap = {
      1: "grid grid-cols-1 auto-rows-fr gap-1",
      2: "grid grid-cols-2 auto-rows-fr gap-1",
      3: "grid grid-cols-3 auto-rows-fr gap-1",
      4: "grid grid-cols-4 auto-rows-fr gap-1",
    };

    return (
      gridClassMap[cols as keyof typeof gridClassMap] ||
      "grid grid-cols-4 gap-1"
    );
  };

  // Check if similarity preset is currently active
  const isSimilarityPresetActive = (presetType: string): boolean => {
    if (!smartContentFilter.preferences.filterContentSimilarity) return false;

    switch (presetType) {
      case "local":
        return (
          smartContentFilter.preferences.contentSimilarityThreshold === 60 &&
          smartContentFilter.preferences.contentSimilarityMode === "today" &&
          smartContentFilter.preferences.contentSimilarityScope ===
            "within-category" &&
          smartContentFilter.preferences.similarityTitleWeight === 50 &&
          smartContentFilter.preferences.similarityContentWeight === 30 &&
          smartContentFilter.preferences.similarityEntityWeight === 20
        );
      case "global":
        return (
          smartContentFilter.preferences.contentSimilarityThreshold === 70 &&
          smartContentFilter.preferences.contentSimilarityMode ===
            "historical" &&
          smartContentFilter.preferences.contentSimilarityExpiry === 7 &&
          smartContentFilter.preferences.contentSimilarityScope ===
            "across-categories" &&
          smartContentFilter.preferences.similarityTitleWeight === 30 &&
          smartContentFilter.preferences.similarityContentWeight === 40 &&
          smartContentFilter.preferences.similarityEntityWeight === 30
        );
      case "balanced":
        return (
          smartContentFilter.preferences.contentSimilarityThreshold === 70 &&
          smartContentFilter.preferences.contentSimilarityMode === "today" &&
          smartContentFilter.preferences.contentSimilarityScope ===
            "within-category" &&
          smartContentFilter.preferences.similarityTitleWeight === 40 &&
          smartContentFilter.preferences.similarityContentWeight === 25 &&
          smartContentFilter.preferences.similarityEntityWeight === 35
        );
      default:
        return false;
    }
  };

  // Final polish: Enhanced animations and transitions
  const enhancedTransitionClasses =
    "transition-all duration-300 ease-in-out transform";
  const enhancedHoverClasses = "hover:scale-[1.02] hover:shadow-md";
</script>

<!-- Skip Links for Keyboard Navigation -->
<div class="sr-only">
  <a
    href="#main-toggle"
    class="absolute top-4 left-4 z-50 rounded bg-blue-600 px-4 py-2 text-white focus:not-sr-only focus:relative focus:z-auto"
    onclick={(e) => {
      e.preventDefault();
      skipToSection("main-toggle");
    }}
  >
    Skip to main toggle
  </a>
  <a
    href="#filter-sections"
    class="absolute top-4 left-4 z-50 rounded bg-blue-600 px-4 py-2 text-white focus:not-sr-only focus:relative focus:z-auto"
    onclick={(e) => {
      e.preventDefault();
      skipToSection("filter-sections");
    }}
  >
    Skip to filter sections
  </a>
  <a
    href="#system-controls"
    class="absolute top-4 left-4 z-50 rounded bg-blue-600 px-4 py-2 text-white focus:not-sr-only focus:relative focus:z-auto"
    onclick={(e) => {
      e.preventDefault();
      skipToSection("system-controls");
    }}
  >
    Skip to system controls
  </a>
</div>

<!-- Live Region for Screen Reader Announcements -->
<div
  aria-live="polite"
  aria-atomic="true"
  class="sr-only"
  role="status"
  aria-label="Filter setting changes"
>
  {#each announcements as announcement, index (lastAnnouncementId - announcements.length + index + 1)}
    <div>{announcement}</div>
  {/each}
</div>

<!-- Main Content Area with Landmark Role -->
<main
  class="space-y-6 p-4"
  aria-label="Content Filter Settings"
  style="contain: layout;"
>
  <!-- Main Toggle Section -->
  <section id="main-toggle" class="mb-6" aria-labelledby="main-toggle-heading">
    <div class="flex items-center justify-between">
      <div>
        <div class="mb-1 flex items-center gap-2">
          <Icon
            icon="tabler:filter"
            class="h-4 w-4 text-gray-600 dark:text-gray-400"
          />
          <h4
            id="main-toggle-heading"
            class="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {s("settings.contentFilter.enableTitle") || "Content Filtering"}
          </h4>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {s("settings.contentFilter.enableDescription") ||
            "Automatically filter low-quality, irrelevant, or unwanted content using smart analysis"}
        </p>
      </div>

      <!-- Main Toggle Switch -->
      <button
        type="button"
        onclick={() => {
          smartContentFilter.toggleEnabled();
        }}
        class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none {smartContentFilter.isEnabled
          ? 'bg-blue-600'
          : 'bg-gray-200 dark:bg-gray-600'}"
        role="switch"
        aria-checked={smartContentFilter.isEnabled}
        aria-label={smartContentFilter.isEnabled
          ? "Disable content filtering"
          : "Enable content filtering"}
      >
        <span
          class="inline-block h-4 w-4 transform rounded-full bg-white transition {smartContentFilter.isEnabled
            ? 'translate-x-6'
            : 'translate-x-1'}"
        ></span>
      </button>
    </div>
  </section>

  <!-- Presets divider (collapsible) -->
  <button
    type="button"
    class="my-3 flex w-full items-center text-left"
    onclick={() => (showPresets = !showPresets)}
    aria-expanded={showPresets}
    aria-controls="presets-section"
  >
    <div class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
    <span class="px-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {s("settings.contentFilter.presets.parent") || "Presets"}
    </span>
    <Icon
      icon="tabler:chevron-right"
      class="ml-2 h-4 w-4 text-gray-400 transition-transform duration-200 {showPresets ? 'rotate-90' : ''}"
      aria-hidden="true"
    />
    <div class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
  </button>

  {#if showPresets}
  <div id="presets-section">

    <!-- Basic Presets -->
    <div class="mb-6">
    <button
      type="button"
      class="flex w-full items-center justify-between text-left mb-3"
      onclick={() => (showBasicPresets = !showBasicPresets)}
    >
      <div class="flex items-center gap-2">
        <Icon
          icon="tabler:layout-grid"
          class="h-4 w-4 text-gray-600 dark:text-gray-400"
        />
        <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {s("settings.contentFilter.basicPresets.title") || "Basic Presets"}
        </h5>
      </div>
      <Icon
        icon="tabler:chevron-right"
        class="h-4 w-4 text-gray-400 transition-transform duration-200 {showBasicPresets ? 'rotate-90' : ''}"
      />
    </button>
    {#if showBasicPresets}
      <div class={getGridClasses(basicPresets.length)}>
        {#each basicPresets as preset}
          {@const isActive = isPresetActive(preset.id)}
          {@const conflicts = getPresetConflicts(preset.id)}
          {@const canActivate = canActivatePreset(preset.id)}

          <Tooltip
            text={!canActivate && !isActive
              ? getDeactivationReason(preset.id)
              : preset.tooltip}
          >
            <button
              type="button"
              class={getButtonClasses(isActive, canActivate)}
              onclick={() => togglePreset(preset.id)}
              disabled={!canActivate && !isActive}
            >
              <Icon
                icon={preset.icon}
                class="mb-2 h-5 w-5 {isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'}"
              />
              <span class="text-sm font-medium">{preset.label}</span>

              {#if conflicts.length > 0 && !isActive}
                <Icon
                  icon="tabler:alert-circle"
                  class="mt-1 h-3 w-3 text-orange-500"
                />
              {/if}

              {#if isActive}
                <Icon
                  icon="tabler:check-circle"
                  class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
                />
              {/if}
            </button>
          </Tooltip>
        {/each}
      </div>
    {/if}
    </div>
 
    <!-- Specialized Presets -->
    <div class="mb-6">
      <button
        type="button"
        class="flex w-full items-center justify-between text-left mb-3"
        onclick={() => (showSpecializedPresets = !showSpecializedPresets)}
      >
        <div class="flex items-center gap-2">
          <Icon
            icon="tabler:tools"
            class="h-4 w-4 text-gray-600 dark:text-gray-400"
          />
          <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {s("settings.contentFilter.presets.label") || "Specialized Presets"}
          </h5>
        </div>
        <Icon
          icon="tabler:chevron-right"
          class="h-4 w-4 text-gray-400 transition-transform duration-200 {showSpecializedPresets ? 'rotate-90' : ''}"
        />
      </button>
      {#if showSpecializedPresets}
      <div class={getGridClasses(specializedPresets.length)}>
        {#each specializedPresets as preset}
          {@const isActive = isPresetActive(preset.id)}
          {@const conflicts = getPresetConflicts(preset.id)}
          {@const canActivate = canActivatePreset(preset.id)}

          <Tooltip
            text={!canActivate && !isActive
              ? getDeactivationReason(preset.id)
              : preset.tooltip}
          >
            <button
              type="button"
              class={getButtonClasses(isActive, canActivate)}
              onclick={() => togglePreset(preset.id)}
              disabled={!canActivate && !isActive}
            >
              <Icon
                icon={preset.icon}
                class="mb-2 h-5 w-5 {isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'}"
              />
              <span class="text-sm font-medium">{preset.label}</span>

              {#if conflicts.length > 0 && !isActive}
                <Icon
                  icon="tabler:alert-circle"
                  class="mt-1 h-3 w-3 text-orange-500"
                />
              {/if}

              {#if isActive}
                <Icon
                  icon="tabler:check-circle"
                  class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
                />
              {/if}
            </button>
          </Tooltip>
        {/each}
      </div>
      {/if}
    </div>
  </div>
  {/if}
  <!-- Filters divider (collapsible) -->
  <button
    type="button"
    class="my-3 flex w-full items-center text-left"
    onclick={() => (showFilters = !showFilters)}
    aria-expanded={showFilters}
    aria-controls="filters-section"
  >
    <div class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
    <span class="px-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {s("settings.contentFilter.filters.parent") || "Filters"}
    </span>
    <Icon
      icon="tabler:chevron-right"
      class="ml-2 h-4 w-4 text-gray-400 transition-transform duration-200 {showFilters ? 'rotate-90' : ''}"
      aria-hidden="true"
    />
    <div class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
  </button>

  <div id="filters-section" class={showFilters ? '' : 'hidden'}>

    <!-- Content Quality Sub-section -->
    <div class="mb-6">
      <button
        type="button"
        class="flex w-full items-center justify-between text-left mb-3"
        onclick={() => {
          const wasExpanded = showContentQuality;
          showContentQuality = !showContentQuality;
          
          // Track manual actions to prevent auto-expand/collapse interference
          if (wasExpanded && !showContentQuality) {
            // User manually collapsed the section
            manuallyCollapsedContentQuality = true;
          } else if (!wasExpanded && showContentQuality) {
            // User manually expanded the section
            manuallyCollapsedContentQuality = false;
          }
        }}
        aria-expanded={showContentQuality}
        aria-controls="content-quality-section"
      >
        <div class="flex items-center gap-2">
          <Icon
            icon="tabler:shield-check"
            class="h-4 w-4 text-gray-600 dark:text-gray-400"
          />
          <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {s("settings.contentFilter.contentQuality.parent") || "Content Quality"}
          </h5>
          {#if filterGroups["Content Quality"].filters.some((filter) => smartContentFilter.preferences[filter])}
            {@const activeCount = filterGroups["Content Quality"].filters.filter(
              (filter) => smartContentFilter.preferences[filter],
            ).length}
            <span class="text-xs font-medium text-blue-600 dark:text-blue-400">
              ({activeCount}/{filterGroups["Content Quality"].filters.length} active)
            </span>
          {/if}
        </div>
        <Icon
          icon="tabler:chevron-right"
          class="h-4 w-4 text-gray-400 transition-transform duration-200 {showContentQuality ? 'rotate-90' : ''}"
          aria-hidden="true"
        />
      </button>

      {#if showContentQuality}
      <div id="content-quality-section">
        <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
          {s("settings.contentFilter.contentQuality.description") ||
            "Filter content based on quality indicators and editorial standards"}
        </p>

      <div class={getGridClasses(5)}>
        <!-- Low Quality Content Filter -->
        <Tooltip
          text="Filter content with poor writing quality, clickbait, or unreliable sources"
        >
          <button
            type="button"
            class={getFilterButtonClasses(
              smartContentFilter.preferences.filterLowQuality,
            )}
            onclick={(e) =>
              handleFilterClick(e, () =>
                smartContentFilter.togglePreference("filterLowQuality"),
              )}
          >
            <Icon
              icon="tabler:thumb-down"
              class="mb-2 h-5 w-5 {smartContentFilter.preferences
                .filterLowQuality
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'}"
            />
            <span class="text-sm font-medium">Low Quality</span>
            {#if smartContentFilter.preferences.filterLowQuality}
              <Icon
                icon="tabler:check-circle"
                class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
              />
            {/if}
          </button>
        </Tooltip>

        <!-- Promotional Content Filter -->
        <Tooltip
          text="Filter sponsored content, advertisements, and promotional articles"
        >
          <button
            type="button"
            class={getFilterButtonClasses(
              smartContentFilter.preferences.filterPromotional,
            )}
            onclick={() =>
              smartContentFilter.togglePreference("filterPromotional")}
          >
            <Icon
              icon="tabler:ad"
              class="mb-2 h-5 w-5 {smartContentFilter.preferences
                .filterPromotional
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'}"
            />
            <span class="text-sm font-medium">Promotional</span>
            {#if smartContentFilter.preferences.filterPromotional}
              <Icon
                icon="tabler:check-circle"
                class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
              />
            {/if}
          </button>
        </Tooltip>

        <!-- Opinion Pieces Filter -->
        <Tooltip
          text="Filter opinion pieces, editorials, and subjective commentary"
        >
          <button
            type="button"
            class={getFilterButtonClasses(
              smartContentFilter.preferences.filterOpinions,
            )}
            onclick={() =>
              smartContentFilter.togglePreference("filterOpinions")}
          >
            <Icon
              icon="tabler:message-circle"
              class="mb-2 h-5 w-5 {smartContentFilter.preferences.filterOpinions
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'}"
            />
            <span class="text-sm font-medium">Opinions</span>
            {#if smartContentFilter.preferences.filterOpinions}
              <Icon
                icon="tabler:check-circle"
                class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
              />
            {/if}
          </button>
        </Tooltip>

        <!-- Repetitive Content Filter -->
        <Tooltip
          text="Filter duplicate stories and repetitive coverage of the same events"
        >
          <button
            type="button"
            class={getFilterButtonClasses(
              smartContentFilter.preferences.filterRepetitive,
            )}
            onclick={() =>
              smartContentFilter.togglePreference("filterRepetitive")}
          >
            <Icon
              icon="tabler:repeat"
              class="mb-2 h-5 w-5 {smartContentFilter.preferences
                .filterRepetitive
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'}"
            />
            <span class="text-sm font-medium">Repetitive</span>
            {#if smartContentFilter.preferences.filterRepetitive}
              <Icon
                icon="tabler:check-circle"
                class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
              />
            {/if}
          </button>
        </Tooltip>

        <!-- Social Media Drama Filter -->
        <Tooltip
          text="Filter social media controversies, online drama, and viral disputes"
        >
          <button
            type="button"
            class={getFilterButtonClasses(
              smartContentFilter.preferences.filterSocialMediaDrama,
            )}
            onclick={() =>
              smartContentFilter.togglePreference("filterSocialMediaDrama")}
          >
            <!-- Three rotating social media icons -->
            <div
              class="relative mb-2 flex h-5 w-12 items-center justify-center"
            >
              <Icon
                icon="tabler:brand-x"
                class="absolute h-4 w-4 -translate-x-4 -rotate-12 transform {smartContentFilter
                  .preferences.filterSocialMediaDrama
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'}"
              />
              <Icon
                icon="tabler:brand-instagram"
                class="absolute h-4 w-4 rotate-0 transform {smartContentFilter
                  .preferences.filterSocialMediaDrama
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'}"
              />
              <Icon
                icon="tabler:brand-tiktok"
                class="absolute h-4 w-4 translate-x-4 rotate-12 transform {smartContentFilter
                  .preferences.filterSocialMediaDrama
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'}"
              />
            </div>
            <span class="text-sm font-medium">Social Media Drama</span>
            {#if smartContentFilter.preferences.filterSocialMediaDrama}
              <Icon
                icon="tabler:check-circle"
                class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
              />
            {/if}
          </button>
        </Tooltip>
        </div>
      </div>
      {/if}
    </div>

    <!-- Topics & Subjects Sub-section -->
    <div class="mb-6">
      <button
        type="button"
        class="flex w-full items-center justify-between text-left mb-3"
        onclick={() => {
          const wasExpanded = showTopicsSubjects;
          showTopicsSubjects = !showTopicsSubjects;
          
          // Track manual actions to prevent auto-expand/collapse interference
          if (wasExpanded && !showTopicsSubjects) {
            // User manually collapsed the section
            manuallyCollapsedTopicsSubjects = true;
          } else if (!wasExpanded && showTopicsSubjects) {
            // User manually expanded the section
            manuallyCollapsedTopicsSubjects = false;
          }
        }}
        aria-expanded={showTopicsSubjects}
        aria-controls="topics-subjects-section"
      >
        <div class="flex items-center gap-2">
          <Icon
            icon="tabler:tags"
            class="h-4 w-4 text-gray-600 dark:text-gray-400"
          />
          <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {s("settings.contentFilter.topicsSubjects.parent") || "Topics & Subjects"}
          </h5>
          {#if filterGroups["Topics & Subjects"].filters.some((filter) => smartContentFilter.preferences[filter])}
            {@const activeCount = filterGroups[
              "Topics & Subjects"
            ].filters.filter(
              (filter) => smartContentFilter.preferences[filter],
            ).length}
            <span class="text-xs font-medium text-blue-600 dark:text-blue-400">
              ({activeCount}/{filterGroups["Topics & Subjects"].filters.length} active)
            </span>
          {/if}
        </div>
        <Icon
          icon="tabler:chevron-right"
          class="h-4 w-4 text-gray-400 transition-transform duration-200 {showTopicsSubjects ? 'rotate-90' : ''}"
          aria-hidden="true"
        />
      </button>
      
      {#if showTopicsSubjects}
      <div id="topics-subjects-section">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {s("settings.contentFilter.topicsSubjects.description") ||
            "Filter content based on specific topics and subject areas"}
        </p>

        <div class={getGridClasses(7)}>
        <!-- Politics Filter -->
        <Tooltip text="Political news, elections, government affairs">
          <button
            type="button"
            class={getFilterButtonClasses(
              smartContentFilter.preferences.filterPolitics,
            )}
            onclick={(e) =>
              handleFilterClick(e, () =>
                smartContentFilter.togglePreference("filterPolitics"),
              )}
          >
            <Icon
              icon="heroicons:megaphone"
              class="mb-2 h-5 w-5 {smartContentFilter.preferences.filterPolitics
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'}"
            />
            <span class="text-sm font-medium">Politics</span>
            {#if smartContentFilter.preferences.filterPolitics}
              <Icon
                icon="tabler:check-circle"
                class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
              />
            {/if}
          </button>
        </Tooltip>

        <!-- Sports Filter -->
        <Tooltip text="Sports news, games, athlete updates">
          <button
            type="button"
            class={getFilterButtonClasses(
              smartContentFilter.preferences.filterSports,
            )}
            onclick={(e) =>
              handleFilterClick(e, () =>
                smartContentFilter.togglePreference("filterSports"),
              )}
          >
            <Icon
              icon="tabler:ball-football"
              class="mb-2 h-5 w-5 {smartContentFilter.preferences.filterSports
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'}"
            />
            <span class="text-sm font-medium">Sports</span>
            {#if smartContentFilter.preferences.filterSports}
              <Icon
                icon="tabler:check-circle"
                class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
              />
            {/if}
          </button>
        </Tooltip>

        <!-- Financial Filter -->
        <Tooltip text="Market news, business updates, economic reports">
          <button
            type="button"
            class={getFilterButtonClasses(
              smartContentFilter.preferences.filterFinancial,
            )}
            onclick={(e) =>
              handleFilterClick(e, () =>
                smartContentFilter.togglePreference("filterFinancial"),
              )}
          >
            <Icon
              icon="tabler:chart-line"
              class="mb-2 h-5 w-5 {smartContentFilter.preferences
                .filterFinancial
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'}"
            />
            <span class="text-sm font-medium">Financial</span>
            {#if smartContentFilter.preferences.filterFinancial}
              <Icon
                icon="tabler:check-circle"
                class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
              />
            {/if}
          </button>
        </Tooltip>

        <!-- Technology Filter -->
        <Tooltip text="Tech news, gadgets, software updates">
          <button
            type="button"
            class={getFilterButtonClasses(
              smartContentFilter.preferences.filterTechnology,
            )}
            onclick={(e) =>
              handleFilterClick(e, () =>
                smartContentFilter.togglePreference("filterTechnology"),
              )}
          >
            <Icon
              icon="tabler:device-laptop"
              class="mb-2 h-5 w-5 {smartContentFilter.preferences
                .filterTechnology
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'}"
            />
            <span class="text-sm font-medium">Technology</span>
            {#if smartContentFilter.preferences.filterTechnology}
              <Icon
                icon="tabler:check-circle"
                class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
              />
            {/if}
          </button>
        </Tooltip>

        <!-- Entertainment Filter -->
        <Tooltip text="Movies, TV shows, music, pop culture">
          <button
            type="button"
            class={getFilterButtonClasses(
              smartContentFilter.preferences.filterEntertainment,
            )}
            onclick={(e) =>
              handleFilterClick(e, () =>
                smartContentFilter.togglePreference("filterEntertainment"),
              )}
          >
            <Icon
              icon="tabler:movie"
              class="mb-2 h-5 w-5 {smartContentFilter.preferences
                .filterEntertainment
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'}"
            />
            <span class="text-sm font-medium">Entertainment</span>
            {#if smartContentFilter.preferences.filterEntertainment}
              <Icon
                icon="tabler:check-circle"
                class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
              />
            {/if}
          </button>
        </Tooltip>

        <!-- Celebrity Filter -->
        <Tooltip text="Celebrity news, gossip, personal lives">
          <button
            type="button"
            class={getFilterButtonClasses(
              smartContentFilter.preferences.filterCelebrity,
            )}
            onclick={(e) =>
              handleFilterClick(e, () =>
                smartContentFilter.togglePreference("filterCelebrity"),
              )}
          >
            <Icon
              icon="tabler:star"
              class="mb-2 h-5 w-5 {smartContentFilter.preferences
                .filterCelebrity
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'}"
            />
            <span class="text-sm font-medium">Celebrity</span>
            {#if smartContentFilter.preferences.filterCelebrity}
              <Icon
                icon="tabler:check-circle"
                class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
              />
            {/if}
          </button>
        </Tooltip>

        <!-- Weather Filter -->
        <Tooltip text="Weather reports, forecasts, climate updates">
          <button
            type="button"
            class={getFilterButtonClasses(
              smartContentFilter.preferences.filterWeather,
            )}
            onclick={(e) =>
              handleFilterClick(e, () =>
                smartContentFilter.togglePreference("filterWeather"),
              )}
          >
            <Icon
              icon="tabler:cloud"
              class="mb-2 h-5 w-5 {smartContentFilter.preferences.filterWeather
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'}"
            />
            <span class="text-sm font-medium">Weather</span>
            {#if smartContentFilter.preferences.filterWeather}
              <Icon
                icon="tabler:check-circle"
                class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
              />
            {/if}
          </button>
        </Tooltip>
        </div>
      </div>
      {/if}
    </div>

    <!-- News Types Sub-section -->
    <div class="mb-6">
      <button
        type="button"
        class="flex w-full items-center justify-between text-left mb-3"
        onclick={() => {
          const wasExpanded = showNewsTypes;
          showNewsTypes = !showNewsTypes;
          
          // Track manual actions to prevent auto-expand/collapse interference
          if (wasExpanded && !showNewsTypes) {
            // User manually collapsed the section
            manuallyCollapsedNewsTypes = true;
          } else if (!wasExpanded && showNewsTypes) {
            // User manually expanded the section
            manuallyCollapsedNewsTypes = false;
          }
        }}
        aria-expanded={showNewsTypes}
        aria-controls="news-types-section"
      >
        <div class="flex items-center gap-2">
          <Icon
            icon="tabler:news"
            class="h-4 w-4 text-gray-600 dark:text-gray-400"
          />
          <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {s("settings.contentFilter.newsTypes.parent") || "News Types"}
          </h5>
          <!-- Active count indicator -->
          {#if hasNewsTypesFilters}
            {@const activeCount = filterGroups["News Types"].filters.filter(
              (filter) => smartContentFilter.preferences[filter],
            ).length}
            <span class="text-xs font-medium text-blue-600 dark:text-blue-400">
              ({activeCount}/{filterGroups["News Types"].filters.length} active)
            </span>
          {/if}
        </div>
        <Icon
          icon="tabler:chevron-right"
          class="h-4 w-4 text-gray-400 transition-transform duration-200 {showNewsTypes ? 'rotate-90' : ''}"
          aria-hidden="true"
        />
      </button>
      
      {#if showNewsTypes}
      <div id="news-types-section">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {s("settings.contentFilter.newsTypes.description") ||
            "Filter content based on news format and delivery style"}
        </p>

        <div class={getGridClasses(3)}>
          <!-- Breaking News Filter -->
          <Tooltip
            text="Urgent alerts, breaking news notifications, live updates"
          >
            <button
              type="button"
              class={getFilterButtonClasses(
                smartContentFilter.preferences.filterBreakingNews,
              )}
              onclick={(e) => handleFilterClick(e, () => smartContentFilter.togglePreference("filterBreakingNews"))}
            >
              <Icon
                icon="tabler:urgent"
                class="mb-2 h-5 w-5 {smartContentFilter.preferences
                  .filterBreakingNews
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'}"
              />
              <span class="text-sm font-medium">Breaking News</span>
              {#if smartContentFilter.preferences.filterBreakingNews}
                <Icon
                  icon="tabler:check-circle"
                  class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
                />
              {/if}
            </button>
          </Tooltip>

          <!-- Local News Filter -->
          <Tooltip
            text="Hyper-local stories, community events, regional coverage"
          >
            <button
              type="button"
              class={getFilterButtonClasses(
                smartContentFilter.preferences.filterLocalNews,
              )}
              onclick={(e) => handleFilterClick(e, () => smartContentFilter.togglePreference("filterLocalNews"))}
            >
              <Icon
                icon="tabler:map-pin"
                class="mb-2 h-5 w-5 {smartContentFilter.preferences
                  .filterLocalNews
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'}"
              />
              <span class="text-sm font-medium">Local News</span>
              {#if smartContentFilter.preferences.filterLocalNews}
                <Icon
                  icon="tabler:check-circle"
                  class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
                />
              {/if}
            </button>
          </Tooltip>

          <!-- International News Filter -->
          <Tooltip text="Global events, foreign affairs, international coverage">
            <button
              type="button"
              class={getFilterButtonClasses(
                smartContentFilter.preferences.filterInternationalNews,
              )}
              onclick={(e) => handleFilterClick(e, () => smartContentFilter.togglePreference("filterInternationalNews"))}
            >
              <Icon
                icon="tabler:globe"
                class="mb-2 h-5 w-5 {smartContentFilter.preferences
                  .filterInternationalNews
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'}"
              />
              <span class="text-sm font-medium">International News</span>
              {#if smartContentFilter.preferences.filterInternationalNews}
                <Icon
                  icon="tabler:check-circle"
                  class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
                />
              {/if}
            </button>
          </Tooltip>
        </div>
      </div>
      {/if}
    </div>

    <!-- Wellness & Mental Health Sub-section -->
    <div class="mb-6">
      <button
        type="button"
        class="flex w-full items-center justify-between text-left mb-3"
        onclick={() => {
          const wasExpanded = showWellnessMental;
          showWellnessMental = !showWellnessMental;
          
          // Track manual actions to prevent auto-expand/collapse interference
          if (wasExpanded && !showWellnessMental) {
            // User manually collapsed the section
            manuallyCollapsedWellnessMental = true;
          } else if (!wasExpanded && showWellnessMental) {
            // User manually expanded the section
            manuallyCollapsedWellnessMental = false;
          }
        }}
        aria-expanded={showWellnessMental}
        aria-controls="wellness-mental-section"
      >
        <div class="flex items-center gap-2">
          <Icon
            icon="tabler:brain"
            class="h-4 w-4 text-gray-600 dark:text-gray-400"
          />
          <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {s("settings.contentFilter.wellnessMental.parent") || "Wellness & Mental Health"}
          </h5>
          <!-- Active count indicator -->
          {#if hasWellnessFilters}
            {@const activeCount = filterGroups["Wellness & Mental Health"].filters.filter(
              (filter) => smartContentFilter.preferences[filter],
            ).length}
            <span class="text-xs font-medium text-blue-600 dark:text-blue-400">
              ({activeCount}/{filterGroups["Wellness & Mental Health"].filters.length} active)
            </span>
          {/if}
        </div>
        <Icon
          icon="tabler:chevron-right"
          class="h-4 w-4 text-gray-400 transition-transform duration-200 {showWellnessMental ? 'rotate-90' : ''}"
          aria-hidden="true"
        />
      </button>
      
      {#if showWellnessMental}
      <div id="wellness-mental-section">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {s("settings.contentFilter.wellnessMental.description") ||
            "Filter content that may negatively impact mental health and well-being"}
        </p>

        <div class={getGridClasses(4)}>
          <!-- Negative News Filter -->
          <Tooltip
            text="Stories with predominantly negative sentiment and pessimistic outlook"
          >
            <button
              type="button"
              class={getFilterButtonClasses(
                smartContentFilter.preferences.filterNegativeNews,
              )}
              onclick={(e) =>
                handleFilterClick(e, () =>
                  smartContentFilter.togglePreference("filterNegativeNews"),
                )}
            >
              <Icon
                icon="tabler:mood-sad"
                class="mb-2 h-5 w-5 {smartContentFilter.preferences
                  .filterNegativeNews
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'}"
              />
              <span class="text-sm font-medium">Negative News</span>
              {#if smartContentFilter.preferences.filterNegativeNews}
                <Icon
                  icon="tabler:check-circle"
                  class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
                />
              {/if}
            </button>
          </Tooltip>

          <!-- Violence Filter -->
          <Tooltip
            text="Content involving physical harm, conflict, and disturbing imagery"
          >
            <button
              type="button"
              class={getFilterButtonClasses(
                smartContentFilter.preferences.filterViolence,
              )}
              onclick={(e) =>
                handleFilterClick(e, () =>
                  smartContentFilter.togglePreference("filterViolence"),
                )}
            >
              <Icon
                icon="emojione-monotone:raised-fist"
                class="mb-2 h-5 w-5 {smartContentFilter.preferences
                  .filterViolence
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'}"
              />
              <span class="text-sm font-medium">Violence</span>
              {#if smartContentFilter.preferences.filterViolence}
                <Icon
                  icon="tabler:check-circle"
                  class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
                />
              {/if}
            </button>
          </Tooltip>

          <!-- Anxiety-Inducing Content Filter -->
          <Tooltip
            text="Content that may trigger stress, worry, or anxiety responses"
          >
            <button
              type="button"
              class={getFilterButtonClasses(
                smartContentFilter.preferences.filterAnxietyInducing,
              )}
              onclick={(e) =>
                handleFilterClick(e, () =>
                  smartContentFilter.togglePreference("filterAnxietyInducing"),
                )}
            >
              <Icon
                icon="fluent-emoji-high-contrast:fearful-face"
                class="mb-2 h-5 w-5 {smartContentFilter.preferences
                  .filterAnxietyInducing
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'}"
              />
              <span class="text-sm font-medium">Anxiety-Inducing</span>
              {#if smartContentFilter.preferences.filterAnxietyInducing}
                <Icon
                  icon="tabler:check-circle"
                  class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
                />
              {/if}
            </button>
          </Tooltip>

          <!-- Economic Pessimism Filter -->
          <Tooltip
            text="Doom-and-gloom economic forecasts and financial fear-mongering"
          >
            <button
              type="button"
              class={getFilterButtonClasses(
                smartContentFilter.preferences.filterEconomicPessimism,
              )}
              onclick={(e) =>
                handleFilterClick(e, () =>
                  smartContentFilter.togglePreference("filterEconomicPessimism"),
                )}
            >
              <Icon
                icon="tabler:trending-down"
                class="mb-2 h-5 w-5 {smartContentFilter.preferences
                  .filterEconomicPessimism
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'}"
              />
              <span class="text-sm font-medium">Economic Pessimism</span>
              {#if smartContentFilter.preferences.filterEconomicPessimism}
                <Icon
                  icon="tabler:check-circle"
                  class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
                />
              {/if}
            </button>
          </Tooltip>
        </div>
      </div>
      {/if}
    </div>

    <!-- Custom Keywords Sub-section -->
    <div class="mb-6">
      <button
        type="button"
        class="flex w-full items-center justify-between text-left mb-3"
        onclick={() => {
          const wasExpanded = showCustomKeywords;
          showCustomKeywords = !showCustomKeywords;
          
          // Track manual actions to prevent auto-expand/collapse interference
          if (wasExpanded && !showCustomKeywords) {
            // User manually collapsed the section
            manuallyCollapsedCustomKeywords = true;
          } else if (!wasExpanded && showCustomKeywords) {
            // User manually expanded the section
            manuallyCollapsedCustomKeywords = false;
          }
        }}
        aria-expanded={showCustomKeywords}
        aria-controls="custom-keywords-section"
      >
        <div class="flex items-center gap-2">
          <Icon
            icon="tabler:key"
            class="h-4 w-4 text-gray-600 dark:text-gray-400"
          />
          <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {s("settings.contentFilter.customKeywords.parent") || "Custom Keywords"}
          </h5>
          <!-- Active count indicator -->
          {#if hasCustomKeywordsFilters}
            <span class="text-xs font-medium text-blue-600 dark:text-blue-400">
              ({smartContentFilter.customKeywords.length} active)
            </span>
          {/if}
        </div>
        <Icon
          icon="tabler:chevron-right"
          class="h-4 w-4 text-gray-400 transition-transform duration-200 {showCustomKeywords ? 'rotate-90' : ''}"
          aria-hidden="true"
        />
      </button>
      
      {#if showCustomKeywords}
      <div id="custom-keywords-section">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {s("settings.contentFilter.customKeywords.description") ||
            "Add custom keywords to filter content containing specific terms or phrases"}
        </p>

        <!-- Add Single Keyword -->
        <div class="mb-4">
          <label
            for="new-keyword-input"
            class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {s("settings.contentFilter.customKeywords.add") || "Add Keywords"}
          </label>
          <div class="flex gap-2">
            <input
              id="new-keyword-input"
              type="text"
              bind:value={newKeywordInput}
              placeholder={s(
                "settings.contentFilter.customKeywords.placeholder",
              ) || "Enter keyword or keywords separated by commas..."}
              class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-blue-400 dark:focus:ring-blue-400"
              onkeydown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomKeyword();
                }
              }}
            />
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-800"
              onclick={addCustomKeyword}
              disabled={!newKeywordInput.trim()}
            >
              <Icon icon="tabler:plus" class="h-4 w-4" />
              <span
                >{s("settings.contentFilter.customKeywords.add") ||
                  "Add"}</span
              >
            </button>
          </div>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {s("settings.contentFilter.customKeywords.help") ||
              "Enter a single keyword or multiple keywords separated by commas. Duplicates will be ignored."}
          </p>
        </div>

        <!-- Current Keywords Display -->
        {#if smartContentFilter.customKeywords.length > 0}
          <div class="mb-4">
            <div class="mb-3 flex items-center justify-between">
              <div
                class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {s("settings.contentFilter.customKeywords.current") ||
                  "Current Keywords"} ({smartContentFilter.customKeywords
                  .length})
              </div>
              <button
                type="button"
                class="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                onclick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  clearAllCustomKeywords();
                }}
              >
                {s("settings.contentFilter.customKeywords.clearAll") ||
                  "Clear All"}
              </button>
            </div>
            <div class="flex flex-wrap gap-2">
              {#each smartContentFilter.customKeywords as keyword}
                <div
                  class="group flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm dark:bg-gray-700/50"
                >
                  <Icon
                    icon="tabler:tag"
                    class="mr-2 h-4 w-4 text-gray-600 opacity-80 dark:text-gray-400"
                  />
                  <span class="text-gray-800 dark:text-gray-200"
                    >{keyword}</span
                  >
                  <button
                    type="button"
                    class="ml-2 text-gray-600 opacity-75 hover:text-gray-800 hover:opacity-100 dark:text-gray-400 dark:hover:text-gray-200"
                    onclick={() => removeCustomKeyword(keyword)}
                    aria-label={`Remove keyword: ${keyword}`}
                  >
                    <Icon icon="tabler:x" class="h-3 w-3" />
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <div
            class="rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-700/50"
          >
            <Icon
              icon="tabler:tag-off"
              class="mx-auto mb-2 h-8 w-8 text-gray-400"
            />
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {s("settings.contentFilter.customKeywords.empty") ||
                "No custom keywords added yet"}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {s("settings.contentFilter.customKeywords.emptyHelp") ||
                "Add keywords above to filter content containing specific terms"}
            </p>
          </div>
        {/if}
      </div>
      {/if}
    </div>

      </div>



      <!-- Filter Scope & Mode Top-Level Divider -->
      <button
        type="button"
        class="my-3 flex w-full items-center text-left"
        onclick={() => (showFilterScopeMode = !showFilterScopeMode)}
        aria-expanded={showFilterScopeMode}
        aria-controls="filter-scope-mode-section"
      >
        <div class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
        <span class="px-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {s("settings.contentFilter.filterMode") || "Filter Mode"}
        </span>
        <Icon
          icon="tabler:chevron-right"
          class="ml-2 h-4 w-4 text-gray-400 transition-transform duration-200 {showFilterScopeMode ? 'rotate-90' : ''}"
          aria-hidden="true"
        />
        <div class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
      </button>

      {#if showFilterScopeMode}
      <div id="filter-scope-mode-section">
        <!-- Filter Scope Sub-Section -->
        <div class="mb-6">
          <button
            type="button"
            class="flex w-full items-center justify-between text-left mb-3"
            onclick={() => {
              const wasExpanded = showFilterScope;
              showFilterScope = !showFilterScope;
              
              if (wasExpanded && !showFilterScope) {
                manuallyCollapsedFilterScope = true;
              } else if (!wasExpanded && showFilterScope) {
                manuallyCollapsedFilterScope = false;
              }
            }}
            aria-expanded={showFilterScope}
            aria-controls="filter-scope-content"
          >
            <div class="flex items-center gap-2">
              <Icon
                icon="tabler:target"
                class="h-4 w-4 text-gray-600 dark:text-gray-400"
              />
              <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {s("settings.contentFilter.filterScope.parent") || "Filter Scope"}
              </h5>
              {#if hasFilterScopeFilters}
                <span class="text-xs font-medium text-blue-600 dark:text-blue-400">
                  (Custom settings active)
                </span>
              {/if}
            </div>
            <Icon
              icon="tabler:chevron-right"
              class="h-4 w-4 text-gray-400 transition-transform duration-200 {showFilterScope ? 'rotate-90' : ''}"
              aria-hidden="true"
            />
          </button>
          
          {#if showFilterScope}
          <div id="filter-scope-content">
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {s("settings.contentFilter.filterScope.description") ||
                "Configure how and where filters are applied"}
            </p>

            <div class="space-y-6">
            <!-- Filter Scope Selection -->
            <div>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  class="flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors {smartContentFilter.filterScope ===
                  'title'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
                  onclick={(e) => handleFilterClick(e, () => smartContentFilter.setFilterScope("title"))}
                >
                  <Icon icon="tabler:heading" class="h-4 w-4" />
                  <span
                    >{s("settings.contentFilter.filterScope.title") ||
                      "Title Only"}</span
                  >
                </button>
                <button
                  type="button"
                  class="flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors {smartContentFilter.filterScope ===
                  'summary'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
                  onclick={(e) => handleFilterClick(e, () => smartContentFilter.setFilterScope("summary"))}
                >
                  <Icon icon="tabler:file-text" class="h-4 w-4" />
                  <span
                    >{s("settings.contentFilter.filterScope.summary") ||
                      "Summary"}</span
                  >
                </button>
                <button
                  type="button"
                  class="flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors {smartContentFilter.filterScope ===
                  'all'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
                  onclick={(e) => handleFilterClick(e, () => smartContentFilter.setFilterScope("all"))}
                >
                  <Icon icon="tabler:file-description" class="h-4 w-4" />
                  <span
                    >{s("settings.contentFilter.filterScope.all") ||
                      "All Content"}</span
                  >
                </button>
              </div>
              <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {#if smartContentFilter.filterScope === "title"}
                  {s("settings.contentFilter.filterScope.title.help") ||
                    "Only analyze article titles for filtering decisions. Fastest but least comprehensive."}
                {:else if smartContentFilter.filterScope === "summary"}
                  {s("settings.contentFilter.filterScope.summary.help") ||
                    "Analyze titles and summaries. Good balance of speed and accuracy."}
                {:else}
                  {s("settings.contentFilter.filterScope.all.help") ||
                    "Analyze all available content including full articles. Most comprehensive but slower."}
                {/if}
      </div>
      </div>

            <!-- Filter Mode Selection -->
            <div>
              <!-- Collapsed divider already labels this as Filter Mode; keep description only -->
              <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
                {s("settings.contentFilter.filterMode.description") ||
                  "Controls how filtered content appears in your feed"}
              </p>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  class="flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors {smartContentFilter.filterMode ===
                  'hide'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
                  onclick={(e) => handleFilterClick(e, () => smartContentFilter.setFilterMode("hide"))}
                >
                  <Icon icon="tabler:eye-off" class="h-4 w-4" />
                  <span
                    >{s("settings.contentFilter.filterMode.hide") ||
                      "Hide"}</span
                  >
                </button>
                <button
                  type="button"
                  class="flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors {smartContentFilter.filterMode ===
                  'blur'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
                  onclick={(e) => handleFilterClick(e, () => smartContentFilter.setFilterMode("blur"))}
                >
                  <Icon icon="tabler:blur" class="h-4 w-4" />
                  <span
                    >{s("settings.contentFilter.filterMode.blur") ||
                      "Blur"}</span
                  >
                </button>
              </div>
              <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {#if smartContentFilter.filterMode === "hide"}
                  {s("settings.contentFilter.filterMode.hide.help") ||
                    "Completely remove filtered content from your feed. Clean but you won't see what was filtered."}
                {:else}
                  {s("settings.contentFilter.filterMode.blur.help") ||
                    "Show filtered content with a blur effect. You can still access it if needed."}
                {/if}
      </div>
      </div>

            <!-- Show Filtered Count Toggle -->
            <div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Icon
                    icon="tabler:numbers"
                    class="h-4 w-4 text-gray-500 dark:text-gray-400"
                  />
                  <span
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {s("settings.contentFilter.showFilteredCount") ||
                      "Show Filtered Count"}
                  </span>
                  <Tooltip
                    text={s(
                      "settings.contentFilter.showFilteredCount.tooltip",
                    ) ||
                      "Display the number of stories that have been filtered out"}
                    position="top"
                  >
                    <Icon
                      icon="tabler:info-circle"
                      class="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    />
                  </Tooltip>
                </div>
                <button
                  type="button"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none {smartContentFilter.showFilteredCount
                    ? 'bg-blue-600'
                    : 'bg-gray-200 dark:bg-gray-600'}"
                  onclick={() =>
                    smartContentFilter.setShowFilteredCount(
                      !smartContentFilter.showFilteredCount,
                    )}
                  aria-checked={smartContentFilter.showFilteredCount}
                  role="switch"
                >
                  <span class="sr-only">Show filtered count</span>
                  <span
                    class="inline-block h-4 w-4 transform rounded-full bg-white transition {smartContentFilter.showFilteredCount
                      ? 'translate-x-6'
                      : 'translate-x-1'}"
                  ></span>
                </button>
              </div>
              <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {s("settings.contentFilter.showFilteredCount.description") ||
                  "When enabled, displays how many stories were filtered from each category"}
              </p>
            </div>

            <!-- Global Filter Sensitivity -->
            <div>
              <div class="mb-3 flex items-center gap-2">
                <Icon
                  icon="tabler:adjustments"
                  class="h-4 w-4 text-gray-500 dark:text-gray-400"
                />
                <span
                  class="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {s("settings.contentFilter.globalSensitivity") ||
                    "Global Filter Sensitivity"}
                </span>
                <Tooltip
                  text={s("settings.contentFilter.globalSensitivity.tooltip") ||
                    "Controls how aggressively filters are applied across all categories"}
                  position="top"
                >
                  <Icon
                    icon="tabler:info-circle"
                    class="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  />
                </Tooltip>
              </div>
              <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
                {s("settings.contentFilter.globalSensitivity.description") ||
                  "Adjusts the default sensitivity level for all content filters"}
              </p>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  class="flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors {smartContentFilter
                    .preferences.filterSensitivity === 'loose'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
                  onclick={(e) => handleFilterClick(e, () =>
                    smartContentFilter.setFilterSensitivity("loose"))}
                >
                  <Icon icon="tabler:feather" class="h-4 w-4" />
                  <span
                    >{s("settings.contentFilter.sensitivity.loose") ||
                      "Loose"}</span
                  >
                </button>
                <button
                  type="button"
                  class="flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors {smartContentFilter
                    .preferences.filterSensitivity === 'balanced'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
                  onclick={(e) => handleFilterClick(e, () =>
                    smartContentFilter.setFilterSensitivity("balanced"))}
                >
                  <Icon icon="tabler:weight" class="h-4 w-4" />
                  <span
                    >{s("settings.contentFilter.sensitivity.balanced") ||
                      "Balanced"}</span
                  >
                </button>
                <button
                  type="button"
                  class="flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors {smartContentFilter
                    .preferences.filterSensitivity === 'strict'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
                  onclick={(e) => handleFilterClick(e, () =>
                    smartContentFilter.setFilterSensitivity("strict"))}
                >
                  <Icon icon="tabler:shield" class="h-4 w-4" />
                  <span
                    >{s("settings.contentFilter.sensitivity.strict") ||
                      "Strict"}</span
                  >
                </button>
              </div>
              <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {#if smartContentFilter.preferences.filterSensitivity === "loose"}
                  {s("settings.contentFilter.sensitivity.loose.help") ||
                    "More permissive filtering. Only removes clearly unwanted content."}
                {:else if smartContentFilter.preferences.filterSensitivity === "balanced"}
                  {s("settings.contentFilter.sensitivity.balanced.help") ||
                    "Moderate filtering that balances content variety with quality."}
                {:else}
                  {s("settings.contentFilter.sensitivity.strict.help") ||
                    "Aggressive filtering for maximum content quality and relevance."}
                {/if}
            </div>
          </div>
            </div>
          </div>
          {/if}
        </div>

        <!-- Content Similarity Detection Sub-Section -->
        <div class="mb-6">
          <button
            type="button"
            class="flex w-full items-center justify-between text-left mb-3"
            onclick={() => {
              const wasExpanded = showAdvancedSimilarity;
              showAdvancedSimilarity = !showAdvancedSimilarity;
              
              if (wasExpanded && !showAdvancedSimilarity) {
                manuallyCollapsedAdvancedSimilarity = true;
              } else if (!wasExpanded && showAdvancedSimilarity) {
                manuallyCollapsedAdvancedSimilarity = false;
              }
            }}
            aria-expanded={showAdvancedSimilarity}
            aria-controls="advanced-similarity-content"
          >
            <div class="flex items-center gap-2">
              <Icon
                icon="tabler:copy"
                class="h-4 w-4 text-gray-600 dark:text-gray-400"
              />
              <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {s("settings.contentFilter.contentSimilarity") || "Content Similarity Detection"}
              </h5>
              {#if hasAdvancedSimilarityFilters}
                <span class="text-xs font-medium text-blue-600 dark:text-blue-400">
                  (Similarity detection active)
                </span>
              {/if}
            </div>
            <Icon
              icon="tabler:chevron-right"
              class="h-4 w-4 text-gray-400 transition-transform duration-200 {showAdvancedSimilarity ? 'rotate-90' : ''}"
              aria-hidden="true"
            />
          </button>
          
          {#if showAdvancedSimilarity}
          <div id="advanced-similarity-content">
            

          <!-- Main Content Similarity Toggle -->
          <div class="mb-6">
            <div class="flex items-center justify-between">
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {s("settings.contentFilter.advancedSimilarity.description") ||
                  "Detect and filter duplicate or highly similar content using advanced algorithms. Fine-tune how similarity is calculated and when content should be considered duplicates."}
              </p>

              <!-- Content Similarity Toggle Switch -->
              <button
                type="button"
                onclick={() => {
                  smartContentFilter.togglePreference(
                    "filterContentSimilarity",
                  );
                }}
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none {smartContentFilter
                  .preferences.filterContentSimilarity
                  ? 'bg-blue-600'
                  : 'bg-gray-200 dark:bg-gray-600'}"
                role="switch"
                aria-checked={smartContentFilter.preferences
                  .filterContentSimilarity}
                aria-label={smartContentFilter.preferences
                  .filterContentSimilarity
                  ? "Disable content similarity detection"
                  : "Enable content similarity detection"}
              >
                <span
                  class="inline-block h-4 w-4 transform rounded-full bg-white transition {smartContentFilter
                    .preferences.filterContentSimilarity
                    ? 'translate-x-6'
                    : 'translate-x-1'}"
                ></span>
              </button>
      </div>
      </div>
          <!-- Similarity Threshold Slider -->
          <div class="mb-6">
            <div class="mb-3 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Icon
                  icon="tabler:adjustments-horizontal"
                  class="h-4 w-4 text-gray-600 dark:text-gray-400"
                />
                <span
                  class="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {s("settings.contentFilter.similarityThreshold") ||
                    "Similarity Threshold"}
                </span>
              </div>
              <span class="text-sm text-gray-600 dark:text-gray-400">
                {smartContentFilter.preferences.contentSimilarityThreshold}%
              </span>
            </div>
            <div class="relative">
              <input
                type="range"
                min="10"
                max="95"
                step="5"
                bind:value={
                  smartContentFilter.preferences.contentSimilarityThreshold
                }
                oninput={createSafeAction((e) =>
                  smartContentFilter.setContentSimilarityThreshold(
                    parseInt((e.target as HTMLInputElement).value),
                  ))}
                class="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
              />
              <div
                class="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400"
              >
                <span>10% (Very Loose)</span>
                <span>50% (Balanced)</span>
                <span>95% (Very Strict)</span>
      </div>
      </div>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {s("settings.contentFilter.similarityThreshold.help") ||
                "Higher values require more similarity to filter content. Lower values catch more duplicates but may filter unique stories."}
            </p>
          </div>

          <!-- Detection Mode Selection -->
          <div class="mb-6">
            <div class="mb-3 flex items-center gap-2">
              <Icon
                icon="tabler:radar"
                class="h-4 w-4 text-gray-600 dark:text-gray-400"
              />
              <span
                class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {s("settings.contentFilter.detectionMode") || "Detection Mode"}
              </span>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                class="flex items-center justify-between rounded-lg border p-4 text-left transition-all duration-200 {smartContentFilter
                  .preferences.contentSimilarityMode === 'today'
                  ? 'border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-100'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-600'}"
                onclick={createSafeAction(() =>
                  smartContentFilter.setContentSimilarityMode("today"))}
              >
                <div class="flex items-center gap-3">
                  <Icon
                    icon="mdi:calendar-today-outline"
                    class="h-5 w-5 {smartContentFilter.preferences
                      .contentSimilarityMode === 'today'
                      ? 'text-gray-700 opacity-100 dark:text-gray-300'
                      : 'text-gray-500 opacity-75 dark:text-gray-400'}"
                  />
                  <div>
                    <div class="text-sm font-medium">
                      {s("settings.contentFilter.detectionMode.today") ||
                        "Today Only"}
                    </div>
                    <div
                      class="text-xs {smartContentFilter.preferences
                        .contentSimilarityMode === 'today'
                        ? 'text-gray-700 dark:text-gray-300'
                        : 'text-gray-500 dark:text-gray-400'}"
                    >
                      {s(
                        "settings.contentFilter.detectionMode.today.description",
                      ) || "Compare only with stories from today"}
      </div>
      </div>
                </div>
                {#if smartContentFilter.preferences.contentSimilarityMode === "today"}
                  <Icon
                    icon="tabler:check-circle"
                    class="h-5 w-5 text-gray-700 opacity-90 dark:text-gray-300"
                  />
                {/if}
              </button>

              <button
                type="button"
                class="flex items-center justify-between rounded-lg border p-4 text-left transition-all duration-200 {smartContentFilter
                  .preferences.contentSimilarityMode === 'historical'
                  ? 'border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-100'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-600'}"
                onclick={createSafeAction(() =>
                  smartContentFilter.setContentSimilarityMode("historical"))}
              >
                <div class="flex items-center gap-3">
                  <Icon
                    icon="tabler:history"
                    class="h-5 w-5 {smartContentFilter.preferences
                      .contentSimilarityMode === 'historical'
                      ? 'text-gray-700 opacity-100 dark:text-gray-300'
                      : 'text-gray-500 opacity-75 dark:text-gray-400'}"
                  />
                  <div>
                    <div class="text-sm font-medium">
                      {s("settings.contentFilter.detectionMode.historical") ||
                        "Historical"}
                    </div>
                    <div
                      class="text-xs {smartContentFilter.preferences
                        .contentSimilarityMode === 'historical'
                        ? 'text-gray-700 dark:text-gray-300'
                        : 'text-gray-500 dark:text-gray-400'}"
                    >
                      {s(
                        "settings.contentFilter.detectionMode.historical.description",
                      ) || "Compare with stories from previous days"}
      </div>
      </div>
                </div>
                {#if smartContentFilter.preferences.contentSimilarityMode === "historical"}
                  <Icon
                    icon="tabler:check-circle"
                    class="h-5 w-5 text-gray-700 opacity-90 dark:text-gray-300"
                  />
                {/if}
              </button>
      </div>
      </div>

          <!-- Memory Duration Controls (only show for historical mode) -->
          {#if smartContentFilter.preferences.contentSimilarityMode === "historical"}
            <div class="mb-6">
              <div class="mb-3 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Icon
                    icon="tabler:clock-hour-4"
                    class="h-4 w-4 text-gray-600 dark:text-gray-400"
                  />
                  <span
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {s("settings.contentFilter.memoryDuration") ||
                      "Memory Duration"}
                  </span>
                </div>
                <span class="text-sm text-gray-600 dark:text-gray-400">
                  {smartContentFilter.preferences.contentSimilarityExpiry}
                  {smartContentFilter.preferences.contentSimilarityExpiry === 1
                    ? "day"
                    : "days"}
                </span>
              </div>
              <div class="relative">
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="1"
                  bind:value={
                    smartContentFilter.preferences.contentSimilarityExpiry
                  }
                  oninput={createSafeAction((e) =>
                    smartContentFilter.setContentSimilarityExpiry(
                      parseInt((e.target as HTMLInputElement).value),
                    ))}
                  class="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
                />
                <div
                  class="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400"
                >
                  <span>1 day</span>
                  <span>7 days</span>
                  <span>30 days</span>
      </div>
      </div>
              <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {s("settings.contentFilter.memoryDuration.help") ||
                  "How many days back to compare stories for similarity detection. Longer periods catch more duplicates but use more memory."}
              </p>
            </div>
          {/if}

          <!-- Detection Scope Controls -->
          <div class="mb-6">
            <div class="mb-3 flex items-center gap-2">
              <Icon
                icon="tabler:focus-2"
                class="h-4 w-4 text-gray-600 dark:text-gray-400"
              />
              <span
                class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {s("settings.contentFilter.detectionScope") ||
                  "Detection Scope"}
              </span>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                class="flex items-center justify-between rounded-lg border p-4 text-left transition-all duration-200 {smartContentFilter
                  .preferences.contentSimilarityScope === 'within-category'
                  ? 'border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-100'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-600'}"
                onclick={() =>
                  smartContentFilter.setContentSimilarityScope(
                    "within-category",
                  )}
              >
                <div class="flex items-center gap-3">
                  <Icon
                    icon="tabler:folder"
                    class="h-5 w-5 {smartContentFilter.preferences
                      .contentSimilarityScope === 'within-category'
                      ? 'text-gray-700 opacity-100 dark:text-gray-300'
                      : 'text-gray-500 opacity-75 dark:text-gray-400'}"
                  />
                  <div>
                    <div class="text-sm font-medium">
                      {s(
                        "settings.contentFilter.detectionScope.withinCategory",
                      ) || "Within Categories"}
                    </div>
                    <div
                      class="text-xs {smartContentFilter.preferences
                        .contentSimilarityScope === 'within-category'
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-gray-500 dark:text-gray-400'}"
                    >
                      {s(
                        "settings.contentFilter.detectionScope.withinCategory.description",
                      ) || "Compare only stories in the same category"}
      </div>
      </div>
                </div>
                {#if smartContentFilter.preferences.contentSimilarityScope === "within-category"}
                  <Icon
                    icon="tabler:check-circle"
                    class="h-5 w-5 text-gray-700 opacity-90 dark:text-gray-300"
                  />
                {/if}
              </button>

              <button
                type="button"
                class="flex items-center justify-between rounded-lg border p-4 text-left transition-all duration-200 {smartContentFilter
                  .preferences.contentSimilarityScope === 'across-categories'
                  ? 'border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-100'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-600'}"
                onclick={() =>
                  smartContentFilter.setContentSimilarityScope(
                    "across-categories",
                  )}
              >
                <div class="flex items-center gap-3">
                  <Icon
                    icon="tabler:folders"
                    class="h-5 w-5 {smartContentFilter.preferences
                      .contentSimilarityScope === 'across-categories'
                      ? 'text-gray-700 opacity-100 dark:text-gray-300'
                      : 'text-gray-500 opacity-75 dark:text-gray-400'}"
                  />
                  <div>
                    <div class="text-sm font-medium">
                      {s(
                        "settings.contentFilter.detectionScope.acrossCategories",
                      ) || "Across Categories"}
                    </div>
                    <div
                      class="text-xs {smartContentFilter.preferences
                        .contentSimilarityScope === 'across-categories'
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-gray-500 dark:text-gray-400'}"
                    >
                      {s(
                        "settings.contentFilter.detectionScope.acrossCategories.description",
                      ) || "Compare stories across all categories"}
      </div>
      </div>
                </div>
                {#if smartContentFilter.preferences.contentSimilarityScope === "across-categories"}
                  <Icon
                    icon="tabler:check-circle"
                    class="h-5 w-5 text-gray-700 opacity-90 dark:text-gray-300"
                  />
                {/if}
              </button>
      </div>
      </div>

          <!-- Algorithm Weight Controls -->
          <div class="mb-6">
            <div class="mb-4 flex items-center gap-2">
              <Icon
                icon="tabler:scale"
                class="h-4 w-4 text-gray-600 dark:text-gray-400"
              />
              <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {s("settings.contentFilter.algorithmWeights") ||
                  "Algorithm Weight Controls"}
              </h5>
            </div>
            <p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
              {s("settings.contentFilter.algorithmWeights.description") ||
                "Adjust how different aspects of content are weighted when calculating similarity. The algorithm automatically normalizes these weights."}
            </p>

            <!-- Title Similarity Weight -->
            <div class="mb-4">
              <div class="mb-2 flex items-center justify-between">
                <span
                  class="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {s("settings.contentFilter.titleWeight") ||
                    "Title Similarity Weight"}
                </span>
                <span class="text-sm text-gray-600 dark:text-gray-400">
                  {smartContentFilter.preferences.similarityTitleWeight}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                bind:value={
                  smartContentFilter.preferences.similarityTitleWeight
                }
                oninput={(e) => {
                  const titleWeight = parseInt(
                    (e.target as HTMLInputElement).value,
                  );
                  smartContentFilter.setSimilarityWeights(
                    titleWeight,
                    smartContentFilter.preferences.similarityContentWeight,
                    smartContentFilter.preferences.similarityEntityWeight,
                  );
                }}
                class="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {s("settings.contentFilter.titleWeight.help") ||
                  "How much weight to give to title similarity when comparing stories"}
              </p>
            </div>

            <!-- Content Similarity Weight -->
            <div class="mb-4">
              <div class="mb-2 flex items-center justify-between">
                <span
                  class="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {s("settings.contentFilter.contentWeight") ||
                    "Content Similarity Weight"}
                </span>
                <span class="text-sm text-gray-600 dark:text-gray-400">
                  {smartContentFilter.preferences.similarityContentWeight}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                bind:value={
                  smartContentFilter.preferences.similarityContentWeight
                }
                oninput={(e) => {
                  const contentWeight = parseInt(
                    (e.target as HTMLInputElement).value,
                  );
                  smartContentFilter.setSimilarityWeights(
                    smartContentFilter.preferences.similarityTitleWeight,
                    contentWeight,
                    smartContentFilter.preferences.similarityEntityWeight,
                  );
                }}
                class="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {s("settings.contentFilter.contentWeight.help") ||
                  "How much weight to give to content body similarity when comparing stories"}
              </p>
            </div>

            <!-- Entity Similarity Weight -->
            <div class="mb-4">
              <div class="mb-2 flex items-center justify-between">
                <span
                  class="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {s("settings.contentFilter.entityWeight") ||
                    "Entity Similarity Weight"}
                </span>
                <span class="text-sm text-gray-600 dark:text-gray-400">
                  {smartContentFilter.preferences.similarityEntityWeight}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                bind:value={
                  smartContentFilter.preferences.similarityEntityWeight
                }
                oninput={(e) => {
                  const entityWeight = parseInt(
                    (e.target as HTMLInputElement).value,
                  );
                  smartContentFilter.setSimilarityWeights(
                    smartContentFilter.preferences.similarityTitleWeight,
                    smartContentFilter.preferences.similarityContentWeight,
                    entityWeight,
                  );
                }}
                class="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {s("settings.contentFilter.entityWeight.help") ||
                  "How much weight to give to shared entities (people, places, organizations) when comparing stories"}
              </p>
            </div>

            <!-- Real-time Weight Feedback -->
            <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
              <div class="text-xs text-gray-600 dark:text-gray-400">
                <div class="mb-1">
                  <strong>Current Algorithm Focus:</strong>
                  {#if smartContentFilter.preferences.similarityTitleWeight >= smartContentFilter.preferences.similarityContentWeight && smartContentFilter.preferences.similarityTitleWeight >= smartContentFilter.preferences.similarityEntityWeight}
                    Title-focused detection (good for catching headline
                    duplicates)
                  {:else if smartContentFilter.preferences.similarityContentWeight >= smartContentFilter.preferences.similarityTitleWeight && smartContentFilter.preferences.similarityContentWeight >= smartContentFilter.preferences.similarityEntityWeight}
                    Content-focused detection (good for catching story rewrites)
                  {:else if smartContentFilter.preferences.similarityEntityWeight >= smartContentFilter.preferences.similarityTitleWeight && smartContentFilter.preferences.similarityEntityWeight >= smartContentFilter.preferences.similarityContentWeight}
                    Entity-focused detection (good for catching stories about
                    same events)
                  {:else}
                    Balanced detection (good general-purpose similarity
                    detection)
                  {/if}
                </div>
                <div class="text-xs">
                  Normalized weights: Title {Math.round(
                    (smartContentFilter.preferences.similarityTitleWeight /
                      (smartContentFilter.preferences.similarityTitleWeight +
                        smartContentFilter.preferences.similarityContentWeight +
                        smartContentFilter.preferences
                          .similarityEntityWeight)) *
                      100,
                  )}%, Content {Math.round(
                    (smartContentFilter.preferences.similarityContentWeight /
                      (smartContentFilter.preferences.similarityTitleWeight +
                        smartContentFilter.preferences.similarityContentWeight +
                        smartContentFilter.preferences
                          .similarityEntityWeight)) *
                      100,
                  )}%, Entity {Math.round(
                    (smartContentFilter.preferences.similarityEntityWeight /
                      (smartContentFilter.preferences.similarityTitleWeight +
                        smartContentFilter.preferences.similarityContentWeight +
                        smartContentFilter.preferences
                          .similarityEntityWeight)) *
                      100,
                  )}%
      </div>
      </div>
      </div>
      </div>

          <!-- Preset Buttons for Common Similarity Scenarios -->
          <div class="mb-6">
            <div class="mb-3 flex items-center gap-2">
              <Icon
                icon="tabler:template"
                class="h-4 w-4 text-gray-600 dark:text-gray-400"
              />
              <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {s("settings.contentFilter.similarityPresets") ||
                  "Quick Similarity Presets"}
              </h5>
            </div>
            <div class={getGridClasses(3)}>
              <Tooltip
                text="Focus on local and regional news, reduce international duplicates"
              >
                <button
                  type="button"
                  class={getSimilarityPresetButtonClasses(
                    isSimilarityPresetActive("local"),
                    smartContentFilter.preferences.filterContentSimilarity,
                  )}
                  onclick={() => {
                    if (
                      smartContentFilter.preferences.filterContentSimilarity
                    ) {
                      smartContentFilter.setContentSimilarityThreshold(60);
                      smartContentFilter.setContentSimilarityMode("today");
                      smartContentFilter.setContentSimilarityScope(
                        "within-category",
                      );
                      smartContentFilter.setSimilarityWeights(50, 30, 20);
                    }
                  }}
                  disabled={!smartContentFilter.preferences
                    .filterContentSimilarity}
                >
                  <Icon
                    icon="tabler:map-pin"
                    class="mb-2 h-5 w-5 {isSimilarityPresetActive('local')
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400'}"
                  />
                  <span class="text-sm font-medium">Local Focus</span>
                  <span
                    class="text-xs {isSimilarityPresetActive('local')
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-500 dark:text-gray-400'}"
                  >
                    60% threshold, today only, within categories
                  </span>
                  {#if isSimilarityPresetActive("local")}
                    <Icon
                      icon="tabler:check-circle"
                      class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
                    />
                  {/if}
                </button>
              </Tooltip>

              <Tooltip
                text="Catch global story duplicates across all categories"
              >
                <button
                  type="button"
                  class={getSimilarityPresetButtonClasses(
                    isSimilarityPresetActive("global"),
                    smartContentFilter.preferences.filterContentSimilarity,
                  )}
                  onclick={() => {
                    if (
                      smartContentFilter.preferences.filterContentSimilarity
                    ) {
                      smartContentFilter.setContentSimilarityThreshold(70);
                      smartContentFilter.setContentSimilarityMode("historical");
                      smartContentFilter.setContentSimilarityExpiry(7);
                      smartContentFilter.setContentSimilarityScope(
                        "across-categories",
                      );
                      smartContentFilter.setSimilarityWeights(30, 40, 30);
                    }
                  }}
                  disabled={!smartContentFilter.preferences
                    .filterContentSimilarity}
                >
                  <Icon
                    icon="tabler:world"
                    class="mb-2 h-5 w-5 {isSimilarityPresetActive('global')
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400'}"
                  />
                  <span class="text-sm font-medium">Global Focus</span>
                  <span
                    class="text-xs {isSimilarityPresetActive('global')
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-500 dark:text-gray-400'}"
                  >
                    70% threshold, 7-day history, across categories
                  </span>
                  {#if isSimilarityPresetActive("global")}
                    <Icon
                      icon="tabler:check-circle"
                      class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
                    />
                  {/if}
                </button>
              </Tooltip>

              <Tooltip text="Balanced similarity detection for general use">
                <button
                  type="button"
                  class={getSimilarityPresetButtonClasses(
                    isSimilarityPresetActive("balanced"),
                    smartContentFilter.preferences.filterContentSimilarity,
                  )}
                  onclick={() => {
                    if (
                      smartContentFilter.preferences.filterContentSimilarity
                    ) {
                      smartContentFilter.setContentSimilarityThreshold(70);
                      smartContentFilter.setContentSimilarityMode("today");
                      smartContentFilter.setContentSimilarityScope(
                        "within-category",
                      );
                      smartContentFilter.setSimilarityWeights(40, 25, 35);
                    }
                  }}
                  disabled={!smartContentFilter.preferences
                    .filterContentSimilarity}
                >
                  <Icon
                    icon="tabler:weight"
                    class="mb-2 h-5 w-5 {isSimilarityPresetActive('balanced')
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400'}"
                  />
                  <span class="text-sm font-medium">Balanced</span>
                  <span
                    class="text-xs {isSimilarityPresetActive('balanced')
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-500 dark:text-gray-400'}"
                  >
                    70% threshold, today only, balanced weights
                  </span>
                  {#if isSimilarityPresetActive("balanced")}
                    <Icon
                      icon="tabler:check-circle"
                      class="mt-1 h-3 w-3 text-blue-600 dark:text-blue-400"
                    />
                  {/if}
                </button>
              </Tooltip>
          </div>
        </div>
        </div>
          {/if}
        </div>
      </div>
      {/if}

      <div class="flex flex-col space-y-2">
        <div class="mb-1 flex items-center gap-2">
          <Icon
            icon="tabler:filter"
            class="h-4 w-4 text-gray-600 dark:text-gray-400"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {s("settings.contentFilter.activeFilters") || "Active Filters"}
          </span>
          <span class="text-xs text-gray-500 dark:text-gray-400">
            ({getActiveFilterCount()} active)
          </span>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {s("settings.contentFilter.activeFilters.description") ||
            "Currently active content filters. Click on any filter tag to remove it individually."}
        </p>

        <!-- Active Filter Tags -->
        <div class="mb-4 flex flex-wrap gap-2">
          {#each getActiveFilterTags() as filter}
            <div
              class="group flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm dark:bg-gray-700/50"
            >
              {#if filter.icon === "social-media-icons"}
                <!-- Custom social media icons for Social Media Drama filter -->
                <div
                  class="relative mr-2 flex h-4 w-12 items-center justify-center opacity-80"
                >
                  <Icon
                    icon="tabler:brand-x"
                    class="absolute h-4 w-4 -translate-x-4 -rotate-12 transform text-gray-600 dark:text-gray-400"
                  />
                  <Icon
                    icon="tabler:brand-instagram"
                    class="absolute h-4 w-4 rotate-0 transform text-gray-600 dark:text-gray-400"
                  />
                  <Icon
                    icon="tabler:brand-tiktok"
                    class="absolute h-4 w-4 translate-x-4 rotate-12 transform text-gray-600 dark:text-gray-400"
                  />
                </div>
              {:else}
                <Icon
                  icon={filter.icon}
                  class="mr-2 h-4 w-4 text-gray-600 opacity-80 dark:text-gray-400"
                />
              {/if}
              <span class="text-gray-800 dark:text-gray-200"
                >{filter.label}</span
              >
              <button
                type="button"
                class="ml-2 rounded-full p-0.5 text-gray-600 opacity-75 hover:bg-gray-200 hover:text-gray-800 hover:opacity-100 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-200"
                onclick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeFilter(filter.key, filter.value);
                }}
                aria-label={`Remove ${filter.label} filter`}
              >
                <Icon icon="tabler:x" class="h-3 w-3" />
              </button>
            </div>
          {/each}

          <!-- Custom Keywords Tags -->
          {#each smartContentFilter.customKeywords as keyword}
            <div
              class="group flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm dark:bg-gray-700/50"
            >
              <Icon
                icon="tabler:tag"
                class="mr-2 h-4 w-4 text-gray-600 opacity-80 dark:text-gray-400"
              />
              <span class="text-gray-800 dark:text-gray-200">"{keyword}"</span>
              <button
                type="button"
                class="ml-2 rounded-full p-0.5 text-gray-600 opacity-75 hover:bg-gray-200 hover:text-gray-800 hover:opacity-100 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-200"
                onclick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeCustomKeyword(keyword);
                }}
                aria-label={`Remove keyword "${keyword}"`}
              >
                <Icon icon="tabler:x" class="h-3 w-3" />
              </button>
            </div>
          {/each}

          <!-- No active filters message -->
          {#if getActiveFilterCount() === 0}
            <div
              class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
            >
              <Icon icon="tabler:info-circle" class="h-4 w-4" />
              <span>No filters are currently active</span>
            </div>
          {/if}
        </div>

        <!-- Clear All Filters Button -->
        {#if getActiveFilterCount() > 0}
          <div
            class="mt-2 flex items-center justify-between border-t border-gray-200 pt-2 dark:border-gray-700"
          >
            <span class="text-xs text-gray-500 dark:text-gray-400">
              {s("settings.contentFilter.clearAll.description") ||
                "Remove all active filters and reset to defaults"}
            </span>
            <button
              type="button"
              class="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:border-red-300 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:border-red-700 dark:hover:bg-red-900/30"
              onclick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clearAllFilters();
              }}
            >
              {s("settings.contentFilter.clearAll") || "Clear All Filters"}
            </button>
          </div>
        {/if}
      </div>

      <!-- Statistics Section -->
      {#if smartContentFilter.stats}
        <div
          class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
        >
          <div class="mb-6 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon
                icon="tabler:chart-bar"
                class="h-4 w-4 text-gray-600 dark:text-gray-400"
              />
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {s("settings.contentFilter.statistics") || "Filter Statistics"}
              </h4>
            </div>
            <Icon
              icon="tabler:chart-bar"
              class="h-5 w-5 text-gray-500 dark:text-gray-400"
            />
          </div>

          <!-- Overview Statistics -->
          <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <!-- Total Processed -->
            <div
              class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/50"
            >
              <div class="flex items-center gap-3">
                <Icon
                  icon="tabler:file-text"
                  class="h-5 w-5 text-gray-500 dark:text-gray-400"
                />
                <div>
                  <div
                    class="text-lg font-semibold text-gray-900 dark:text-gray-100"
                  >
                    {smartContentFilter.stats.totalProcessed.toLocaleString()}
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {s("settings.contentFilter.stats.totalProcessed") ||
                      "Total Processed"}
      </div>
      </div>
      </div>
      </div>

            <!-- Filtered Count -->
            <div
              class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/50"
            >
              <div class="flex items-center gap-3">
                <Icon
                  icon="tabler:filter"
                  class="h-5 w-5 text-gray-500 dark:text-gray-400"
                />
                <div>
                  <div
                    class="text-lg font-semibold text-gray-900 dark:text-gray-100"
                  >
                    {smartContentFilter.stats.filtered.toLocaleString()}
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {s("settings.contentFilter.stats.filtered") ||
                      "Stories Filtered"}
      </div>
      </div>
      </div>
      </div>

            <!-- Filter Rate -->
            <div
              class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/50"
            >
              <div class="flex items-center gap-3">
                <Icon
                  icon="tabler:percentage"
                  class="h-5 w-5 text-gray-500 dark:text-gray-400"
                />
                <div>
                  <div
                    class="text-lg font-semibold text-gray-900 dark:text-gray-100"
                  >
                    {(smartContentFilter.stats.filterRate * 100).toFixed(1)}%
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {s("settings.contentFilter.stats.filterRate") ||
                      "Filter Rate"}
      </div>
      </div>
      </div>
      </div>
          </div>

          <!-- Filter Rate Progress Bar -->
          <div class="mb-6">
            <div class="mb-2 flex items-center justify-between">
              <span
                class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {s("settings.contentFilter.stats.filterEffectiveness") ||
                  "Filter Effectiveness"}
              </span>
              <span class="text-sm text-gray-600 dark:text-gray-400">
                {(smartContentFilter.stats.filterRate * 100).toFixed(1)}%
              </span>
            </div>
            <div class="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                class="h-2 rounded-full bg-blue-600 transition-all duration-300 ease-in-out"
                style="width: {Math.min(
                  smartContentFilter.stats.filterRate * 100,
                  100,
                )}%"
              ></div>
            </div>
            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {#if smartContentFilter.stats.filterRate < 0.1}
                Low filtering activity - most content passes through
              {:else if smartContentFilter.stats.filterRate < 0.3}
                Moderate filtering - balanced content curation
              {:else if smartContentFilter.stats.filterRate < 0.6}
                High filtering - aggressive content filtering
              {:else}
                Very high filtering - strict content standards
              {/if}
      </div>
      </div>

          <!-- Top Filter Reasons -->
          {#if smartContentFilter.stats.topFilterReasons.length > 0}
            <div class="mb-6">
              <div class="mb-3 flex items-center gap-2">
                <Icon
                  icon="tabler:list-numbers"
                  class="h-4 w-4 text-gray-600 dark:text-gray-400"
                />
                <h5
                  class="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {s("settings.contentFilter.stats.topReasons") ||
                    "Top Filter Reasons"}
                </h5>
              </div>
              <div class="space-y-2">
                {#each smartContentFilter.stats.topFilterReasons.slice(0, 5) as reason}
                  {@const percentage =
                    smartContentFilter.stats.totalProcessed > 0
                      ? (reason.count /
                          smartContentFilter.stats.totalProcessed) *
                        100
                      : 0}
                  <div
                    class="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-600"
                  >
                    <div class="flex items-center space-x-3">
                      <div
                        class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"
                      >
                        <span
                          class="text-xs font-medium text-gray-600 dark:text-gray-400"
                        >
                          {reason.count}
                        </span>
                      </div>
                      <div>
                        <div
                          class="text-sm font-medium text-gray-900 dark:text-gray-100"
                        >
                          {reason.reason}
                        </div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">
                          {percentage.toFixed(1)}% of total stories
      </div>
      </div>
                    </div>
                    <div class="flex items-center space-x-2">
                      <div
                        class="h-1.5 w-16 rounded-full bg-gray-200 dark:bg-gray-700"
                      >
                        <div
                          class="h-1.5 rounded-full bg-blue-600"
                          style="width: {Math.min(percentage, 100)}%"
                        ></div>
      </div>
      </div>
                  </div>
                {/each}
      </div>
      </div>
          {/if}

          <!-- Category Breakdown -->
          {#if Object.keys(smartContentFilter.stats.categoryBreakdown).length > 0}
            <div>
              <div class="mb-3 flex items-center gap-2">
                <Icon
                  icon="tabler:category-2"
                  class="h-4 w-4 text-gray-600 dark:text-gray-400"
                />
                <h5
                  class="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {s("settings.contentFilter.stats.categoryBreakdown") ||
                    "Category Breakdown"}
                </h5>
              </div>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {#each Object.entries(smartContentFilter.stats.categoryBreakdown) as [category, stats]}
                  {@const filterRate =
                    stats.total > 0 ? stats.filtered / stats.total : 0}
                  <div
                    class="rounded-lg border border-gray-200 p-4 dark:border-gray-600"
                  >
                    <div class="mb-2 flex items-center justify-between">
                      <div
                        class="text-sm font-medium text-gray-900 capitalize dark:text-gray-100"
                      >
                        {category}
                      </div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">
                        {(filterRate * 100).toFixed(0)}%
      </div>
      </div>
                    <div
                      class="mb-2 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700"
                    >
                      <div
                        class="h-1.5 rounded-full bg-blue-600 transition-all duration-300 ease-in-out"
                        style="width: {Math.min(filterRate * 100, 100)}%"
                      ></div>
                    </div>
                    <div
                      class="flex justify-between text-xs text-gray-500 dark:text-gray-400"
                    >
                      <span>{stats.filtered} filtered</span>
                      <span>{stats.total} total</span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- No Statistics Available -->
          {#if smartContentFilter.stats.totalProcessed === 0}
            <div class="py-8 text-center">
              <Icon
                icon="tabler:chart-bar"
                class="mx-auto mb-4 h-12 w-12 text-gray-400 dark:text-gray-500"
              />
              <div class="text-sm text-gray-500 dark:text-gray-400">
                {s("settings.contentFilter.stats.noData") ||
                  "No filtering statistics available yet. Statistics will appear once content has been processed through your filters."}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Advanced Weights top-level divider -->
      <button
        type="button"
        class="my-3 flex w-full items-center text-left"
        onclick={() => (showAdvancedWeights = !showAdvancedWeights)}
        aria-expanded={showAdvancedWeights}
        aria-controls="advanced-weights-section"
      >
        <div class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
        <span class="px-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {s("settings.contentFilter.advancedWeights.parent") || "Advanced Weights"}
        </span>
        <Icon
          icon="tabler:chevron-right"
          class="ml-2 h-4 w-4 text-gray-400 transition-transform duration-200 {showAdvancedWeights ? 'rotate-90' : ''}"
          aria-hidden="true"
        />
        <div class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
      </button>

      {#if showAdvancedWeights}
      <div id="advanced-weights-section" class="flex flex-col space-y-2">
        <div class="mb-1 flex items-center gap-2">
          <Icon
            icon="tabler:scale"
            class="h-4 w-4 text-gray-600 dark:text-gray-400"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {s("settings.contentFilter.advancedWeights") ||
              "Advanced Category Weight Overrides"}
          </span>
          {#if smartContentFilter.preferences.categoryOverrides && Object.keys(smartContentFilter.preferences.categoryOverrides).length > 0}
            <span class="text-xs font-medium text-blue-600 dark:text-blue-400">
              (Custom weight settings active)
            </span>
          {/if}
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {s("settings.contentFilter.advancedWeights.description") ||
            "Fine-tune filtering sensitivity for each category"}
        </p>

        <div class="mt-4">
          <p class="mb-6 text-sm text-gray-600 dark:text-gray-400">
            {s("settings.contentFilter.advancedWeights.description") ||
              "Fine-tune how different aspects of content are weighted when detecting similarity and relevance. Global settings apply to all categories unless overridden."}
          </p>

          <!-- Global Weight Settings (collapsible) -->
          <div class="mb-2">
            <button
              type="button"
              class="mb-2 flex w-full items-center justify-between text-left"
              onclick={() => (showGlobalWeights = !showGlobalWeights)}
            >
              <div class="flex items-center gap-3">
                <Icon
                  icon="tabler:world"
                  class="h-5 w-5 text-gray-500 dark:text-gray-400"
                />
                <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {s("settings.contentFilter.globalWeights") ||
                    "Global Weight Settings"}
                </h5>
              </div>
              <Icon
                icon="tabler:chevron-right"
                class="h-4 w-4 text-gray-400 transition-transform duration-200 {showGlobalWeights ? 'rotate-90' : ''}"
              />
            </button>
            {#if showGlobalWeights}
            <p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
              {s("settings.contentFilter.globalWeights.description") ||
                "These weights determine how much importance is given to different parts of content when analyzing relevance and quality."}
            </p>

            <div class="space-y-4">
              <!-- Title Importance -->
              <div>
                <div class="mb-2 flex items-center justify-between">
                  <div class="flex items-center space-x-2">
                    <Icon
                      icon="tabler:heading"
                      class="h-4 w-4 text-gray-500 dark:text-gray-400"
                    />
                    <span
                      class="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      {s("settings.contentFilter.titleImportance") ||
                        "Title Importance"}
                    </span>
                    <Tooltip
                      text="How much weight to give to keywords and patterns found in article titles"
                    >
                      <Icon
                        icon="tabler:info-circle"
                        class="h-4 w-4 text-gray-400"
                      />
                    </Tooltip>
                  </div>
                  <span class="text-sm text-gray-600 dark:text-gray-400">
                    {smartContentFilter.preferences.globalTitleImportance}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={smartContentFilter.preferences.globalTitleImportance}
                  oninput={createSafeAction((e) =>
                    smartContentFilter.updatePreference(
                      "globalTitleImportance",
                      parseInt((e.target as HTMLInputElement).value),
                    ))}
                  class="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
                />
                <div
                  class="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400"
                >
                  <span>Less Important</span>
                  <span>More Important</span>
                </div>
              </div>

              <!-- Content Importance -->
              <div>
                <div class="mb-2 flex items-center justify-between">
                  <div class="flex items-center space-x-2">
                    <Icon
                      icon="tabler:file-text"
                      class="h-4 w-4 text-gray-500 dark:text-gray-400"
                    />
                    <span
                      class="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      {s("settings.contentFilter.contentImportance") ||
                        "Content Importance"}
                    </span>
                    <Tooltip
                      text="How much weight to give to keywords and patterns found in article body content"
                    >
                      <Icon
                        icon="tabler:info-circle"
                        class="h-4 w-4 text-gray-400"
                      />
                    </Tooltip>
                  </div>
                  <span class="text-sm text-gray-600 dark:text-gray-400">
                    {smartContentFilter.preferences.globalContentImportance}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={smartContentFilter.preferences.globalContentImportance}
                  oninput={createSafeAction((e) =>
                    smartContentFilter.updatePreference(
                      "globalContentImportance",
                      parseInt((e.target as HTMLInputElement).value),
                    ))}
                  class="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
                />
                <div
                  class="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400"
                >
                  <span>Less Important</span>
                  <span>More Important</span>
                </div>
              </div>

              <!-- Context Evidence -->
              <div>
                <div class="mb-2 flex items-center justify-between">
                  <div class="flex items-center space-x-2">
                    <Icon
                      icon="tabler:puzzle"
                      class="h-4 w-4 text-gray-500 dark:text-gray-400"
                    />
                    <span
                      class="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      {s("settings.contentFilter.contextEvidence") ||
                        "Context Evidence"}
                    </span>
                    <Tooltip
                      text="How much weight to give to surrounding context, metadata, and source information"
                    >
                      <Icon
                        icon="tabler:info-circle"
                        class="h-4 w-4 text-gray-400"
                      />
                    </Tooltip>
                  </div>
                  <span class="text-sm text-gray-600 dark:text-gray-400">
                    {smartContentFilter.preferences.globalContextEvidence}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={smartContentFilter.preferences.globalContextEvidence}
                  oninput={createSafeAction((e) =>
                    smartContentFilter.updatePreference(
                      "globalContextEvidence",
                      parseInt((e.target as HTMLInputElement).value),
                    ))}
                  class="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
                />
                <div
                  class="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400"
                >
                  <span>Less Important</span>
                  <span>More Important</span>
                </div>
              </div>
            </div>

            <!-- Weight Distribution Display -->
            <div class="mt-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
              <div class="text-xs text-gray-600 dark:text-gray-400">
                <div class="mb-2 font-medium">Current Weight Distribution:</div>
                <div class="space-y-1">
                  <div class="flex justify-between">
                    <span
                      >Title: {smartContentFilter.preferences
                        .globalTitleImportance}%</span
                    >
                    <span
                      >Content: {smartContentFilter.preferences
                        .globalContentImportance}%</span
                    >
                    <span
                      >Context: {smartContentFilter.preferences
                        .globalContextEvidence}%</span
                    >
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-500">
                    Total: {smartContentFilter.preferences
                      .globalTitleImportance +
                      smartContentFilter.preferences.globalContentImportance +
                      smartContentFilter.preferences.globalContextEvidence}%
                  </div>
                </div>
              </div>
            </div>
            {/if}
          </div>

          <!-- Per-Category Weight Overrides (collapsible) -->
          <div class="mb-8">
            <button
              type="button"
              class="mb-4 flex w-full items-center justify-between text-left"
              onclick={() => (showPerCategoryOverrides = !showPerCategoryOverrides)}
            >
              <div class="flex items-center gap-3">
                <Icon
                  icon="tabler:category"
                  class="h-5 w-5 text-gray-500 dark:text-gray-400"
                />
                <h5
                  class="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {s("settings.contentFilter.categoryOverrides") ||
                    "Per-Category Weight Overrides"}
                </h5>
              </div>
              <Icon
                icon="tabler:chevron-right"
                class="h-4 w-4 text-gray-400 transition-transform duration-200 {showPerCategoryOverrides ? 'rotate-90' : ''}"
              />
            </button>
            {#if showPerCategoryOverrides}
            <div class="mb-4 flex items-center justify-between">
              {#if smartContentFilter.preferences.categoryWeightOverrides && Object.keys(smartContentFilter.preferences.categoryWeightOverrides).length > 0}
                <button
                  type="button"
                  class="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                  onclick={createSafeAction(() => {
                    smartContentFilter.updatePreference(
                      "categoryWeightOverrides",
                      undefined,
                    );
                  })}
                >
                  Clear All Overrides
                </button>
              {/if}
            </div>
            <p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
              {s("settings.contentFilter.categoryOverrides.description") ||
                "Override global weight settings for specific content categories. Only categories with active filters can be customized."}
            </p>

            <!-- Category Override Controls -->
            {#snippet categoryOverrideControls()}
              {@const availableCategories = [
                {
                  key: "politics",
                  label: "Politics",
                  icon: "heroicons:megaphone",
                  active: smartContentFilter.preferences.filterPolitics,
                },
                {
                  key: "sports",
                  label: "Sports",
                  icon: "tabler:ball-football",
                  active: smartContentFilter.preferences.filterSports,
                },
                {
                  key: "financial",
                  label: "Financial",
                  icon: "tabler:chart-line",
                  active: smartContentFilter.preferences.filterFinancial,
                },
                {
                  key: "technology",
                  label: "Technology",
                  icon: "tabler:device-laptop",
                  active: smartContentFilter.preferences.filterTechnology,
                },
                {
                  key: "entertainment",
                  label: "Entertainment",
                  icon: "tabler:movie",
                  active: smartContentFilter.preferences.filterEntertainment,
                },
                {
                  key: "celebrity",
                  label: "Celebrity",
                  icon: "tabler:star",
                  active: smartContentFilter.preferences.filterCelebrity,
                },
                {
                  key: "weather",
                  label: "Weather",
                  icon: "tabler:cloud",
                  active: smartContentFilter.preferences.filterWeather,
                },
              ]}

              {@const activeCategories = availableCategories.filter(
                (cat) => cat.active,
              )}

              {#if activeCategories.length === 0}
                <div
                  class="rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-700/50"
                >
                  <Icon
                    icon="tabler:info-circle"
                    class="mx-auto mb-2 h-8 w-8 text-gray-400"
                  />
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    {s("settings.contentFilter.categoryOverrides.noActive") ||
                      "No category filters are currently active."}<br />
                    {s(
                      "settings.contentFilter.categoryOverrides.enableFilters",
                    ) ||
                      "Enable category filters above to customize their weight settings."}
                  </p>
                </div>
              {:else}
                <div class="space-y-6">
                  {#each activeCategories as category}
                    {@const hasOverride =
                      smartContentFilter.preferences.categoryWeightOverrides?.[
                        category.key
                      ]}
                    {@const override = hasOverride || {}}

                    <div
                      class="rounded-lg border border-gray-200 p-4 dark:border-gray-600"
                    >
                      <div class="mb-3 flex items-center justify-between">
                        <div class="flex items-center space-x-2">
                          <Icon
                            icon={category.icon}
                            class="h-4 w-4 text-gray-500 dark:text-gray-400"
                          />
                          <span
                            class="text-sm font-medium text-gray-900 dark:text-gray-100"
                          >
                            {category.label}
                          </span>
                          {#if hasOverride}
                            <span
                              class="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                            >
                              Custom
                            </span>
                          {/if}
                        </div>
                        <div class="flex items-center space-x-2">
                          {#if hasOverride}
                            <button
                              type="button"
                              class="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                              onclick={createSafeAction(() =>
                                smartContentFilter.setCategoryWeightOverride(
                                  category.key,
                                  undefined,
                                ))}
                            >
                              Reset
                            </button>
                          {/if}
                          <button
                            type="button"
                            class="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                            onclick={createSafeAction(() => {
                              if (!hasOverride) {
                                smartContentFilter.setCategoryWeightOverride(
                                  category.key,
                                  {
                                    titleImportance:
                                      smartContentFilter.preferences
                                        .globalTitleImportance,
                                    contentImportance:
                                      smartContentFilter.preferences
                                        .globalContentImportance,
                                    contextEvidence:
                                      smartContentFilter.preferences
                                        .globalContextEvidence,
                                  },
                                );
                              }
                            })}
                          >
                            {hasOverride ? "Customize" : "Override"}
                          </button>
                        </div>
                      </div>

                      {#if hasOverride}
                        <div class="space-y-3">
                          <!-- Title Importance Override -->
                          <div>
                            <div class="mb-1 flex items-center justify-between">
                              <span
                                class="text-xs font-medium text-gray-700 dark:text-gray-300"
                              >
                                Title Importance
                              </span>
                              <span
                                class="text-xs text-gray-600 dark:text-gray-400"
                              >
                                {override.titleImportance ??
                                  smartContentFilter.preferences
                                    .globalTitleImportance}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={override.titleImportance ??
                                smartContentFilter.preferences
                                  .globalTitleImportance}
                              oninput={createSafeAction((e) => {
                                const currentOverride =
                                  smartContentFilter.preferences
                                    .categoryWeightOverrides?.[category.key] ||
                                  {};
                                smartContentFilter.setCategoryWeightOverride(
                                  category.key,
                                  {
                                    ...currentOverride,
                                    titleImportance: parseInt(
                                      (e.target as HTMLInputElement).value,
                                    ),
                                  },
                                );
                              })}
                              class="slider h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
                            />
                          </div>

                          <!-- Content Importance Override -->
                          <div>
                            <div class="mb-1 flex items-center justify-between">
                              <span
                                class="text-xs font-medium text-gray-700 dark:text-gray-300"
                              >
                                Content Importance
                              </span>
                              <span
                                class="text-xs text-gray-600 dark:text-gray-400"
                              >
                                {override.contentImportance ??
                                  smartContentFilter.preferences
                                    .globalContentImportance}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={override.contentImportance ??
                                smartContentFilter.preferences
                                  .globalContentImportance}
                              oninput={createSafeAction((e) => {
                                const currentOverride =
                                  smartContentFilter.preferences
                                    .categoryWeightOverrides?.[category.key] ||
                                  {};
                                smartContentFilter.setCategoryWeightOverride(
                                  category.key,
                                  {
                                    ...currentOverride,
                                    contentImportance: parseInt(
                                      (e.target as HTMLInputElement).value,
                                    ),
                                  },
                                );
                              })}
                              class="slider h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
                            />
                          </div>

                          <!-- Context Evidence Override -->
                          <div>
                            <div class="mb-1 flex items-center justify-between">
                              <span
                                class="text-xs font-medium text-gray-700 dark:text-gray-300"
                              >
                                Context Evidence
                              </span>
                              <span
                                class="text-xs text-gray-600 dark:text-gray-400"
                              >
                                {override.contextEvidence ??
                                  smartContentFilter.preferences
                                    .globalContextEvidence}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={override.contextEvidence ??
                                smartContentFilter.preferences
                                  .globalContextEvidence}
                              oninput={createSafeAction((e) => {
                                const currentOverride =
                                  smartContentFilter.preferences
                                    .categoryWeightOverrides?.[category.key] ||
                                  {};
                                smartContentFilter.setCategoryWeightOverride(
                                  category.key,
                                  {
                                    ...currentOverride,
                                    contextEvidence: parseInt(
                                      (e.target as HTMLInputElement).value,
                                    ),
                                  },
                                );
                              })}
                              class="slider h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
                            />
                          </div>

                          <!-- Override Summary -->
                          <div
                            class="mt-2 rounded bg-gray-50 p-2 dark:bg-gray-700/50"
                          >
                            <div
                              class="text-xs text-gray-600 dark:text-gray-400"
                            >
                              <div class="mb-1 font-medium">
                                Override Distribution:
                              </div>
                              <div class="flex justify-between">
                                <span
                                  >T: {override.titleImportance ??
                                    smartContentFilter.preferences
                                      .globalTitleImportance}%</span
                                >
                                <span
                                  >C: {override.contentImportance ??
                                    smartContentFilter.preferences
                                      .globalContentImportance}%</span
                                >
                                <span
                                  >E: {override.contextEvidence ??
                                    smartContentFilter.preferences
                                      .globalContextEvidence}%</span
                                >
                              </div>
                            </div>
                          </div>
                        </div>
                      {:else}
                        <div class="text-xs text-gray-500 dark:text-gray-400">
                          Using global weights: Title {smartContentFilter
                            .preferences.globalTitleImportance}%, Content {smartContentFilter
                            .preferences.globalContentImportance}%, Context {smartContentFilter
                            .preferences.globalContextEvidence}%
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            {/snippet}

            {@render categoryOverrideControls()}
            {/if}
          </div>

          <!-- Sensitivity Override Controls -->
          <div class="mb-8">
            <div class="mb-4 flex items-center gap-3">
              <Icon
                icon="tabler:adjustments"
                class="h-5 w-5 text-gray-500 dark:text-gray-400"
              />
              <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {s("settings.contentFilter.sensitivityOverrides") ||
                  "Sensitivity Override Controls"}
              </h5>
            </div>
            <p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
              {s("settings.contentFilter.sensitivityOverrides.description") ||
                "Override the global filter sensitivity for specific categories. Higher values mean stricter filtering."}
            </p>

            <!-- Category Sensitivity Overrides -->
            {#snippet sensitivityOverrideControls()}
              {@const availableCategories = [
                {
                  key: "politics",
                  label: "Politics",
                  icon: "heroicons:megaphone",
                  active: smartContentFilter.preferences.filterPolitics,
                },
                {
                  key: "sports",
                  label: "Sports",
                  icon: "tabler:ball-football",
                  active: smartContentFilter.preferences.filterSports,
                },
                {
                  key: "financial",
                  label: "Financial",
                  icon: "tabler:chart-line",
                  active: smartContentFilter.preferences.filterFinancial,
                },
                {
                  key: "technology",
                  label: "Technology",
                  icon: "tabler:device-laptop",
                  active: smartContentFilter.preferences.filterTechnology,
                },
                {
                  key: "entertainment",
                  label: "Entertainment",
                  icon: "tabler:movie",
                  active: smartContentFilter.preferences.filterEntertainment,
                },
                {
                  key: "celebrity",
                  label: "Celebrity",
                  icon: "tabler:star",
                  active: smartContentFilter.preferences.filterCelebrity,
                },
                {
                  key: "weather",
                  label: "Weather",
                  icon: "tabler:cloud",
                  active: smartContentFilter.preferences.filterWeather,
                },
              ]}

              {@const activeCategories = availableCategories.filter(
                (cat) => cat.active,
              )}

              {#if activeCategories.length > 0}
                <div class="space-y-3">
                  {#each activeCategories as category}
                    {@const currentOverride =
                      smartContentFilter.preferences.categoryOverrides?.[
                        category.key
                      ]}
                    {@const hasNumericOverride =
                      typeof currentOverride === "number"}
                    {@const hasPresetOverride =
                      typeof currentOverride === "string"}

                    <div
                      class="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-600"
                    >
                      <div class="flex items-center space-x-2">
                        <Icon
                          icon={category.icon}
                          class="h-4 w-4 text-gray-500 dark:text-gray-400"
                        />
                        <span
                          class="text-sm font-medium text-gray-900 dark:text-gray-100"
                        >
                          {category.label}
                        </span>
                        {#if currentOverride}
                          <span
                            class="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                          >
                            {hasNumericOverride
                              ? `${currentOverride}%`
                              : currentOverride}
                          </span>
                        {/if}
                      </div>
                      <div class="flex items-center space-x-2">
                        <!-- Preset Sensitivity -->
                        <Select
                          value={hasPresetOverride ? currentOverride : "global"}
                          onChange={createSafeAction((value) => {
                            if (value === "global") {
                              smartContentFilter.updateCategoryOverride(
                                category.key,
                                undefined,
                              );
                            } else {
                              smartContentFilter.updateCategoryOverride(
                                category.key,
                                value,
                              );
                            }
                          })}
                          options={[
                            { value: "global", label: "Global" },
                            { value: "loose", label: "Loose" },
                            { value: "balanced", label: "Balanced" },
                            { value: "strict", label: "Strict" },
                            { value: "custom", label: "Custom" },
                          ]}
                          className="text-xs"
                        />

                        <!-- Custom Numeric Input -->
                        {#if hasNumericOverride || (hasPresetOverride && currentOverride === "custom")}
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="5"
                            value={hasNumericOverride ? currentOverride : 50}
                            oninput={createSafeAction((e) => {
                              const value = parseInt(
                                (e.target as HTMLInputElement).value,
                              );
                              if (!isNaN(value)) {
                                smartContentFilter.updateCategoryOverride(
                                  category.key,
                                  Math.max(0, Math.min(100, value)),
                                );
                              }
                            })}
                            class="w-16 rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700"
                            placeholder="0-100"
                          />
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <div
                  class="rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-700/50"
                >
                  <Icon
                    icon="tabler:info-circle"
                    class="mx-auto mb-2 h-8 w-8 text-gray-400"
                  />
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    {s(
                      "settings.contentFilter.sensitivityOverrides.noActive",
                    ) || "No category filters are currently active."}<br />
                    {s(
                      "settings.contentFilter.sensitivityOverrides.enableFilters",
                    ) ||
                      "Enable category filters above to customize their sensitivity settings."}
                  </p>
                </div>
              {/if}
            {/snippet}

            {@render sensitivityOverrideControls()}
          </div>

          <!-- Advanced Parameter Controls -->
          <div>
            <div class="mb-4 flex items-center gap-3">
              <Icon
                icon="tabler:settings-2"
                class="h-5 w-5 text-gray-500 dark:text-gray-400"
              />
              <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {s("settings.contentFilter.advancedParameters") ||
                  "Advanced Parameter Controls"}
              </h5>
            </div>
            <p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
              {s("settings.contentFilter.advancedParameters.description") ||
                "Fine-tune the filtering algorithm with detailed parameter controls. These settings affect how content quality, relevance, and sentiment are evaluated."}
            </p>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <!-- Minimum Quality Threshold -->
              <div
                class="rounded-lg border border-gray-200 p-3 dark:border-gray-600"
              >
                <div class="mb-2 flex items-center justify-between">
                  <div class="flex items-center space-x-1">
                    <Icon
                      icon="tabler:award"
                      class="h-4 w-4 text-gray-500 dark:text-gray-400"
                    />
                    <span
                      class="text-xs font-medium text-gray-700 dark:text-gray-300"
                    >
                      Quality Threshold
                    </span>
                    <Tooltip
                      text="Minimum content quality score (0-1). Higher values filter more aggressively based on content quality."
                    >
                      <Icon
                        icon="tabler:info-circle"
                        class="h-3 w-3 text-gray-400"
                      />
                    </Tooltip>
                  </div>
                  <span class="text-xs text-gray-600 dark:text-gray-400">
                    {smartContentFilter.preferences.minimumQuality.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={smartContentFilter.preferences.minimumQuality}
                  oninput={createSafeAction((e) =>
                    smartContentFilter.updatePreference(
                      "minimumQuality",
                      parseFloat((e.target as HTMLInputElement).value),
                    ))}
                  class="slider h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
                />
                <div
                  class="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400"
                >
                  <span>Permissive</span>
                  <span>Strict</span>
                </div>
              </div>

              <!-- Minimum Relevance Threshold -->
              <div
                class="rounded-lg border border-gray-200 p-3 dark:border-gray-600"
              >
                <div class="mb-2 flex items-center justify-between">
                  <div class="flex items-center space-x-1">
                    <Icon
                      icon="tabler:target"
                      class="h-4 w-4 text-gray-500 dark:text-gray-400"
                    />
                    <span
                      class="text-xs font-medium text-gray-700 dark:text-gray-300"
                    >
                      Relevance Threshold
                    </span>
                    <Tooltip
                      text="Minimum content relevance score (0-1). Higher values filter content that may be less relevant to your interests."
                    >
                      <Icon
                        icon="tabler:info-circle"
                        class="h-3 w-3 text-gray-400"
                      />
                    </Tooltip>
                  </div>
                  <span class="text-xs text-gray-600 dark:text-gray-400">
                    {smartContentFilter.preferences.minimumRelevance.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={smartContentFilter.preferences.minimumRelevance}
                  oninput={createSafeAction((e) =>
                    smartContentFilter.updatePreference(
                      "minimumRelevance",
                      parseFloat((e.target as HTMLInputElement).value),
                    ))}
                  class="slider h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
                />
                <div
                  class="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400"
                >
                  <span>Broad</span>
                  <span>Focused</span>
                </div>
              </div>

              <!-- Minimum Sentiment Threshold -->
              <div
                class="rounded-lg border border-gray-200 p-3 dark:border-gray-600"
              >
                <div class="mb-2 flex items-center justify-between">
                  <div class="flex items-center space-x-1">
                    <Icon
                      icon="tabler:mood-happy"
                      class="h-4 w-4 text-gray-500 dark:text-gray-400"
                    />
                    <span
                      class="text-xs font-medium text-gray-700 dark:text-gray-300"
                    >
                      Sentiment Threshold
                    </span>
                    <Tooltip
                      text="Minimum content sentiment score (0-1). Higher values filter more negative or pessimistic content."
                    >
                      <Icon
                        icon="tabler:info-circle"
                        class="h-3 w-3 text-gray-400"
                      />
                    </Tooltip>
                  </div>
                  <span class="text-xs text-gray-600 dark:text-gray-400">
                    {smartContentFilter.preferences.minimumSentiment.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={smartContentFilter.preferences.minimumSentiment}
                  oninput={createSafeAction((e) =>
                    smartContentFilter.updatePreference(
                      "minimumSentiment",
                      parseFloat((e.target as HTMLInputElement).value),
                    ))}
                  class="slider h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
                />
                <div
                  class="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400"
                >
                  <span>All Sentiment</span>
                  <span>Positive Only</span>
                </div>
              </div>
            </div>

            <!-- Parameter Explanations -->
            <div class="mt-4 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
              <div class="flex items-start space-x-2">
                <Icon
                  icon="tabler:lightbulb"
                  class="mt-0.5 h-4 w-4 text-blue-600 dark:text-blue-400"
                />
                <div class="text-xs text-blue-700 dark:text-blue-300">
                  <p class="mb-1 font-medium">Parameter Guidelines:</p>
                  <ul class="space-y-1">
                    <li>
                      • <strong>Quality:</strong> 0.0-0.3 = Permissive, 0.3-0.6 =
                      Balanced, 0.6+ = Strict
                    </li>
                    <li>
                      • <strong>Relevance:</strong> 0.0 = Disabled, 0.1-0.3 = Broad
                      interests, 0.3+ = Focused
                    </li>
                    <li>
                      • <strong>Sentiment:</strong> 0.0 = All content, 0.3+ = Reduce
                      negativity, 0.5+ = Positive focus
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/if}



      <!-- System Controls Section -->
      <div class="flex flex-col space-y-2">
        <div class="mb-1 flex items-center gap-2">
          <Icon
            icon="tabler:settings"
            class="h-4 w-4 text-gray-600 dark:text-gray-400"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {s("settings.contentFilter.systemControls") || "System Controls"}
          </span>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {s("settings.contentFilter.systemControls.description") ||
            "Import, export, and reset filter configurations"}
        </p>

        <div class="mt-4 space-y-4">
          <!-- Export/Import Section -->
          <div>
            <div class="mb-3 flex items-center gap-2">
              <Icon
                icon="tabler:database-export"
                class="h-4 w-4 text-gray-600 dark:text-gray-400"
              />
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {s("settings.contentFilter.backupRestore") ||
                  "Backup & Restore"}
              </h4>
            </div>
            <p class="mb-3 text-sm text-gray-500 dark:text-gray-400">
              {s("settings.contentFilter.backupDescription") ||
                "Export your content filter settings to a file or import from a previous backup"}
            </p>
            <div class="flex gap-3">
              <button
                onclick={exportConfiguration}
                class="flex items-center gap-2 rounded-md bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                <Icon icon="tabler:download" class="h-4 w-4" />
                {s("settings.contentFilter.export") || "Export Settings"}
              </button>
              <button
                onclick={() => fileInput?.click()}
                class="flex items-center gap-2 rounded-md bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                <Icon icon="tabler:upload" class="h-4 w-4" />
                {s("settings.contentFilter.import") || "Import Settings"}
              </button>
              <input
                bind:this={fileInput}
                type="file"
                accept=".json"
                onchange={handleFileSelect}
                class="hidden"
              />
            </div>
            {#if selectedFileName}
              <p class="mt-2 text-xs text-gray-600 dark:text-gray-400">
                Selected: {selectedFileName}
              </p>
            {/if}
          </div>

          <!-- Reset to Defaults -->
          <div class="flex flex-col space-y-2">
            <button
              type="button"
              onclick={handleResetClick}
              class={`flex w-full items-center justify-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                isResetConfirming
                  ? "bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                  : "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
              }`}
            >
              <Icon icon="tabler:refresh" class="h-4 w-4" />
              <span>
                {#if isResetConfirming}
                  {s("settings.resetSettings.confirm") || "Confirm Reset"}
                {:else}
                  {s("settings.contentFilter.reset.title") || "Reset Settings"}
                {/if}
              </span>
            </button>
            <p class="text-center text-xs text-gray-500 dark:text-gray-400">
              {#if isResetConfirming}
                {s("settings.resetSettings.confirmDescription") ||
                  "Click again to confirm reset"}
              {:else}
                {s("settings.contentFilter.reset.description") ||
                  "Reset all filter settings to their default values"}
              {/if}
            </p>
          </div>

          <!-- System Messages -->
          {#if systemMessage}
            <div
              class="rounded-lg p-4 {systemMessage.type === 'success'
                ? 'border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                : systemMessage.type === 'warning'
                  ? 'border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
                  : 'border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'}"
            >
              <div class="flex items-start space-x-3">
                <Icon
                  icon={systemMessage.type === "success"
                    ? "tabler:check-circle"
                    : systemMessage.type === "warning"
                      ? "tabler:alert-triangle"
                      : "tabler:x-circle"}
                  class="mt-0.5 h-5 w-5 {systemMessage.type === 'success'
                    ? 'text-green-600 dark:text-green-400'
                    : systemMessage.type === 'warning'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-red-600 dark:text-red-400'}"
                />
                <div class="flex-1">
                  <p
                    class="text-sm font-medium {systemMessage.type === 'success'
                      ? 'text-green-900 dark:text-green-100'
                      : systemMessage.type === 'warning'
                        ? 'text-amber-900 dark:text-amber-100'
                        : 'text-red-900 dark:text-red-100'}"
                  >
                    {systemMessage.title}
                  </p>
                  {#if systemMessage.description}
                    <p
                      class="mt-1 text-xs {systemMessage.type === 'success'
                        ? 'text-green-700 dark:text-green-300'
                        : systemMessage.type === 'warning'
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-red-700 dark:text-red-300'}"
                    >
                      {systemMessage.description}
                    </p>
                  {/if}
                </div>
                <button
                  type="button"
                  class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  onclick={() => (systemMessage = null)}
                >
                  <Icon icon="tabler:x" class="h-4 w-4" />
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>


<!-- Import Confirmation Dialog -->
{#if showImportConfirmation}
  <div
    class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black"
    role="dialog"
    aria-modal="true"
    aria-labelledby="import-dialog-title"
    aria-describedby="import-dialog-description"
    onclick={(e) => {
      if (e.target === e.currentTarget) cancelImport();
    }}
    onkeydown={(e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelImport();
      }
    }}
    tabindex="-1"
  >
    <div
      id="import-confirmation-modal"
      class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
    >
      <div class="mb-4 flex items-center space-x-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30"
        >
          <Icon
            icon="tabler:upload"
            class="h-6 w-6 text-amber-600 dark:text-amber-400"
          />
        </div>
        <div>
          <h3
            id="import-dialog-title"
            class="text-lg font-medium text-gray-900 dark:text-gray-100"
          >
            {s("settings.contentFilter.import.confirm.title") ||
              "Import Configuration"}
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {s("settings.contentFilter.import.confirm.subtitle") ||
              "This will replace your current settings"}
          </p>
        </div>
      </div>

      <div id="import-dialog-description" class="mb-6">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {s("settings.contentFilter.import.confirm.description") ||
            "Importing this configuration will replace all your current filter settings. This action cannot be undone."}
        </p>
        {#if selectedFileName}
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <strong>File:</strong>
            {selectedFileName}
          </p>
        {/if}
        {#if importWarning}
          <div class="mt-3 rounded-lg bg-orange-50 p-3 dark:bg-orange-900/20">
            <div class="flex items-start space-x-2">
              <Icon
                icon="tabler:alert-triangle"
                class="mt-0.5 h-4 w-4 text-orange-600 dark:text-orange-400"
              />
              <div class="text-xs text-orange-700 dark:text-orange-300">
                <p class="font-medium">Warning</p>
                <p class="mt-1">{importWarning}</p>
              </div>
            </div>
          </div>
        {/if}
        <div class="mt-3 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
          <div class="flex items-start space-x-2">
            <Icon
              icon="tabler:alert-triangle"
              class="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400"
            />
            <div class="text-xs text-amber-700 dark:text-amber-300">
              <p class="font-medium">
                {s("settings.contentFilter.import.confirm.warning") ||
                  "Warning: Current settings will be lost"}
              </p>
              <p class="mt-1">
                {s(
                  "settings.contentFilter.import.confirm.warning.description",
                ) ||
                  "Consider exporting your current settings first if you want to keep them as a backup."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="flex space-x-3">
        <button
          type="button"
          class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          onclick={cancelImport}
        >
          {s("settings.contentFilter.import.confirm.cancel") || "Cancel"}
        </button>
        <button
          type="button"
          class="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800"
          onclick={confirmImport}
        >
          {s("settings.contentFilter.import.confirm.confirm") ||
            "Import Settings"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- End of main content area -->
</main>

<style>
  .auto-rows-fr > * {
    height: 100%;
  }

  /* Range slider styling */
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    height: 20px;
    width: 20px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    border: 2px solid #ffffff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .slider::-webkit-slider-thumb:hover {
    background: #2563eb;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  .slider::-moz-range-thumb {
    height: 20px;
    width: 20px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    border: 2px solid #ffffff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .slider::-moz-range-thumb:hover {
    background: #2563eb;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  /* Dark mode slider styling */
  :global(.dark) .slider::-webkit-slider-thumb {
    background: #60a5fa;
    border-color: #374151;
  }

  :global(.dark) .slider::-webkit-slider-thumb:hover {
    background: #3b82f6;
  }

  :global(.dark) .slider::-moz-range-thumb {
    background: #60a5fa;
    border-color: #374151;
  }

  :global(.dark) .slider::-moz-range-thumb:hover {
    background: #3b82f6;
  }

  /* Range track styling */
  .slider::-webkit-slider-track {
    height: 8px;
    border-radius: 4px;
    background: #e5e7eb;
  }

  .slider::-moz-range-track {
    height: 8px;
    border-radius: 4px;
    background: #e5e7eb;
    border: none;
  }

  :global(.dark) .slider::-webkit-slider-track {
    background: #374151;
  }

  :global(.dark) .slider::-moz-range-track {
    background: #374151;
  }

  /* Skip link focus styling */
  .focus\:not-sr-only:focus {
    position: static !important;
    width: auto !important;
    height: auto !important;
    padding: 0.5rem 1rem !important;
    margin: 0 !important;
    overflow: visible !important;
    clip: auto !important;
    white-space: normal !important;
  }
</style>
