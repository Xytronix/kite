<script lang="ts">
  import { s } from "$lib/client/localization.svelte";
  import { getSectionIcon } from "$lib/constants/sections";
  import { experimental } from "$lib/stores/experimental.svelte.js";
  import type { Article } from "$lib/types";
  import {
    replaceWithNumberedCitations,
    type CitationMapping,
  } from "$lib/utils/citationContext";
  import { getOrganizationNames } from "$lib/utils/domainUtils";
  import { parseStructuredText } from "$lib/utils/textParsing";
  import SmartImage from "../SmartImage.svelte";
  import CitationText from "./CitationText.svelte";
  import SectionSources from "./SectionSources.svelte";
  import SourceTooltip from "./SourceTooltip.svelte";
  import Icon from "@iconify/svelte";

  // Props
  interface Props {
    perspectives?: Array<{
      text: string;
      sources?: Array<{
        name: string;
        url: string;
      }>;
    }>;
    articles?: Article[];
    citationMapping?: CitationMapping;
  }

  let { perspectives = [], articles = [], citationMapping }: Props = $props();

  // Function to decode HTML entities
  function decodeHtmlEntities(text: string): string {
    if (typeof document === "undefined") return text;
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    return textarea.value;
  }

  // Shared tooltip reference
  let citationTooltip = $state<SourceTooltip | undefined>();

  // Convert citations in perspectives if mapping is available
  const displayPerspectives = $derived.by(() => {
    if (!citationMapping) return perspectives;
    return perspectives.map((p) => ({
      ...p,
      text: replaceWithNumberedCitations(p.text, citationMapping),
    }));
  });

  // Get all cited articles from all perspectives - only those actually referenced in the text
  const allCitedArticles = $derived.by(() => {
    if (!citationMapping) {
      return {
        citedArticles: [],
        citedNumbers: [],
        hasCommonKnowledge: false,
        citedItems: [],
      };
    }

    // Extract citation numbers from all perspective texts
    const citationNumbers = new Set<number>();
    let hasCommonKnowledge = false;

    displayPerspectives.forEach((perspective) => {
      // Look for citation patterns [1], [2], etc.
      const citationMatches = perspective.text.match(/\[(\d+)\]/g);
      if (citationMatches) {
        citationMatches.forEach((match) => {
          const num = parseInt(match.replace(/[\[\]]/g, ""));
          if (!isNaN(num)) {
            citationNumbers.add(num);
          }
        });
      }

      // Check for common knowledge marker [*]
      if (perspective.text.includes("[*]")) {
        hasCommonKnowledge = true;
      }
    });

    // Get articles for these specific citation numbers
    const citedArticles: Article[] = [];
    const citedItems: Array<{
      article: Article | null;
      number: number;
      isCommon?: boolean;
    }> = [];

    citationNumbers.forEach((num) => {
      const article = citationMapping.numberToArticle.get(num);
      if (article) {
        citedArticles.push(article);
        citedItems.push({ article, number: num, isCommon: false });
      }
    });

    if (hasCommonKnowledge) {
      citedItems.push({ article: null, number: -1, isCommon: true });
    }

    return {
      citedArticles,
      citedNumbers: Array.from(citationNumbers),
      hasCommonKnowledge,
      citedItems,
    };
  });

  // Get paragraph-level citations for more granular context - only actual citations
  const paragraphCitations = $derived.by(() => {
    if (!citationMapping) return [];

    return displayPerspectives
      .map((perspective, index) => {
        const citationNumbers = new Set<number>();

        // Extract citation numbers from this specific perspective text
        const citationMatches = perspective.text.match(/\[(\d+)\]/g);
        if (citationMatches) {
          citationMatches.forEach((match) => {
            const num = parseInt(match.replace(/[\[\]]/g, ""));
            if (!isNaN(num)) {
              citationNumbers.add(num);
            }
          });
        }

        // Get articles for these specific citation numbers
        const perspectiveArticles: Article[] = [];
        citationNumbers.forEach((num) => {
          const article = citationMapping.numberToArticle.get(num);
          if (article) {
            perspectiveArticles.push(article);
          }
        });

        return {
          articles: perspectiveArticles,
          title: `Perspective ${index + 1}`,
        };
      })
      .filter((p) => p.articles.length > 0); // Only include perspectives with actual citations
  });

  // Organization names cache
  let organizationNames = $state<Map<string, string>>(new Map());

  // Preload organization names for all cited domains
  $effect(() => {
    const allDomains = new Set<string>();
    allCitedArticles.citedArticles.forEach((article) => {
      if (article?.domain) {
        allDomains.add(article.domain);
      }
    });

    if (allDomains.size > 0) {
      getOrganizationNames(Array.from(allDomains))
        .then((names) => {
          organizationNames = names;
        })
        .catch((error) => {
          console.warn("Failed to preload organization names:", error);
        });
    }
  });

  // Helper function to get unique domains from articles
  function getUniqueDomains(articles: Article[]): string[] {
    const domains = new Set<string>();
    articles.forEach((article) => {
      if (article?.domain) {
        domains.add(article.domain);
      }
    });
    return Array.from(domains);
  }

  // Helper function to get the correct URL for a source name from articles
  function getSourceUrl(sourceName: string, fallbackUrl: string): string {
    // Clean the source name
    const cleanSourceName = sourceName.toLowerCase().trim();

    // Try exact match first
    const exactMatch = articles.find(
      (article) => article.title.toLowerCase().trim() === cleanSourceName,
    );

    if (exactMatch) {
      return exactMatch.link;
    }

    // Try matching by domain name with better logic for organization names
    const domainMatch = articles.find((article) => {
      const domain = article.domain.toLowerCase();

      // Remove common TLDs to get the base domain name
      const domainBase = domain.replace(
        /\.(com|org|net|co\.uk|co\.nz|com\.pk|com\.au|tv|news)$/,
        "",
      );

      // Check various matching patterns
      return (
        // Direct domain match: "dawn" matches "dawn.com"
        domainBase === cleanSourceName ||
        // Domain contains source name: "cbsnews" contains "cbs"
        domainBase.includes(cleanSourceName) ||
        // Source name contains domain base: "CBS News" contains "cbs"
        cleanSourceName.includes(domainBase) ||
        // Handle hyphenated domains: "al-jazeera" matches "al jazeera"
        domainBase.replace(/-/g, " ") === cleanSourceName ||
        cleanSourceName.replace(/\s+/g, "-") === domainBase ||
        // Handle common abbreviations and variations
        (cleanSourceName === "dawn" && domainBase === "dawn") ||
        (cleanSourceName === "cbs" && domainBase.includes("cbs")) ||
        (cleanSourceName === "bbc" && domainBase.includes("bbc"))
      );
    });

    if (domainMatch) {
      return domainMatch.link;
    }

    // Try partial title matching
    const partialMatch = articles.find((article) => {
      const title = article.title.toLowerCase();
      return title.includes(cleanSourceName) || cleanSourceName.includes(title);
    });

    if (partialMatch) {
      return partialMatch.link;
    }

    // Fall back to the original URL if no match found
    return fallbackUrl;
  }

  // Touch handling for mobile
  function handleTouchStart() {
    // Touch start handling
  }

  function handleTouchEnd() {
    // Touch end handling
  }
