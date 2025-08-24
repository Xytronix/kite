<script lang="ts">
import CitationText from './CitationText.svelte';
import SourceTooltip from './SourceTooltip.svelte';
import { replaceWithNumberedCitations, type CitationMapping } from '$lib/utils/citationContext';
import { aggregateCitationsFromTexts } from '$lib/utils/citationAggregator';
import type { Article } from '$lib/types';
import Icon from '@iconify/svelte';

// Props
interface Props {
	title: string;
	items?: Array<string>;
	showAsList?: boolean;
	articles?: Article[];
	citationMapping?: CitationMapping;
	icon?: string;
}

let { title, items = [], showAsList = true, articles = [], citationMapping, icon }: Props = $props();

// Shared tooltip reference
let citationTooltip = $state<SourceTooltip | undefined>();

// Convert citations to numbered format if mapping is available
const displayItems = $derived.by(() => {
	if (!citationMapping) return items;
	return items.map(item => replaceWithNumberedCitations(item, citationMapping));
});

// Get all cited articles from all items
const allCitedArticles = $derived.by(() => {
	return aggregateCitationsFromTexts(displayItems, citationMapping, articles);
});
</script>

<section class="mt-6">
    <h3 class="mb-2 flex items-center gap-2 text-xl font-semibold text-gray-800 dark:text-gray-200">
        {#if icon}
            <Icon icon={icon} class="h-5 w-5 text-gray-500 dark:text-gray-400" />
        {/if}
        <span>{title}</span>
    </h3>
	{#if showAsList}
        <ul class="mb-4 list-inside list-disc space-y-2 text-gray-700 dark:text-gray-300">
            {#each displayItems as item, index}
				<li>
                    <CitationText 
                        text={item} 
                        showFavicons={index === 0} 
						showNumbers={false} 
						inline={true} 
                        articles={allCitedArticles.citedArticles} 
                        allArticles={articles}
						{citationMapping}
						citationTooltip={citationTooltip}
					/>
				</li>
			{/each}
		</ul>
	{:else}
		<div class="mb-4 space-y-2 text-gray-700 dark:text-gray-300">
            {#each displayItems as item, index}
                <CitationText 
                    text={item} 
                    showFavicons={index === 0} 
					showNumbers={false} 
					inline={false} 
                    articles={allCitedArticles.citedArticles} 
                    allArticles={articles}
					{citationMapping}
					citationTooltip={citationTooltip}
				/>
			{/each}
		</div>
	{/if}
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
