<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import CitationText from './CitationText.svelte';
import SectionSources from './SectionSources.svelte';
import SourceTooltip from './SourceTooltip.svelte';
import { replaceWithNumberedCitations, type CitationMapping } from '$lib/utils/citationContext';
import { aggregateCitationsFromPoints } from '$lib/utils/citationAggregator';
import { parseStructuredText } from '$lib/utils/textParsing';
import type { Article } from '$lib/types';
import Icon from '@iconify/svelte';
import { getSectionIcon } from '$lib/constants/sections';

// Props
interface Props {
	points?: string[];
	articles?: Article[];
	citationMapping?: CitationMapping;
}

let { points = [], articles = [], citationMapping }: Props = $props();

// Shared tooltip reference
let citationTooltip = $state<SourceTooltip | undefined>();

// Convert citations to numbered format if mapping is available
const displayPoints = $derived.by(() => {
	if (!citationMapping) return points;
	return points.map(point => replaceWithNumberedCitations(point, citationMapping));
});

// Get all cited articles from all highlight points
const allCitedArticles = $derived.by(() => {
	return aggregateCitationsFromPoints(displayPoints, citationMapping, articles);
});
</script>

<section class="mt-6">
	<h3 class="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-800 dark:text-gray-200">
		<Icon icon={getSectionIcon('highlights')} class="h-5 w-5 text-gray-500 dark:text-gray-400" />
		<span>{s('section.highlights') || 'Key Points'}</span>
	</h3>
	<div class="border-t border-dashed border-gray-300 dark:border-gray-600">
		{#each displayPoints as point, index}
			{@const parsed = parseStructuredText(point)}
			<div class="relative border-b border-dashed border-gray-300 py-4 pl-10 dark:border-gray-600">
				<div class="absolute top-4 left-0">
					<div class="flex h-6 w-6 items-center justify-center rounded-full bg-[#F9D9B8]">
						<span class="text-sm font-semibold text-gray-800">{index + 1}</span>
					</div>
				</div>
				{#if parsed.hasTitle}
					<div>
						<h4 class="mb-2 font-semibold text-gray-800 dark:text-gray-200">
                        <CitationText 
								text={parsed.title!} 
                            showFavicons={true}
                            articles={allCitedArticles.citedArticles} 
                            allArticles={articles}
								{citationMapping}
								citationTooltip={citationTooltip}
							/>
						</h4>
						<p class="-ml-10 text-gray-700 dark:text-gray-300">
                            <CitationText 
                                text={parsed.content} 
                                showFavicons={true}
                                articles={allCitedArticles.citedArticles} 
                                allArticles={articles}
                                {citationMapping}
                                citationTooltip={citationTooltip}
                            />
						</p>
					</div>
				{:else}
					<p class="text-gray-700 dark:text-gray-300">
                        <CitationText 
                            text={parsed.content} 
                            showFavicons={true}
                            articles={allCitedArticles.citedArticles} 
                            allArticles={articles}
                            {citationMapping}
                            citationTooltip={citationTooltip}
                        />
					</p>
				{/if}
			</div>
		{/each}
	</div>
	
	<!-- Section-level sources -->
	<SectionSources articles={allCitedArticles.citedArticles} {citationMapping} sectionTitle={s('section.highlights') || 'Key Points'} />
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
