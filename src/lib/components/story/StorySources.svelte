<script lang="ts">
  import { s } from "$lib/client/localization.svelte";
  import { getSectionIcon } from "$lib/constants/sections";
  import { dataService } from "$lib/services/dataService";
  import { experimental } from "$lib/stores/experimental.svelte.js";
  import { language } from "$lib/stores/language.svelte.js";
  import type { MediaInfo } from "$lib/types";
  import { getOrganizationNames } from "$lib/utils/domainUtils";
  import { getTimeAgo, getMostRecentArticleDate } from "$lib/utils/getTimeAgo";
  import SmartImage from "../SmartImage.svelte";
  import SourceTooltip from "./SourceTooltip.svelte";
  import Icon from "@iconify/svelte";

  // Props
  interface Props {
    domains: any[];
    articles: any[];
    citationMapping?: any;
    showSourceOverlay?: boolean;
    currentSource?: any;
    sourceArticles?: any[];
    currentMediaInfo?: MediaInfo | null;
    isLoadingMediaInfo?: boolean;
  }

  let {
    domains,
    articles,
    citationMapping,
    showSourceOverlay = $bindable(false),
    currentSource = $bindable(null),
    sourceArticles = $bindable([]),
    currentMediaInfo = $bindable(null),
    isLoadingMediaInfo = $bindable(false),
  }: Props = $props();

  // Function to decode HTML entities
  function decodeHtmlEntities(text: string): string {
    if (typeof document === "undefined") return text;
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    return textarea.value;
  }

  // State
  let showAllSources = $state(false);
  let visibleSources = $state(
    typeof window !== "undefined" && window.innerWidth <= 768 ? 4 : 8,
  );
  let organizationNames = $state<Map<string, string>>(new Map());

  // Source tooltip reference
  let sourceTooltip: SourceTooltip;

  // Preload organization names for all domains
  $effect(() => {
    if (domains.length > 0) {
      const domainNames = domains.map((d) => d?.name).filter(Boolean);
      if (domainNames.length > 0) {
        getOrganizationNames(domainNames)
          .then((names) => {
            organizationNames = names;
          })
          .catch((error) => {
            console.warn("Failed to preload organization names:", error);
          });
      }
    }
  });

  // All unique domains across articles for the global icon tooltip
  const allArticleDomains = $derived.by(() => {
    const set = new Set<string>();
    (articles || []).forEach((a) => {
      if (a?.domain) set.add(a.domain);
    });
    return Array.from(set);
  });

  // Handle window resize
  if (typeof window !== "undefined") {
    window.addEventListener("resize", () => {
      visibleSources = window.innerWidth <= 768 ? 4 : 8;
    });
  }

  // Mobile detection helper
  const isMobile = $derived(
    typeof window !== "undefined" &&
      ("ontouchstart" in window || window.innerWidth < 768),
  );

  // Helpers to normalize URL and build a dedupe key
  function normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      u.hostname = u.hostname.replace(/^www\./, "").toLowerCase();
      u.protocol = u.protocol.toLowerCase();
      const tracking = new Set([
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "utm_id",
        "utm_name",
        "utm_reader",
        "utm_place",
        "utm_brand",
        "utm_social",
        "utm_social-type",
        "fbclid",
        "gclid",
        "mc_cid",
        "mc_eid",
        "ref",
        "ref_src",
        "ref_url",
        "irclickid",
        "cmp",
        "ncid",
        "mbid",
        "campaign",
        "cid",
      ]);
      const kept: Array<[string, string]> = [];
      u.searchParams.forEach((v, k) => {
        if (!tracking.has(k)) kept.push([k, v]);
      });
      kept.sort((a, b) => a[0].localeCompare(b[0]));
      u.search = kept.length
        ? `?${kept.map(([k, v]) => `${k}=${v}`).join("&")}`
        : "";
      u.hash = "";
      if (u.pathname !== "/" && u.pathname.endsWith("/"))
        u.pathname = u.pathname.slice(0, -1);
      return u.toString();
    } catch {
      return (url || "").trim();
    }
  }
  function getArticleKey(a: any): string {
    if (!a) return "null";
    if (a.link) return normalizeUrl(a.link);
    return `${a.domain || ""}::${(a.title || "").trim()}`;
  }

  // Handle source click
  async function handleSourceClick(domain: any) {
    // On mobile, show all sources in tooltip instead of overlay
    if (isMobile) {
      sourceTooltip?.handleSourceInteraction(
        { target: document.body } as unknown as Event,
        allArticleDomains,
        undefined,
        articles,
      );
      return;
    }

    currentSource = domain;

    // Get articles for this domain and deduplicate by normalized link/title
    const domainArticles =
      articles.filter((a) => a.domain === domain?.name) || [];
    const seen = new Set<string>();
    const uniqueArticles = domainArticles.reduce(
      (acc, article) => {
        const key = getArticleKey(article);
        if (article && !seen.has(key)) {
          seen.add(key);
          acc.push(article);
        }
        return acc;
      },
      [] as typeof domainArticles,
    );

    sourceArticles = uniqueArticles;
    currentMediaInfo = null;
    isLoadingMediaInfo = true;

    // Fetch media info for this specific domain
    if (domain?.name) {
      try {
        const mediaInfo = await dataService.loadMediaDataForHost(
          domain.name,
          language.data,
        );
        currentMediaInfo = mediaInfo;
      } catch (error) {
        console.error(
          "Failed to load media info for domain:",
          domain.name,
          error,
        );
        currentMediaInfo = null;
      }
    }

    isLoadingMediaInfo = false;
    showSourceOverlay = true;
  }

  // Handle source hover for tooltip
  function handleSourceHover(event: Event, domain: any) {
    if (!sourceTooltip) return;

    // Get all articles for this domain (deduped)
    const domainArticles =
      articles.filter((a) => a.domain === domain?.name) || [];
    const seen = new Set<string>();
    const uniqueArticles = domainArticles.reduce((acc, article) => {
      const key = getArticleKey(article);
      if (article && !seen.has(key)) {
        seen.add(key);
        acc.push(article);
      }
      return acc;
    }, [] as any[]);

    sourceTooltip.handleSourceInteraction(
      event,
      [domain?.name || "unknown"],
      undefined,
      uniqueArticles,
    );
  }

  // Narrow hover area: only trigger when cursor is over the favicon container
  function handleSourceHoverIfOverIcon(event: MouseEvent, domain: any) {
    const button = event.currentTarget as HTMLElement | null;
    if (!button) return;
    const iconEl = button.querySelector(".source-icon") as HTMLElement | null;
    if (!iconEl) return;
    const rect = iconEl.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    const inside =
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    if (inside) {
      handleSourceHover(event, domain);
    } else {
      handleSourceLeave(event);
    }
  }

  // Handle source hover leave
  function handleSourceLeave(event: Event) {
    if (!sourceTooltip) return;
    sourceTooltip.handleSourceLeave(event);
  }

  // Build a complete domain list: union of provided domains and all article domains
  const combinedDomains = $derived.by(() => {
    const map = new Map<string, any>();
    // Seed with provided domain objects (prefer richer objects)
    (domains || []).forEach((d: any) => {
      const name = d?.name || String(d || "").trim();
      if (name && !map.has(name)) map.set(name, d);
    });
    // Add any domains found in articles
    (articles || []).forEach((a: any) => {
      const name = a?.domain;
      if (name && !map.has(name)) map.set(name, { name });
    });
    return Array.from(map.values());
  });

  // Sort domains: cited first by their minimum citation number, then non‑cited alphabetically
  const sortedDomains = $derived.by(() => {
    const list = combinedDomains || [];
    const domainToMinCitation = new Map<string, number>();
    if (citationMapping?.numberToArticle) {
      for (const [num, art] of citationMapping.numberToArticle.entries()) {
        if (art?.domain) {
          const prev = domainToMinCitation.get(art.domain);
          if (prev == null || num < prev)
            domainToMinCitation.set(art.domain, num);
        }
      }
    }
    return [...list].sort((a: any, b: any) => {
      const aMin = domainToMinCitation.get(a?.name);
      const bMin = domainToMinCitation.get(b?.name);
      const aCited = aMin != null;
      const bCited = bMin != null;
      if (aCited !== bCited) return aCited ? -1 : 1;
      if (aCited && bCited) return (aMin as number) - (bMin as number);
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
  });

  // Unique cited article counts per domain (dedupe by link/title)
  const citedCountsByDomain = $derived.by(() => {
    const result = new Map<string, number>();
    const map = citationMapping?.numberToArticle;
    if (!map) return result;
    const domainToLinks = new Map<string, Set<string>>();
    for (const art of map.values()) {
      if (!art?.domain) continue;
      const key = (art as any).link || (art as any).title || "";
      if (!key) continue;
      if (!domainToLinks.has(art.domain))
        domainToLinks.set(art.domain, new Set<string>());
      domainToLinks.get(art.domain)!.add(key);
    }
    for (const [dom, set] of domainToLinks) {
      result.set(dom, set.size);
    }
    return result;
  });
</script>

<section class="mt-6" data-no-wiki>
  <div class="mb-4 flex items-center justify-between">
    <h3
      class="flex items-center gap-2 text-xl font-semibold text-gray-800 dark:text-gray-200"
    >
      <Icon
        icon={getSectionIcon("sources")}
        class="h-5 w-5 cursor-pointer text-gray-500 dark:text-gray-400"
        aria-label={s("section.sources") || "Sources"}
        role="button"
        tabindex={0}
        onmouseenter={(e) =>
          sourceTooltip?.handleSourceInteraction(
            e,
            allArticleDomains,
            undefined,
          )}
        onmouseleave={(e) => sourceTooltip?.handleSourceLeave(e)}
        onfocus={(e) =>
          sourceTooltip?.handleSourceInteraction(
            e,
            allArticleDomains,
            undefined,
          )}
        onblur={(e) => sourceTooltip?.handleSourceLeave(e)}
        onclick={(e) =>
          sourceTooltip?.handleSourceInteraction(
            e,
            allArticleDomains,
            undefined,
          )}
        onkeydown={(e) =>
          ((e as KeyboardEvent).key === "Enter" ||
            (e as KeyboardEvent).key === " ") &&
          sourceTooltip?.handleSourceInteraction(
            e,
            allArticleDomains,
            undefined,
          )}
      />
      <span>{s("section.sources") || "Sources"}</span>
    </h3>
    {#if domains.length > visibleSources}
      <button
        onclick={() => (showAllSources = !showAllSources)}
        class="focus-visible-ring text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        aria-label={showAllSources ? "Show fewer sources" : "Show all sources"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="ml-1 inline-block h-5 w-5 transform transition-transform duration-200"
          class:rotate-180={showAllSources}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
    {/if}
  </div>

  <div
    class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
  >
    {#each sortedDomains as domain, index}
      {#if index < visibleSources || showAllSources}
        <button
          type="button"
          class="source-item focus-visible-ring grid w-full grid-cols-[2.5rem_1fr] grid-rows-[auto_auto] gap-x-2 rounded-lg py-2 pl-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
          onclick={(e) => {
            e.stopPropagation();
            handleSourceClick(domain);
          }}
          onmousemove={(e) =>
            handleSourceHoverIfOverIcon(e as MouseEvent, domain)}
          onmouseleave={handleSourceLeave}
          aria-label={`Show articles from ${domain?.name || "Unknown"}`}
          title={`Show articles from ${domain?.name || "Unknown"}`}
        >
          <!-- Icon column centered across card -->
          <div
            class="source-icon col-start-1 row-span-2 flex items-center justify-center"
          >
            <SmartImage
              domain={domain?.name}
              alt={`${domain?.name || "Unknown"} Favicon`}
              class="h-6 w-6 rounded-full"
              size={48}
              loading="eager"
              preferIconify={experimental.preferIconifyIcons}
              addBackground={true}
              backgroundMode="transparent-only"
            />
          </div>
          <span
            class="col-start-2 line-clamp-2 text-base leading-tight font-semibold"
          >
            {decodeHtmlEntities(
              organizationNames.get(domain?.name) || domain?.name || "Unknown",
            )}
          </span>
          <div
            class="col-start-2 flex flex-col text-xs leading-5 text-gray-500 dark:text-gray-400"
          >
            {#if articles}
              {@const articleCount = articles.filter(
                (a) => a.domain === domain?.name,
              ).length}
              {@const mostRecentDate = getMostRecentArticleDate(
                articles,
                domain?.name,
              )}
              {@const citedCount = citedCountsByDomain.get(domain?.name) || 0}
              <span>
                {#if mostRecentDate && articleCount > 0}
                  {getTimeAgo(mostRecentDate)} · {articleCount === 1
                    ? s("sources.article", { count: articleCount.toString() })
                    : s("sources.articles", { count: articleCount.toString() })}
                {:else}
                  {articleCount === 1
                    ? s("sources.article", { count: articleCount.toString() })
                    : s("sources.articles", { count: articleCount.toString() })}
                {/if}
              </span>
              <span>{citedCount} cited</span>
            {:else}
              <span>{s("sources.articles", { count: "0" })}</span>
              <span>0 cited</span>
            {/if}
          </div>
        </button>
      {/if}
    {/each}
  </div>
</section>

<!-- Source Tooltip for source hover -->
<SourceTooltip
  bind:this={sourceTooltip}
  {articles}
  {citationMapping}
  citedItems={[]}
/>

<style>
  /* Multi-line text support with line clamping */
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
