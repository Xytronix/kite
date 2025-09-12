<script lang="ts">
import type { OnThisDayEvent } from '$lib/types';
import OnThisDayEventTimeline from './onthisday/OnThisDayEventTimeline.svelte';
import OnThisDayPeopleCarousel from './onthisday/OnThisDayPeopleCarousel.svelte';
import WikipediaTooltip from './WikipediaTooltip.svelte';
import Icon from '$lib/components/Icon.svelte';
import { initializeWikipediaIntegration } from '$lib/utils/wikipediaIntegration';
import { wikipediaTooltipManager } from '$lib/utils/wikipediaTooltipManager';
import { onDestroy } from 'svelte';

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

// Container for OnThisDay content
let contentContainer: HTMLElement;

// Wikipedia integration instance
let wikipediaIntegration: ReturnType<typeof initializeWikipediaIntegration> | null = null;

// Initialize integration when tooltip and container are ready
$effect(() => {
	if (wikipediaTooltip && contentContainer && !wikipediaIntegration) {
		wikipediaIntegration = initializeWikipediaIntegration(
			wikipediaTooltip,
			{
				handleWikipediaInteraction: wikipediaTooltip.handleWikipediaInteraction,
				handleWikipediaLeave: wikipediaTooltip.handleWikipediaLeave
			},
			{
				enableAutoLinking: false, // backend provides QIDs; avoid extra auto-linking here
				enableTooltips: true,
				autoLinkOnMount: false
			}
		);
		// Defer tooltip attachment to ensure DOM is ready
		setTimeout(() => {
			try { 
				wikipediaTooltipManager.attachTooltipsToContainer(contentContainer);
			} catch (error) {
				console.debug('Failed to attach Wikipedia tooltips:', error);
			}
		}, 100);
	}
});

// Refresh tooltip attachments when stories change
$effect(() => {
	if (wikipediaIntegration && contentContainer && stories) {
		// Defer to ensure DOM is updated after stories render
		setTimeout(() => {
			// Refresh attachments directly via manager (bypass experimental gating)
			try { 
				wikipediaTooltipManager.refreshTooltips(contentContainer);
				console.debug('Wikipedia tooltips refreshed for', contentContainer.querySelectorAll('[data-wiki-id]').length, 'elements');
			} catch (error) {
				console.debug('Failed to refresh Wikipedia tooltips:', error);
			}
		}, 100);
	}
});

onDestroy(() => {
	try { wikipediaIntegration?.cleanup(); } catch {}
	wikipediaIntegration = null;
});
</script>

<div 
	bind:this={contentContainer}
	class="py-4 onthisday-content" 
	role="region" 
	aria-label="OnThisDay events with Wikipedia links"
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
