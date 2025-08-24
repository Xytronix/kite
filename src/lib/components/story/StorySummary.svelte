<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import { openMapLocation, getMapServiceName } from '$lib/utils/mapUtils';
import { replaceWithNumberedCitations, type CitationMapping } from '$lib/utils/citationContext';
import CitationText from './CitationText.svelte';
import SectionSources from './SectionSources.svelte';
import SourceTooltip from './SourceTooltip.svelte';
import { aggregateCitationsFromTexts } from '$lib/utils/citationAggregator';
import type { Article } from '$lib/types';
import SmartImage from '../SmartImage.svelte';

// Props
interface Props {
	story: any;
	citationMapping?: CitationMapping;
}

let { story, citationMapping }: Props = $props();

// Shared tooltip reference
let citationTooltip = $state<SourceTooltip | undefined>();



// Handle location click
function handleLocationClick() {
	if (story.location) {
		openMapLocation(story.location);
	}
}

// Handle location keyboard events
function handleLocationKeydown(event: KeyboardEvent) {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		handleLocationClick();
	}
}

// Get the map service name for accessibility
const mapServiceName = getMapServiceName();

// Convert citations to numbered format if mapping is available
const displaySummary = $derived.by(() => {
	if (!citationMapping) return story.short_summary || '';
	return replaceWithNumberedCitations(story.short_summary || '', citationMapping);
});

const displayLocation = $derived.by(() => {
	if (!citationMapping || !story.location) return story.location || '';
	return replaceWithNumberedCitations(story.location, citationMapping);
});

// Get all cited articles from summary and location
const allCitedArticles = $derived.by(() => {
	const texts = [displaySummary];
	if (displayLocation) texts.push(displayLocation);
	return aggregateCitationsFromTexts(texts, citationMapping, story.articles || []);
});
</script>

<section class="mt-6">
	<div class="mb-6">
        <CitationText 
			text={displaySummary} 
			showFavicons={true} 
			showNumbers={false} 
            articles={allCitedArticles.citedArticles} 
            allArticles={story.articles || []}
			{citationMapping}
			citationTooltip={citationTooltip}
		/>
	</div>
	{#if story.location}
		<button
			data-no-wiki
			class="flex cursor-pointer items-center text-gray-600 dark:text-gray-300 bg-transparent border-none p-0 focus-visible-ring rounded"
			onclick={handleLocationClick}
			onkeydown={handleLocationKeydown}
			title={s('article.location') || `View on ${mapServiceName}`}
			aria-label="View {story.location} on {mapServiceName}"
		>
			<img src="/svg/map.svg" alt="Map icon" class="mr-2 h-5 w-5" />
			<span>
                <CitationText 
					text={displayLocation} 
					showFavicons={true} 
					showNumbers={false} 
					inline={true} 
                    articles={allCitedArticles.citedArticles} 
                    allArticles={story.articles || []}
					{citationMapping}
					citationTooltip={citationTooltip}
				/>
			</span>
		</button>
	{/if}
	
	<!-- Section-level sources -->
	<SectionSources articles={allCitedArticles.citedArticles} {citationMapping} sectionTitle="Summary" />

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
