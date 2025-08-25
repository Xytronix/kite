<script lang="ts">
  import { s } from "$lib/client/localization.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { dataService } from "$lib/services/dataService";
  import { experimental } from "$lib/stores/experimental.svelte.js";
  import { language } from "$lib/stores/language.svelte.js";
  import type { Article, MediaInfo } from "$lib/types";
  import type { CitationMapping } from "$lib/utils/citationContext";
  import { getOrganizationNames } from "$lib/utils/domainUtils";
  import SmartImage from "../SmartImage.svelte";
  import SourceOverlay from "../SourceOverlay.svelte";
  import SourceTooltip from "./SourceTooltip.svelte";

  // Props
  interface Props {
    articles?: Article[];
    citationMapping?: CitationMapping;
    sectionTitle?: string;
    paragraphCitations?: Array<{ articles: Article[]; title?: string }>; // Optional paragraph-level citations
  }

  let {
    articles = [],
    citationMapping,
    sectionTitle = "Section",
    paragraphCitations = [],
  }: Props = $props();

  // State for source overlay
  let showSourceOverlay = $state(false);
  let currentSource = $state<any>(null);
  let sourceArticles = $state<any[]>([]);
  let currentMediaInfo = $state<MediaInfo | null>(null);
  let isLoadingMediaInfo = $state(false);

  // Get unique domains from the section-specific cited articles
  const citedDomains = $derived.by(() => {
    const domains = new Set<string>();
    
    // If we have paragraph-level citations, use those for more granular context
    if (paragraphCitations.length > 0) {
      paragraphCitations.forEach((paragraph) => {
        paragraph.articles.forEach((article) => {
          if (article?.domain) {
            domains.add(article.domain);
          }
        });
      });
    } else if (articles.length > 0) {
      // Fallback to section-level articles, but only if they have domains
      articles.forEach((article) => {
        if (article?.domain) {
          domains.add(article.domain);
        }
      });
    }
    
    return Array.from(domains);
  });

  // Citation tooltip reference
  let sectionTooltip = $state<SourceTooltip | undefined>();
  let organizationNames = $state<Map<string, string>>(new Map());

  // Helper function to get section-specific articles
  function normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      u.hostname = u.hostname.replace(/^www\./, '').toLowerCase();
      u.protocol = u.protocol.toLowerCase();
      const tracking = new Set([
        'utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id','utm_name',
        'utm_reader','utm_place','utm_brand','utm_social','utm_social-type','fbclid','gclid','mc_cid','mc_eid','ref','ref_src','ref_url','irclickid','cmp','ncid','mbid','campaign','cid'
      ]);
      const kept: Array<[string,string]> = [];
      u.searchParams.forEach((v,k) => { if (!tracking.has(k)) kept.push([k,v]); });
      kept.sort((a,b) => a[0].localeCompare(b[0]));
      u.search = kept.length ? `?${kept.map(([k,v]) => `${k}=${v}`).join('&')}` : '';
      u.hash = '';
      if (u.pathname !== '/' && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0,-1);
      return u.toString();
    } catch { return (url || '').trim(); }
  }
  function getArticleKey(a: Article | undefined | null): string {
    if (!a) return 'null';
    if (a.link) return normalizeUrl(a.link);
    return `${a.domain || ''}::${(a.title || '').trim()}`;
  }
  function getSectionArticles(): Article[] {
    let sectionArticles: Article[] = [];
    if (paragraphCitations.length > 0) {
      paragraphCitations.forEach((paragraph) => {
        sectionArticles.push(...paragraph.articles);
      });
    } else {
      sectionArticles = articles;
    }
    
    // Deduplicate by link
    const seen = new Set<string>();
    return sectionArticles.reduce((acc, article) => {
      const key = getArticleKey(article);
      if (article && !seen.has(key)) { seen.add(key); acc.push(article); }
      return acc;
    }, [] as Article[]);
  }

  // Mobile detection helper
  const isMobile = $derived(
    typeof window !== 'undefined' && 
    ('ontouchstart' in window || window.innerWidth < 768)
  );

  // Only show if we have cited domains and position is set to section-end (not inline to avoid duplicates)
  const shouldShow = $derived(
    citedDomains.length > 0 &&
      experimental.sourceIconPosition === "section-end",
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

  // Handle source click to open overlay
  async function handleSourceClick(domain: string) {
    const domainObj = { name: domain };
    currentSource = domainObj;

    // Get articles for this domain from the appropriate source and deduplicate by link
    let domainArticles: Article[] = [];
    
    if (paragraphCitations.length > 0) {
      // Use paragraph-level citations for more specific context
      paragraphCitations.forEach((paragraph) => {
        const paragraphDomainArticles = paragraph.articles.filter((a) => a?.domain === domain);
        domainArticles.push(...paragraphDomainArticles);
      });
    } else {
      // Fallback to section-level articles
      domainArticles = articles.filter((a) => a?.domain === domain) || [];
    }
    
    const seen = new Set<string>();
    const uniqueArticles = domainArticles.reduce((acc, article) => {
      const key = getArticleKey(article);
      if (article && article.domain && !seen.has(key)) { seen.add(key); acc.push(article); }
      return acc;
    }, [] as typeof domainArticles);

    sourceArticles = uniqueArticles;
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
  <!-- Section sources aligned in a single line at the bottom -->
  <div
    class="section-sources mt-4"
    role="region"
    aria-label="Section sources"
    data-no-wiki
  >
    <div class="flex items-center justify-start flex-wrap gap-2">
      <!-- Global sources icon -->
      <button
        class="source-item mr-2 inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        aria-label="View all sources for {sectionTitle}"
        onmouseenter={(e) => {
          sectionTooltip?.handleSourceInteraction(
            e,
            citedDomains,
            undefined,
            getSectionArticles(),
          );
        }}
        onmouseleave={(e) => {
          sectionTooltip?.handleSourceLeave(e);
        }}
        onfocus={(e) => {
          sectionTooltip?.handleSourceInteraction(
            e,
            citedDomains,
            undefined,
            getSectionArticles(),
          );
        }}
        onblur={(e) => {
          sectionTooltip?.handleSourceLeave(e);
        }}
        onclick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          // Show all section sources in tooltip (mobile gets full-page modal)
          sectionTooltip?.handleSourceInteraction(
            e,
            citedDomains,
            undefined,
            getSectionArticles(),
          );
        }}
        onkeydown={async (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            sectionTooltip?.forceHide();
            sectionTooltip?.handleSourceInteraction(
              e,
              citedDomains,
              undefined,
              getSectionArticles(),
            );
          }
        }}
        type="button"
      >
        <Icon icon="tabler:sitemap" class="h-4 w-4" />
      </button>
      <span class="mr-2 text-xs text-gray-500 dark:text-gray-400">
        {s(citedDomains.length === 1 ? "citation.source" : "citation.sources")}:
      </span>
      <div class="flex items-center -space-x-2">
        {#each citedDomains.slice(0, 8) as domain, index}
          <button
            type="button"
            class="favicon-wrapper source-item section-favicon relative flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white bg-white p-0 shadow-sm transition-all hover:z-10 hover:scale-110 hover:shadow-md dark:border-gray-600 dark:bg-gray-800"
            style="z-index: {8 - index}"
            title={organizationNames.get(domain) || domain}
            aria-label="View citations from {organizationNames.get(domain) || domain}"
            onmouseenter={(e) => {
              // Get articles for this specific domain from the current context
              let domainArticles: Article[] = [];
              if (paragraphCitations.length > 0) {
                paragraphCitations.forEach((paragraph) => {
                  const paragraphDomainArticles = paragraph.articles.filter((a) => a?.domain === domain);
                  domainArticles.push(...paragraphDomainArticles);
                });
              } else {
                domainArticles = articles.filter((a) => a?.domain === domain);
              }
              
              // Deduplicate by normalized link/title
              const seen = new Set<string>();
              const uniqueDomainArticles = domainArticles.reduce((acc, article) => {
                const key = getArticleKey(article);
                if (article && !seen.has(key)) { seen.add(key); acc.push(article); }
                return acc;
              }, [] as Article[]);
              
              sectionTooltip?.handleSourceInteraction(
                e,
                [domain],
                undefined,
                uniqueDomainArticles,
              );
            }}
            onmouseleave={(e) => {
              sectionTooltip?.handleSourceLeave(e);
            }}
            onfocus={(e) => {
              // Get articles for this specific domain from the current context
              let domainArticles: Article[] = [];
              if (paragraphCitations.length > 0) {
                paragraphCitations.forEach((paragraph) => {
                  const paragraphDomainArticles = paragraph.articles.filter((a) => a?.domain === domain);
                  domainArticles.push(...paragraphDomainArticles);
                });
              } else {
                domainArticles = articles.filter((a) => a?.domain === domain);
              }
              
              // Deduplicate by normalized link/title
              const seen = new Set<string>();
              const uniqueDomainArticles = domainArticles.reduce((acc, article) => {
                const key = getArticleKey(article);
                if (article && !seen.has(key)) { seen.add(key); acc.push(article); }
                return acc;
              }, [] as Article[]);
              
              sectionTooltip?.handleSourceInteraction(
                e,
                [domain],
                undefined,
                uniqueDomainArticles,
              );
            }}
            onblur={(e) => {
              sectionTooltip?.handleSourceLeave(e);
            }}
            onclick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              
              // On mobile, always show all section sources in full-page overlay
              // On desktop, show domain-specific sources in overlay
              if (isMobile) {
                sectionTooltip?.handleSourceInteraction(
                  e,
                  citedDomains,
                  undefined,
                  getSectionArticles(),
                );
              } else {
                await handleSourceClick(domain);
              }
            }}
          >
            <SmartImage
              {domain}
              alt="{domain} favicon"
              class="h-full w-full"
              size={24}
              loading="eager"
              preferIconify={true}
              addBackground={true}
            />
          </button>
        {/each}
        {#if citedDomains.length > 8}
          <div class="ml-3 text-xs text-gray-500 dark:text-gray-400">
            +{citedDomains.length - 8} more
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Section Source Tooltip -->
  <SourceTooltip
    bind:this={sectionTooltip}
    {articles}
    allArticles={articles}
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
  .favicon-wrapper {
    transition:
      transform 0.2s,
      z-index 0.2s;
  }
</style>
