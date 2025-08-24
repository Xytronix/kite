<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import CitationText from './CitationText.svelte';
import SourceTooltip from './SourceTooltip.svelte';
import { replaceWithNumberedCitations, type CitationMapping } from '$lib/utils/citationContext';
import { aggregateCitationsFromTexts } from '$lib/utils/citationAggregator';
import { parseStructuredText } from '$lib/utils/textParsing';
import type { Article } from '$lib/types';
import Icon from '@iconify/svelte';
import { getSectionIcon } from '$lib/constants/sections';

// Props
interface Props {
	reactions: Array<string>;
	articles?: Article[];
	citationMapping?: CitationMapping;
}

let { reactions, articles = [], citationMapping }: Props = $props();

// Shared tooltip reference
let citationTooltip = $state<SourceTooltip | undefined>();

// Convert citations in reactions if mapping is available
const displayReactions = $derived.by(() => {
	if (!citationMapping) return reactions;
	return reactions.map(r => replaceWithNumberedCitations(r, citationMapping));
});

// Get all cited articles from all reactions
const allCitedArticles = $derived.by(() => {
	return aggregateCitationsFromTexts(displayReactions, citationMapping, articles);
});

// Parse reaction text using structured text utility
function parseReaction(reaction: string) {
	const parsed = parseStructuredText(reaction);
	let country = parsed.hasTitle ? parsed.title! : '';
	let response = parsed.content;
	
	// Ensure response ends with period
	if (!response.endsWith('.')) {
		response += '.';
	}
	
	return { country, response };
}
</script>

<section class="mt-6">
	<h3 class="mb-2 flex items-center gap-2 text-xl font-semibold text-gray-800 dark:text-gray-200">
		<Icon icon={getSectionIcon('internationalReactions')} class="h-5 w-5 text-gray-500 dark:text-gray-400" />
		<span>{s('section.internationalReactions') || 'International Reactions'}</span>
	</h3>
	<div class="space-y-2">
		{#each displayReactions as reaction}
			{@const parsedReaction = parseReaction(reaction)}
			<div class="rounded-lg bg-gray-100 p-4 dark:bg-gray-700">
				{#if parsedReaction.country}
					<h4 class="font-semibold text-gray-800 dark:text-gray-200">
						{parsedReaction.country}
					</h4>
                    <p class="text-gray-700 dark:text-gray-300">
                            <CitationText 
                            text={parsedReaction.response} 
                            showFavicons={false} 
                            showNumbers={false} 
                            inline={true} 
                            articles={allCitedArticles.citedArticles} 
                            allArticles={articles}
                            {citationMapping}
                            citationTooltip={citationTooltip}
                        />
					</p>
				{:else}
                    <p class="text-gray-700 dark:text-gray-300">
                        <CitationText 
                            text={parsedReaction.response} 
                            showFavicons={false} 
                            showNumbers={false} 
                            inline={true} 
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
