<script lang="ts">

import { openMapLocation, getMapServiceName } from '$lib/utils/mapUtils';
import { replaceWithNumberedCitations, type CitationMapping } from '$lib/utils/citationContext';
import CitationText from './CitationText.svelte';
import SectionSources from './SectionSources.svelte';
import SourceTooltip from './SourceTooltip.svelte';
import WikipediaTooltip from '$lib/components/WikipediaTooltip.svelte';

import { aggregateCitationsFromTexts } from '$lib/utils/citationAggregator';

import { experimental } from '$lib/stores/experimental.svelte.js';
  import { s } from '$lib/client/localization.svelte';

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

// State to track if Wikipedia content is available for this location
let hasWikipediaContent = $state(false);
let wikipediaUrl = $state<string | null>(null);



// Handle location click - prioritize Wikipedia, fallback to maps
async function handleLocationClick() {
	if (!story.location) return;
	
	console.debug('Location clicked:', cleanLocationName, 'hasWikipediaContent:', hasWikipediaContent, 'wikipediaUrl:', wikipediaUrl);
	
	// If we already know Wikipedia content is available, use it
	if (hasWikipediaContent && wikipediaUrl) {
		console.debug('Opening cached Wikipedia URL:', wikipediaUrl);
		window.open(wikipediaUrl, '_blank', 'noopener,noreferrer');
		return;
	}
	
	// Check if the tooltip has already found Wikipedia content
	const wikiElement = document.querySelector(`[data-wiki-id="${cleanLocationName}"]`) as HTMLElement;
	if (wikiElement) {
		const existingUrl = wikiElement.getAttribute('data-url');
		if (existingUrl && existingUrl !== '') {
			console.debug('Found existing Wikipedia URL from tooltip:', existingUrl);
			hasWikipediaContent = true;
			wikipediaUrl = existingUrl;
			window.open(existingUrl, '_blank', 'noopener,noreferrer');
			return;
		}
	}
	
	// Try to find Wikipedia content first
	console.debug('Searching for Wikipedia content for:', cleanLocationName);
	try {
		const wikiContent = await fetchWikipediaContentWithCrossLanguage(cleanLocationName);
		if (wikiContent && wikiContent.wikiUrl && wikiContent.extract && wikiContent.extract !== 'Failed to load Wikipedia content.') {
			// Cache the result for future clicks
			hasWikipediaContent = true;
			wikipediaUrl = wikiContent.wikiUrl;
			console.debug('Found Wikipedia content, opening:', wikiContent.wikiUrl);
			window.open(wikiContent.wikiUrl, '_blank', 'noopener,noreferrer');
			return;
		} else {
			console.debug('No valid Wikipedia content found, wikiContent:', wikiContent);
		}
	} catch (error) {
		console.debug('Wikipedia search failed, falling back to maps:', error);
	}
	
	// Fallback to maps
	console.debug('Opening maps for:', story.location);
	openMapLocation(story.location);
}

// Handle location keyboard events
function handleLocationKeydown(event: KeyboardEvent) {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		handleLocationClick();
	}
}



// Wikipedia interaction handlers for tooltip
async function handleWikipediaInteraction(event: Event) {
	// Check if Wikipedia tooltips are enabled
	if (!experimental.showWikipediaTooltips) {
		return;
	}
	
	// Let the WikipediaTooltip handle everything, including content validation
	wikipediaTooltip?.handleWikipediaInteraction(event);
}

function handleWikipediaLeave(event: Event) {
	wikipediaTooltip?.handleWikipediaLeave(event);
}

async function onWikipediaClick(_title: string, content: string, _imageUrl?: string, wikiUrl?: string) {
	// If we have a Wikipedia URL, redirect to it
	if (wikiUrl && content && content !== 'Failed to load Wikipedia content.') {
		window.open(wikiUrl, '_blank', 'noopener,noreferrer');
	} else {
		// Fallback to location click behavior
		await handleLocationClick();
	}
}

