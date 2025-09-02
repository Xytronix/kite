<script lang="ts">
  import { browser } from "$app/environment";
  import { goto, replaceState as skReplaceState } from "$app/navigation";
  import { page } from "$app/state";
  import {
    UrlNavigationService,
    type NavigationParams,
  } from "$lib/services/urlNavigationService";
  import { language } from "$lib/stores/language.svelte.js";

  interface Props {
    batchId: string;
    categoryId: string;
    storyIndex?: number | null;
    onNavigate?: (params: NavigationParams) => void;
  }

  const {
    batchId = $bindable(),
    categoryId = $bindable(),
    storyIndex = null, // Changed from $bindable() to regular prop since it's derived
    onNavigate,
  }: Props = $props();

  // Minimal state tracking
  let lastUrl = $state("");
  let initialized = $state(false);
  let isUpdatingUrl = $state(false); // Flag to prevent reactive conflicts

  // Debug export for checking state
  export function getNavigationState() {
    return {
      lastUrl,
      initialized,
      currentPageUrl: browser ? window.location.href : "",
      currentBatchId: batchId,
      currentCategoryId: categoryId,
      currentStoryIndex: storyIndex,
    };
  }

  // Force reset navigation state (for debugging)
  export function resetNavigationState() {
    console.log("🔧 HistoryManager navigation state reset");
    lastUrl = "";
    initialized = false;
  }

  // Build URL based on current state
  function buildUrl(params?: Partial<NavigationParams>): string {
    const navigationParams: NavigationParams = {
      batchId: params?.batchId !== undefined ? params.batchId : batchId,
      categoryId:
        params?.categoryId !== undefined ? params.categoryId : categoryId,
      storyIndex:
        params?.storyIndex !== undefined ? params.storyIndex : storyIndex,
      slug: params?.slug,
    };

    return UrlNavigationService.buildUrl(navigationParams, language.data);
  }

  // Update URL without triggering navigation
  export function updateUrl(params?: Partial<NavigationParams>) {
    if (!browser) return;

    try {
      isUpdatingUrl = true; // Prevent reactive effect from interfering

      console.log("🔄 HistoryManager: updateUrl called with params:", {
        params,
        currentState: { batchId, categoryId, storyIndex },
      });

      const newUrl = buildUrl(params);
      console.log("🔄 HistoryManager: Built URL:", newUrl);

      // Only update if URL actually changed
      if (newUrl !== lastUrl) {
        lastUrl = newUrl;
        skReplaceState(newUrl, { keepfocus: true, noscroll: true });
        console.log("🔄 HistoryManager: Updated URL to:", newUrl);
      } else {
        console.log(
          "🔄 HistoryManager: URL unchanged, skipping update:",
          newUrl,
        );
      }
    } catch (error) {
      console.warn("HistoryManager updateUrl error:", error);
    } finally {
      // Reset flag after a small delay
      setTimeout(() => {
        isUpdatingUrl = false;
      }, 100);
    }
  }

  // Navigate to new URL with history entry
  export function navigateTo(params: Partial<NavigationParams>) {
    if (!browser) return;

    try {
      isUpdatingUrl = true; // Prevent reactive effect from interfering
      const newUrl = buildUrl(params);

      // Only navigate if URL actually changed
      if (newUrl !== lastUrl) {
        lastUrl = newUrl;
        console.log("🔄 HistoryManager: Navigating to:", newUrl);
        goto(newUrl, {
          keepFocus: true,
          noScroll: true,
          state: { restored: false },
        });
      }
    } catch (error) {
      console.warn("HistoryManager navigateTo error:", error);
    } finally {
      // Reset flag after a small delay
      setTimeout(() => {
        isUpdatingUrl = false;
      }, 100);
    }
  }

  // Simple initialization - only run once
  $effect(() => {
    if (!browser || initialized) return;

    initialized = true;
    const urlString = UrlNavigationService.getFullUrl(page.url);
    lastUrl = urlString;

    // Parse URL and trigger navigation if we have parameters
    const params = UrlNavigationService.parseUrl(page.url);
    const hasParams =
      params.batchId !== undefined ||
      params.categoryId ||
      params.storyIndex !== undefined ||
      params.dataLang;

    console.log("🔍 HistoryManager initialization:", {
      url: urlString,
      params,
      hasParams,
      willTriggerNavigation: hasParams && !!onNavigate,
    });

    if (hasParams && onNavigate) {
      // Use setTimeout to avoid blocking the UI
      setTimeout(() => {
        onNavigate(params);
      }, 0);
    }
  });

  // Watch for batch ID and category changes and update URL if needed
  // Note: We don't watch storyIndex here to avoid flickering - story updates are handled explicitly
  $effect(() => {
    if (!browser || !initialized || isUpdatingUrl) return;

    // Get current URL to compare
    const currentUrl = window.location.pathname + window.location.search;

    // Only build URL with batch and category, not story index to avoid conflicts
    const expectedUrl = buildUrl({ storyIndex: null });

    // Only update if the URL has actually changed and we're not overriding a story URL
    const currentHasStoryIndex = /\/\d+(\?|$)/.test(currentUrl);
    const shouldUpdate =
      expectedUrl !== lastUrl &&
      expectedUrl !== currentUrl &&
      !currentHasStoryIndex;

    if (shouldUpdate) {
      console.log(
        "🔄 HistoryManager: Batch/category state changed, updating URL:",
        {
          from: lastUrl,
          current: currentUrl,
          to: expectedUrl,
          batchId,
          categoryId,
          reason: "batch or category change",
          currentHasStoryIndex,
        },
      );
      lastUrl = expectedUrl;
      // Use replaceState to avoid creating new history entries for state synchronization
      skReplaceState(expectedUrl, { keepfocus: true, noscroll: true });
    }
  });
</script>
