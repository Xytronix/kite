<script lang="ts">
  import { s } from "$lib/client/localization.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import {
    fetchWikipediaContentForDomain,
    type WikipediaContent,
  } from "$lib/services/wikipediaService";
  import { experimental } from "$lib/stores/experimental.svelte.js";
  import { getOrganizationName } from "$lib/utils/domainUtils";
  import { getTimeAgo } from "$lib/utils/getTimeAgo";
  import { scrollLock } from "$lib/utils/scrollLock";
  import SmartImage from "./SmartImage.svelte";
  import { useOverlayScrollbars } from "overlayscrollbars-svelte";
  import "overlayscrollbars/overlayscrollbars.css";

  // Props
  interface Props {
    isOpen?: boolean;
    currentSource?: any;
    sourceArticles?: any[];
    currentMediaInfo?: any;
    isLoadingMediaInfo?: boolean;
    onClose?: () => void;
  }

  let {
    isOpen = false,
    currentSource,
    sourceArticles = [],
    currentMediaInfo,
    isLoadingMediaInfo = false,
    onClose,
  }: Props = $props();

  // Function to decode HTML entities
  function decodeHtmlEntities(text: string): string {
    if (typeof document === "undefined") return text;
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    return textarea.value;
  }

  // State for showing source info
  let showSourceInfo = $state(false);

  // Focus management
  let dialogElement: HTMLElement | undefined = $state(undefined);
  let firstFocusableElement: HTMLElement | undefined = $state(undefined);
  let lastFocusableElement: HTMLElement | undefined = $state(undefined);
  let previousActiveElement: Element | null = null;
  let focusManagementInitialized = $state(false);

  // Use the fetched media info
  const mediaInfo = $derived.by(() => {
    return currentMediaInfo || null;
  });

  // State for organization name
  let organizationName = $state<string>("");

  // Load organization name when currentSource changes
  $effect(() => {
    if (currentSource?.name) {
      organizationName = currentSource.name; // Set fallback immediately
      getOrganizationName(currentSource.name)
        .then((name) => {
          organizationName = decodeHtmlEntities(name);
        })
        .catch(() => {
          // Keep the fallback domain name if lookup fails
        });
    }
  });

  // OverlayScrollbars setup
  let scrollableElement: HTMLElement | undefined = $state(undefined);
  let [initialize, instance] = useOverlayScrollbars({
    defer: true,
    options: {
      scrollbars: {
        autoHide: "leave",
        autoHideDelay: 100,
      },
    },
  });

  // Initialize OverlayScrollbars only when overlay opens
  $effect(() => {
    if (scrollableElement && isOpen) {
      try {
        initialize(scrollableElement);
      } catch (error) {
        console.warn("Failed to initialize OverlayScrollbars:", error);
      }
    }
  });

  // Handle escape key
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && isOpen) {
      handleClose();
    }
  }

  // Focus trap handler
  function handleFocusTrap(e: KeyboardEvent) {
    if (e.key !== "Tab") return;

    if (!firstFocusableElement || !lastFocusableElement) return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusableElement) {
        e.preventDefault();
        lastFocusableElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusableElement) {
        e.preventDefault();
        firstFocusableElement.focus();
      }
    }
  }

  // Get focusable elements
  function getFocusableElements(): HTMLElement[] {
    if (!dialogElement) return [];

    const focusableSelectors = [
      "button:not([disabled])",
      "[href]:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"]):not([disabled])',
    ];

    return Array.from(
      dialogElement.querySelectorAll(focusableSelectors.join(", ")),
    ) as HTMLElement[];
  }

  // Update focusable elements
  function updateFocusableElements() {
    const focusableElements = getFocusableElements();
    firstFocusableElement = focusableElements[0];
    lastFocusableElement = focusableElements[focusableElements.length - 1];
  }

  // Handle visibility changes for scroll lock and focus management
  $effect(() => {
    if (typeof document !== "undefined") {
      if (isOpen && !focusManagementInitialized) {
        // Store the previously active element
        previousActiveElement = document.activeElement;

        // Background scroll locked in dedicated effect below

        // Set up keyboard listeners
        document.addEventListener("keydown", handleKeydown);
        document.addEventListener("keydown", handleFocusTrap);

        // Set initial focus after DOM updates
        setTimeout(() => {
          updateFocusableElements();
          if (firstFocusableElement) {
            firstFocusableElement.focus();
          }
        }, 0);

        focusManagementInitialized = true;
      } else if (!isOpen && focusManagementInitialized) {
        // Clean up listeners
        document.removeEventListener("keydown", handleKeydown);
        document.removeEventListener("keydown", handleFocusTrap);

        // Background scroll unlocked in dedicated effect below

        // Skip focus restoration to prevent position jumping
        // previousActiveElement is cleared but not restored

        focusManagementInitialized = false;
      }

      return () => {
        document.removeEventListener("keydown", handleKeydown);
        document.removeEventListener("keydown", handleFocusTrap);
        // Unlock handled in dedicated effect below
      };
    }
  });

  // Add new dedicated scroll lock effect
  $effect(() => {
    if (typeof document === "undefined") return;
    if (isOpen) {
      scrollLock.lock();
      return () => {
        scrollLock.unlock();
      };
    }
  });

  // Handle close
  function handleClose() {
    if (onClose) onClose();
  }

  // Handle backdrop click
  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  let wikipediaInfo = $state<WikipediaContent | null>(null);
  let isLoadingWikipediaInfo = $state(false);

  // Track the last source we fetched Wikipedia info for to prevent refetching
  let lastFetchedSource = $state<string | null>(null);

  // Watch for overlay open & missing media info to fetch Wikipedia fallback
  $effect(() => {
    // Only proceed if overlay is open, no media info, and we have a source name
    if (!isOpen || currentMediaInfo || !currentSource?.name) {
      // Reset when overlay closes or conditions change
      if (!isOpen) {
        wikipediaInfo = null;
        lastFetchedSource = null;
        isLoadingWikipediaInfo = false;
      }
      return;
    }

    // Avoid refetching if we already have data for the same source
    if (lastFetchedSource === currentSource.name && wikipediaInfo) {
      return;
    }

    // Fetch Wikipedia content asynchronously without blocking reactive updates
    (async () => {
      try {
        isLoadingWikipediaInfo = true;
        lastFetchedSource = currentSource.name;
        const result = await fetchWikipediaContentForDomain(currentSource.name);

        // Only update if we're still looking at the same source and overlay is open
        if (isOpen && currentSource?.name === lastFetchedSource) {
          wikipediaInfo = result;
        }
      } catch (error) {
        console.error("Failed to fetch Wikipedia content:", error);
        wikipediaInfo = null;
      } finally {
        isLoadingWikipediaInfo = false;
      }
    })();
  });

  // Helper derived – any loading state
  const isLoadingInfo = $derived(isLoadingMediaInfo || isLoadingWikipediaInfo);

  // Replace rendering checks
  // Find the block where source info is shown
  // We'll insert new else-if for wikipediaInfo.
