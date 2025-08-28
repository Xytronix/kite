<script lang="ts">
  import { browser } from "$app/environment";
  import { page } from "$app/state";
  import { s } from "$lib/client/localization.svelte";
  import CategoryNavigation from "$lib/components/CategoryNavigation.svelte";
  import ClientOnly from "$lib/components/ClientOnly.svelte";
  import DataLoader from "$lib/components/DataLoader.svelte";
  import Footer from "$lib/components/Footer.svelte";
  import Header from "$lib/components/Header.svelte";
  import HistoryManager from "$lib/components/HistoryManager.svelte";
  import IntroScreen from "$lib/components/IntroScreen.svelte";
  import OnThisDay from "$lib/components/OnThisDay.svelte";
  import Settings from "$lib/components/Settings.svelte";
  import SourceOverlay from "$lib/components/SourceOverlay.svelte";
  import StoryList from "$lib/components/StoryList.svelte";
  import TemporaryCategoryTooltip from "$lib/components/TemporaryCategoryTooltip.svelte";
  import TimeTravel from "$lib/components/TimeTravel.svelte";
  import WikipediaPopup from "$lib/components/WikipediaPopup.svelte";
  import { dataService, dataReloadService } from "$lib/services/dataService";
  import { imagePreloadingService } from "$lib/services/imagePreloadingService";
  import { navigationHandlerService } from "$lib/services/navigationHandlerService";
  import {
    UrlNavigationService,
    type NavigationParams,
  } from "$lib/services/urlNavigationService";
  import { feedDate } from "$lib/stores/feedDate.svelte";
  import { categories as categoriesStore } from "$lib/stores/categories.svelte.js";
  import { experimental } from "$lib/stores/experimental.svelte.js";
  import type { SupportedLanguage } from "$lib/stores/language.svelte";
  import { language } from "$lib/stores/language.svelte.js";
  import { settings } from "$lib/stores/settings.svelte.js";
  import { timeTravel } from "$lib/stores/timeTravel.svelte.js";
  import { timeTravelBatch } from "$lib/stores/timeTravelBatch.svelte.js";
  import type { Category, Story, OnThisDayEvent } from "$lib/types";
  import { categorySwipeHandler } from "$lib/utils/categorySwipeHandler";
  import { formatTimeAgo } from "$lib/utils/formatTimeAgo";
  import {
    clearImageCache,
    getImageCacheStats,
    extractStoryImages,
  } from "$lib/utils/imagePreloader";
  import { slugify } from "$lib/utils/urlShortener";
  import { onMount } from "svelte";

  // App state
  let dataLoaded = $state(false);
  const offlineMode = $state(false);
  let lastLoadedCategory = $state(""); // Track last loaded category to prevent duplicates
  let temporaryCategory = $state<string | null>(null);
  let showTemporaryCategoryTooltip = $state(false);
  let temporaryCategoryElement = $state<HTMLElement | null>(null);
  let desktopCategoryNavigation = $state<any>();
  let pendingUrlNavigation = $state<NavigationParams | null>(null); // Store URL navigation until data is loaded

  // Derive the header position reactively from the settings store. Using `.by` ensures we
  // properly subscribe to the underlying state instead of capturing a static value.
  const categoryHeaderPosition = $derived.by(
    () => settings.categoryHeaderPosition,
  );

  // React to story count setting changes
  const storyCountSetting = $derived.by(() => settings.storyCount);

  // Data state
  let categories = $state<Category[]>([]);
  let currentCategory = $state("World");

  // Track when currentCategory changes
  $effect(() => {
    persistentLogMain("🔍 currentCategory changed", {
      newValue: currentCategory,
      stack: new Error().stack?.split("\n").slice(1, 4).join(" | "),
    });
  });
  let stories = $state<Story[]>([]);
  let onThisDayEvents = $state<OnThisDayEvent[] | null>(null);
  let onThisDayLoading = $state(false);
  let readStories = $state<Record<string, boolean>>({});
  let totalReadCount = $state(0);
  // totalStoriesRead is now a derived value based on readStories
  let lastUpdated = $state("");
  let allCategoryStories = $state<Record<string, Story[]>>({});
  let categoryMap = $state<Record<string, string>>({}); // Map category ID to UUID
  let currentBatchId = $state<string>("");
  let latestBatchId = $state<string>(""); // Track the original latest batch ID
  let batchTimestamp = $state<number>(0); // Timestamp of the current batch
  let categoryHasMore = $state<Record<string, boolean>>({});
  let categoryLimits = $state<Record<string, number>>({});
  let batchList = $state<Array<{ id: string; createdAt: string }>>([]);
  let batchesLoaded = $state(false);
  // Track batches and their story counts
  let catBatches: { [categoryId: string]: string[] } = {};
  let catBatchesIndex: { [categoryId: string]: number } = {};
  let catBatchSizes: { [categoryId: string]: { [batchId: string]: number } } =
    {}; // Track actual batch sizes
  let catDailyBatches: {
    [categoryId: string]: { [dateKey: string]: string[] };
  } = {}; // Group batches by day

  // Flag to show loading indicator when switching categories or fetching more
  let storiesLoading = $state<boolean>(false);

  async function fetchBatchList() {
    if (batchesLoaded) return;
    try {
      // Fetch batches from the last 30 days to ensure we have historical content
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // 30 days ago

      console.log(
        "📋 Fetching batch list from",
        startDate.toISOString(),
        "to",
        endDate.toISOString(),
      );

      const resp = await fetch(
        `/api/batches?from=${startDate.toISOString()}&to=${endDate.toISOString()}&lang=${language.data}`,
      );
      if (resp.ok) {
        const data = await resp.json();
        batchList = data.batches.map((b: any) => ({
          id: b.id,
          createdAt: b.createdAt,
        }));
        batchesLoaded = true;
        console.log(
          "✅ Fetched",
          batchList.length,
          "batches for historical loading",
        );
      } else {
        console.error(
          "❌ Failed to fetch batch list:",
          resp.status,
          resp.statusText,
        );

        // For API failures (500/502/503), mark all categories as having no more content
        // to prevent infinite retry loops
        if (resp.status >= 500) {
          console.warn(
            "⚠️ API server error detected - disabling load more for all categories",
          );
          Object.keys(categoryHasMore).forEach((cat) => {
            categoryHasMore[cat] = false;
          });

          // Set empty batch list to prevent further attempts
          batchList = [];
          batchesLoaded = true;
          return;
        }
      }
    } catch (err) {
      console.error("Failed to fetch batch list", err);

      // For network errors, also disable load more to prevent infinite retries
      console.warn(
        "⚠️ Network error fetching batch list - disabling load more for all categories",
      );
      Object.keys(categoryHasMore).forEach((cat) => {
        categoryHasMore[cat] = false;
      });

      // Set empty batch list to prevent further attempts
      batchList = [];
      batchesLoaded = true;
    }
  }

  // Helper function to get date key from batch
  function getBatchDateKey(batchId: string): string {
    const batchInfo = batchList.find((b) => b.id === batchId);
    if (batchInfo) {
      const date = new Date(batchInfo.createdAt);
      return date.toISOString().split("T")[0]; // YYYY-MM-DD format
    }
    // Fallback for unknown batches: use a stable per-batch key (avoid mislabeling as today)
    return `unknown-${batchId.substring(0, 8)}`;
  }

  // State for source overlay
  let showSourceOverlay = $state(false);
  let currentSource = $state<any>(null);
  let sourceArticles = $state<any[]>([]);
  let currentMediaInfo = $state<any>(null);
  let isLoadingMediaInfo = $state(false);

  // State for chaos index
  let chaosIndex = $state({
    score: 0,
    summary: "",
    lastUpdated: "",
  });

  // State for view mode (currently unused but reserved for future map view)
  // let viewMode = $state<'list' | 'map'>('list');

  // State for Wikipedia popup
  let wikipediaPopup = $state({
    visible: false,
    title: "",
    content: "",
    imageUrl: "",
    wikiUrl: "",
  });

  // State for story URL management - Initialize with empty reactive objects
  let expandedStories = $state<Record<string, boolean>>({});
  // Map of category -> expanded stories for that category
  let expandedStoriesByCategory = $state<
    Record<string, Record<string, boolean>>
  >({});
  // NEW: Load persisted expanded story state from localStorage (if available)
  if (typeof localStorage !== "undefined") {
    try {
      const persisted = localStorage.getItem("expandedStoriesByCategory");
      if (persisted) {
        expandedStoriesByCategory = JSON.parse(persisted);
      }
    } catch (err) {
      console.warn(
        "Failed to parse expandedStoriesByCategory from storage",
        err,
      );
    }
  }

  // Persist map to localStorage whenever it changes
  $effect(() => {
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(
          "expandedStoriesByCategory",
          JSON.stringify(expandedStoriesByCategory),
        );
      } catch (err) {
        console.warn(
          "Failed to save expandedStoriesByCategory to storage",
          err,
        );
      }
    }
  });

  // Time travel state per category
  let timeTravelByCategory = $state<Record<string, boolean>>({});
  let isLatestBatch = $state(true);
  let historyManager = $state<HistoryManager>();

  // Compute current story index from expanded stories
  const currentStoryIndex = $derived.by(() => {
    const expandedStoryId = Object.keys(expandedStories).find(
      (id) => expandedStories[id],
    );
    if (!expandedStoryId) return null;

    // Parse the category-aware story ID (format: "category:batchId:baseStoryId")
    const parts = expandedStoryId.split(":");
    let baseStoryId;

    if (parts.length === 3) {
      [, , baseStoryId] = parts; // Extract baseStoryId from category:batchId:baseStoryId
    } else if (parts.length === 2) {
      [, baseStoryId] = parts; // Legacy format: batchId:baseStoryId
    } else {
      baseStoryId = expandedStoryId; // Very old format: just the story ID
    }

    // Find the story using the base story ID
    const story = stories.find((s) => {
      const clusterId = s.cluster_number?.toString();
      const title = s.title;

      // Prefer cluster_number match, fallback to title
      return (
        (clusterId && clusterId === baseStoryId) ||
        (!clusterId && title === baseStoryId)
      );
    });

    if (!story) return null;

    // Calculate index based on batch context - use same logic as story toggle
    if (isLatestBatch && !(story as any).__fromHistoricalBatch) {
      // For latest batch current stories, use index among current batch stories only (exclude historical)
      const currentBatchStories = stories.filter(
        (s) => !(s as any).__fromHistoricalBatch,
      );
      return currentBatchStories.indexOf(story);
    } else {
      // For historical batches or historical stories, use index among all displayed stories
      return stories.indexOf(story);
    }
  });

  // Check if we have historical stories to show restore button
  const hasHistoricalStories = $derived.by(() => {
    if (!allCategoryStories[currentCategory]) return false;
    return allCategoryStories[currentCategory].some(
      (item) =>
        (item as any).__fromHistoricalBatch || (item as any).__dateDivider,
    );
  });

  // Create ordered categories based on store order
  const orderedCategories = $derived.by(() => {
    if (categories.length === 0 || categoriesStore.enabled.length === 0) {
      return categories;
    }

    // Filter only enabled categories and order them according to store order
    // Now that the store always uses IDs, we only need to check cat.id
    const enabledCategories = categories.filter(
      (cat) =>
        categoriesStore.enabled.includes(cat.id) ||
        (temporaryCategory && cat.id === temporaryCategory), // Include temporary category
    );

    // Sort by store order - use toSorted() to avoid mutations
    return [...enabledCategories].sort((a, b) => {
      const aIndex = categoriesStore.enabled.findIndex((id) => id === a.id);
      const bIndex = categoriesStore.enabled.findIndex((id) => id === b.id);

      // If both categories are in the enabled list, sort by their order
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      // If one is temporary (not in enabled list), put it at the end
      if (aIndex === -1 && bIndex !== -1) return 1; // a is temporary, put after b
      if (aIndex !== -1 && bIndex === -1) return -1; // b is temporary, put after a

      // If both are not in enabled (e.g., temporary + disabled), fall back to the master order list
      const orderA = categoriesStore.order.findIndex((id) => id === a.id);
      const orderB = categoriesStore.order.findIndex((id) => id === b.id);
      return orderA - orderB;
    });
  });

  // Show restore UI when the currently displayed today's stories exceed the user's target (e.g., 3→12)
  const canRestoreToToday = $derived.by(() => {
    try {
      const displayedTodayCount = (stories || []).filter(
        (it: any) => !(it?.__dateDivider) && !(it?.__fromHistoricalBatch),
      ).length;
      return displayedTodayCount > settings.storyCount;
    } catch {
      return false;
    }
  });

  // Data loading functions
  function handleDataLoaded(data: {
    categories: Category[];
    stories: Story[];
    totalReadCount: number;
    lastUpdated: string;
    currentCategory: string;
    allCategoryStories: Record<string, Story[]>;
    categoryMap: Record<string, string>;
    batchId: string;
    batchTimestamp: number;
    chaosIndex?: number;
    chaosDescription?: string;
    chaosLastUpdated?: string;
    isLatestBatch: boolean;
    temporaryCategory?: string | null;
    onThisDayEvents?: OnThisDayEvent[];
  }) {
    // Reset app state for fresh data
    expandedStories = {};
    lastLoadedCategory = "";
    lastEffectLoadedCategory = "";

    // Close any open overlays
    if (showSourceOverlay) {
      handleCloseSource();
    }
    if (wikipediaPopup.visible) {
      closeWikipediaPopup();
    }

    // Load new data
    categories = data.categories;
    stories = data.stories;
    totalReadCount = data.totalReadCount;
    lastUpdated = data.lastUpdated;
    currentCategory = data.currentCategory;
    // Restore any persisted expanded stories for this category
    expandedStories = { ...(expandedStoriesByCategory[currentCategory] ?? {}) };

    // Set time travel state for this category
    timeTravelByCategory[currentCategory] = !data.isLatestBatch;
    allCategoryStories = data.allCategoryStories;
    categoryMap = data.categoryMap;
    currentBatchId = data.batchId;
    batchTimestamp = data.batchTimestamp;
    // Set latestBatchId only if we're loading the latest batch (not in time travel mode)
    if (data.isLatestBatch) {
      latestBatchId = data.batchId;
    }
    lastLoadedCategory = data.currentCategory; // Set the guard for initial load

    // Ensure all initial stories have correct batch ID information
    const batchIdToUse = data.batchId;
    Object.keys(allCategoryStories).forEach((categoryId) => {
      allCategoryStories[categoryId].forEach((story) => {
        if (!(story as any).__batchId) {
          (story as any).__batchId = batchIdToUse;
        }
        if (!data.isLatestBatch) {
          (story as any).__fromHistoricalBatch = true;
        }
      });
    });

    // Also update the current stories array
    stories.forEach((story) => {
      if (!(story as any).__batchId) {
        (story as any).__batchId = batchIdToUse;
      }
      if (!data.isLatestBatch) {
        (story as any).__fromHistoricalBatch = true;
      }
    });

    // Set OnThisDay events from preloaded data
    if (data.onThisDayEvents) {
      onThisDayEvents = data.onThisDayEvents;
      console.log(
        `📅 Preloaded ${onThisDayEvents.length} OnThisDay events during splash screen`,
      );
    }

    // Use the isLatestBatch value from DataLoader
    isLatestBatch = data.isLatestBatch;

    // Clear time travel UI state if we're on the latest batch
    if (isLatestBatch) {
      timeTravel.reset();
    }

    // Set chaos index from initial load
    if (
      data.chaosIndex !== undefined &&
      data.chaosDescription &&
      data.chaosLastUpdated
    ) {
      chaosIndex = {
        score: data.chaosIndex,
        summary: data.chaosDescription,
        lastUpdated: data.chaosLastUpdated,
      };
    }

    // Handle temporary category
    if (data.temporaryCategory) {
      temporaryCategory = data.temporaryCategory;
      // Tooltip will appear on hover only
    }

    dataLoaded = true;

    console.log(
      `🚀 Loaded ${Object.keys(allCategoryStories).length} categories with ${Object.values(allCategoryStories).flat().length} total stories`,
    );

    // Trigger favicon preloading for enabled categories after data is loaded
    if (browser) {
      import("$lib/utils/citationUtils").then(({ preloadCommonFavicons }) => {
        import("$lib/stores/categories.svelte").then(
          ({ categories: categoriesStore }) => {
            const enabledCategories = categoriesStore.enabled;
            preloadCommonFavicons(allCategoryStories, enabledCategories).catch(
              (error) => {
                console.warn(
                  "Failed to preload favicons after data load:",
                  error,
                );
              },
            );
          },
        );
      });
    }

    // After initial data load, ensure URL has the current batch ID
    if (browser) {
      const urlParams = parseInitialUrl();

      let storyToExpand: Story | undefined;
      if (urlParams.slug) {
        storyToExpand = stories.find(
          (s) => slugify(s.title) === urlParams.slug,
        );
        console.log("🔍 Looking for story by slug:", {
          slug: urlParams.slug,
          found: !!storyToExpand,
          title: storyToExpand?.title,
          totalStories: stories.length,
        });
      } else if (
        urlParams.storyIndex !== undefined &&
        urlParams.storyIndex !== null
      ) {
        // For historical batches, look at all stories; for current batch, filter out historical
        let storiesToSearch = stories;
        if (isLatestBatch) {
          storiesToSearch = stories.filter(
            (s) => !(s as any).__fromHistoricalBatch,
          );
        }

        console.log("🔍 Looking for story by index:", {
          index: urlParams.storyIndex,
          isLatestBatch,
          totalStories: stories.length,
          searchableStories: storiesToSearch.length,
          batchId: data.batchId,
        });

        if (storiesToSearch[urlParams.storyIndex]) {
          storyToExpand = storiesToSearch[urlParams.storyIndex];
          console.log("✅ Found story at index:", {
            index: urlParams.storyIndex,
            title: storyToExpand.title,
            clusterId: storyToExpand.cluster_number,
          });
        } else {
          console.warn(
            "❌ Story not found at index:",
            urlParams.storyIndex,
            "in",
            storiesToSearch.length,
            "searchable stories",
          );
        }
      }

      if (storyToExpand) {
        // Expand the story from URL - create new object to avoid mutation
        const story = storyToExpand;
        const baseStoryId = story.cluster_number?.toString() || story.title;
        // Use the current batch ID from the data load, not the story's __batchId which might not be set yet
        const batchId = data.batchId;
        // Use category-aware story ID
        const storyId = `${currentCategory}:${batchId}:${baseStoryId}`;
        expandedStories = { ...expandedStories, [storyId]: true };
        console.log("🎯 Initial story expansion from URL:", {
          storyIndex: urlParams.storyIndex,
          slug: urlParams.slug,
          storyId,
          title: story.title,
          isLatestBatch,
          batchId: data.batchId,
        });
      } else if (
        urlParams.storyIndex !== undefined ||
        urlParams.slug !== undefined
      ) {
        console.warn("❌ Could not find story to expand from URL:", {
          storyIndex: urlParams.storyIndex,
          slug: urlParams.slug,
          totalStories: stories.length,
          isLatestBatch,
          batchId: data.batchId,
        });
      }
    }

    // Initialize limits and hasMore map for categories
    categoryLimits = {};
    categoryHasMore = {};
    for (const catId of data.categories.map((c) => c.id)) {
      categoryLimits[catId] = settings.storyCount;
      categoryHasMore[catId] = true; // assume more until proven otherwise
    }

    // Mark initial load as complete
    persistentLogMain("✅ Initial load completed");

    // Handle any pending URL navigation that was deferred until data was loaded
    if (pendingUrlNavigation) {
      persistentLogMain("🔄 Processing pending URL navigation", {
        pendingUrlNavigation,
      });
      const pendingParams = pendingUrlNavigation;
      pendingUrlNavigation = null; // Clear the pending navigation

      // Process the pending navigation after a small delay to ensure state is settled
      setTimeout(() => {
        handleUrlNavigation(pendingParams);
      }, 100);
    }

    // Fetch list of batches for cross-day load
    fetchBatchList();
  }

  function handleDataError(error: string) {
    console.error("Data loading error:", error);
    // Could show error state here if needed
    dataLoaded = true; // Still show the app with fallback data
  }

  // Function to log persistently in main page
  function persistentLogMain(message: string, data?: any) {
    if (!browser) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      message: `[MAIN] ${message}`,
      data,
      url: window.location.href,
    };

    try {
      const logs = JSON.parse(localStorage.getItem("kite-debug-logs") || "[]");
      logs.push(logEntry);
      if (logs.length > 50) logs.splice(0, logs.length - 50);
      localStorage.setItem("kite-debug-logs", JSON.stringify(logs));
    } catch (e) {
      console.warn("Failed to save persistent log:", e);
    }

    console.log(`[PERSISTENT MAIN] ${message}`, data || "");
  }

  // Debug utilities for the browser console
  if (browser) {
    (window as any).clearKiteLogs = () => {
      localStorage.removeItem("kite-debug-logs");
      console.log("✅ Kite debug logs cleared");
    };

    (window as any).showKiteLogs = () => {
      try {
        const logs = JSON.parse(
          localStorage.getItem("kite-debug-logs") || "[]",
        );
        console.table(logs.slice(-20)); // Show last 20 logs
        return logs;
      } catch (e) {
        console.log("No logs found");
        return [];
      }
    };

    (window as any).showKiteLogsBeforeRefresh = () => {
      try {
        const logs = JSON.parse(
          localStorage.getItem("kite-debug-logs") || "[]",
        );
        const refreshIndex = logs.findIndex((log: any) =>
          log.message.includes("📱 StoryList mounted"),
        );
        if (refreshIndex > 0) {
          const beforeRefresh = logs.slice(0, refreshIndex);
          console.group("🔍 Logs before last refresh:");
          beforeRefresh.slice(-10).forEach((log: any) => {
            console.log(`[${log.timestamp}] ${log.message}`, log.data || "");
          });
          console.groupEnd();
          return beforeRefresh;
        } else {
          console.log("No refresh detected in logs");
          return [];
        }
      } catch (e) {
        console.log("Error reading logs:", e);
        return [];
      }
    };
  }

  // Flag to prevent navigation during load more
  let isLoadingMore = $state(false);

  // Queue to apply the latest load request if another request arrives while a load is in progress
  let pendingLoadRequests: Record<
    string,
    {
      increment: boolean;
      autoTopUpAttempted: boolean;
      restrictToCurrentBatch: boolean;
    } | null
  > = {};

  // Mark all displayed stories as read
  function markAllAsRead() {
    // Get current displayed stories
    const storiesToMark = stories.filter(
      (item) => !(item as any).__dateDivider,
    );

    // Defer state mutations to avoid issues when called from reactive contexts
    setTimeout(() => {
      for (const story of storiesToMark) {
        const baseStoryId = story.cluster_number?.toString() || story.title;
        const storyBatchId = (story as any).__batchId || currentBatchId;
        // Use category-aware story ID for mark all as read
        const storyId = `${currentCategory}:${storyBatchId}:${baseStoryId}`;
        readStories[storyId] = true;
      }
      console.log("✅ Marked", storiesToMark.length, "stories as read");
    }, 0);
  }

  // Mark all displayed stories as unread
  function markAllAsUnread() {
    // Get current displayed stories
    const storiesToMark = stories.filter(
      (item) => !(item as any).__dateDivider,
    );

    // Defer state mutations to avoid issues when called from reactive contexts
    setTimeout(() => {
      for (const story of storiesToMark) {
        const baseStoryId = story.cluster_number?.toString() || story.title;
        const storyBatchId = (story as any).__batchId || currentBatchId;
        // Use category-aware story ID for mark all as unread
        const storyId = `${currentCategory}:${storyBatchId}:${baseStoryId}`;
        readStories[storyId] = false;
      }
      console.log("✅ Marked", storiesToMark.length, "stories as unread");
    }, 0);
  }

  // Function to restore to today's stories only (remove historical stories)
  function restoreToToday() {
    if (!allCategoryStories[currentCategory]) return;

    persistentLogMain("🔄 Restoring to today's stories only", {
      category: currentCategory,
      totalStories: allCategoryStories[currentCategory].length,
    });


    // Ensure any transient loading states are cleared so UI doesn't show spinners
    isLoadingMore = false;
    storiesLoading = false;
    if (pendingLoadRequests[currentCategory]) {
      persistentLogMain("🧹 Clearing queued load due to restoreToToday", {
        category: currentCategory,
      });
      pendingLoadRequests[currentCategory] = null;
    }

    // Filter out historical stories and date dividers
    const todayStories = allCategoryStories[currentCategory].filter((item) => {
      if ((item as any).__dateDivider) return false; // Remove all date dividers
      if ((item as any).__fromHistoricalBatch) return false; // Remove historical stories
      return true; // Keep today's stories
    });

    // Reset per-category limit to user setting when restoring
    categoryLimits[currentCategory] = settings.storyCount;

    // Update the category stories and current display
    allCategoryStories[currentCategory] = todayStories;
    // Also purge historical items for all categories to avoid cross-day bleed after restore
    try {
      Object.keys(allCategoryStories).forEach((catId) => {
        const todayOnly = (allCategoryStories[catId] || []).filter((it: any) => !(it?.__dateDivider) && !(it?.__fromHistoricalBatch));
        allCategoryStories[catId] = todayOnly as any;
        catBatchesIndex[catId] = 0;
        catBatches[catId] = [currentBatchId];
        try { catBatchSizes[catId] = {}; } catch {}
        try { catDailyBatches[catId] = {}; } catch {}
      });
    } catch {}
    stories = todayStories.slice(
      0,
      Math.min(
        categoryLimits[currentCategory] || settings.storyCount,
        todayStories.length,
      ),
    );

    // Reset batch tracking and day caches for this category
    catBatchesIndex[currentCategory] = 0;
    catBatches[currentCategory] = [currentBatchId];
    try { catBatchSizes[currentCategory] = {}; } catch {}
    try { catDailyBatches[currentCategory] = {}; } catch {}

    // Re-enable load more
    categoryHasMore[currentCategory] = todayStories.length > 0;

    // Ensure we are in latest mode after restoring
    try {
      isLatestBatch = true;
      dataService.setTimeTravelBatch(null);
    } catch {}

    console.log(
      "✅ Restored to today's stories:",
      todayStories.length,
      "stories",
    );
    persistentLogMain("✅ Restore completed", {
      todayStoriesCount: todayStories.length,
      displayedCount: stories.length,
    });
  }

  // Triggered by StoryList load more
  async function handleLoadMore() {
    // Prevent overlapping load more operations
    if (isLoadingMore) {
      persistentLogMain("🚫 handleLoadMore blocked: already loading");
      return;
    }

    // Create a timeout to ensure the flag is always reset
    const timeoutId = setTimeout(() => {
      if (isLoadingMore) {
        persistentLogMain(
          "⏰ Load more timeout - forcing reset of isLoadingMore flag",
        );
        isLoadingMore = false;
      }
    }, 30000); // 30 second timeout

    try {
      isLoadingMore = true;
      persistentLogMain("🔄 handleLoadMore called", {
        category: currentCategory,
        canLoadMore: categoryHasMore[currentCategory],
        currentBatchId,
        timeTravelBatchId: timeTravelBatch.batchId,
        isLatestBatch,
        storiesCount: stories?.length || 0,
      });

      // Double check that we can actually load more
      if (!categoryHasMore[currentCategory]) {
        persistentLogMain(
          "❌ handleLoadMore blocked: categoryHasMore is false",
          {
            category: currentCategory,
            categoryHasMore: categoryHasMore[currentCategory],
          },
        );
        return;
      }

      persistentLogMain("🚀 About to call loadStoriesForCategory", {
        category: currentCategory,
      });
      await loadStoriesForCategory(currentCategory, true);
      persistentLogMain("✅ loadStoriesForCategory completed", {
        category: currentCategory,
      });
    } catch (error) {
      persistentLogMain("❌ handleLoadMore failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Reset categoryHasMore to prevent infinite retry loops on persistent errors
      if (
        error instanceof Error &&
        (error.message.includes("timeout") || error.message.includes("network"))
      ) {
        categoryHasMore[currentCategory] = false;
        persistentLogMain("🛑 Disabling load more due to persistent error");
      }
    } finally {
      // Always reset the flag and clear timeout
      clearTimeout(timeoutId);
      isLoadingMore = false;
      persistentLogMain(
        "🔧 Load more operation completed, resetting isLoadingMore flag",
      );
    }
  }

  async function loadStoriesForCategory(
    categoryId: string,
    increment: boolean = false,
    autoTopUpAttempted: boolean = false,
    restrictToCurrentBatch: boolean = false,
  ) {
    // Helper: trim trailing date dividers to avoid ending list on a divider
    function removeTrailingDateDividers<T = any>(items: T[]): T[] {
      let end = items.length;
      while (end > 0 && (items[end - 1] as any)?.__dateDivider) {
        end--;
      }
      return end === items.length ? items : items.slice(0, end);
    }
    persistentLogMain("🔧 loadStoriesForCategory starting", {
      categoryId,
      increment,
    });
    console.log("📖 loadStoriesForCategory called:", { categoryId, increment });

    // Prevent duplicate loading calls
    if (storiesLoading && lastLoadedCategory === categoryId) {
      console.log(
        "⏳ Blocked duplicate load – queued re-run to apply latest limit",
        { increment },
      );
      pendingLoadRequests[categoryId] = {
        increment,
        autoTopUpAttempted,
        restrictToCurrentBatch,
      };
      return;
    }

    storiesLoading = true;
    // Handle OnThisDay separately
    if (categoryId === "onthisday") {
      await loadOnThisDayEvents();
      storiesLoading = false;
      return;
    }

    // Preload icons for this category's stories
    if (allCategoryStories[categoryId]) {
      Promise.all([
        import("$lib/utils/iconPreloader").then(
          ({ preloadSourceIcons, preloadStoryIcons }) => {
            // Preload source icons
            const domains = new Set<string>();
            allCategoryStories[categoryId].forEach((story: any) => {
              if (story.articles) {
                story.articles.forEach((article: any) => {
                  if (article.domain) domains.add(article.domain);
                });
              }
            });
            preloadSourceIcons(Array.from(domains));

            // Preload story emojis
            preloadStoryIcons(allCategoryStories[categoryId]);
          },
        ),
        import("$lib/services/iconService").then(({ iconService }) => {
          // Preload common iconify icons
          const commonIcons = [
            "heroicons-outline:globe-alt",
            "material-symbols:public",
            "mdi:web",
          ];
          iconService.preload(commonIcons, false); // Pass array of icons
        }),
      ]).catch((err) => {
        console.warn("Failed to preload icons for category:", err);
      });
    }

    // Compute requested limit
    if (!categoryLimits[categoryId]) {
      categoryLimits[categoryId] = settings.storyCount;
      console.log(
        "🆕 Initialized category limit for",
        categoryId,
        "to:",
        settings.storyCount,
        "(user setting)",
      );
    }
    if (increment && !autoTopUpAttempted) {
      const oldLimit = categoryLimits[categoryId];

      // If we're starting from an empty view (no displayed items yet),
      // do not double the limit; keep it at the user's Stories per Category
      const currentlyShown = (stories || []).filter(
        (item: any) => !(item as any).__dateDivider,
      ).length;
      if (currentlyShown === 0) {
        categoryLimits[categoryId] = settings.storyCount;
      } else {
        // Smart completion logic: complete the current day if only a small remainder remains
        // Works for both current day and historical batches; day size is determined dynamically

        // Determine which batch we're currently loading from
        const currentLoadingIndex = catBatchesIndex[categoryId] || 0;
        const currentLoadingBatch = batchList[currentLoadingIndex];

        if (currentLoadingBatch && allCategoryStories[categoryId]) {
          // Get the date for the current batch
          const currentDateKey = getBatchDateKey(currentLoadingBatch.id);
          const batchesForCurrentDay = catDailyBatches[categoryId]?.[
            currentDateKey
          ] || [currentLoadingBatch.id];

          // Calculate total stories from all batches for this day
          let totalDailyBatchSize = 0;
          let storiesFromCurrentDay = 0;

          for (const dayBatchId of batchesForCurrentDay) {
            // Add batch size (if known)
            if (catBatchSizes[categoryId]?.[dayBatchId]) {
              totalDailyBatchSize += catBatchSizes[categoryId][dayBatchId];
            }
          }

          // If we don't know the daily batch size yet, try to determine it dynamically for current day
          if (totalDailyBatchSize === 0) {
            if (currentLoadingIndex === 0) {
              try {
                const currentBatch = currentLoadingBatch?.id || currentBatchId;
                const catUuidEstimate = categoryMap[categoryId];
                if (currentBatch && catUuidEstimate) {
                  const estimate = await dataService.loadStories(
                    currentBatch,
                    catUuidEstimate,
                    50,
                    language.data,
                  );
                  const estimatedSize = (estimate?.stories?.length || 0);
                  if (estimatedSize > 0) {
                    totalDailyBatchSize = estimatedSize;
                    if (!catBatchSizes[categoryId]) catBatchSizes[categoryId] = {};
                    catBatchSizes[categoryId][currentBatch] = estimatedSize;
                    console.log(
                      "📏 Dynamically estimated daily batch size:",
                      estimatedSize,
                    );
                  }
                }
              } catch (e) {
                console.log(
                  "⚠️ Dynamic daily batch size estimate failed; skipping day completion",
                  e,
                );
              }
            }
          }

          // Count stories from current day
          if (currentLoadingIndex === 0) {
            // Current day - count non-historical stories that are currently displayed (ignore cached extras)
            storiesFromCurrentDay = (stories || []).filter(
              (item: any) =>
                !(item as any).__dateDivider &&
                !(item as any).__fromHistoricalBatch,
            ).length;
          } else {
            // Historical day - count stories since last date divider
            let storiesAfterLastDivider = 0;
            for (
              let i = allCategoryStories[categoryId].length - 1;
              i >= 0;
              i--
            ) {
              const item = allCategoryStories[categoryId][i];
              if ((item as any).__dateDivider) break;
              if (!(item as any).__dateDivider) storiesAfterLastDivider++;
            }
            storiesFromCurrentDay = storiesAfterLastDivider;
          }

          // Remaining items in today's content (do not cap by user setting; we may spill into yesterday if needed)
          const remainingInCurrentDay = Math.max(
            0,
            totalDailyBatchSize - storiesFromCurrentDay,
          );
          const userIncrement = settings.storyCount;
          const isCurrentDay = currentLoadingIndex === 0;
          const isFirstManualLoadMore = increment && oldLimit === settings.storyCount;

          console.log("🔍 Daily completion check:", {
            dateKey: currentDateKey,
            batchesForDay: batchesForCurrentDay.length,
            dailyBatchIds: batchesForCurrentDay.map((id) => id.substring(0, 8)),
            storiesFromDay: storiesFromCurrentDay,
            totalDailySize: totalDailyBatchSize || "unknown",
            remainingInDay: remainingInCurrentDay,
            userSetting: userIncrement,
            shouldComplete:
              storiesFromCurrentDay > 0 &&
              totalDailyBatchSize > 0 &&
              storiesFromCurrentDay < totalDailyBatchSize &&
              remainingInCurrentDay <= userIncrement * 1.5 &&
              remainingInCurrentDay > 0,
          });

          // Complete today's remaining stories only when it's a small remainder and we already have some of today loaded
          if (
            totalDailyBatchSize > 0 &&
            storiesFromCurrentDay > 0 &&
            storiesFromCurrentDay < totalDailyBatchSize &&
            remainingInCurrentDay > 0 &&
            // Only use "complete day first" for small per-category settings (e.g., 3, 4, 5)
            userIncrement <= 5 &&
            // On the first manual load more, always complete the day regardless of remainder size
            (isFirstManualLoadMore || remainingInCurrentDay <= userIncrement * 1.5)
          ) {
            // Target: complete today first, but allow exceeding the increment or spilling into yesterday
            const targetIncrement = Math.max(remainingInCurrentDay, userIncrement);
            categoryLimits[categoryId] = oldLimit + targetIncrement;
            // Restrict to current batch only if we can satisfy the target within today; otherwise allow historical spill
            restrictToCurrentBatch = remainingInCurrentDay >= userIncrement;
            console.log(
              "📅 Completing current day first with flexible target: from",
              oldLimit,
              "to",
              categoryLimits[categoryId],
              `(+${targetIncrement}, finish today${remainingInCurrentDay < userIncrement ? " and spill" : ""} ${currentDateKey})`,
            );
          } else {
            // Normal increment using user setting (fetch across days as needed) and cap exactly to increment size
            categoryLimits[categoryId] = oldLimit + userIncrement;
            console.log(
              currentLoadingIndex === 0
                ? "📈 Normal increment (current day)"
                : "🕰️ Historical increment",
              "from",
              oldLimit,
              "to:",
              categoryLimits[categoryId],
              "(+" + userIncrement + ")",
            );
          }
        } else {
          // Fallback to normal increment
          categoryLimits[categoryId] += settings.storyCount;
          console.log(
            "📈 Fallback increment: from",
            oldLimit,
            "to:",
            categoryLimits[categoryId],
            "(+" + settings.storyCount + " from user setting)",
          );
        }
      }
    }

    let requestedLimit = categoryLimits[categoryId];
    console.log("🎯 Load operation details:", {
      requestedLimit,
      currentCachedCount:
        allCategoryStories[categoryId]?.filter(
          (item) => !(item as any).__dateDivider,
        ).length || 0,
      isLoadMore: increment,
      categoryLimit: categoryLimits[categoryId],
      userSetting: settings.storyCount,
    });
    console.log(
      "⚙️ User story count setting:",
      settings.storyCount,
      "(configured in Settings > General)",
    );

    // Ensure batch list ready
    await fetchBatchList();
    console.log("📋 Batch list ready, total batches:", batchList.length);
    console.log("🔍 Current category mapping:", {
      categoryId,
      currentBatchId,
      categoryMap: categoryMap[categoryId],
    });

    // Track batches consumed for this category
    if (!catBatches[categoryId]) catBatches[categoryId] = [currentBatchId];
    if (!catBatchesIndex[categoryId]) catBatchesIndex[categoryId] = 0;

    console.log(
      "🎯 Batch tracking: current batch index",
      catBatchesIndex[categoryId],
      "of",
      batchList.length,
    );

    // If we have enough cached stories AND this is not a load more operation, use them
    const cachedStoryCount =
      allCategoryStories[categoryId]?.filter(
        (item) => !(item as any).__dateDivider,
      ).length || 0;
    // Count only today's (non-historical) cached stories
    const currentDayCachedCount =
      allCategoryStories[categoryId]?.filter(
        (item: any) =>
          !(item as any).__dateDivider && !(item as any).__fromHistoricalBatch,
      ).length || 0;
    console.log("📊 Cached story analysis:", {
      cachedCount: cachedStoryCount,
      requestedLimit,
      isIncrement: increment,
      needsMore: cachedStoryCount < requestedLimit,
      hasEnough: cachedStoryCount >= requestedLimit,
      shouldUseCached: !increment && cachedStoryCount >= requestedLimit,
    });

    persistentLogMain("📊 Cached story analysis", {
      cachedCount: cachedStoryCount,
      requestedLimit,
      isIncrement: increment,
      needsMore: cachedStoryCount < requestedLimit,
      hasEnough: cachedStoryCount >= requestedLimit,
      shouldUseCached: !increment && cachedStoryCount >= requestedLimit,
    });

    persistentLogMain("🔍 About to check if should use cached stories");

    persistentLogMain("🔍 Checking conditions", {
      increment,
      cachedStoryCount,
      requestedLimit,
      shouldUseCached: !increment && cachedStoryCount >= requestedLimit,
    });

    // If we're on the latest batch, only consider today's cached stories for initial load
    if (
      !increment &&
      ((isLatestBatch &&
        currentDayCachedCount >=
          (categoryLimits[categoryId] || requestedLimit)) ||
        (!isLatestBatch &&
          cachedStoryCount >= (categoryLimits[categoryId] || requestedLimit)))
    ) {
      // Re-read latest requested limit to handle rapid setting changes
      requestedLimit = categoryLimits[categoryId] || requestedLimit;
      persistentLogMain("✅ Using cached stories for initial load");
      console.log(
        "✅ Using cached stories for initial load, slicing to:",
        requestedLimit,
      );
      stories = allCategoryStories[categoryId].slice(
        0,
        Math.min(
          requestedLimit +
            allCategoryStories[categoryId].filter(
              (item) => (item as any).__dateDivider,
            ).length,
          allCategoryStories[categoryId].length,
        ),
      );
      storiesLoading = false;
      return;
    } else if (increment) {
      persistentLogMain("🔄 Load more operation - entering branch");
      console.log(
        "🔄 Load more operation - will fetch additional stories even if we have cached ones",
      );
      persistentLogMain("🔄 Load more operation - logged to console");
    } else {
      persistentLogMain("🔍 Neither cached nor increment branch");
    }
    // On latest batch with zero stories today, avoid auto historical fetch only when auto top-up is disabled
    if (!increment && isLatestBatch) {
      const todaysOnlyCount =
        allCategoryStories[categoryId]?.filter(
          (item: any) =>
            !(item as any).__dateDivider &&
            !(item as any).__fromHistoricalBatch,
        ).length || 0;
      if (todaysOnlyCount === 0 && !experimental.autoTopUpShortDays) {
        console.log(
          "🛑 No stories available for today - skipping historical fetch and showing empty state",
        );
        // Show empty state for today; allow manual Load More button to fetch historical if enabled
        stories = [];
        storiesLoading = false;
        return;
      }
    }

    persistentLogMain("🔍 After increment branch - continuing to batch check");

    // If we have some cached stories but fewer than requested,
    // show all cached stories first and check if more batches are available
    persistentLogMain("🔍 Checking if we have cached but need more", {
      cachedStoryCount,
      requestedLimit,
      needsMore: cachedStoryCount > 0 && cachedStoryCount < requestedLimit,
      isIncrement: increment,
    });

    {
      const limitNow = categoryLimits[categoryId] || requestedLimit;
      if (cachedStoryCount > 0 && cachedStoryCount < limitNow) {
        persistentLogMain(
          "📊 Have cached but need more - showing cached first",
        );
        console.log(
          "📊 Have",
          cachedStoryCount,
          "cached stories, need",
          limitNow,
          "total. Showing cached first.",
        );
        // Only show cached immediately for initial loads; keep current view for increments
        if (!increment) {
          stories = allCategoryStories[categoryId];
        }

        // For initial loads (not increments): if auto top-up is off, restrict to current batch only
        // Allow fetching within today's batch to meet the requested limit, but do not traverse historical
        if (!increment && !experimental.autoTopUpShortDays) {
          console.log(
            "⛔ Auto top-up off: restricting initial load to current batch only",
          );
          restrictToCurrentBatch = true;
        }

        persistentLogMain("🔍 About to check for more batches");
        // Check if we can get more content from additional batches
        const hasMoreBatches =
          batchList && catBatchesIndex[categoryId] < batchList.length;
        persistentLogMain("🔍 Batch check result", {
          batchListExists: !!batchList,
          currentIndex: catBatchesIndex[categoryId],
          totalBatches: batchList?.length,
          hasMoreBatches,
        });
        console.log(
          "🔍 Batch check: index",
          catBatchesIndex[categoryId],
          "of",
          batchList.length,
          "hasMore:",
          hasMoreBatches,
        );

        if (!hasMoreBatches) {
          console.log(
            "🚫 No more batches available, setting limit to cached count",
          );
          categoryLimits[categoryId] = cachedStoryCount;
          categoryHasMore[categoryId] = hasMoreBatches;
          storiesLoading = false;
          return;
        }
      }
    }

    try {
      lastLoadedCategory = categoryId;

      // Continue fetching from batches until we reach requestedLimit or no more batches
      let currentIndex = 0;
      if (catBatchesIndex[categoryId] === undefined)
        catBatchesIndex[categoryId] = 0;
      // Align the batch index to the current batch so we load relative to it
      if (currentBatchId) {
        const currentIdx = batchList.findIndex((b) => b.id === currentBatchId);
        if (currentIdx >= 0 && catBatchesIndex[categoryId] !== currentIdx) {
          persistentLogMain(
            "🔧 Aligning batch index to current time travel batch",
            {
              prevIndex: catBatchesIndex[categoryId],
              newIndex: currentIdx,
              currentBatchId: currentBatchId.substring(0, 8),
            },
          );
          catBatchesIndex[categoryId] = currentIdx;
        }
      }

      // Add safety limit to prevent infinite loops
      let batchProcessingAttempts = 0;
      const maxBatchAttempts = 10;

      // Use story-only count (exclude date dividers) for precise control
      while (
        catBatchesIndex[categoryId] < batchList.length &&
        batchProcessingAttempts < maxBatchAttempts
      ) {
        const currentStoryCountForLoop =
          allCategoryStories[categoryId]?.filter(
            (item) => !(item as any).__dateDivider,
          ).length || 0;
        const currentDayCountForLoop =
          allCategoryStories[categoryId]?.filter(
            (item: any) =>
              !(item as any).__dateDivider &&
              !(item as any).__fromHistoricalBatch,
          ).length || 0;
        const limitNow = categoryLimits[categoryId] || requestedLimit;
        if (
          (restrictToCurrentBatch
            ? currentDayCountForLoop
            : currentStoryCountForLoop) >= limitNow
        ) {
          break;
        }
        // On latest batch, if today's stories already satisfy the requested limit,
        // do not fetch historical batches (prevents flicker and unnecessary fetches)
        if (
          isLatestBatch &&
          currentDayCountForLoop >=
            (categoryLimits[categoryId] || requestedLimit)
        ) {
          persistentLogMain(
            "⏭️ Current day satisfies limit - skipping historical fetch",
          );
          break;
        }
        batchProcessingAttempts++;
        const batchId = batchList[catBatchesIndex[categoryId]].id;
        persistentLogMain("🔄 Processing batch", {
          batchId: batchId.substring(0, 8),
          index: catBatchesIndex[categoryId],
          totalBatches: batchList.length,
          category: categoryId,
          attempt: batchProcessingAttempts,
        });

        persistentLogMain("🔄 Entering try block");

        // For initial loads, don't proceed beyond today's batch unless auto top-up is enabled
        if (
          !increment &&
          !experimental.autoTopUpShortDays &&
          batchId !== currentBatchId
        ) {
          persistentLogMain(
            "⏭️ Skipping historical batches (auto top-up disabled for initial load)",
            {
              batchId: batchId.substring(0, 8),
              currentBatchId: currentBatchId?.substring(0, 8),
            },
          );
          // Stop looking at further batches
          break;
        }

        // When restricted (e.g., user increased story count but historical loading is disabled),
        // do not traverse beyond the current batch even for increments
        if (restrictToCurrentBatch && batchId !== currentBatchId) {
          persistentLogMain(
            "⏭️ Restricting to current batch - skipping historical traversal",
            {
              batchId: batchId.substring(0, 8),
              currentBatchId: currentBatchId?.substring(0, 8),
              increment,
            },
          );
          break;
        }

        // Global guard: Only allow automatic historical traversal when Auto top-up short days is ON.
        // Manual load-more (increment === true and autoTopUpAttempted === false) is still allowed.
        if (
          batchId !== currentBatchId &&
          !experimental.autoTopUpShortDays &&
          !(increment && !autoTopUpAttempted)
        ) {
          persistentLogMain(
            "⏭️ Skipping historical batches (auto top-up disabled)",
            {
              batchId: batchId.substring(0, 8),
              currentBatchId: currentBatchId?.substring(0, 8),
              increment,
              autoTopUpAttempted,
            },
          );
          break;
        }

        try {
          persistentLogMain("🔄 About to check if batchId === currentBatchId", {
            batchId: batchId.substring(0, 8),
            currentBatchId: currentBatchId?.substring(0, 8),
            areEqual: batchId === currentBatchId,
          });

          // Remove premature skip - fetch again from current batch until we detect no new unique stories
          if (batchId === currentBatchId) {
            persistentLogMain("🔍 Checking if current batch has more stories");
            // Determine how many unique stories we already have from current day
            const currentDayStories = allCategoryStories[categoryId].filter(
              (it) =>
                !(it as any).__dateDivider &&
                !(it as any).__fromHistoricalBatch,
            ).length;
            const currentBatchSizeKnown = catBatchSizes[categoryId]?.[batchId];
            const maybeMoreInCurrentBatch = restrictToCurrentBatch
              ? currentDayStories < requestedLimit
              : currentBatchSizeKnown === undefined ||
                currentDayStories < currentBatchSizeKnown;

            if (!maybeMoreInCurrentBatch) {
              console.log("⏭️ Skipping current batch - fully loaded");
              catBatchesIndex[categoryId]++;
              continue;
            }
            // else fall through to fetch more from current batch
          }

          // Obtain category uuid for this batch
          persistentLogMain("🔍 About to obtain category UUID");
          let catUuid: string | null = null;
          persistentLogMain("🔍 Declared catUuid variable");

          if (batchId === currentBatchId) {
            persistentLogMain(
              "🔍 Batch matches current batch - using categoryMap",
            );
            catUuid = categoryMap[categoryId];
            persistentLogMain("✅ Using current batch", {
              batchId: batchId.substring(0, 8),
              catUuid,
            });
            console.log("✅ Using current batch, catUuid:", catUuid);
          } else {
            persistentLogMain("🔍 Different batch - need to fetch categories");
            persistentLogMain("🔍 Fetching categories for batch", {
              batchId: batchId.substring(0, 8),
            });
            console.log("🔍 Fetching categories for batch:", batchId);
            try {
              persistentLogMain("🌐 About to fetch categories", {
                batchId: batchId.substring(0, 8),
              });
              const resp = await fetch(
                `/api/batches/${batchId}/categories?lang=${language.data}`,
              );
              persistentLogMain("📡 Categories fetch response", {
                batchId: batchId.substring(0, 8),
                status: resp.status,
                ok: resp.ok,
              });
              if (resp.ok) {
                const data = await resp.json();
                console.log(
                  "📋 Available categories for batch:",
                  (data.categories || data).map((c: any) => ({
                    id: c.id,
                    categoryId: c.categoryId,
                    name: c.name,
                  })),
                );

                // Try multiple matching strategies
                const categories = data.categories || data;
                let catObj = categories.find(
                  (c: any) =>
                    c.id === categoryId || c.categoryId === categoryId,
                );

                // If not found, try matching by name (case insensitive)
                if (!catObj) {
                  const categoryNames: Record<string, string> = {
                    world: "World",
                    usa: "USA",
                    business: "Business",
                    tech: "Technology",
                    science: "Science",
                    sports: "Sports",
                    gaming: "Gaming",
                  };
                  const expectedName = categoryNames[categoryId.toLowerCase()];
                  if (expectedName) {
                    catObj = categories.find(
                      (c: any) =>
                        c.name?.toLowerCase() === expectedName.toLowerCase(),
                    );
                    console.log(
                      "🔍 Trying name match for",
                      expectedName,
                      ":",
                      catObj ? "found" : "not found",
                    );
                  }
                }

                catUuid = catObj?.id || catObj?.uuid;
                persistentLogMain("✅ Found catUuid for batch", {
                  batchId: batchId.substring(0, 8),
                  catUuid,
                  matchedCategory: catObj,
                });
                console.log(
                  "✅ Found catUuid for batch:",
                  catUuid,
                  "from category:",
                  catObj,
                );
              } else {
                persistentLogMain("❌ Failed to fetch categories for batch", {
                  batchId: batchId.substring(0, 8),
                  status: resp.status,
                });
                console.log(
                  "❌ Failed to fetch categories for batch:",
                  resp.status,
                );
              }
            } catch (err) {
              persistentLogMain("💥 Categories fetch error", {
                batchId: batchId.substring(0, 8),
                error: err instanceof Error ? err.message : String(err),
              });
              console.warn(
                "Failed to fetch categories for batch",
                batchId,
                err,
              );
            }
          }

          if (!catUuid) {
            // Multiple fallback strategies
            console.log("⚠️ No catUuid found, trying fallback strategies...");

            // Skip this batch if we can't resolve the category
            persistentLogMain("⏭️ Skipping batch due to unresolved category", {
              batchId: batchId.substring(0, 8),
              categoryId,
              reason: "Could not resolve category UUID",
            });

            // Mark this batch as processed
            if (!catBatches[categoryId].includes(batchId)) {
              catBatches[categoryId].push(batchId);
            }

            // Continue to next batch
            catBatchesIndex[categoryId]++;
            continue;
          }

          const remainingNeeded =
            (categoryLimits[categoryId] || requestedLimit) -
            (allCategoryStories[categoryId]?.filter(
              (item) => !(item as any).__dateDivider,
            ).length || 0);
          console.log("📊 Fetching stories:");
          console.log("- Remaining needed (overall):", remainingNeeded);
          let fetchAmount = Math.min(15, remainingNeeded + 5); // Default behavior with small buffer

          // IMPORTANT: When fetching from the current batch, the API returns the first N items
          // without an offset parameter. To ensure we actually receive unseen items beyond those
          // already loaded from today, request: alreadySeenFromThisBatch + remainingInDay + buffer.
          if (batchId === currentBatchId) {
            const limitNowForBatch =
              categoryLimits[categoryId] || requestedLimit;
            const seenFromThisBatch =
              allCategoryStories[categoryId]?.filter(
                (item: any) =>
                  !(item as any).__dateDivider &&
                  ((item as any).__batchId || currentBatchId) === batchId &&
                  !(item as any).__fromHistoricalBatch,
              ).length || 0;
            const totalTodayCount =
              allCategoryStories[categoryId]?.filter(
                (item: any) =>
                  !(item as any).__dateDivider &&
                  !(item as any).__fromHistoricalBatch,
              ).length || 0;
            const remainingInDay = Math.max(
              0,
              limitNowForBatch - totalTodayCount,
            );
            const desiredApiLimit =
              seenFromThisBatch + Math.max(remainingInDay, settings.storyCount) + 3; // ensure progress + small buffer based on user target
            fetchAmount = Math.min(50, desiredApiLimit);
            console.log("- Current batch fetch tuning:", {
              seenFromThisBatch,
              totalTodayCount,
              remainingInDay,
              desiredApiLimit,
              fetchAmount,
            });
          }

          // Increase fetch for historical batches to reduce fragmentation with small increments
          if (batchId !== currentBatchId) {
            const historicalTarget = Math.max(settings.storyCount * 2, 12);
            fetchAmount = Math.min(50, Math.max(fetchAmount, historicalTarget));
          }
          console.log("- Final fetch amount:", fetchAmount);
          console.log("- From batch:", batchId);
          console.log("- Category UUID:", catUuid);

          persistentLogMain("🚀 About to call dataService.loadStories", {
            batchId: batchId.substring(0, 8),
            catUuid,
            fetchAmount,
          });

          const result = await dataService.loadStories(
            batchId,
            catUuid,
            fetchAmount,
            language.data,
          );

          persistentLogMain("📦 API result received", {
            batchId: batchId.substring(0, 8),
            categoryId,
            storiesReceived: result.stories.length,
            fetchAmount,
            isEmpty: result.stories.length === 0,
            isApiFailure: result.isApiFailure || false,
          });

          // Check for API failures and stop immediately
          if (result.isApiFailure) {
            persistentLogMain(
              "🛑 API failure detected - stopping load more immediately",
              {
                batchId: batchId.substring(0, 8),
                category: categoryId,
                catUuid,
                reason: "API server error or network failure",
              },
            );

            // For server errors (500, 502, 503), stop trying entirely
            categoryHasMore[categoryId] = false;
            break;
          }

          // Handle empty results (including 404s) - try next batch
          if (result.stories.length === 0) {
            persistentLogMain("📭 No stories in batch - trying next batch", {
              batchId: batchId.substring(0, 8),
              category: categoryId,
              catUuid,
            });
            console.log(
              "📭 No stories returned from batch",
              batchId,
              "- trying next batch",
            );

            // Mark this batch as processed
            if (!catBatches[categoryId].includes(batchId)) {
              catBatches[categoryId].push(batchId);
            }

            // Continue to next batch
            catBatchesIndex[categoryId]++;
            continue;
          }

          // Track actual batch size if this is the first time we're seeing this batch
          if (!catBatchSizes[categoryId]) catBatchSizes[categoryId] = {};
          if (!catDailyBatches[categoryId]) catDailyBatches[categoryId] = {};

          // Group batches by day
          const dateKey = getBatchDateKey(batchId);
          if (!catDailyBatches[categoryId][dateKey]) {
            catDailyBatches[categoryId][dateKey] = [];
          }
          if (!catDailyBatches[categoryId][dateKey].includes(batchId)) {
            catDailyBatches[categoryId][dateKey].push(batchId);
            console.log(
              "📅 Grouped batch",
              batchId.substring(0, 8),
              "under date:",
              dateKey,
            );
          }

          if (!catBatchSizes[categoryId][batchId]) {
            // If we got fewer stories than we asked for, this batch is smaller
            if (result.stories.length < fetchAmount) {
              catBatchSizes[categoryId][batchId] = result.stories.length;
              console.log(
                "📏 Detected batch size:",
                batchId.substring(0, 8),
                "→",
                result.stories.length,
                "stories (smaller than expected)",
              );
            } else {
              // We got what we asked for, but there might be more - we'll update this later
              catBatchSizes[categoryId][batchId] = result.stories.length;
              console.log(
                "📏 Partial batch size recorded:",
                batchId.substring(0, 8),
                "→",
                result.stories.length,
                "stories (may have more)",
              );
            }
          } else {
            // Update batch size if we got more stories than previously recorded
            const newTotal =
              catBatchSizes[categoryId][batchId] + result.stories.length;
            catBatchSizes[categoryId][batchId] = Math.max(
              catBatchSizes[categoryId][batchId],
              newTotal,
            );
            console.log(
              "📏 Updated batch size:",
              batchId.substring(0, 8),
              "→",
              catBatchSizes[categoryId][batchId],
              "stories",
            );
          }

          if (!allCategoryStories[categoryId])
            allCategoryStories[categoryId] = [];

          if (result.stories.length > 0) {
            // Enhanced duplicate detection with batch-aware logic
            const existingStories = allCategoryStories[categoryId].filter(
              (item) => !(item as any).__dateDivider,
            );

            // Create batch-aware deduplication sets
            // For cluster IDs, only check within the same batch (cluster IDs are not unique across batches)
            const existingBatchClusterIds = new Set(
              existingStories
                .filter((story) => (story as any).__batchId === batchId) // Only same batch
                .map((story) => (story as any).cluster_number?.toString())
                .filter(Boolean),
            );

            // For titles and URLs, check across all batches (these should be globally unique)
            const existingTitles = new Set(
              existingStories
                .map((story) => (story as any).title?.toLowerCase().trim())
                .filter(Boolean),
            );
            const existingUrls = new Set(
              existingStories
                .flatMap(
                  (story) =>
                    (story as any).articles?.map((a: any) => a.url) || [],
                )
                .filter(Boolean),
            );

            console.log("🔍 Batch-aware deduplication check:", {
              batchId: batchId.substring(0, 8),
              existingBatchClusterIds: existingBatchClusterIds.size,
              existingTitles: existingTitles.size,
              existingUrls: existingUrls.size,
              newStoriesCount: result.stories.length,
            });

            // Enhanced deduplication logic with batch awareness
            const newStories = result.stories.filter((story) => {
              const clusterId = story.cluster_number?.toString();
              const titleKey = story.title?.toLowerCase().trim();
              const storyUrls = story.articles?.map((a: any) => a.url) || [];

              // Check for cluster ID duplicates ONLY within the same batch
              if (clusterId && existingBatchClusterIds.has(clusterId)) {
                console.log(
                  "🔄 Duplicate cluster ID found within batch:",
                  clusterId,
                  "- Title:",
                  story.title.substring(0, 50) + "...",
                );
                return false;
              }

              // Check for exact title duplicates across all batches
              if (titleKey && existingTitles.has(titleKey)) {
                console.log(
                  "🔄 Duplicate title found:",
                  story.title.substring(0, 50) + "...",
                );
                return false;
              }

              // Check for URL overlaps across all batches
              if (storyUrls.length > 0) {
                const hasUrlOverlap = storyUrls.some((url) =>
                  existingUrls.has(url),
                );
                if (hasUrlOverlap) {
                  console.log(
                    "🔄 Duplicate URL found in story:",
                    story.title.substring(0, 50) + "...",
                  );
                  return false;
                }
              }

              return true;
            });

            console.log(
              "📝 After batch-aware duplicate filtering:",
              newStories.length,
              "unique stories to add",
            );

            if (newStories.length === 0 && result.stories.length > 0) {
              console.log(
                "⚠️ All stories filtered as duplicates. Sample story details:",
              );
              const sampleStory = result.stories[0];
              console.log("- Cluster ID:", sampleStory.cluster_number);
              console.log("- Title:", sampleStory.title.substring(0, 100));
              console.log("- Batch ID:", batchId.substring(0, 8));
              console.log(
                "- Current batch ID:",
                currentBatchId?.substring(0, 8),
              );
            }

            // Only add stories and date divider if we have unique content
            if (newStories.length > 0) {
              // Insert date divider when starting new batch (if not latest) - moved inside this block
              if (
                batchId !== currentBatchId &&
                !catBatches[categoryId]?.includes(batchId)
              ) {
                const batchInfo = batchList.find((b) => b.id === batchId);
                let batchDateIso: string | null = null;

                if (batchInfo?.createdAt) {
                  batchDateIso = batchInfo.createdAt;
                } else if (
                  typeof (result as any)?.timestamp === "number" &&
                  (result as any).timestamp > 0
                ) {
                  // Use API result timestamp if provided
                  batchDateIso = new Date(
                    ((result as any).timestamp as number) * 1000,
                  ).toISOString();
                } else {
                  // If not in batch list, try to fetch batch info
                  try {
                    const batchResponse = await fetch(
                      `/api/batches/${batchId}`,
                    );
                    if (batchResponse.ok) {
                      const batchData = await batchResponse.json();
                      if (batchData?.createdAt) {
                        batchDateIso = batchData.createdAt;
                      }
                    }
                  } catch (err) {
                    console.warn(
                      "Failed to fetch batch date for",
                      batchId,
                      err,
                    );
                  }
                }

                if (batchDateIso) {
                  // Check if we already have a date divider for this date
                  const dateKey = new Date(batchDateIso)
                    .toISOString()
                    .split("T")[0]; // YYYY-MM-DD
                  const existingDateDividers = allCategoryStories[
                    categoryId
                  ].filter((item) => (item as any).__dateDivider);
                  const hasDateDivider = existingDateDividers.some((divider) => {
                    const dividerDateKey = new Date((divider as any).date)
                      .toISOString()
                      .split("T")[0];
                    return dividerDateKey === dateKey;
                  });

                  if (!hasDateDivider) {
                    console.log(
                      "📅 Adding date divider for batch:",
                      batchId,
                      "with date:",
                      dateKey,
                    );
                    allCategoryStories[categoryId].push({
                      __dateDivider: true,
                      date: batchDateIso,
                    } as any);
                    // If we are on latest batch but loading historical content due to no current-day stories,
                    // enter lightweight time-travel mode to reflect historical context in the UI
                    try {
                      const currentDayCountExisting = allCategoryStories[categoryId]
                        .filter((it: any) => !it.__dateDivider && !it.__fromHistoricalBatch)
                        .length;
                      if (isLatestBatch && currentDayCountExisting === 0) {
                        isLatestBatch = false;
                        timeTravelBatch.set(batchId);
                        try { timeTravel.selectBatch(batchId); } catch {}
                        try { timeTravel.selectDate(new Date(batchDateIso)); } catch {}
                        console.log("🕰️ Entered time-travel mode due to no current-day stories; batch:", batchId.substring(0,8));
                      }
                    } catch {}
                  } else {
                    console.log(
                      "📅 Skipping duplicate date divider for:",
                      dateKey,
                    );
                  }

                  catBatches[categoryId].push(batchId);
                } else {
                  // No reliable date available; skip adding a divider to avoid mislabeling as today
                  console.warn(
                    "⏭️ Skipping date divider due to unknown batch date for",
                    batchId,
                  );
                  catBatches[categoryId].push(batchId);
                }
              }

              // Mark stories with batch information for deduplication and load more logic
              newStories.forEach((story) => {
                (story as any).__batchId = batchId; // Tag with batch ID for deduplication
                if (batchId !== currentBatchId) {
                  (story as any).__fromHistoricalBatch = true;
                }
              });

              allCategoryStories[categoryId].push(...newStories);
              console.log(
                "📚 Added",
                newStories.length,
                "new stories. Total stories now:",
                allCategoryStories[categoryId].filter(
                  (item) => !(item as any).__dateDivider,
                ).length,
              );
            } else {
              console.log(
                "⚠️ No unique stories found in batch",
                batchId,
                "- continuing to next batch",
              );
            }

            // Mark this batch as processed if we got fewer stories than requested
            if (result.stories.length < fetchAmount) {
              console.log(
                "🏁 Batch",
                batchId,
                "fully processed - got",
                result.stories.length,
                "out of",
                fetchAmount,
                "requested",
              );
              if (!catBatches[categoryId].includes(batchId)) {
                catBatches[categoryId].push(batchId);
              }
            }
          } else {
            console.log("📭 No stories returned from batch", batchId);
            // Mark empty batch as processed
            if (!catBatches[categoryId].includes(batchId)) {
              catBatches[categoryId].push(batchId);
            }
          }
        } catch (batchError) {
          persistentLogMain("❌ Error processing batch", {
            batchId: batchId.substring(0, 8),
            error:
              batchError instanceof Error
                ? batchError.message
                : String(batchError),
            stack: batchError instanceof Error ? batchError.stack : undefined,
            category: categoryId,
          });
          // Don't let one failed batch break the entire load more operation
          console.warn(
            "Failed to process batch",
            batchId,
            "- continuing to next batch:",
            batchError,
          );

          // Mark this batch as processed to avoid retrying it
          if (!catBatches[categoryId].includes(batchId)) {
            catBatches[categoryId].push(batchId);
          }
        }

        // Always increment batch index to progress through historical batches
        persistentLogMain("➡️ Incrementing batch index", {
          oldIndex: catBatchesIndex[categoryId],
          newIndex: catBatchesIndex[categoryId] + 1,
          category: categoryId,
        });
        catBatchesIndex[categoryId]++;

        // If we didn't get enough unique stories from this batch, continue to next batch
        // This ensures we aggregate content from multiple historical batches if needed
        const currentStoryCount = allCategoryStories[categoryId].filter(
          (item) => !(item as any).__dateDivider,
        ).length;
        if (
          currentStoryCount < requestedLimit &&
          catBatchesIndex[categoryId] < batchList.length
        ) {
          persistentLogMain("🔄 Need more stories - continuing to next batch", {
            currentStoryCount,
            requestedLimit,
            batchIndex: catBatchesIndex[categoryId],
            totalBatches: batchList.length,
          });
          console.log(
            "🔄 Need more stories (have",
            currentStoryCount,
            "/",
            requestedLimit,
            ") - continuing to next historical batch",
          );
          continue;
        } else if (currentStoryCount >= requestedLimit) {
          persistentLogMain("✅ Reached story target", {
            currentStoryCount,
            requestedLimit,
          });
          console.log(
            "✅ Reached story target:",
            currentStoryCount,
            "/",
            requestedLimit,
          );
          break;
        } else {
          persistentLogMain("🔚 No more batches available", {
            currentStoryCount,
            requestedLimit,
            totalBatches: batchList.length,
          });
          console.log(
            "🔚 No more batches available. Final count:",
            currentStoryCount,
            "/",
            requestedLimit,
          );
          break;
        }
      }

      // Update hasMore flag
      // Allow further loading as long as there are still batches left to inspect
      const hasMoreBatches = catBatchesIndex[categoryId] < batchList.length;
      const oldHasMore = categoryHasMore[categoryId];
      categoryHasMore[categoryId] = hasMoreBatches;

      const finalStoryCount =
        allCategoryStories[categoryId]?.filter(
          (item) => !(item as any).__dateDivider,
        ).length || 0;

      console.log(
        "🏁 Load more results: showing",
        Math.min(categoryLimits[categoryId] || requestedLimit, finalStoryCount),
        "of",
        finalStoryCount,
        "cached stories. More available:",
        categoryHasMore[categoryId],
      );

      // Keep increments precise: don't auto-raise the limit beyond the computed target

      // Always slice to the requested limit, including date dividers in the correct positions
      // Re-read latest requested limit here to respect rapid live changes (e.g., 5 → 9 → 12)
      const currentRequestedLimit =
        categoryLimits[categoryId] || requestedLimit;
      const allItems = allCategoryStories[categoryId] || [];
      const storyCount = allItems.filter(
        (item) => !(item as any).__dateDivider,
      ).length;

      // Only show up to the requested limit of actual stories
      if (storyCount > currentRequestedLimit) {
        let storiesShown = 0;
        let sliceIndex = 0;

        if (!increment) {
          // Initial load: prefer current-day stories first
          const currentDayStories = allItems.filter(
            (item) =>
              !(item as any).__dateDivider &&
              !(item as any).__fromHistoricalBatch,
          );
          if (currentDayStories.length >= currentRequestedLimit) {
            let currentDayCount = 0;
            for (let i = 0; i < allItems.length; i++) {
              const item = allItems[i] as any;
              if (item.__dateDivider) {
                sliceIndex = i + 1;
                continue;
              }
              const isCurrent = !item.__fromHistoricalBatch;
              if (isCurrent) currentDayCount++;
              if (currentDayCount >= currentRequestedLimit) {
                sliceIndex = i + 1;
                break;
              }
            }
            stories = removeTrailingDateDividers(allItems.slice(0, sliceIndex));
            console.log("✂️ Sliced to current-day preference for initial load");
          } else {
            // Not enough current-day; count across all items
            for (let i = 0; i < allItems.length; i++) {
              if ((allItems[i] as any).__dateDivider) {
                sliceIndex = i + 1;
              } else {
                storiesShown++;
                if (storiesShown >= currentRequestedLimit) {
                  sliceIndex = i + 1;
                  break;
                }
              }
            }
            stories = removeTrailingDateDividers(allItems.slice(0, sliceIndex));
            console.log(
              "✂️ Sliced across all items (initial load, fill with historical)",
            );
          }
        } else {
          // Increment (explicit load more): keep newly loaded content visible
          // Count stories across all items in order (today followed by historical)
          for (let i = 0; i < allItems.length; i++) {
            if ((allItems[i] as any).__dateDivider) {
              sliceIndex = i + 1;
            } else {
              storiesShown++;
              if (storiesShown >= currentRequestedLimit) {
                sliceIndex = i + 1;
                break;
              }
            }
          }
          stories = removeTrailingDateDividers(allItems.slice(0, sliceIndex));
          console.log(
            "✂️ Sliced for increment keeping newly loaded items visible",
          );
        }
      } else {
        stories = removeTrailingDateDividers(allItems);
        console.log(
          "✅ Showing all",
          storyCount,
          "cached stories (within limit)",
        );
      }

      // Smart positioning of new content: if we had to add historical stories to meet the user's
      // per-category target, ensure we prioritize today's stories first and then append yesterday's.
      // The existing load logic already preserves chronological grouping with dividers.

      // Auto top-up: if enabled and today's list is below the user's Stories per Category setting,
      // fetch just enough from recent history to reach that setting
      try {
        if (
          experimental.autoTopUpShortDays &&
          !increment &&
          !autoTopUpAttempted &&
          isLatestBatch &&
          (allCategoryStories[categoryId]?.length || 0) > 0
        ) {
          const todaysCount = (stories || []).filter(
            (item: any) =>
              !(item as any).__dateDivider &&
              !(item as any).__fromHistoricalBatch,
          ).length;

          // Only top-up if below user-configured target
          const targetPerCategory = settings.storyCount;

          if (todaysCount < targetPerCategory && categoryHasMore[categoryId]) {
            persistentLogMain("⚡ Auto top-up short day triggered", {
              categoryId,
              todaysCount,
              targetPerCategory,
              requestedLimit,
            });

            // Set the limit exactly to the user's target (avoid cumulative overshoot)
            categoryLimits[categoryId] = targetPerCategory;

            await loadStoriesForCategory(categoryId, true, true);
            return; // Subsequent call will handle slicing/state
          }
        }
      } catch (autoErr) {
        console.warn("Auto top-up check failed:", autoErr);
      }

      // Do not update currentBatchId during time travel load-more; preserve user's historical context
      // If desired in the future, we can add a preference to opt into URL updates for time travel

      storiesLoading = false;
      // Apply any queued request for this category now that loading finished
      const queued = pendingLoadRequests[categoryId];
      if (queued) {
        console.log(
          "🔁 Running queued load for category after prior load finished",
          { categoryId, queued },
        );
        pendingLoadRequests[categoryId] = null;
        setTimeout(() => {
          loadStoriesForCategory(
            categoryId,
            queued.increment,
            queued.autoTopUpAttempted,
            queued.restrictToCurrentBatch,
          );
        }, 0);
      }
    } catch (error) {
      persistentLogMain("❌ Fatal error in loadStoriesForCategory", {
        category: categoryId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      console.error("Error loading cross-day stories:", error);

      // Set hasMore to false to prevent further attempts that might cause more errors
      categoryHasMore[categoryId] = false;

      // Ensure we show whatever stories we have
      if (
        allCategoryStories[categoryId] &&
        allCategoryStories[categoryId].length > 0
      ) {
        stories = allCategoryStories[categoryId];
        persistentLogMain("📚 Showing cached stories after error", {
          count: stories.length,
          category: categoryId,
        });
      }

      storiesLoading = false;
      // If there was a queued request, clear it since we hit an error; avoid loopstorms
      if (pendingLoadRequests[categoryId]) {
        console.log("🧹 Clearing queued load due to error", { categoryId });
        pendingLoadRequests[categoryId] = null;
      }

      // Don't rethrow the error to prevent page refresh
      // The UI will show what stories we have so far
    }
  }

  async function loadOnThisDayEvents() {
    try {
      onThisDayLoading = true;
      lastLoadedCategory = "onthisday";

      // If we already have preloaded OnThisDay events, use them
      if (onThisDayEvents && onThisDayEvents.length > 0) {
        console.log("📅 Using preloaded OnThisDay events");
        // OnThisDay doesn't have read count or timestamp in the same format
        // We could add these later if needed
      } else {
        // Fall back to loading from API if not preloaded
        console.log("📅 Loading OnThisDay events from API");
        const events = await dataService.loadOnThisDayEvents(language.data);
        onThisDayEvents = events;
      }
    } catch (error) {
      console.error("Error loading OnThisDay events:", error);
      // Set empty array to show proper empty state
      onThisDayEvents = [];
    } finally {
      onThisDayLoading = false;
    }
  }

  onMount(() => {
    persistentLogMain("📱 Main page mounted");

    // Initialize time travel batch store and clear stale batches
    timeTravelBatch.init();
    if (timeTravelBatch.isStale()) {
      console.log("🗑️ Clearing stale time travel batch on page mount");
      timeTravelBatch.set(null);
      // Also clear the UI state
      timeTravel.reset();
    }

    // Add periodic check to prevent stuck loading states
    const loadingStateCheck = setInterval(() => {
      if (isLoadingMore) {
        persistentLogMain(
          "⚠️ Periodic check: isLoadingMore has been true for extended period",
        );
      }
      if (storiesLoading) {
        persistentLogMain(
          "⚠️ Periodic check: storiesLoading has been true for extended period",
        );
      }
    }, 30000); // Check every 30 seconds

    // Check for data language in URL first
    const urlParams = parseInitialUrl();
    if (urlParams.dataLang && urlParams.dataLang !== language.data) {
      // Validate it's a supported language
      if (UrlNavigationService.isValidDataLanguage(urlParams.dataLang)) {
        console.log(
          "Setting data language from URL on mount:",
          urlParams.dataLang,
        );
        language.setData(urlParams.dataLang as SupportedLanguage);
      }
    }

    // Load saved read stories from localStorage
    try {
      const saved = localStorage.getItem("readStories");
      if (saved) {
        const savedReadStories = JSON.parse(saved);

        // Migrate old story IDs to new category-aware format
        const migratedReadStories: Record<string, boolean> = {};
        for (const [storyId, isRead] of Object.entries(savedReadStories)) {
          if (typeof isRead === "boolean" && isRead) {
            // Check if this is already in the new format (has category prefix)
            if (storyId.includes(":") && storyId.split(":").length >= 3) {
              // Already in new format: category:batch:storyId
              migratedReadStories[storyId] = isRead;
            } else {
              // Old format - we can't reliably migrate without knowing the category
              // So we'll keep the old format for now and let it naturally migrate as users interact
              migratedReadStories[storyId] = isRead;
            }
          }
        }

        readStories = migratedReadStories;
        // totalStoriesRead is now derived from readStories automatically
      }
    } catch (error) {
      console.error("Error loading saved stories:", error);
    }

    // Handle URL hash navigation
    function handleHashChange() {
      const hash = window.location.hash.slice(1); // Remove the #
      persistentLogMain("🔍 handleHashChange called", { hash });
      if (hash.startsWith("settings")) {
        // Extract tab name if provided (e.g., #settings/filter)
        const parts = hash.split("/");
        const tab = parts[1] || undefined;
        persistentLogMain("⚙️ Opening settings from hash", { tab });
        settings.open(tab);
        // Clear the hash without disrupting SvelteKit's router
        // Use a timeout to ensure the settings modal opens first
        setTimeout(() => {
          persistentLogMain("🔄 About to call goto to clear hash");
          import("$app/navigation").then(({ goto }) => {
            persistentLogMain("🔄 Calling goto to clear hash");
            goto(window.location.pathname + window.location.search, {
              replaceState: true,
              noScroll: true,
              keepFocus: true,
            });
          });
        }, 50);
      }
    }

    // Check initial hash
    handleHashChange();

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange);

    // Listen for lightweight exit from time travel (restore to today without full reload)
    const handleExitTimeTravel = async () => {
      try {
        persistentLogMain("🕰️ Exit time travel requested via header X");
        // Clear UI indicator and restore today's stories without reloading
        timeTravel.reset();
        isLatestBatch = true;
        dataService.setTimeTravelBatch(null);
        // Purge historical items and date dividers from ALL categories immediately to avoid leftovers
        try {
          Object.keys(allCategoryStories || {}).forEach((catId) => {
            const todayOnly = (allCategoryStories[catId] || []).filter((it: any) => !(it?.__dateDivider) && !(it?.__fromHistoricalBatch));
            allCategoryStories[catId] = todayOnly as any;
            // Reset per-category tracking
            catBatchesIndex[catId] = 0;
            catBatches[catId] = [currentBatchId];
            categoryHasMore[catId] = todayOnly.length > 0;
          });
          // Update current view to reflect purge
          const limit = categoryLimits[currentCategory] || settings.storyCount;
          const todayForCurrent = (allCategoryStories[currentCategory] || []).filter((it: any) => !(it.__dateDivider) && !(it.__fromHistoricalBatch));
          stories = todayForCurrent.slice(0, Math.min(limit, todayForCurrent.length));
        } catch {}
        // Clear any stale feed date and ensure header shows today's date
        try { feedDate.set(null); } catch {}
        try { batchTimestamp = Math.floor(Date.now() / 1000); } catch {}
        // Resolve latest batch ID and update URL
        let latestId: string | null = null;
        try {
          const resp = await fetch(`/api/batches/latest?lang=${language.data}`);
          if (resp.ok) {
            const data = await resp.json();
            latestId = data?.id || null;
            latestBatchId = latestId || latestBatchId;
            currentBatchId = latestId || currentBatchId;
          }
        } catch {}
        if (historyManager) {
          const urlBatchId = latestId || latestBatchId || null;
          historyManager.updateUrl({
            batchId: urlBatchId,
            categoryId: currentCategory,
            storyIndex: null,
          });
        }
        // Trigger a lightweight full data reload to repopulate from latest batch
        try {
          await dataReloadService.reloadData();
        } catch (e) {
          console.warn('Reload to latest after exit time travel failed:', e);
        }
        // Notify header that exit-to-today completed so it can clear its spinner
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kite-exit-time-travel-done'));
          }
        } catch {}
      } catch (e) {
        console.warn("Failed to handle exit time travel:", e);
      }
    };
    window.addEventListener("kite-exit-time-travel" as any, handleExitTimeTravel as any);

    // Listen for batch selection from TimeTravel modal and process without full page navigation
    const handleSelectTimeTravelBatch = async (evt: CustomEvent) => {
      try {
        const detail: any = (evt as any).detail || {};
        const selectedBatchId: string = detail.batchId;
        const selectedCreatedAt: string | undefined = detail.createdAt;
        const selectedCategoryId: string | undefined = detail.categoryId;

        persistentLogMain("🕰️ Processing time travel batch selection (no full nav)", {
          selectedBatchId: selectedBatchId?.substring?.(0, 8),
          selectedCategoryId,
        });

        // Show loading state to suppress empty-state flicker
        storiesLoading = true;

        // Enter time-travel mode
        try { isLatestBatch = false; } catch {}
        try { timeTravel.selectBatch(selectedBatchId); } catch {}
        try { if (selectedCreatedAt) timeTravel.selectDate(new Date(selectedCreatedAt)); } catch {}
        try { dataService.setTimeTravelBatch(selectedBatchId); } catch {}
        try { timeTravelBatch.set(selectedBatchId); } catch {}

        // Do not pre-set currentBatchId here. Let the timeTravelBatch effect detect the change
        // and trigger a proper lightweight reload to replace the feed with historical stories.
        try {
          if (selectedCreatedAt) {
            batchTimestamp = Math.floor(new Date(selectedCreatedAt).getTime() / 1000);
          }
        } catch {}

        // Update URL to reflect selected batch immediately to match header/date
        try {
          if (historyManager) {
            const categoryForUrl = selectedCategoryId || currentCategory;
            historyManager.updateUrl({
              batchId: selectedBatchId,
              categoryId: categoryForUrl,
              storyIndex: null,
            });
          }
        } catch {}

      } catch (e) {
        console.warn("Failed to handle time travel batch selection:", e);
      } finally {
        // Ensure loading state clears after content reload settles
        setTimeout(() => {
          storiesLoading = false;
        }, 800);
      }
    };
    window.addEventListener("kite-select-time-travel-batch" as any, handleSelectTimeTravelBatch as any);

    // Cleanup
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      clearInterval(loadingStateCheck);
      window.removeEventListener("kite-exit-time-travel" as any, handleExitTimeTravel as any);
      window.removeEventListener("kite-select-time-travel-batch" as any, handleSelectTimeTravelBatch as any);
    };
  });

  // Helper functions
  const getLastUpdated = $derived(
    lastUpdated || s("loading.default") || "Loading...",
  );
  const parseInitialUrl = (): NavigationParams => {
    if (!browser) return {};
    const params = UrlNavigationService.parseUrl(page.url);
    console.log("🔍 Parsing URL:", page.url.href, "Result:", params);
    return params;
  };
  const handleIntroClose = () => settings.setShowIntro(false);

  // Handle category change
  function handleCategoryChange(category: string, updateUrl: boolean = true) {
    console.log("🔄 handleCategoryChange called", {
      category,
      updateUrl,
      currentCategory,
    });
    persistentLogMain("🔄 handleCategoryChange called", {
      category,
      updateUrl,
      currentCategory,
      isNoChange: category === currentCategory,
      isLoadingMore,
    });

    // Skip if no actual change needed
    if (category === currentCategory) {
      persistentLogMain("🚫 Skipping handleCategoryChange - no change needed");
      return;
    }

    // If load more is in progress, wait for it to complete before changing categories
    if (isLoadingMore) {
      persistentLogMain(
        "⏳ Delaying category change until load more completes",
      );
      setTimeout(() => handleCategoryChange(category, updateUrl), 500);
      return;
    }

    // Prevent load more operations during category changes and show loading state to avoid flicker
    isLoadingMore = true;
    storiesLoading = true;

    // Execute state mutations immediately (removed setTimeout delay)
    persistentLogMain("🔄 handleCategoryChange executing immediately", {
      category,
      updateUrl,
    });

    currentCategory = category;

    // Reset view mode when changing categories (when map view is implemented)
    // if (category.toLowerCase() !== 'world') {
    // 	viewMode = 'list';
    // }

    // Save current expanded state for the current category
    expandedStoriesByCategory[currentCategory] = { ...expandedStories };

    // Restore expanded stories for new category if available
    expandedStories = { ...(expandedStoriesByCategory[category] ?? {}) };

    // Keep time travel global across categories; do not clear state on category switch

    // Clear temporary category if user manually navigates
    if (updateUrl && temporaryCategory) {
      categoriesStore.removeTemporary();
      temporaryCategory = null;
      showTemporaryCategoryTooltip = false;
    }

    // Reset any stale feed date to avoid showing an older header date
    try { feedDate.set(null); } catch {}

    // Update the effect tracking variable to prevent duplicate loading
    lastEffectLoadedCategory = category;

    // Load stories for the new category (will be instant for preloaded categories)
    persistentLogMain(
      "🔄 About to call loadStoriesForCategory from handleCategoryChange",
    );

    // Add safety timeout for category change
    const categoryChangeTimeout = setTimeout(() => {
      if (isLoadingMore) {
        persistentLogMain(
          "⏰ Category change timeout - forcing reset of isLoadingMore",
        );
        isLoadingMore = false;
      }
    }, 10000); // 10 second timeout for category changes

    loadStoriesForCategory(category)
      .then(async () => {
        try {
          // After initial load, if the category doesn't meet the new target, fetch incrementally
          const target = categoryLimits[category] || settings.storyCount;
          const currentCount =
            allCategoryStories[category]?.filter(
              (item: any) => !(item as any).__dateDivider,
            ).length || 0;
          const needsTopUp = currentCount < target;
          if (needsTopUp) {
            persistentLogMain(
              "⚙️ Category needs top-up to meet new story count",
              {
                category,
                currentCount,
                target,
                hasMore: categoryHasMore[category],
              },
            );
            // Perform an incremental fetch to respect the user's increased story count
            const restrict =
              !experimental.enableHistoricalLoadMore &&
              !experimental.autoTopUpShortDays;
            await loadStoriesForCategory(category, true, true, restrict);
          }
        } catch (e) {
          console.warn("Category top-up after navigation failed:", e);
        }
      })
      .finally(() => {
        clearTimeout(categoryChangeTimeout);

        // Update URL to reflect new category AFTER story loading is complete
        if (historyManager && updateUrl) {
          console.log(
            "🔄 About to call historyManager.updateUrl after story loading",
            {
              category,
              isNavigating: navigationHandlerService.isNavigating(),
              isLatestBatch,
              currentBatchId,
              latestBatchId,
            },
          );
          persistentLogMain(
            "🔄 About to call historyManager.updateUrl after story loading",
          );

          // Use the active time-travel batch when present; otherwise latest/current batch
          const urlBatchId = timeTravelBatch.batchId
            ? timeTravelBatch.batchId
            : (isLatestBatch ? latestBatchId : currentBatchId);
          historyManager.updateUrl({
            batchId: urlBatchId,
            categoryId: category,
            storyIndex: null,
          });
        }

        // Re-enable load more after category change is complete
        setTimeout(() => {
          isLoadingMore = false;
          persistentLogMain(
            "✅ Category change completed, load more re-enabled",
          );
        }, 500); // Small delay to prevent immediate triggering
      });

    // Chaos index is already loaded with the batch data
  }

  // Wikipedia popup handlers
  const handleWikipediaClick = (
    title: string,
    content: string,
    imageUrl?: string,
    wikiUrl?: string,
  ) => {
    wikipediaPopup = {
      visible: true,
      title,
      content,
      imageUrl: imageUrl || "",
      wikiUrl: wikiUrl || "",
    };
  };

  const closeWikipediaPopup = () => {
    wikipediaPopup = {
      visible: false,
      title: "",
      content: "",
      imageUrl: "",
      wikiUrl: "",
    };
  };

  // Prevent rapid story toggle calls
  let storyToggleTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastToggleStoryId: string | null = null;

  // Clicking a story should expand/collapse it without triggering a full page navigation.
  // We therefore disable the automatic URL update that caused SvelteKit to reload the page.
  function handleStoryToggle(storyId: string, updateUrl: boolean = false) {
    console.log("🔄 handleStoryToggle called", {
      storyId,
      updateUrl,
      currentCategory,
      currentBatchId,
      isLatestBatch,
    });

    // Prevent rapid duplicate calls for the same story
    if (storyToggleTimeout && lastToggleStoryId === storyId) {
      console.log("🚫 Ignoring rapid duplicate toggle for:", storyId);
      return;
    }

    // Clear any existing timeout
    if (storyToggleTimeout) {
      clearTimeout(storyToggleTimeout);
    }

    // Set debounce timeout
    lastToggleStoryId = storyId;
    storyToggleTimeout = setTimeout(() => {
      storyToggleTimeout = null;
      lastToggleStoryId = null;
    }, 300); // 300ms debounce

    // Parse the category-aware story ID (format: "category:batchId:baseStoryId")
    const parts = storyId.split(":");
    let categoryId, batchId, baseStoryId;

    if (parts.length === 3) {
      [categoryId, batchId, baseStoryId] = parts;
    } else if (parts.length === 2) {
      // Legacy format: "batchId:baseStoryId"
      [batchId, baseStoryId] = parts;
      categoryId = currentCategory;
    } else {
      // Very old format: just the story ID
      baseStoryId = storyId;
      batchId = currentBatchId;
      categoryId = currentCategory;
    }

    // Only process if this story belongs to the current category
    if (categoryId !== currentCategory) {
      console.warn(
        "🚫 Story toggle ignored - different category:",
        categoryId,
        "vs",
        currentCategory,
      );
      return;
    }

    // Find the story using batch and story ID
    const story = stories.find((s) => {
      const storyBatchId = (s as any).__batchId || currentBatchId;
      const clusterId = s.cluster_number?.toString();
      const title = s.title;

      // Must match both batch and story ID
      if (storyBatchId !== batchId) return false;

      // Prefer cluster_number match, fallback to title
      return (
        (clusterId && clusterId === baseStoryId) ||
        (!clusterId && title === baseStoryId)
      );
    });

    console.log("🔍 Story search details:", {
      storyId,
      parsedBatchId: batchId,
      parsedBaseStoryId: baseStoryId,
      currentBatchId,
      foundStory: !!story,
      storyTitle: story?.title?.substring(0, 50),
      storyBatchId: story ? (story as any).__batchId : "N/A",
    });

    if (!story) {
      console.warn("� Story nogt found for toggle:", storyId);
      console.log(
        "Available story IDs:",
        stories.map((s) => ({
          clusterId: s.cluster_number?.toString(),
          title: s.title.substring(0, 30),
        })),
      );
      return;
    }

    // Use category-aware story ID to prevent cross-category expansion
    const storyBaseId = story.cluster_number?.toString() || story.title;
    const storyBatchId = (story as any).__batchId || currentBatchId;
    const consistentStoryId = `${currentCategory}:${storyBatchId}:${storyBaseId}`;
    console.log(
      "🔄 Using consistent story ID:",
      consistentStoryId,
      "for story:",
      story.title.substring(0, 50),
    );

    // Determine if clicked story is already expanded
    const currentlyExpanded = expandedStories[consistentStoryId];
    console.log("📊 Current expansion state:", {
      consistentStoryId,
      currentlyExpanded,
      allExpanded: Object.keys(expandedStories),
    });

    if (currentlyExpanded) {
      // Collapse only this story
      console.log("🔽 Collapsing story:", consistentStoryId);
      expandedStories = { ...expandedStories };
      delete expandedStories[consistentStoryId];

      if (updateUrl && historyManager) {
        // Always include batch ID in URL when collapsing
        // Use story's actual batch ID for historical stories, latest batch ID for current stories
        const isHistoricalStory = (story as any).__fromHistoricalBatch;
        const urlBatchId = isHistoricalStory
          ? storyBatchId
          : isLatestBatch
            ? latestBatchId
            : storyBatchId;

        console.log("🔄 Story collapse URL update:", {
          isLatestBatch,
          isHistoricalStory: (story as any).__fromHistoricalBatch,
          storyBatchId,
          urlBatchId,
          currentBatchId,
          currentCategory,
        });

        historyManager.updateUrl({
          batchId: urlBatchId,
          categoryId: currentCategory,
          storyIndex: null,
        });
      }
    } else {
      // FORCE single story rule - clear ALL expanded stories first
      console.log("🔽 FORCE clearing all expanded stories (single story rule)");
      expandedStories = {}; // Clear everything first

      // Then expand only the clicked story
      expandedStories = { [consistentStoryId]: true };
      console.log("🔼 Expanding ONLY story:", consistentStoryId);

      // Preload citation icons for this story immediately
      import("$lib/utils/iconPreloader").then(({ preloadStoryCitations }) => {
        preloadStoryCitations(story).catch((err) => {
          console.warn("Failed to preload story citations:", err);
        });
      });

      // Mark as read using consistent ID
      readStories = { ...readStories, [consistentStoryId]: true };

      if (updateUrl && historyManager) {
        // Use the story's actual batch ID for URL, not always currentBatchId
        const urlBatchId = storyBatchId;

        // Calculate story index based on batch context
        let storyIndex = -1;

        // Filter stories to only those from the same batch as the expanded story
        const sameBatchStories = stories.filter((s) => {
          if ((s as any).__dateDivider) return false;
          const sBatchId = (s as any).__batchId || currentBatchId;
          return sBatchId === storyBatchId;
        });

        storyIndex = sameBatchStories.indexOf(story);

        console.log("🔄 Story URL update:", {
          storyTitle: story.title.substring(0, 50),
          storyIndex,
          storyBatchId,
          urlBatchId,
          currentBatchId,
          isLatestBatch,
          isHistoricalStory: (story as any).__fromHistoricalBatch,
          sameBatchStoriesCount: sameBatchStories.length,
          totalStories: stories.length,
        });

        // Always include batch ID in URL for both latest and historical batches
        // Use story's actual batch ID for historical stories, latest batch ID for current stories
        const isHistoricalStory = (story as any).__fromHistoricalBatch;
        const finalBatchId = isHistoricalStory
          ? urlBatchId
          : isLatestBatch
            ? latestBatchId
            : urlBatchId;

        // Use numeric index URLs (restore original format)
        historyManager.updateUrl({
          batchId: finalBatchId,
          categoryId: currentCategory,
          storyIndex: storyIndex >= 0 ? storyIndex : null,
          slug: null, // Don't use slugs, use numeric indices
        });
      }
    }

    console.log("📊 Final expansion state:", Object.keys(expandedStories));
    // Persist per-category map
    expandedStoriesByCategory[currentCategory] = { ...expandedStories };
  }

  // Derived value for total stories read count
  const totalStoriesRead = $derived(
    Object.values(readStories).filter(Boolean).length,
  );

  // Check if all displayed stories are read
  const allDisplayedStoriesRead = $derived(
    stories
      .filter((item) => !(item as any).__dateDivider)
      .every((story) => {
        const baseStoryId = story.cluster_number?.toString() || story.title;
        const storyBatchId = (story as any).__batchId || currentBatchId;
        const storyId = `${currentCategory}:${storyBatchId}:${baseStoryId}`;
        return readStories[storyId];
      }),
  );

  // Effect for saving to localStorage (side effects only, no state mutation)
  $effect(() => {
    // Save to localStorage
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("readStories", JSON.stringify(readStories));
    }
  });

  // Handle source overlay close
  const handleCloseSource = () => {
    showSourceOverlay = false;
    currentSource = null;
    sourceArticles = [];
    currentMediaInfo = null;
    isLoadingMediaInfo = false;
  };

  // Handle navigation from URL changes
  const handleUrlNavigation = async (params: NavigationParams) => {
    // Only skip navigation for category changes during load more, allow story navigation
    if (
      isLoadingMore &&
      params.categoryId &&
      params.categoryId !== currentCategory
    ) {
      persistentLogMain(
        "🚫 Skipping category navigation during load more operation",
        {
          params,
          isLoadingMore,
          currentCategory,
        },
      );
      return;
    }

    persistentLogMain("🔄 handleUrlNavigation called", {
      params,
      isLoadingMore,
      dataLoaded,
      currentCategory,
      currentBatchId,
      storiesCount: stories.length,
      allCategoryStoriesKeys: Object.keys(allCategoryStories),
      expandedStories: Object.keys(expandedStories),
    });

    // Don't handle navigation if data isn't loaded yet - store it for later
    if (!dataLoaded) {
      persistentLogMain("🚫 Storing navigation for after data load", {
        params,
      });
      pendingUrlNavigation = params;
      return;
    }

    // Handle batch ID changes - interpret explicitly
    if (params.batchId !== undefined) {
      const incomingBatchId = params.batchId;
      const knownLatest = latestBatchId || null;
      const newIsLatest = incomingBatchId === null || (knownLatest && incomingBatchId === knownLatest) ? true : false;

      persistentLogMain("🔄 Batch ID change detected", {
        oldBatchId: currentBatchId,
        newBatchId: incomingBatchId,
        knownLatest,
        computedIsLatest: newIsLatest,
      });

      // Update local batch ID first
      currentBatchId = incomingBatchId || currentBatchId;

      // Apply mode
      isLatestBatch = newIsLatest;
      try {
        dataService.setTimeTravelBatch(newIsLatest ? null : incomingBatchId!);
      } catch {}
    }

    const updates = await navigationHandlerService.handleUrlNavigation(
      params,
      {
        currentBatchId,
        currentCategory,
        categories,
        stories,
        allCategoryStories,
        expandedStories,
        isLatestBatch,
      },
      {
        setDataLanguage: (lang: SupportedLanguage) => language.setData(lang),
        getCurrentDataLanguage: () => language.data,
        handleCategoryChange,
      },
    );

    // Apply state updates
    if (updates.isLatestBatch !== undefined)
      isLatestBatch = updates.isLatestBatch;
    if (updates.expandedStories !== undefined) {
      // Directly set the expanded stories from navigation
      expandedStories = updates.expandedStories;
    }
  };

  // Track last loaded category to prevent duplicate loads
  let lastEffectLoadedCategory = $state("");

  // Single consolidated effect to handle all category-related logic
  $effect(() => {
    if (!browser || !dataLoaded) return;

    // Step 1: Initialize category if needed (only once)
    if (
      orderedCategories.length > 0 &&
      !orderedCategories.find((cat) => cat.id === currentCategory) &&
      !(temporaryCategory && currentCategory === temporaryCategory)
    ) {
      console.log(`🔧 Setting initial category to: ${orderedCategories[0].id}`);
      currentCategory = orderedCategories[0].id;
      return; // Exit early to let the effect re-run with the new category
    }

    // Step 2: Update swipe handler (side effect only)
    if (orderedCategories.length > 0 && currentCategory) {
      categorySwipeHandler.updateState(
        orderedCategories,
        currentCategory,
        handleCategoryChange,
      );
    }

    // Step 3: Load stories if category is valid and hasn't been loaded by this effect
    if (
      currentCategory &&
      currentCategory !== lastEffectLoadedCategory &&
      orderedCategories.find((cat) => cat.id === currentCategory)
    ) {
      console.log(`🔧 Loading stories for category: ${currentCategory}`);
      lastEffectLoadedCategory = currentCategory;

      // Load stories, respecting time travel state from URL/DataLoader
      queueMicrotask(() => {
        try {
          if (timeTravelBatch.batchId === null) {
            // Latest mode
            isLatestBatch = true;
            dataService.setTimeTravelBatch(null);
          } else {
            // Historical mode 
            isLatestBatch = false;
          }
        } catch {}
        loadStoriesForCategory(currentCategory);
      });
    }
  });

  // Apply Settings > Stories per Category changes in real time
  let storyCountDebounce: ReturnType<typeof setTimeout> | null = null;
  // Track last applied story count to avoid overriding load-more increments
  let lastAppliedStoryCount = $state<number>(settings.storyCount);
  $effect(() => {
    if (!browser || !dataLoaded) return;

    const targetCount = storyCountSetting;
    const currentCat = currentCategory;

    // Only react when the user changes the setting value
    if (lastAppliedStoryCount === targetCount) return;
    const isIncrease = targetCount > lastAppliedStoryCount;

    // Sync all category limits to the new target so navigation reflects it
    try {
      const knownCats = new Set<string>();
      // Prefer keys already present in categoryLimits
      Object.keys(categoryLimits || {}).forEach((id) => knownCats.add(id));
      // Also include loaded categories if any
      (categories || []).forEach((c) => knownCats.add(c.id));
      knownCats.forEach((catId) => {
        if ((categoryLimits[catId] || 0) !== targetCount) {
          categoryLimits[catId] = targetCount;
        }
      });
    } catch (e) {
      console.warn("Failed to sync category limits to new story count:", e);
    }

    // Count currently displayed stories (exclude date dividers)
    const displayedCount = stories.filter(
      (item: any) => !(item as any).__dateDivider,
    ).length;
    // Count currently cached stories for this category (exclude date dividers)
    const cachedCountForCat =
      allCategoryStories[currentCat]?.filter(
        (item: any) => !(item as any).__dateDivider,
      ).length || 0;

    // Always set current category limit to target to avoid stale lower caps blocking subsequent increases
    categoryLimits[currentCat] = targetCount;

    // Record that we've applied this setting so we don't re-apply on unrelated state changes
    lastAppliedStoryCount = targetCount;

    // If already matching, avoid unnecessary work
    if (displayedCount === targetCount) return;

    // Debounce to avoid spamming while user drags the slider
    if (storyCountDebounce) clearTimeout(storyCountDebounce);
    storyCountDebounce = setTimeout(() => {
      // Choose strategy based on increase/decrease and feature flags
      try {
        if (isIncrease) {
          // First, try to fill from today's current batch only
          const restrict = true;
          isLoadingMore = false; // ensure not blocked by previous increment guard
          loadStoriesForCategory(currentCat, true, true, restrict);
        } else {
          // Decrease: always re-slice without fetching
          loadStoriesForCategory(currentCat);
        }
      } catch (e) {
        console.warn("Failed to apply real-time story count change:", e);
      }
    }, 150);
  });

  // If the temporary category gets permanently enabled by the user (e.g., via Settings),
  // clear the temporary state so it no longer shows the tooltip.
  $effect(() => {
    if (
      temporaryCategory &&
      categoriesStore.enabled.includes(temporaryCategory)
    ) {
      console.log("Temporary category now permanently enabled, cleaning up");
      categoriesStore.removeTemporary();
      temporaryCategory = null;
      showTemporaryCategoryTooltip = false;
    }
  });
  // Language changes are now handled by DataLoader through the reload service
  // Chaos index will be reloaded with all other data when language changes

  // Update reference element for tooltip whenever navigation or temporary category changes
  $effect(() => {
    if (!browser) return;
    if (temporaryCategory && desktopCategoryNavigation) {
      temporaryCategoryElement =
        desktopCategoryNavigation.getCategoryElement(temporaryCategory);
    } else {
      temporaryCategoryElement = null;
    }
  });

  // Show tooltip only on hover/focus of the temporary category element
  $effect(() => {
    if (!browser || !temporaryCategoryElement) return;

    const handleEnter = () => {
      showTemporaryCategoryTooltip = true;
    };
    const handleLeave = () => {
      showTemporaryCategoryTooltip = false;
    };

    temporaryCategoryElement.addEventListener("mouseenter", handleEnter);
    temporaryCategoryElement.addEventListener("focus", handleEnter);
    temporaryCategoryElement.addEventListener("mouseleave", handleLeave);
    temporaryCategoryElement.addEventListener("blur", handleLeave);

    // Cleanup listeners when element changes or component unmounts
    return () => {
      temporaryCategoryElement?.removeEventListener("mouseenter", handleEnter);
      temporaryCategoryElement?.removeEventListener("focus", handleEnter);
      temporaryCategoryElement?.removeEventListener("mouseleave", handleLeave);
      temporaryCategoryElement?.removeEventListener("blur", handleLeave);
    };
  });

  // Debug effect to track batch changes
  $effect(() => {
    if (!browser) return;
    const newBatch = timeTravelBatch.batchId;
    console.log("🔍 timeTravelBatch.batchId changed to:", newBatch);
    // If batch actually changed, proactively reload data and prevent mixing content
    if ((newBatch || null) !== (currentBatchId || null)) {
      // Update mode flag
      isLatestBatch = newBatch === null;
      // Clear current cached content to avoid mixing across batches
      try {
        stories = [];
        allCategoryStories = {} as any;
        // Reset per-category tracking so subsequent loads start clean
        catBatches = {} as any;
        catBatchesIndex = {} as any;
      } catch {}
      // Ensure service batch matches the store
      try { dataService.setTimeTravelBatch(newBatch || null); } catch {}
      // Trigger lightweight reload (no SplashScreen)
      try { dataReloadService.reloadData(); } catch {}
    }
  });

  // Debug helper for testing (only in development)
  if (browser && typeof window !== "undefined") {
    (window as any).kiteDebug = {
      // Navigation debugging
      resetNavigationState: () => {
        navigationHandlerService.resetNavigationState();
        if (historyManager) {
          historyManager.resetNavigationState();
        }
        console.log("✅ Navigation state reset");
      },
      // Loading state debugging
      resetLoadingState: () => {
        isLoadingMore = false;
        storiesLoading = false;
        console.log("✅ Loading state reset");
      },
      checkLoadingState: () => {
        console.log("🔍 Loading state:", {
          isLoadingMore,
          storiesLoading,
          categoryHasMore: Object.entries(categoryHasMore),
          categoryLimits: Object.entries(categoryLimits),
        });
      },
      checkNavigationState: () => {
        const historyState = historyManager
          ? historyManager.getNavigationState()
          : null;
        console.log("🔍 Navigation state:", {
          navigationHandlerIsNavigating:
            navigationHandlerService.isNavigating(),
          historyManagerState: historyState,
          currentCategory,
          expandedStories: Object.keys(expandedStories),
          storiesCount: stories?.length || 0,
        });
      },
      getCacheStats: getImageCacheStats,
      clearCache: clearImageCache,
      preloadCurrentCategory: () =>
        imagePreloadingService.preloadCategory(stories),
      getCurrentStories: () => stories,
      getCurrentCategory: () => currentCategory,
      // Test handlers
      testCategoryChange: (category: string) => {
        console.log("🧪 Testing category change to:", category);
        handleCategoryChange(category);
      },
      // Test all categories by cycling through them
      testAllCategories: async (delayMs: number = 2000) => {
        if (!orderedCategories || orderedCategories.length === 0) {
          console.log("❌ No categories available to test");
          return "❌ No categories available";
        }
        
        console.log(`🔄 Testing all ${orderedCategories.length} categories with ${delayMs}ms delay...`);
        const originalCategory = currentCategory;
        
        for (let i = 0; i < orderedCategories.length; i++) {
          const category = orderedCategories[i];
          console.log(`📍 Testing category ${i + 1}/${orderedCategories.length}: ${category.id}`);
          handleCategoryChange(category.id);
          
          // Wait for the specified delay before moving to next category
          if (i < orderedCategories.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
        
        console.log(`✅ Completed testing all categories. Returning to: ${originalCategory}`);
        handleCategoryChange(originalCategory);
        return `✅ Tested ${orderedCategories.length} categories`;
      },
      // Get list of available categories
      getAvailableCategories: () => {
        const categoryList = orderedCategories.map(cat => cat.id);
        console.log("📋 Available categories:", categoryList);
        return categoryList;
      },
      testStoryToggle: (storyIndex: number) => {
        if (stories && stories[storyIndex]) {
          const story = stories[storyIndex];
          const storyId = story.cluster_number?.toString() || story.title;
          console.log("🧪 Testing story toggle for:", storyId);
          handleStoryToggle(storyId);
        } else {
          console.log("❌ Story not found at index:", storyIndex);
        }
      },
      // Load more testing
      testLoadMore: () => {
        console.log("🧪 Testing load more functionality");
        console.log("Current state:", {
          currentCategory,
          canLoadMore: categoryHasMore[currentCategory],
          isLoadingMore,
          storiesLoading,
          storiesCount: stories?.length || 0,
          categoryLimit: categoryLimits[currentCategory],
        });
        if (
          categoryHasMore[currentCategory] &&
          !isLoadingMore &&
          !storiesLoading
        ) {
          handleLoadMore();
        } else {
          console.log("❌ Cannot load more due to current state");
        }
      },
      // Force enable load more for testing
      forceEnableLoadMore: (category?: string) => {
        const cat = category || currentCategory;
        categoryHasMore[cat] = true;
        console.log("✅ Force enabled load more for category:", cat);
      },
      // Restore to today's stories only
      restoreToToday: () => {
        restoreToToday();
        return "✅ Restored to today's stories only";
      },
      // Debug expanded stories
      checkExpandedStories: () => {
        console.log(
          "📊 Current expanded stories:",
          Object.keys(expandedStories),
        );
        console.log(
          "📊 Expanded stories by category:",
          expandedStoriesByCategory,
        );
        return Object.keys(expandedStories);
      },
      // Force close all stories
      closeAllStories: () => {
        expandedStories = {};
        expandedStoriesByCategory[currentCategory] = {};
        console.log("✅ Forced close all stories");
        return "✅ All stories closed";
      },
      // Force expand all stories in current category
      expandAllStories: () => {
        if (!stories || stories.length === 0) {
          console.log("❌ No stories available to expand");
          return "❌ No stories available";
        }
        
        const expandedCount = stories.length;
        stories.forEach(story => {
          const storyId = story.cluster_number?.toString() || story.title;
          expandedStories[storyId] = true;
          if (!expandedStoriesByCategory[currentCategory]) {
            expandedStoriesByCategory[currentCategory] = {};
          }
          expandedStoriesByCategory[currentCategory][storyId] = true;
        });
        
        console.log(`✅ Expanded ${expandedCount} stories in category: ${currentCategory}`);
        return `✅ Expanded ${expandedCount} stories`;
      },
      getAllCategoryStories: () => allCategoryStories,
      getPreloadedCategories: () => Object.keys(allCategoryStories),
      getImageUrls: () => {
        const allUrls: string[] = [];
        stories.forEach((story) => {
          allUrls.push(...extractStoryImages(story));
        });
        return [...new Set(allUrls)];
      },
      getAllImageUrls: () => {
        const allUrls: string[] = [];
        Object.values(allCategoryStories)
          .flat()
          .forEach((story) => {
            allUrls.push(...extractStoryImages(story));
          });
        return [...new Set(allUrls)];
      },
      showPreloadingSettings: () => {
        console.log("🔧 Enabling preloading settings tab");
        if (
          (window as any).kiteSettingsDebug &&
          (window as any).kiteSettingsDebug.enablePreloadingTab
        ) {
          (window as any).kiteSettingsDebug.enablePreloadingTab();
          console.log(
            "✅ Preloading settings tab enabled permanently. Open settings to see it.",
          );
          return "✅ Preloading tab enabled permanently. Open settings to see it.";
        } else {
          console.log(
            "❌ Settings component not available. Please refresh and try again.",
          );
          return "❌ Settings component not available. Please refresh and try again.";
        }
      },
      hidePreloadingSettings: () => {
        console.log("🔧 Disabling preloading settings tab");
        if (
          (window as any).kiteSettingsDebug &&
          (window as any).kiteSettingsDebug.disablePreloadingTab
        ) {
          (window as any).kiteSettingsDebug.disablePreloadingTab();
          console.log("✅ Preloading settings tab disabled.");
          return "✅ Preloading tab disabled.";
        } else {
          console.log(
            "❌ Settings component not available. Please refresh and try again.",
          );
          return "❌ Settings component not available. Please refresh and try again.";
        }
      },
    };
  }
</script>

<svelte:head>
  <title
    >{s("app.title") || "Kite"} - {s("app.motto") || "News. Elevated."}</title
  >
</svelte:head>

<!-- DataLoader rendered both on server and client -->
<DataLoader
  onDataLoaded={handleDataLoaded}
  onError={handleDataError}
  initialBatchId={parseInitialUrl().batchId}
  initialCategoryId={parseInitialUrl().categoryId}
/>

<!-- Client-only HistoryManager and main content -->
{#if dataLoaded}
  <ClientOnly>
    <HistoryManager
      bind:this={historyManager}
      bind:batchId={currentBatchId}
      bind:categoryId={currentCategory}
      storyIndex={currentStoryIndex}
      onNavigate={handleUrlNavigation}
    />
  </ClientOnly>

  <!-- Category Navigation - Mobile only (fixed positioning) -->
  <div class="md:hidden">
    <CategoryNavigation
      categories={orderedCategories}
      {currentCategory}
      onCategoryChange={handleCategoryChange}
      mobilePosition={categoryHeaderPosition}
      {temporaryCategory}
      showTemporaryTooltip={false}
      displayedStoriesCount={stories.filter(
        (item) => !(item as any).__dateDivider,
      ).length}
      allStoriesRead={allDisplayedStoriesRead}
      {hasHistoricalStories}
      canRestoreToToday={canRestoreToToday}
      onMarkAllRead={markAllAsRead}
      onMarkAllUnread={markAllAsUnread}
      onRestoreToToday={restoreToToday}
    />
  </div>

  <!-- Main Content -->
  <main
    class="pb-[56px] md:pb-0 {categoryHeaderPosition === 'top'
      ? 'pt-12 md:pt-0'
      : ''}"
    ontouchstart={categorySwipeHandler.handleTouchStart}
    ontouchend={categorySwipeHandler.handleTouchEnd}
  >
    <div class="container mx-auto max-w-[732px] px-4 py-6">
      <Header
        {offlineMode}
        {totalReadCount}
        {totalStoriesRead}
        {getLastUpdated}
        {batchTimestamp}
        {chaosIndex}
      />

      <!-- Category Navigation - Desktop (normal document flow) -->
      <div class="hidden md:block">
        <CategoryNavigation
          bind:this={desktopCategoryNavigation}
          categories={orderedCategories}
          {currentCategory}
          onCategoryChange={handleCategoryChange}
          mobilePosition="bottom"
          {temporaryCategory}
          showTemporaryTooltip={showTemporaryCategoryTooltip}
          displayedStoriesCount={stories.filter(
            (item) => !(item as any).__dateDivider,
          ).length}
          allStoriesRead={allDisplayedStoriesRead}
          {hasHistoricalStories}
          canRestoreToToday={canRestoreToToday}
          onMarkAllRead={markAllAsRead}
          onMarkAllUnread={markAllAsUnread}
          onRestoreToToday={restoreToToday}
        />
      </div>

      <div class="mt-0">
        <!-- News Content -->
        {#if currentCategory === "onthisday"}
          <OnThisDay
            stories={onThisDayEvents}
            isLoading={onThisDayLoading}
            onWikipediaClick={handleWikipediaClick}
            onRetry={loadOnThisDayEvents}
          />
        {:else}
          <StoryList
            {stories}
            {currentCategory}
            batchId={currentBatchId}
            {expandedStories}
            onStoryToggle={handleStoryToggle}
            bind:readStories
            bind:showSourceOverlay
            bind:currentSource
            bind:sourceArticles
            bind:currentMediaInfo
            bind:isLoadingMediaInfo
            onLoadMore={handleLoadMore}
            canLoadMore={categoryHasMore[currentCategory]}
            isLoading={storiesLoading}
          />
        {/if}
      </div>

      <!-- Footer -->
      <Footer
        {currentCategory}
        onShowAbout={() => settings.setShowIntro(true)}
      />
    </div>
  </main>
{/if}

<!-- Settings Modal -->
<Settings
  visible={settings.isOpen}
  {categories}
  onClose={() => settings.close()}
  onShowAbout={() => {
    settings.close();
    settings.setShowIntro(true);
  }}
/>

<!-- Time Travel Modal -->
<TimeTravel />

<!-- Source Overlay -->
<SourceOverlay
  isOpen={showSourceOverlay}
  {currentSource}
  {sourceArticles}
  {currentMediaInfo}
  {isLoadingMediaInfo}
  onClose={handleCloseSource}
/>

<!-- Wikipedia Popup -->
<WikipediaPopup
  visible={wikipediaPopup.visible}
  title={wikipediaPopup.title}
  content={wikipediaPopup.content}
  imageUrl={wikipediaPopup.imageUrl}
  wikiUrl={wikipediaPopup.wikiUrl}
  onClose={closeWikipediaPopup}
/>

<!-- Temporary Category Tooltip -->
<TemporaryCategoryTooltip
  show={showTemporaryCategoryTooltip}
  referenceElement={temporaryCategoryElement}
/>

<!-- Intro Screen Modal -->
<IntroScreen visible={settings.showIntro} onClose={handleIntroClose} />
