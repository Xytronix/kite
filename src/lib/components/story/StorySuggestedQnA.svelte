<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import CitationText from './CitationText.svelte';
import SourceTooltip from './SourceTooltip.svelte';
import SectionSources from './SectionSources.svelte';
import { replaceWithNumberedCitations, type CitationMapping } from '$lib/utils/citationContext';
import { aggregateCitationsFromQnA } from '$lib/utils/citationAggregator';
import type { Article } from '$lib/types';
import Icon from '$lib/components/Icon.svelte';
import { getSectionIcon } from '$lib/constants/sections';
import { experimental } from '$lib/stores/experimental.svelte.js';

// Props
interface Props {
	qna: Array<{
		question: string;
		answer: string;
	}>;
	articles?: Article[];
	citationMapping?: CitationMapping;
}

let { qna, articles = [], citationMapping }: Props = $props();

// Shared tooltip reference
let citationTooltip = $state<SourceTooltip | undefined>();

// Convert citations in Q&A if mapping is available
const displayQna = $derived.by(() => {
	if (!citationMapping) return qna;
	return qna.map(qa => ({
		question: replaceWithNumberedCitations(qa.question, citationMapping),
		answer: replaceWithNumberedCitations(qa.answer, citationMapping)
	}));
});

// Get all cited articles from all Q&A pairs
const allCitedArticles = $derived.by(() => {
	return aggregateCitationsFromQnA(displayQna, citationMapping, articles);
});

// Get paragraph-level citations for more granular context
const paragraphCitations = $derived.by(() => {
	if (!citationMapping) return [];

	return displayQna
		.map((qa, index) => {
			const citationNumbers = new Set<number>();

			// Extract citation numbers from both question and answer
			const combinedText = `${qa.question} ${qa.answer}`;
			const citationMatches = combinedText.match(/\[(\d+)\]/g);
			if (citationMatches) {
				citationMatches.forEach((match) => {
					const num = parseInt(match.replace(/[\[\]]/g, ""));
					if (!isNaN(num)) {
						citationNumbers.add(num);
					}
				});
			}

			// Get articles for these specific citation numbers
			const qaArticles: Article[] = [];
			citationNumbers.forEach((num) => {
				const article = citationMapping.numberToArticle.get(num);
				if (article) {
					qaArticles.push(article);
				}
			});

			return {
				articles: qaArticles,
				title: `Q&A ${index + 1}`,
			};
		})
		.filter((p) => p.articles.length > 0); // Only include Q&A pairs with actual citations
});
</script>

<section class="mt-6">
	<h3 class="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-800 dark:text-gray-200">
		<Icon icon={getSectionIcon('suggestedQnA')} class="h-5 w-5 text-gray-500 dark:text-gray-400" />
		<span>{s('section.suggestedQnA') || 'Q&A'}</span>
	</h3>

	<div class="space-y-4">
		{#each displayQna as qa}
			<div class="rounded-lg bg-gray-100 p-4 dark:bg-gray-700">
                <p class="mb-2 font-semibold text-gray-800 dark:text-gray-200">
                    <CitationText 
						text={qa.question} 
                        showFavicons={true} 
						showNumbers={false} 
						inline={true} 
                        articles={allCitedArticles.citedArticles} 
                        allArticles={articles}
						{citationMapping}
						citationTooltip={citationTooltip}
					/>
				</p>
				<p class="text-gray-700 dark:text-gray-300">
                    <CitationText 
                        text={qa.answer} 
                        showFavicons={true} 
                        showNumbers={false} 
                        inline={false} 
                        articles={allCitedArticles.citedArticles} 
                        allArticles={articles}
                        {citationMapping}
                        citationTooltip={citationTooltip}
                    />
				</p>
			</div>
		{/each}
	</div>

	<!-- Section-level sources -->
	{#if experimental.sourceIconPosition === 'section-end'}
		<SectionSources
			articles={allCitedArticles.citedArticles}
			{citationMapping}
			sectionTitle={s('section.suggestedQnA') || 'Q&A'}
			{paragraphCitations}
		/>
	{/if}
</section>

<!-- Shared Source Tooltip -->
<SourceTooltip 
	bind:this={citationTooltip} 
	articles={allCitedArticles.citedArticles} 
	citationNumbers={allCitedArticles.citedNumbers} 
	hasCommonKnowledge={allCitedArticles.hasCommonKnowledge}
	citedItems={allCitedArticles.citedItems}
	{citationMapping}
/>