</script>

{#if isOpen}
  <div
    class="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 transition-opacity duration-200 dark:bg-black/70"
    onclick={handleBackdropClick}
    onkeydown={(e) => {
      if (e.key === "Escape") {
        handleClose();
      }
    }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="source-overlay-title"
    tabindex="-1"
  >
    <div
      bind:this={dialogElement}
      class="max-h-[90vh] w-full max-w-2xl scale-100 transform overflow-y-auto rounded-lg bg-white p-6 transition-all duration-200 dark:bg-gray-800"
      role="document"
    >
      <div
        bind:this={scrollableElement}
        class="max-h-[80vh] overflow-y-auto"
        data-overlayscrollbars-initialize
      >
        <header class="mb-4 flex items-center justify-between">
          <div class="flex items-center space-x-2">
            {#if currentSource?.name}
              <SmartImage
                domain={currentSource?.name}
                alt={`${currentSource?.name || "Unknown Source"} favicon`}
                class="h-4 w-4 rounded-full"
                size={16}
                loading="eager"
                preferIconify={experimental.preferIconifyIcons}
                addBackground={true}
                backgroundMode="transparent-only"
              />
            {/if}
            <h3
              id="source-overlay-title"
              class="dark:text-dark-text text-xl font-bold"
            >
              {organizationName || "Unknown Source"}
            </h3>
          </div>
          <button
            onclick={handleClose}
            class="focus-visible-ring rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Close source overlay"
            type="button"
          >
            <Icon icon="tabler:x" class="h-6 w-6" />
          </button>
        </header>

        <p class="mb-4 text-gray-600 dark:text-gray-400">
          {sourceArticles.length === 1
            ? s("sources.article", {
                count: sourceArticles.length.toString(),
              }) || `${sourceArticles.length} article`
            : s("sources.articles", {
                count: sourceArticles.length.toString(),
              }) || `${sourceArticles.length} articles`}
        </p>

        <div class="space-y-4">
          {#each sourceArticles as article}
            <article class="flex space-x-4">
              <div class="flex-shrink-0">
                {#if article.image}
                  <img
                    src={article.image}
                    alt="Article"
                    class="h-24 w-24 rounded object-cover"
                    onerror={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      (target.nextElementSibling as HTMLElement)!.style.display =
                        "flex";
                    }}
                  />
                  <!-- Fallback article image -->
                  <div
                    class="flex h-24 w-24 items-center justify-center rounded bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                    style="display: none;"
                  >
                    <Icon icon="tabler:photo" class="h-8 w-8" />
                  </div>
                {:else}
                  <!-- Default article image when no image available -->
                  <div
                    class="flex h-24 w-24 items-center justify-center rounded bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                  >
                    <Icon icon="tabler:photo" class="h-8 w-8" />
                  </div>
                {/if}
              </div>
              <div>
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="hover:underline"
                  onclick={(e) => e.stopPropagation()}
                >
                  <h4 class="dark:text-dark-text font-semibold">
                    {decodeHtmlEntities(article.title)}
                  </h4>
                </a>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {getTimeAgo(article.date)} · {new Date(
                    article.date,
                  ).toLocaleDateString()}
                </p>
              </div>
            </article>
          {/each}
        </div>

        <!-- Source Information -->
        <div
          class="mt-8 border-t border-gray-200 pt-4 select-none dark:border-gray-700"
        >
          <button
            onclick={() => (showSourceInfo = !showSourceInfo)}
            class="flex w-full items-center justify-between p-2 text-left text-gray-800 focus:outline-none dark:text-gray-200"
            type="button"
          >
            <span class="font-semibold select-none">
              {s("source.info.title") || "Source Information"}
            </span>
            <Icon
              icon="tabler:chevron-down"
              class="h-5 w-5 transform transition-transform duration-150 ease-in-out {showSourceInfo
                ? 'rotate-180'
                : ''}"
            />
          </button>

          {#if showSourceInfo}
            <div
              class="animate-in slide-in-from-top-2 mt-4 duration-200 ease-out select-text"
            >
              {#if isLoadingInfo}
                <div class="py-6 text-center">
                  <div
                    class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-gray-400"
                  ></div>
                  <p class="text-gray-600 dark:text-gray-400">
                    {s("source.info.loading") ||
                      "Loading source information..."}
                  </p>
                </div>
              {:else if mediaInfo}
                <div class="space-y-6">
                  <!-- Info Grid -->
                  <div class="grid gap-4 sm:grid-cols-2">
                    <!-- Country -->
                    <div class="flex items-start gap-3">
                      <div class="mt-0.5 flex-shrink-0">
                        <Icon
                          icon="tabler:world"
                          class="h-5 w-5 text-gray-500"
                        />
                      </div>
                      <div class="min-w-0 flex-1">
                        <div
                          class="text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          {s("source.info.country") || "Country"}
                        </div>
                        <div
                          class="break-words text-gray-600 dark:text-gray-400"
                        >
                          {mediaInfo?.country}
                        </div>
                      </div>
                    </div>

                    <!-- Owner -->
                    <div class="flex items-start gap-3">
                      <div class="mt-0.5 flex-shrink-0">
                        <Icon
                          icon="tabler:user-circle"
                          class="h-5 w-5 text-gray-500"
                        />
                      </div>
                      <div class="min-w-0 flex-1">
                        <div
                          class="text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          {s("source.info.owner") || "Owner"}
                        </div>
                        <div
                          class="break-words text-gray-600 dark:text-gray-400"
                        >
                          {mediaInfo?.owner ||
                            s("source.info.notSpecified") ||
                            "Not specified"}
                        </div>
                      </div>
                    </div>

                    <!-- Organization -->
                    <div class="flex items-start gap-3">
                      <div class="mt-0.5 flex-shrink-0">
                        <Icon
                          icon="tabler:building-bank"
                          class="h-5 w-5 text-gray-500"
                        />
                      </div>
                      <div class="min-w-0 flex-1">
                        <div
                          class="text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          {s("source.info.organization") || "Organization"}
                        </div>
                        <div
                          class="break-words text-gray-600 dark:text-gray-400"
                        >
                          {mediaInfo?.organization}
                        </div>
                      </div>
                    </div>

                    <!-- Media Classification -->
                    <div class="flex items-start gap-3">
                      <div class="mt-0.5 flex-shrink-0">
                        <Icon
                          icon="tabler:tags"
                          class="h-5 w-5 text-gray-500"
                        />
                      </div>
                      <div class="min-w-0 flex-1">
                        <div
                          class="text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          {s("source.info.mediaClassification") ||
                            "Media Classification"}
                        </div>
                        <div
                          class="break-words text-gray-600 dark:text-gray-400"
                        >
                          {mediaInfo?.typology}
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Description -->
                  {#if mediaInfo?.description}
                    <div
                      class="mt-6 border-t border-gray-200 pt-6 dark:border-gray-700"
                    >
                      <h4
                        class="mb-3 font-medium text-gray-700 dark:text-gray-300"
                      >
                        {s("source.info.description") || "Description"}
                      </h4>
                      <p
                        class="leading-relaxed text-gray-600 dark:text-gray-400"
                      >
                        {mediaInfo?.description}
                      </p>
                    </div>
                  {/if}
                </div>
              {:else if wikipediaInfo}
                <div class="mt-4 space-y-3">
                  <h4
                    class="text-lg font-medium text-gray-700 dark:text-gray-300"
                  >
                    {wikipediaInfo.title}
                  </h4>
                  <p class="leading-relaxed text-gray-600 dark:text-gray-400">
                    {wikipediaInfo.extract}
                  </p>
                  {#if wikipediaInfo.wikiUrl}
                    <a
                      href={wikipediaInfo.wikiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      onclick={(e) => e.stopPropagation()}
                    >
                      <Icon icon="tabler:external-link" class="h-4 w-4" />
                      <span>View on Wikipedia</span>
                    </a>
                  {/if}
                </div>
              {:else}
                <div class="py-6 text-center">
                  <h4
                    class="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-200"
                  >
                    {s("source.contribute.title") ||
                      "Help Us Improve Source Information"}
                  </h4>
                  <p class="mb-4 text-gray-600 dark:text-gray-400">
                    {s("source.contribute.description") ||
                      "We need your help to provide detailed information about news sources."}
                  </p>
                  <a
                    href="https://github.com/kagisearch/kite-public"
                    class="inline-flex items-center rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors duration-200 hover:bg-blue-600"
                  >
                    <Icon icon="tabler:brand-github" class="mr-2 h-5 w-5" />
                    {s("source.contribute.button") || "Contribute on GitHub"}
                  </a>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
