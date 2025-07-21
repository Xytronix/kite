<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import CitationText from './CitationText.svelte';
import CitationTooltip from './CitationTooltip.svelte';
import { replaceWithNumberedCitations, type CitationMapping } from '$lib/utils/citationContext';
import { aggregateCitationsFromPerspectives } from '$lib/utils/citationAggregator';
import { parseStructuredText } from '$lib/utils/textParsing';
import type { Article } from '$lib/types';

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
let citationTooltip = $state<CitationTooltip | undefined>();

// Convert citations in perspectives if mapping is available
const displayPerspectives = $derived.by(() => {
	if (!citationMapping) return perspectives;
	return perspectives.map(p => ({
		...p,
		text: replaceWithNumberedCitations(p.text, citationMapping)
	}));
});

// Get all cited articles from all perspectives
const allCitedArticles = $derived.by(() => {
	return aggregateCitationsFromPerspectives(displayPerspectives, citationMapping, articles);
});

// Touch handling for mobile
let isScrolling = $state(false);

function handleTouchStart() {
	isScrolling = true;
}

function handleTouchEnd() {
	setTimeout(() => {
		isScrolling = false;
	}, 50);
}
</script>

<section class="mt-6">
	<h3 class="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-200">
		{s('section.perspectives') || 'Perspectives'}
	</h3>
	<div
		class="horizontal-scroll-container flex flex-row gap-3 overflow-x-auto pb-4"
		ontouchstart={handleTouchStart}
		ontouchend={handleTouchEnd}
	>
		{#each displayPerspectives as perspective, index}
			{@const parsed = parseStructuredText(perspective.text)}
			<div class="w-56 flex-shrink-0 rounded-lg bg-gray-100 p-4 dark:bg-gray-700">
				{#if parsed.hasTitle}
					<p data-no-wiki class="mb-2 font-bold text-gray-800 dark:text-gray-200">
						<CitationText 
							text={parsed.title!} 
							showFavicons={false} 
							showNumbers={false} 
							inline={true} 
							articles={allCitedArticles.citedArticles} 
							{citationMapping}
							citationTooltip={citationTooltip}
						/>
					</p>
					<p class="mb-2 text-gray-700 dark:text-gray-300">
						<CitationText 
							text={parsed.content} 
							showFavicons={false} 
							showNumbers={false} 
							inline={true} 
							articles={allCitedArticles.citedArticles} 
							{citationMapping}
							citationTooltip={citationTooltip}
						/>
					</p>
				{:else}
					<p class="mb-2 text-gray-700 dark:text-gray-300">
						<CitationText 
							text={parsed.content} 
							showFavicons={false} 
							showNumbers={false} 
							inline={true} 
							articles={allCitedArticles.citedArticles} 
							{citationMapping}
							citationTooltip={citationTooltip}
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
</section>

<!-- Shared Citation Tooltip -->
<CitationTooltip 
	bind:this={citationTooltip} 
	articles={allCitedArticles.citedArticles} 
	citationNumbers={allCitedArticles.citedNumbers} 
	hasCommonKnowledge={allCitedArticles.hasCommonKnowledge}
	citedItems={allCitedArticles.citedItems}
/> 