function onWikipediaContentFound(_wikiId: string, wikiUrl: string, _title: string) {
	// Update button state when Wikipedia content is found via tooltip
	if (!hasWikipediaContent && wikiUrl) {
		hasWikipediaContent = true;
		wikipediaUrl = wikiUrl;
		console.debug('Updated button state from tooltip - Wikipedia available for:', cleanLocationName);
	}
}





// Import the enhanced location search function from WikipediaTooltip
async function fetchWikipediaContentWithCrossLanguage(locationName: string) {
	// Use the same logic as the WikipediaTooltip for consistency
	const { fetchWikipediaContent } = await import('$lib/services/wikipediaService');
	const { resolveWikiTitleWithContext } = await import('$lib/utils/wikiResolver');
	
	console.debug('Fetching Wikipedia content for location:', locationName);
	
	// Clean the location name - remove common prefixes that might interfere
	let cleanLocation = locationName.trim();
	cleanLocation = cleanLocation.replace(/^(?:learn more about|in|at|from|near|over|across|around|into)\s+/i, '');
	
	try {
		// Try multiple search variations for better results
		const searchVariations = [
			cleanLocation,
			cleanLocation.split(',')[0].trim(),
			cleanLocation.replace(/,.*$/, '').trim(),
		];
		
		const uniqueVariations = [...new Set(searchVariations)];
		
		for (const variation of uniqueVariations) {
			const resolveResult = await resolveWikiTitleWithContext(variation, 'place');
			
			if (resolveResult) {
				const wikiId = resolveResult.qid || resolveResult.title;
				const wikiContent = await fetchWikipediaContent(wikiId);
				
				if (wikiContent && wikiContent.extract && wikiContent.extract !== 'Failed to load Wikipedia content.') {
					return wikiContent;
				}
			}
		}
		
		return null;
	} catch (error) {
		console.debug('Wikipedia location search failed:', error);
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

// Get the map service name for accessibility
const mapServiceName = getMapServiceName();

// Check for Wikipedia content availability on location change
$effect(() => {
	if (cleanLocationName) {
		console.debug('Location changed, proactively checking Wikipedia for:', cleanLocationName);
		// Reset state when location changes
		hasWikipediaContent = false;
		wikipediaUrl = null;
		
		// Proactively check for Wikipedia content to improve UX
		fetchWikipediaContentWithCrossLanguage(cleanLocationName)
			.then(wikiContent => {
				if (wikiContent && wikiContent.wikiUrl && wikiContent.extract && wikiContent.extract !== 'Failed to load Wikipedia content.') {
					hasWikipediaContent = true;
					wikipediaUrl = wikiContent.wikiUrl;
					console.debug('Proactive Wikipedia check successful for:', cleanLocationName, 'URL:', wikiContent.wikiUrl);
				} else {
					console.debug('Proactive Wikipedia check found no content for:', cleanLocationName);
				}
			})
			.catch((error) => {
				console.debug('Proactive Wikipedia check failed for:', cleanLocationName, error);
			});
	}
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
			title={hasWikipediaContent ? `View ${story.location} on Wikipedia` : `View ${story.location} on ${mapServiceName}`}
			aria-label="View {story.location} {hasWikipediaContent ? 'on Wikipedia' : `on ${mapServiceName}`}"
		>
			<img src="/svg/map.svg" alt="Map icon" class="mr-2 h-5 w-5" />
			<span 
				data-wiki-id={cleanLocationName}
				data-url=""
				class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
				role="presentation"
				onmouseenter={handleWikipediaInteraction}
				onmouseleave={handleWikipediaLeave}
			>
				<CitationText 
					text={displayLocation} 
					showFavicons={false} 
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

<!-- Wikipedia Tooltip for locations -->
<WikipediaTooltip bind:this={wikipediaTooltip} {onWikipediaClick} {onWikipediaContentFound} />


