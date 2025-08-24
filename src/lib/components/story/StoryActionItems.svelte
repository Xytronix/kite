<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import CitationText from './CitationText.svelte';
import SourceTooltip from './SourceTooltip.svelte';
import { replaceWithNumberedCitations, type CitationMapping } from '$lib/utils/citationContext';
import { aggregateCitationsFromTexts } from '$lib/utils/citationAggregator';
import type { Article } from '$lib/types';
import Icon from '@iconify/svelte';
import { getSectionIcon } from '$lib/constants/sections';

// Props
interface Props {
	actionItems: Array<string>;
	articles?: Article[];
	citationMapping?: CitationMapping;
}

let { actionItems, articles = [], citationMapping }: Props = $props();

// Shared tooltip reference
let citationTooltip = $state<SourceTooltip | undefined>();

// Convert citations to numbered format if mapping is available
const displayItems = $derived.by(() => {
	if (!citationMapping) return actionItems;
	return actionItems.map(item => replaceWithNumberedCitations(item, citationMapping));
});

// Get all cited articles from all action items
const allCitedArticles = $derived.by(() => {
	return aggregateCitationsFromTexts(displayItems, citationMapping, articles);
});
</script>

<section class="mt-6 rounded-lg bg-[#F1FAE8] p-4 dark:bg-[#2B411C]">
	<h3 class="mb-2 flex items-center gap-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
		<Icon icon={getSectionIcon('actionItems')} class="h-5 w-5 text-gray-600 dark:text-gray-300" />
		<span>{s('section.actionItems') || 'Action Items'}</span>
	</h3>
	<ul class="mb-2 ml-4 list-disc space-y-2 text-gray-700 dark:text-gray-200">
		{#each displayItems as item}
			<li>
				<CitationText 
					text={item} 
					showFavicons={false} 
					showNumbers={false} 
					inline={true} 
					articles={allCitedArticles.citedArticles} 
					{citationMapping}
					citationTooltip={citationTooltip}
				/>
			</li>
		{/each}
	</ul>
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
