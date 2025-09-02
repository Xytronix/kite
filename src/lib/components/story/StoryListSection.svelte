<script lang="ts">
  import { experimental } from "$lib/stores/experimental.svelte.js";
  import type { Article, TechnicalDetailItem } from "$lib/types";
  import {
    aggregateCitationsFromTexts,
    aggregateCitationsPerPerspective,
  } from "$lib/utils/citationAggregator";
  import {
    replaceWithNumberedCitations,
    type CitationMapping,
  } from "$lib/utils/citationContext";
  import CitationText from "./CitationText.svelte";
  import SectionSources from "./SectionSources.svelte";
  import SourceTooltip from "./SourceTooltip.svelte";
  import Icon from "@iconify/svelte";

  // Props
  interface Props {
    title: string;
    items?: Array<string | TechnicalDetailItem>;
    showAsList?: boolean;
    articles?: Article[];
    citationMapping?: CitationMapping;
    icon?: string;
  }

  let {
    title,
    items = [],
    showAsList = true,
    articles = [],
    citationMapping,
    icon,
  }: Props = $props();

  // Shared tooltip reference
  let citationTooltip = $state<SourceTooltip | undefined>();

  // Normalize incoming items: group XML-like <detail> and <text> blocks into structured items
  function normalizeItems(
    input: Array<string | TechnicalDetailItem>,
  ): Array<string | TechnicalDetailItem> {
    const result: Array<string | TechnicalDetailItem> = [];
    for (let i = 0; i < input.length; i++) {
      const current = input[i];
      if (typeof current !== "string") {
        result.push(current);
        continue;
      }
      const line = current.trim();

      // Combined single-line detail with <description>
      const combinedDesc = line.match(
        /^<detail>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<description>([\s\S]*?)<\/description>[\s\S]*?<\/detail>$/i,
      );
      if (combinedDesc) {
        result.push({
          title: combinedDesc[1].trim(),
          description: combinedDesc[2].trim(),
        });
        continue;
      }

      // Combined single-line detail with <text>
      const combinedText = line.match(
        /^<detail>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<text>([\s\S]*?)<\/text>[\s\S]*?<\/detail>$/i,
      );
      if (combinedText) {
        result.push({
          title: combinedText[1].trim(),
          description: combinedText[2].trim(),
        });
        continue;
      }
      // Start of multi-line detail
      if (line.toLowerCase() === "<detail>") {
        let titleText = "";
        let descriptionText = "";
        let j = i + 1;
        for (; j < input.length; j++) {
          const next = input[j];
          if (typeof next !== "string") break;
          const t = next.trim();
          const mTitle = t.match(/^<title>([\s\S]*?)<\/title>$/i);
          if (mTitle) {
            titleText = mTitle[1].trim();
            continue;
          }
          const mDesc = t.match(/^<description>([\s\S]*?)<\/description>$/i);
          if (mDesc) {
            descriptionText = mDesc[1].trim();
            continue;
          }
          const mText = t.match(/^<text>([\s\S]*?)<\/text>$/i);
          if (mText) {
            descriptionText = mText[1].trim();
            continue;
          }
          if (t.toLowerCase() === "</detail>") {
            break;
          }
        }
        // Skip consumed lines
        i = j;
        result.push({ title: titleText, description: descriptionText });
        continue;
      }

      // Fallback: keep as-is
      result.push(current);
    }
    return result;
  }

  // Convert citations to numbered format if mapping is available
  const normalizedItems = $derived.by(() => normalizeItems(items));
  const displayItems = $derived.by(() => {
    if (!citationMapping) return normalizedItems;
    return normalizedItems.map((item) => {
      if (typeof item === "string") {
        return replaceWithNumberedCitations(item, citationMapping);
      }
      return {
        title: replaceWithNumberedCitations(item.title, citationMapping),
        description: replaceWithNumberedCitations(
          item.description,
          citationMapping,
        ),
      } as TechnicalDetailItem;
    });
  });

  // Create plain texts for citation aggregation
  const textsForAggregation = $derived.by(() => {
    return displayItems.map((item) =>
      typeof item === "string" ? item : `${item.title}. ${item.description}`,
    );
  });

  // Get all cited articles from all items
  const allCitedArticles = $derived.by(() => {
    return aggregateCitationsFromTexts(
      textsForAggregation,
      citationMapping,
      articles,
    );
  });

  // Get paragraph-level citations (one per list item)
  const paragraphCitations = $derived.by(() => {
    const perItemCitations = aggregateCitationsPerPerspective(
      displayItems.map((item) => ({
        text: typeof item === "string" ? item : item.description,
      })),
      citationMapping,
      articles,
    );
    return perItemCitations.map((citation, index) => ({
      articles: citation.citedArticles,
      title:
        typeof displayItems[index] === "string"
          ? `Item ${index + 1}`
          : (displayItems[index] as TechnicalDetailItem).title,
    }));
  });

  // Container classes - align with StorySummary (no reserved min-height)
  const containerClasses = $derived("flex flex-col");
</script>

<section class="mt-6">
  <h3
    class="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-800 dark:text-gray-200"
  >
    {#if icon}
      <Icon {icon} class="h-5 w-5 text-gray-500 dark:text-gray-400" />
    {/if}
    <span>{title}</span>
  </h3>
  <div class={containerClasses}>
    <div class="flex-grow">
      {#if showAsList}
        <ul
          class="mb-4 list-inside list-disc space-y-2 text-gray-700 dark:text-gray-300"
        >
          {#each displayItems as item, index}
            <li>
              {#if typeof item === "string"}
                <CitationText
                  text={item}
                  showFavicons={true}
                  showNumbers={false}
                  inline={true}
                  articles={allCitedArticles.citedArticles}
                  allArticles={articles}
                  {citationMapping}
                  {citationTooltip}
                />
              {:else}
                <div>
                  <div class="font-semibold text-gray-800 dark:text-gray-200">
                    {(item as TechnicalDetailItem).title}
                  </div>
                  <CitationText
                    text={(item as TechnicalDetailItem).description}
                    showFavicons={true}
                    showNumbers={false}
                    inline={true}
                    articles={allCitedArticles.citedArticles}
                    allArticles={articles}
                    {citationMapping}
                    {citationTooltip}
                  />
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      {:else}
        <div class="mb-4 space-y-2 text-gray-700 dark:text-gray-300">
          {#each displayItems as item, index}
            {#if typeof item === "string"}
              <CitationText
                text={item}
                showFavicons={true}
                showNumbers={false}
                inline={false}
                articles={allCitedArticles.citedArticles}
                allArticles={articles}
                {citationMapping}
                {citationTooltip}
              />
            {:else}
              <div>
                <div class="font-semibold text-gray-800 dark:text-gray-200">
                  {(item as TechnicalDetailItem).title}
                </div>
                <CitationText
                  text={(item as TechnicalDetailItem).description}
                  showFavicons={true}
                  showNumbers={false}
                  inline={false}
                  articles={allCitedArticles.citedArticles}
                  allArticles={articles}
                  {citationMapping}
                  {citationTooltip}
                />
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    <!-- Section-level sources -->
    {#if experimental.sourceIconPosition === "section-end"}
      <div class="mt-auto">
        <SectionSources
          articles={allCitedArticles.citedArticles}
          {citationMapping}
          sectionTitle={title}
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
