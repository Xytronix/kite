<script lang="ts">
  import { browser } from "$app/environment";
  import { s } from "$lib/client/localization.svelte";
  import { settings } from "$lib/stores/settings.svelte.js";
  import type { Category } from "$lib/types";
  import { getCategoryDisplayName } from "$lib/utils/category";
  import { toCamelCase } from "$lib/utils/string.js";
  import Icon from "@iconify/svelte";
  import { onMount } from "svelte";
  import { fade, scale } from "svelte/transition";

  // Props
  interface Props {
    categories?: Category[];
    currentCategory?: string;
    onCategoryChange?: (category: string) => void;
    mobilePosition?: "top" | "bottom";
    temporaryCategory?: string | null;
    showTemporaryTooltip?: boolean;
    // Action props
    displayedStoriesCount?: number;
    allStoriesRead?: boolean;
    hasHistoricalStories?: boolean;
    canRestoreToToday?: boolean;
    onMarkAllRead?: () => void;
    onMarkAllUnread?: () => void;
    onRestoreToToday?: () => void;
  }

  let {
    categories = [],
    currentCategory = "World",
    onCategoryChange,
    mobilePosition = "bottom",
    temporaryCategory = null,
    showTemporaryTooltip = false,
    // Action props
    displayedStoriesCount = 0,
    allStoriesRead = false,
    hasHistoricalStories = false,
    canRestoreToToday = false,
    onMarkAllRead,
    onMarkAllUnread,
    onRestoreToToday,
  }: Props = $props();

  // Overflow detection state
  let hasOverflow = $state(false);
  let canScrollLeft = $state(false);
  let canScrollRight = $state(false);
  let tabsElement: HTMLElement;
  let temporaryCategoryElement = $state<HTMLElement | null>(null);
  let categoryElements = $state<Record<string, HTMLElement>>({});

  // Expose a function to get the reference element for the tooltip
  export function getCategoryElement(categoryId: string): HTMLElement | null {
    return categoryElements[categoryId] || null;
  }

  // Handle category click
  function handleCategoryClick(categoryId: string) {
    console.log("🔄 CategoryNavigation handleCategoryClick called", {
      categoryId,
    });
    if (onCategoryChange) {
      onCategoryChange(categoryId);
    } else {
      console.log("❌ No onCategoryChange handler provided");
    }
  }

  // Handle category key events
  function handleCategoryKeydown(event: KeyboardEvent, categoryId: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCategoryClick(categoryId);
    }
  }

  // Check if content overflows and scroll position
  function checkOverflow() {
    if (tabsElement) {
      const newHasOverflow = tabsElement.scrollWidth > tabsElement.clientWidth;
      if (newHasOverflow !== hasOverflow) {
        hasOverflow = newHasOverflow;
      }

      // Check scroll position to determine if we can scroll left or right
      if (hasOverflow) {
        const scrollLeft = tabsElement.scrollLeft;
        const maxScrollLeft = tabsElement.scrollWidth - tabsElement.clientWidth;

        canScrollLeft = scrollLeft > 0;
        canScrollRight = scrollLeft < maxScrollLeft;
      } else {
        canScrollLeft = false;
        canScrollRight = false;
      }
    }
  }

  // Scroll functions
  function scrollLeft() {
    if (tabsElement) {
      tabsElement.scrollBy({ left: -200, behavior: "smooth" });
    }
  }

  function scrollRight() {
    if (tabsElement) {
      tabsElement.scrollBy({ left: 200, behavior: "smooth" });
    }
  }

  // Set up overflow detection
  onMount(() => {
    if (browser) {
      // Initial check
      setTimeout(() => checkOverflow(), 0);

      // Set up mutation observer to watch for changes in category-tabs
      const observer = new MutationObserver(() => {
        setTimeout(() => {
          checkOverflow();
          // Double check after a small delay
          setTimeout(() => checkOverflow(), 100);
        }, 0);
      });

      if (tabsElement) {
        observer.observe(tabsElement, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      }

      // Listen for window resize
      const handleResize = () => {
        checkOverflow();
        setTimeout(() => checkOverflow(), 0);
      };

      window.addEventListener("resize", handleResize);

      return () => {
        observer.disconnect();
        window.removeEventListener("resize", handleResize);
      };
    }
  });

  // Watch for categories changes
  $effect(() => {
    categories;
    setTimeout(() => checkOverflow(), 0);
  });

  // Watch for font size changes
  $effect(() => {
    settings.fontSize; // React to font size changes
    // Use a longer delay to ensure CSS changes have taken effect
    setTimeout(() => checkOverflow(), 100);
  });
</script>

<div
  class="category-slider-container dark:bg-dark-bg
	fixed right-0 left-0 z-[60] bg-white px-6 md:relative md:top-auto md:right-auto md:bottom-auto
	md:left-auto md:bg-transparent md:px-0 md:py-0 md:shadow-none md:dark:bg-transparent
	{mobilePosition === 'top'
    ? 'top-0 pt-1 pb-0.5 shadow-[0_4px_8px_rgba(0,0,0,0.1)]'
    : 'bottom-0 pb-1 shadow-[0_-4px_8px_rgba(0,0,0,0.1)]'}"
  class:bottom-safe={mobilePosition === "bottom"}
>
  <div class="relative flex items-center">
    <div class="relative flex w-full items-center">
      <!-- Left scroll button (desktop only) -->
      {#if canScrollLeft}
        <button
          onclick={scrollLeft}
          class="focus-visible-ring relative -ml-1 hidden py-3 pr-4 text-gray-400 transition-colors hover:text-gray-600 md:block dark:text-gray-500 dark:hover:text-gray-300"
          aria-label="Scroll categories left"
          transition:scale={{ duration: 200, start: 0.8 }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      {/if}

      <!-- Category tabs -->
      <div
        bind:this={tabsElement}
        class="category-tabs scrollbar-hide flex-1 overflow-x-auto"
        role="tablist"
        aria-label="News categories"
        onscroll={checkOverflow}
      >
        {#each categories as category (category.id)}
          <button
            bind:this={categoryElements[category.id]}
            role="tab"
            tabindex={currentCategory === category.id ? 0 : -1}
            aria-selected={currentCategory === category.id}
            aria-controls="category-{category.id}"
            class="category-tab focus-visible-ring relative cursor-pointer px-4 py-2 text-base font-medium whitespace-nowrap transition-colors md:py-3"
            class:active={currentCategory === category.id}
            class:text-blue-600={currentCategory === category.id}
            class:border-b-2={currentCategory === category.id}
            class:border-blue-600={currentCategory === category.id}
            class:text-gray-600={currentCategory !== category.id}
            class:hover:text-gray-800={currentCategory !== category.id}
            class:dark:text-gray-400={currentCategory !== category.id}
            class:dark:hover:text-gray-200={currentCategory !== category.id}
            onclick={() => handleCategoryClick(category.id)}
            onkeydown={(e) => handleCategoryKeydown(e, category.id)}
          >
            {getCategoryDisplayName(category)}
          </button>
        {/each}
      </div>

      <!-- Right scroll button (desktop only) -->
      {#if canScrollRight}
        <button
          onclick={scrollRight}
          class="focus-visible-ring relative -mr-1 hidden py-3 pl-4 text-gray-400 transition-colors hover:text-gray-600 md:block dark:text-gray-500 dark:hover:text-gray-300"
          aria-label="Scroll categories right"
          transition:scale={{ duration: 200, start: 0.8 }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      {/if}

      <!-- Action Icons - Same line as categories on the right -->
      {#if displayedStoriesCount > 0 && (onMarkAllRead || onMarkAllUnread || hasHistoricalStories || canRestoreToToday)}
        <div class="ml-4 flex items-center gap-2">
          {#if !allStoriesRead && onMarkAllRead}
            <button
              onclick={() => onMarkAllRead?.()}
              title={s("article.markAllAsRead") || "Mark all as read"}
              aria-label={s("article.markAllAsRead") || "Mark all as read"}
              class="rounded-full p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-green-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-green-400"
              type="button"
            >
              <Icon icon="tabler:check" class="h-4 w-4" />
            </button>
          {/if}

          {#if allStoriesRead && onMarkAllUnread}
            <button
              onclick={() => onMarkAllUnread?.()}
              title={s("article.markAllAsUnread") || "Mark all as unread"}
              aria-label={s("article.markAllAsUnread") || "Mark all as unread"}
              class="rounded-full p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-red-400"
              type="button"
            >
              <Icon icon="tabler:x" class="h-4 w-4" />
            </button>
          {/if}

          {#if (hasHistoricalStories || canRestoreToToday) && onRestoreToToday}
            <button
              onclick={() => onRestoreToToday?.()}
              title={s("stories.restoreToToday") || "Show only today's stories"}
              aria-label={s("stories.restoreToToday") ||
                "Show only today's stories"}
              class="rounded-full p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-blue-400"
              type="button"
            >
              <Icon icon="tabler:refresh" class="h-4 w-4" />
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .category-tabs {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  /* Add safe area padding for mobile browsers */
  .bottom-safe {
    padding-bottom: env(safe-area-inset-bottom, 0.25rem);
  }

  /* Ensure the container accounts for safe areas */
  @supports (padding-bottom: env(safe-area-inset-bottom)) {
    .bottom-safe {
      padding-bottom: calc(0.25rem + env(safe-area-inset-bottom));
    }
  }

  .category-tabs::-webkit-scrollbar {
    display: none;
  }

  .category-tab {
    flex-shrink: 0;
    min-width: fit-content;
  }

  .category-tab:first-child {
    margin-left: 0;
  }

  .category-tab:last-child {
    margin-right: 0;
  }

  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
</style>
