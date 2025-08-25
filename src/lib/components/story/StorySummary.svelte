<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import { openMapLocation } from '$lib/utils/mapUtils';
import { replaceWithNumberedCitations, type CitationMapping } from '$lib/utils/citationContext';
import CitationText from './CitationText.svelte';
import SectionSources from './SectionSources.svelte';
import SourceTooltip from './SourceTooltip.svelte';
import WikipediaTooltip from '$lib/components/WikipediaTooltip.svelte';

import { aggregateCitationsFromTexts } from '$lib/utils/citationAggregator';

import { experimental } from '$lib/stores/experimental.svelte.js';

// Props
interface Props {
	story: any;
	citationMapping?: CitationMapping;
}

let { story, citationMapping }: Props = $props();

// Shared tooltip reference
let citationTooltip = $state<SourceTooltip | undefined>();

// Wikipedia tooltip state
let wikipediaTooltip = $state<WikipediaTooltip | undefined>();



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



// Wikipedia interaction handlers
async function handleWikipediaInteraction(event: Event) {
	// Check if Wikipedia tooltips are enabled
	if (!experimental.showWikipediaTooltips) {
		console.debug('Wikipedia tooltips disabled');
		return;
	}
	
	// Use search-based Wikipedia lookup for places
	const target = event.target as HTMLElement;
	const wikiElement = target.closest('[data-wiki-id]') as HTMLElement;
	
	console.debug('Wikipedia interaction triggered for:', cleanLocationName, 'element:', wikiElement, 'target:', target, 'tooltips enabled:', experimental.showWikipediaTooltips);
	
	if (wikiElement && cleanLocationName) {
		try {
			// Use cross-language Wikipedia search
			console.debug('Searching Wikipedia with cross-language support for:', cleanLocationName);
			const wikiContent = await fetchWikipediaContentWithCrossLanguage(cleanLocationName);
			
			console.debug('Wikipedia cross-language search result:', wikiContent);
			
			if (wikiContent && wikiContent.extract && wikiContent.extract !== 'Failed to load Wikipedia content.') {
				// Update the data-wiki-id with the found title for the tooltip
				wikiElement.setAttribute('data-wiki-id', wikiContent.title);
				wikiElement.setAttribute('data-url', wikiContent.wikiUrl);
				// Ensure the title attribute shows the human-readable title, not the QID
				wikiElement.setAttribute('title', wikiContent.title.startsWith('Q') ? cleanLocationName : wikiContent.title);
				console.debug('Showing Wikipedia tooltip for:', wikiContent.title);
				wikipediaTooltip?.handleWikipediaInteraction(event);
			} else {
				console.debug('No Wikipedia content found for:', cleanLocationName);
			}
		} catch (error) {
			console.debug('Wikipedia search failed for location:', cleanLocationName, error);
		}
	}
}

function handleWikipediaLeave(event: Event) {
	wikipediaTooltip?.handleWikipediaLeave(event);
}

async function onWikipediaClick(_title: string, content: string, _imageUrl?: string, wikiUrl?: string) {
	// If we have a Wikipedia URL, redirect to it
	if (wikiUrl && content && content !== 'Failed to load Wikipedia content.') {
		console.debug('Redirecting to Wikipedia:', wikiUrl);
		window.open(wikiUrl, '_blank', 'noopener,noreferrer');
	} else {
		// Fallback: try to search for Wikipedia content and redirect
		try {
			const { fetchWikipediaContentBySearch } = await import('$lib/services/wikipediaService');
			const wikiContent = await fetchWikipediaContentBySearch(cleanLocationName);
			
			if (wikiContent && wikiContent.wikiUrl && wikiContent.extract && wikiContent.extract !== 'Failed to load Wikipedia content.') {
				console.debug('Found Wikipedia content, redirecting to:', wikiContent.wikiUrl);
				window.open(wikiContent.wikiUrl, '_blank', 'noopener,noreferrer');
			} else {
				// If no Wikipedia content, open maps as alternative
				handleLocationClick();
			}
		} catch (error) {
			// If Wikipedia search fails, open maps as fallback
			console.debug('Wikipedia search failed, opening maps instead:', error);
			handleLocationClick();
		}
	}
}