</script>

<section class="mt-6">
  <h3
    class="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-800 dark:text-gray-200"
  >
    <Icon
      icon={getSectionIcon("perspectives")}
      class="h-5 w-5 text-gray-500 dark:text-gray-400"
    />
    <span>{s("section.perspectives") || "Perspectives"}</span>
  </h3>
  <div class="flex flex-col">
    <div class="flex-grow">
      <div
        class="horizontal-scroll-container mb-2 flex flex-row gap-3 overflow-x-auto pb-2"
        ontouchstart={handleTouchStart}
        ontouchend={handleTouchEnd}
      >
        {#each displayPerspectives as perspective}
          {@const parsed = parseStructuredText(perspective.text)}
          {@const perspectiveCitations = (() => {
            if (!citationMapping) return { citedArticles: [] };

            const citationNumbers = new Set<number>();
            const citationMatches = perspective.text.match(/\[(\d+)\]/g);
            if (citationMatches) {
              citationMatches.forEach((match) => {
                const num = parseInt(match.replace(/[\[\]]/g, ""));
                if (!isNaN(num)) {
                  citationNumbers.add(num);
                }
              });
            }

            const citedArticles: Article[] = [];
            citationNumbers.forEach((num) => {
              const article = citationMapping.numberToArticle.get(num);
              if (article) {
                citedArticles.push(article);
              }
            });

            return { citedArticles };
          })()}
          <div
            class="flex w-56 flex-shrink-0 flex-col rounded-lg bg-gray-100 p-4 dark:bg-gray-700"
          >
            <!-- Content section -->
            <div class="flex-grow">
              {#if parsed.hasTitle}
                <p
                  class="question-title mb-2 font-bold text-gray-800 dark:text-gray-200"
                >
                  <CitationText
                    text={parsed.title!}
                    showFavicons={true}
                    forceShowFavicons={true}
                    showNumbers={false}
                    inline={true}
                    articles={perspectiveCitations.citedArticles}
                    allArticles={articles}
                    {citationMapping}
                    {citationTooltip}
                  />
                </p>
                <p class="text-gray-700 dark:text-gray-300">
                  <CitationText
                    text={parsed.content}
                    showFavicons={false}
                    showNumbers={false}
                    inline={true}
                    articles={perspectiveCitations.citedArticles}
                    allArticles={articles}
                    {citationMapping}
                    {citationTooltip}
                  />
                </p>
              {:else}
                <p class="text-gray-700 dark:text-gray-300">
                  <CitationText
                    text={parsed.content}
                    showFavicons={false}
                    showNumbers={false}
                    inline={true}
                    articles={perspectiveCitations.citedArticles}
                    allArticles={articles}
                    {citationMapping}
                    {citationTooltip}
                  />
                </p>
              {/if}
            </div>

            <!-- Sources section - always at bottom -->
            <div class="mt-auto pt-3">
              <!-- Individual perspective sources -->
              {#if experimental.sourceIconPosition === "inline"}
                {@const perspectiveDomains = getUniqueDomains(
                  perspectiveCitations.citedArticles,
                )}
                {#if perspectiveDomains.length > 0}
                  <div
                    class="flex items-center gap-2 border-t border-gray-200 pt-2 dark:border-gray-600"
                  >
                    <div class="flex items-center gap-1">
                      <Icon
                        icon="tabler:link"
                        class="h-3 w-3 text-gray-500 dark:text-gray-400"
                      />
                      <span class="text-xs text-gray-500 dark:text-gray-400">
                        {s(
                          perspectiveDomains.length === 1
                            ? "citation.source"
                            : "citation.sources",
                        )}:
                      </span>
                    </div>
                    <div class="flex items-center -space-x-1">
                      {#each perspectiveDomains.slice(0, 4) as domain, index}
                        <button
                          type="button"
                          class="relative flex h-5 w-5 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white bg-white p-0 shadow-sm transition-all hover:z-10 hover:scale-110 hover:shadow-md dark:border-gray-600 dark:bg-gray-800"
                          style="z-index: {4 - index}"
                          title={decodeHtmlEntities(
                            organizationNames.get(domain) || domain,
                          )}
                          aria-label="View citations from {decodeHtmlEntities(
                            organizationNames.get(domain) || domain,
                          )}"
                          onmouseenter={(e) => {
                            const domainArticles =
                              perspectiveCitations.citedArticles.filter(
                                (a) => a?.domain === domain,
                              );
                            citationTooltip?.handleSourceInteraction(
                              e,
                              [domain],
                              undefined,
                              domainArticles,
                            );
                          }}
                          onmouseleave={(e) => {
                            citationTooltip?.handleSourceLeave(e);
                          }}
                          onfocus={(e) => {
                            const domainArticles =
                              perspectiveCitations.citedArticles.filter(
                                (a) => a?.domain === domain,
                              );
                            citationTooltip?.handleSourceInteraction(
                              e,
                              [domain],
                              undefined,
                              domainArticles,
                            );
                          }}
                          onblur={(e) => {
                            citationTooltip?.handleSourceLeave(e);
                          }}
                          onclick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const domainArticles =
                              perspectiveCitations.citedArticles.filter(
                                (a) => a?.domain === domain,
                              );
                            citationTooltip?.handleSourceInteraction(
                              e,
                              [domain],
                              undefined,
                              domainArticles,
                            );
                          }}
                        >
                          <SmartImage
                            {domain}
                            alt="{domain} favicon"
                            class="h-full w-full"
                            size={20}
                            loading="eager"
                            preferIconify={experimental.preferIconifyIcons}
                            addBackground={true}
                            backgroundMode="transparent-only"
                          />
                        </button>
                      {/each}
                      {#if perspectiveDomains.length > 4}
                        <span
                          class="ml-2 text-xs text-gray-500 dark:text-gray-400"
                        >
                          +{perspectiveDomains.length - 4}
                        </span>
                      {/if}
                    </div>
                  </div>
                {/if}
              {/if}

              <!-- Legacy sources from perspective.sources - only show if inline sources are not active or no citation sources -->
              {#if perspective.sources && perspective.sources.length > 0 && (experimental.sourceIconPosition !== "inline" || perspectiveCitations.citedArticles.length === 0)}
                <div
                  class="flex items-center gap-2 border-t border-gray-200 pt-2 dark:border-gray-600"
                >
                  <div class="flex items-center gap-1">
                    <Icon
                      icon="tabler:link"
                      class="h-3 w-3 text-gray-500 dark:text-gray-400"
                    />
                    <span class="text-xs text-gray-500 dark:text-gray-400"
                      >Source:</span
                    >
                  </div>
                  <div class="flex flex-wrap gap-3 text-sm overflow-hidden">
                    {#each perspective.sources as source, idx}
                      {@const sourceNames = source.name
                        .split(";")
                        .map((name) => name.trim())
                        .filter(Boolean)}
                      {@const sourceUrls = (source.url || "")
                        .split(";")
                        .map((u) => u.trim())
                        .filter(Boolean)}
                      {#each sourceNames as sourceName, nameIdx}
                        {@const matchedArticle = (() => {
                          // First try to find article by matching source name to organization name or domain
                          const cleanSourceName = sourceName
                            .toLowerCase()
                            .trim();

                          // Try exact title match first
                          let match = perspectiveCitations.citedArticles.find(
                            (article) =>
                              article.title.toLowerCase().trim() ===
                              cleanSourceName,
                          );

                          if (!match) {
                            // Try domain-based matching with organization names
                            match = perspectiveCitations.citedArticles.find(
                              (article) => {
                                const domain = article.domain.toLowerCase();
                                const domainBase = domain.replace(
                                  /\.(com|org|net|co\.uk|co\.nz|com\.pk|com\.au|tv|news)$/,
                                  "",
                                );
                                const orgName = decodeHtmlEntities(
                                  organizationNames.get(article.domain) || "",
                                ).toLowerCase();

                                return (
                                  // Direct domain match
                                  domainBase === cleanSourceName ||
                                  // Organization name match
                                  orgName === cleanSourceName ||
                                  // Domain contains source name
                                  domainBase.includes(cleanSourceName) ||
                                  // Source name contains domain base
                                  cleanSourceName.includes(domainBase) ||
                                  // Organization name contains source name
                                  orgName.includes(cleanSourceName) ||
                                  // Source name contains organization name
                                  cleanSourceName.includes(orgName) ||
                                  // Handle hyphenated domains
                                  domainBase.replace(/-/g, " ") ===
                                    cleanSourceName ||
                                  cleanSourceName.replace(/\s+/g, "-") ===
                                    domainBase ||
                                  // Handle common variations
                                  (cleanSourceName.includes("new york times") &&
                                    domain.includes("nytimes")) ||
                                  (cleanSourceName.includes("nytimes") &&
                                    domain.includes("nytimes")) ||
                                  (cleanSourceName.includes("globe and mail") &&
                                    domain.includes("theglobeandmail")) ||
                                  (cleanSourceName.includes("abc news") &&
                                    domain.includes("abc")) ||
                                  (cleanSourceName.includes("politico") &&
                                    domain.includes("politico")) ||
                                  (cleanSourceName.includes("rfe/rl") &&
                                    domain.includes("rferl"))
                                );
                              },
                            );
                          }

                          return match;
                        })()}
                        <a
                          href={matchedArticle?.link ||
                            getSourceUrl(sourceName, sourceUrls[nameIdx] || source.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="break-words max-w-full text-[#183FDC] hover:underline dark:text-[#5B89FF]"
                        >
                          {sourceName}
                        </a>
                      {/each}
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Section-level sources -->
    {#if experimental.sourceIconPosition === "section-end"}
      <div class="mt-auto">
        <SectionSources
          articles={allCitedArticles.citedArticles}
          {citationMapping}
          sectionTitle={s("section.perspectives") || "Perspectives"}
          {paragraphCitations}
        />
      </div>
    {/if}
  </div>
</section>

<!-- Shared Source Tooltip -->
<SourceTooltip
  bind:this={citationTooltip}
  articles={allCitedArticles.citedArticles}
  allArticles={articles}
  citationNumbers={allCitedArticles.citedNumbers}
  hasCommonKnowledge={allCitedArticles.hasCommonKnowledge}
  citedItems={allCitedArticles.citedItems}
  {citationMapping}
/>
