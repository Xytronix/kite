<script lang="ts">
  import { s } from "$lib/client/localization.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { dataService } from "$lib/services/dataService";
  import { getOrganizationNames } from "$lib/utils/domainUtils";
  import { experimental } from "$lib/stores/experimental.svelte.js";
  import { language } from "$lib/stores/language.svelte.js";
  import type { Article, MediaInfo } from "$lib/types";
  import type { CitationMapping } from "$lib/utils/citationContext";
  import SmartImage from "../SmartImage.svelte";
  import SourceOverlay from "../SourceOverlay.svelte";
  import SourceTooltip from "./SourceTooltip.svelte";

  // Props
  interface Props {
    story: any;
    citationMapping?: CitationMapping;
    showSourceOverlay?: boolean;
    currentSource?: any;
    sourceArticles?: any[];
    currentMediaInfo?: MediaInfo | null;
    isLoadingMediaInfo?: boolean;
  }

  let {
    story,
    citationMapping,
    showSourceOverlay = $bindable(false),
    currentSource = $bindable(null),
    sourceArticles = $bindable([]),
    currentMediaInfo = $bindable(null),
    isLoadingMediaInfo = $bindable(false),
  }: Props = $props();

  // Function to decode HTML entities
  function decodeHtmlEntities(text: string): string {
    if (typeof document === 'undefined') return text;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  // Get only domains that are actually cited in the story content
  const citedDomains = $derived.by(() => {
    const domains = new Set<string>();

    // Only include domains that are actually cited via the citation mapping
    if (citationMapping?.numberToArticle) {
      for (const article of citationMapping.numberToArticle.values()) {
        if (article?.domain) {
          domains.add(article.domain);
        }
      }
    }

    return Array.from(domains);
  });

  // Citation tooltip reference
  let storyTooltip = $state<SourceTooltip | undefined>();
  let organizationNames = $state<Map<string, string>>(new Map());

  // Only show if we have cited domains and position is set to story-end
  const shouldShow = $derived(
    citedDomains.length > 0 && experimental.sourceIconPosition === "story-end",
  );

  // Preload organization names for cited domains
  $effect(() => {
    if (citedDomains.length > 0) {
      getOrganizationNames(citedDomains).then(names => {
        organizationNames = names;
      }).catch(error => {
        console.warn('Failed to preload organization names:', error);
      });
    }
  });

  // Mobile detection helper
  const isMobile = $derived(
    typeof window !== "undefined" &&
      ("ontouchstart" in window || window.innerWidth < 768),
  );

  // Handle source click to open overlay
  async function handleSourceClick(domain: string) {
    // On mobile, show all story sources in tooltip instead of domain-specific overlay
    if (isMobile) {
      const allCitedArticles = citationMapping?.numberToArticle
        ? Array.from(citationMapping.numberToArticle.values()).filter(Boolean)
        : [];
      storyTooltip?.handleSourceInteraction(
        { target: document.body } as unknown as Event,
        citedDomains,
        undefined,
        allCitedArticles,
      );
      return;
    }

    const domainObj = { name: domain };
    currentSource = domainObj;

    // Get articles for this domain from the citation mapping and deduplicate
    const domainArticles = citationMapping?.numberToArticle
      ? Array.from(citationMapping.numberToArticle.values()).filter(
          (a) => a?.domain === domain,
        )
      : [];

    // Deduplicate articles by link (same article might be cited multiple times)
    const uniqueArticles = domainArticles.reduce(
      (acc, article) => {
        if (
          article &&
          !acc.some((existing) => existing.link === article.link)
        ) {
          acc.push(article);
        }
        return acc;
      },
      [] as typeof domainArticles,
    );

    sourceArticles = uniqueArticles || [];
    currentMediaInfo = null;
    isLoadingMediaInfo = true;

    // Fetch media info for this specific domain
    if (domain) {
      try {
        const mediaInfo = await dataService.loadMediaDataForHost(
          domain,
          language.data,
        );
        currentMediaInfo = mediaInfo;
      } catch (error) {
        console.error("Failed to load media info for domain:", domain, error);
        currentMediaInfo = null;
      }
    }

    isLoadingMediaInfo = false;
    showSourceOverlay = true;
  }

  // Handle source hover for tooltip
  function handleSourceHover(event: Event, domain: string) {
    if (!storyTooltip) return;

    // Get all articles for this domain
    const domainArticles = citationMapping?.numberToArticle
      ? Array.from(citationMapping.numberToArticle.values()).filter(
          (a) => a?.domain === domain,
        )
      : [];

    storyTooltip.handleSourceInteraction(
      event,
      [domain],
      undefined,
      domainArticles,
    );
  }

  // Handle source hover leave
  function handleSourceLeave(event: Event) {
    if (!storyTooltip) return;
    storyTooltip.handleSourceLeave(event);
  }

  // Close overlay
  function closeOverlay() {
    showSourceOverlay = false;
    currentSource = null;
    sourceArticles = [];
    currentMediaInfo = null;
    isLoadingMediaInfo = false;
  }
</script>

{#if shouldShow}
  <div class="story-end-sources mt-8 pt-6" data-no-wiki>
    <h4
      class="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-gray-200"
    >
      <button
        type="button"
        class="inline-flex items-center justify-center rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        aria-label="View all sources"
        onmouseenter={(e) => {
          // Show tooltip with all cited articles
          const allCitedArticles = citationMapping?.numberToArticle
            ? Array.from(citationMapping.numberToArticle.values()).filter(
                Boolean,
              )
            : [];
          storyTooltip?.handleSourceInteraction(
            e,
            citedDomains,
            undefined,
            allCitedArticles,
          );
        }}
        onmouseleave={(e) => {
          storyTooltip?.handleSourceLeave(e);
        }}
        onfocus={(e) => {
          const allCitedArticles = citationMapping?.numberToArticle
            ? Array.from(citationMapping.numberToArticle.values()).filter(
                Boolean,
              )
            : [];
          storyTooltip?.handleSourceInteraction(
            e,
            citedDomains,
            undefined,
            allCitedArticles,
          );
        }}
        onblur={(e) => {
          storyTooltip?.handleSourceLeave(e);
        }}
        onclick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Hide tooltip first
          storyTooltip?.forceHide();
          // Show tooltip interaction for click (mobile behavior)
          const allCitedArticles = citationMapping?.numberToArticle
            ? Array.from(citationMapping.numberToArticle.values()).filter(
                Boolean,
              )
            : [];
          storyTooltip?.handleSourceInteraction(
            e,
            citedDomains,
            undefined,
            allCitedArticles,
          );
        }}
      >
        <Icon icon="tabler:sitemap" class="h-5 w-5" />
      </button>
      <span>{s("section.sources") || "Sources"}</span>
    </h4>
    <div class="flex flex-wrap items-center gap-3">
      {#each citedDomains as domain}
        {@const citedArticles = citationMapping?.numberToArticle
          ? Array.from(citationMapping.numberToArticle.values()).filter(
              (a) => a?.domain === domain,
            )
          : []}
        {@const uniqueArticles = citedArticles.reduce(
          (acc, article) => {
            if (
              article &&
              !acc.some((existing) => existing.link === article.link)
            ) {
              acc.push(article);
            }
            return acc;
          },
          [] as typeof citedArticles,
        )}
        {@const articleCount = uniqueArticles.length}
        <button
          type="button"
          class="source-item flex cursor-pointer items-center gap-2 rounded-lg border-0 bg-gray-50 px-3 py-2 transition-colors hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600"
          aria-label="View citations from {domain}"
          onmouseenter={(e) => handleSourceHover(e, domain)}
          onmouseleave={(e) => handleSourceLeave(e)}
          onfocus={(e) => handleSourceHover(e, domain)}
          onblur={(e) => handleSourceLeave(e)}
          onclick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await handleSourceClick(domain);
          }}
        >
          <SmartImage
            {domain}
            alt="{domain} favicon"
            class="h-5 w-5 rounded-full"
            size={20}
            loading="eager"
            preferIconify={experimental.preferIconifyIcons}
            addBackground={true}
            backgroundMode="transparent-only"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {decodeHtmlEntities(organizationNames.get(domain) || domain)}
          </span>
          <span class="text-xs text-gray-500 dark:text-gray-400">
            ({articleCount})
          </span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Story Source Tooltip -->
  <SourceTooltip
    bind:this={storyTooltip}
    articles={citationMapping?.numberToArticle
      ? Array.from(citationMapping.numberToArticle.values()).filter(Boolean)
      : []}
    allArticles={story.articles || []}
    citationNumbers={[]}
    hasCommonKnowledge={false}
    citedItems={[]}
    {citationMapping}
  />

  <!-- Source Overlay -->
  <SourceOverlay
    isOpen={showSourceOverlay}
    {currentSource}
    {sourceArticles}
    {currentMediaInfo}
    {isLoadingMediaInfo}
    onClose={closeOverlay}
  />
{/if}

<style>
  .source-item {
    transition: all 0.2s ease;
  }
</style>
