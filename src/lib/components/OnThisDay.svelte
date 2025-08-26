<script lang="ts">
import type { OnThisDayEvent } from '$lib/types';
import OnThisDayEventTimeline from './onthisday/OnThisDayEventTimeline.svelte';
import OnThisDayPeopleCarousel from './onthisday/OnThisDayPeopleCarousel.svelte';
import WikipediaTooltip from './WikipediaTooltip.svelte';
import Icon from '@iconify/svelte';

// Props
interface Props {
	stories: OnThisDayEvent[] | null;
	isLoading?: boolean;
	onWikipediaClick?: (title: string, content: string, imageUrl?: string, wikiUrl?: string) => void;
	onRetry?: () => void;
}

let { stories, isLoading = false, onWikipediaClick, onRetry }: Props = $props();

// Split stories into events and people
const events = $derived((stories ?? []).filter(story => story.type === 'event'));
const people = $derived((stories ?? []).filter(story => story.type === 'person' || story.type === 'people'));

// Reference to Wikipedia tooltip component
let wikipediaTooltip: WikipediaTooltip | null = $state(null);

// Handle Wikipedia interactions
function handleWikipediaInteraction(event: Event) {
	wikipediaTooltip?.handleWikipediaInteraction(event);
}

function handleWikipediaLeave(event: Event) {
	wikipediaTooltip?.handleWikipediaLeave(event);
}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div 
	class="py-4 onthisday-content" 
	role="region" 
	aria-label="OnThisDay events with Wikipedia links"
	onmouseover={handleWikipediaInteraction} 
	onmouseleave={handleWikipediaLeave} 
	onfocus={handleWikipediaInteraction}
	onblur={handleWikipediaLeave}
	onclick={handleWikipediaInteraction}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			handleWikipediaInteraction(e);
		}
	}}
>
	{#if isLoading}
		<!-- Loading state skeleton -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<Icon icon="tabler:calendar-event" class="mb-4 h-10 w-10 animate-pulse text-gray-400 dark:text-gray-500" />
			<p class="text-sm text-gray-500 dark:text-gray-400">Loading events...</p>
		</div>
	{:else if stories && stories.length === 0}
		<!-- Empty state message -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="mb-4 text-4xl">📅</div>
			<h3 class="mb-2 text-lg font-semibold text-gray-700 dark:text-gray-300">
				No events available
			</h3>
			<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
				OnThisDay events are temporarily unavailable. Please try again later.
			</p>
			{#if onRetry}
				<button
					class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
					onclick={onRetry}
				>
					Try Again
				</button>
			{/if}
		</div>
	{:else}
		<!-- Events Section -->
		<OnThisDayEventTimeline {events} />
		
		<!-- People Section -->
		<OnThisDayPeopleCarousel {people} />
	{/if}
</div>

<!-- Wikipedia Tooltip Handler -->
<WikipediaTooltip bind:this={wikipediaTooltip} {onWikipediaClick} />