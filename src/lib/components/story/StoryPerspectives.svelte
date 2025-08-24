<script lang="ts">
  import { s } from "$lib/client/localization.svelte";
  import { getSectionIcon } from "$lib/constants/sections";
  import type { Article } from "$lib/types";
  import { aggregateCitationsPerPerspective } from "$lib/utils/citationAggregator";
  import {
    replaceWithNumberedCitations,
    type CitationMapping,
  } from "$lib/utils/citationContext";
  import { parseStructuredText } from "$lib/utils/textParsing";
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
  <div class="flex min-h-[200px] flex-col">
    <div class="flex-grow">
      <div
        class="horizontal-scroll-container mb-2 flex flex-row gap-3 overflow-x-auto pb-2"
        ontouchstart={handleTouchStart}
        ontouchend={handleTouchEnd}
      >
        {#each displayPerspectives as perspective, perspectiveIndex}
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
            class="w-56 flex-shrink-0 rounded-lg bg-gray-100 p-4 dark:bg-gray-700"
          >
            {#if parsed.hasTitle}
              <p
                data-no-wiki
                class="mb-2 font-bold text-gray-800 dark:text-gray-200"
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
              <p class="mb-2 text-gray-700 dark:text-gray-300">
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
              <p class="mb-2 text-gray-700 dark:text-gray-300">
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

            {#if perspective.sources && perspective.sources.length > 0}
              <div class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {#each perspective.sources as source, idx}
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-[#183FDC] hover:underline dark:text-[#5B89FF]"
                  >
                    {source.name}
                  </a>
                  {#if idx < perspective.sources.length - 1}
                    <span> • </span>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <!-- Section-level sources -->
    <div class="mt-auto">
      <SectionSources
        articles={allCitedArticles.citedArticles}
        {citationMapping}
        sectionTitle={s("section.perspectives") || "Perspectives"}
        {paragraphCitations}
      />
    </div>
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
