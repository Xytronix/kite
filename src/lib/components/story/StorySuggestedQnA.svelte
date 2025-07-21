<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import CitationText from './CitationText.svelte';
import CitationTooltip from './CitationTooltip.svelte';
import { replaceWithNumberedCitations, type CitationMapping } from '$lib/utils/citationContext';
import { aggregateCitationsFromQnA } from '$lib/utils/citationAggregator';
import type { Article } from '$lib/types';

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
let citationTooltip = $state<CitationTooltip | undefined>();

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
</script>

<section class="mt-6">
	<h3 class="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-200">
		{s('section.suggestedQnA') || 'Q&A'}
	</h3>

	<div class="space-y-4">
		{#each displayQna as qa}
			<div class="rounded-lg bg-gray-100 p-4 dark:bg-gray-700">
				<p data-no-wiki class="mb-2 font-semibold text-gray-800 dark:text-gray-200">
					<CitationText 
						text={qa.question} 
						showFavicons={false} 
						showNumbers={false} 
						inline={true} 
						articles={allCitedArticles.citedArticles} 
						{citationMapping}
						citationTooltip={citationTooltip}
					/>
				</p>
				<p class="text-gray-700 dark:text-gray-300">
					<CitationText 
						text={qa.answer} 
						showFavicons={false} 
						showNumbers={false} 
						inline={false} 
						articles={allCitedArticles.citedArticles} 
						{citationMapping}
						citationTooltip={citationTooltip}
					/>
				</p>
			</div>
		{/each}
	</div>
</section>

<!-- Shared Citation Tooltip -->
<CitationTooltip 
	bind:this={citationTooltip} 
	articles={allCitedArticles.citedArticles} 
	citationNumbers={allCitedArticles.citedNumbers} 
	hasCommonKnowledge={allCitedArticles.hasCommonKnowledge}
	citedItems={allCitedArticles.citedItems}
/> 