// Handle click on location - redirect to Wikipedia or maps
async function handleLocationClickOrWikipedia(_event: Event) {
	console.debug('Location clicked:', cleanLocationName);
	
	if (!cleanLocationName) {
		console.debug('No location available');
		return;
	}
	
	try {
		// Use the same cross-language approach as wikipediaService.ts
		const wikiContent = await fetchWikipediaContentWithCrossLanguage(cleanLocationName);
		
		if (wikiContent && wikiContent.wikiUrl && wikiContent.extract && wikiContent.extract !== 'Failed to load Wikipedia content.') {
			// Redirect to Wikipedia
			console.debug('Found Wikipedia content for:', cleanLocationName, 'redirecting to:', wikiContent.wikiUrl);
			window.open(wikiContent.wikiUrl, '_blank', 'noopener,noreferrer');
		} else {
			// No Wikipedia content found, open maps instead
			console.debug('No Wikipedia content found, opening maps for:', cleanLocationName);
			handleLocationClick();
		}
	} catch (error) {
		// If Wikipedia search fails, open maps as fallback
		console.debug('Wikipedia search failed, opening maps instead:', error);
		handleLocationClick();
	}
}

// Cross-language Wikipedia content fetching using wikiResolver for proper place validation
async function fetchWikipediaContentWithCrossLanguage(locationName: string) {
	console.debug('Fetching Wikipedia content for location:', locationName);
	
	// Clean the location name - remove common prefixes that might interfere
	let cleanLocation = locationName.trim();
	
	// Remove common prefixes like "Learn more about", "in", "at", etc.
	cleanLocation = cleanLocation.replace(/^(?:learn more about|in|at|from|near|over|across|around|into)\s+/i, '');
	
	console.debug('Cleaned location name:', cleanLocation);
	
	try {
		// Step 1: Use wikiResolver to properly resolve the place with context validation
		const { resolveWikiTitleWithContext } = await import('$lib/utils/wikiResolver');
		const resolveResult = await resolveWikiTitleWithContext(cleanLocation, 'place');
		
		if (!resolveResult) {
			console.debug('No Wikipedia place found for:', cleanLocation);
			return null;
		}
		
		console.debug('WikiResolver found:', resolveResult);
		
		// Step 2: Get the full Wikipedia content using the resolved title and Q-ID
		const { fetchWikipediaContent } = await import('$lib/services/wikipediaService');
		
		// Prefer Q-ID if available for better cross-language support
		const wikiId = resolveResult.qid || resolveResult.title;
		const wikiContent = await fetchWikipediaContent(wikiId);
		
		if (wikiContent && wikiContent.extract && wikiContent.extract !== 'Failed to load Wikipedia content.') {
			console.debug('Successfully fetched Wikipedia content via resolver');
			
			return wikiContent;
		}
		
		console.debug('No valid Wikipedia content found');
		return null;
		
	} catch (error) {
		console.debug('Wikipedia resolver fetch failed:', error);
		return null;
	}
}





// Convert citations to numbered format if mapping is available
const displaySummary = $derived.by(() => {
	if (!citationMapping) return story.short_summary || '';
	return replaceWithNumberedCitations(story.short_summary || '', citationMapping);
});

const displayLocation = $derived.by(() => {
	if (!citationMapping || !story.location) return story.location || '';
	return replaceWithNumberedCitations(story.location, citationMapping);
});

// Clean location name for Wikipedia search (remove common prefixes)
const cleanLocationName = $derived.by(() => {
	if (!story.location) return '';
	let cleanLocation = story.location.trim();
	// Remove common prefixes like "Learn more about", "in", "at", etc.
	cleanLocation = cleanLocation.replace(/^(?:learn more about|in|at|from|near|over|across|around|into)\s+/i, '');
	return cleanLocation;
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
		<div class="flex items-center text-gray-600 dark:text-gray-300">
			<button
				data-no-wiki
				class="flex cursor-pointer items-center bg-transparent border-none p-0 focus-visible-ring rounded mr-2"
				onclick={handleLocationClick}
				onkeydown={handleLocationKeydown}
				title={s('article.location')}
				aria-label="View {story.location} on map"
			>
				<img src="/svg/map.svg" alt="Map icon" class="h-5 w-5" />
			</button>
			<span 
				data-wiki-id={cleanLocationName}
				data-url=""
				class="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors wikipedia-enabled-location"
				title={cleanLocationName}
				role="button"
				tabindex="0"
				onmouseenter={handleWikipediaInteraction}
				onmouseleave={handleWikipediaLeave}
				onfocus={handleWikipediaInteraction}
				onblur={handleWikipediaLeave}
				onclick={handleLocationClickOrWikipedia}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						handleLocationClickOrWikipedia(e);
					}
				}}
			>
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
		</div>
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

<!-- Wikipedia Tooltip for locations -->
<WikipediaTooltip bind:this={wikipediaTooltip} {onWikipediaClick} />


