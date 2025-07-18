<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import StoryCard from './story/StoryCard.svelte';
import type { Story } from '$lib/types';
import { storyCount } from '$lib/stores/storyCount.svelte.js';
import { smartContentFilter } from '$lib/stores/smartContentFilter.svelte';
import type { FilteredStory } from '$lib/utils/contentFilter';

// Props
interface Props {
	stories?: Story[];
	currentCategory: string;
	batchId?: string;
	readStories?: Record<string, boolean>;
	expandedStories?: Record<string, boolean>;
	onStoryToggle?: (storyId: string) => void;
	showSourceOverlay?: boolean;
	currentSource?: any;
	sourceArticles?: any[];
	currentMediaInfo?: any;
	isLoadingMediaInfo?: boolean;
}

let { 
	stories = [],
	currentCategory, 
	batchId,
	readStories = $bindable({}),
	expandedStories = {},
	onStoryToggle,
	showSourceOverlay = $bindable(false),
	currentSource = $bindable(null),
	sourceArticles = $bindable([]),
	currentMediaInfo = $bindable(null),
	isLoadingMediaInfo = $bindable(false)
}: Props = $props();

// Handle story toggle
function handleStoryToggle(story: Story) {
	const storyId = story.cluster_number?.toString() || story.title;
	if (onStoryToggle) {
		onStoryToggle(storyId);
	}
}

// Handle read status toggle
function handleReadToggle(story: Story) {
	readStories[story.title] = !readStories[story.title];
}

// Mark all as read
function markAllAsRead() {
	displayedStories.forEach(story => {
		readStories[story.title] = true;
	});
}

// Apply content filtering and story count limit
const { displayedStories, filteredCount, hiddenStories } = $derived.by(() => {
	// First apply story count limit
	const limitedStories = stories.slice(0, storyCount.current);
	
	// Then apply smart content filtering if enabled
	if (smartContentFilter.isEnabled) {
		const result = smartContentFilter.filterStories(limitedStories);
		
		return {
			displayedStories: result.filtered as FilteredStory[],
			filteredCount: result.removed.length,
			hiddenStories: result.removed.map(r => r.story)
		};
	}
	
	return {
		displayedStories: limitedStories as FilteredStory[],
		filteredCount: 0,
		hiddenStories: []
	};
});

// Check if all stories are read
const allStoriesRead = $derived(
	displayedStories.every(story => readStories[story.title])
);
</script>

<div class="story-list">
	{#if displayedStories.length === 0}
		<div class="py-8 text-center text-gray-500 dark:text-gray-400">
					{#if smartContentFilter.isEnabled && filteredCount > 0}
			<!-- All stories filtered message -->
			<p class="text-base font-medium mb-2">
				{s('smartFilter.allStoriesFiltered') || 'All stories in this category were filtered'}
			</p>
			<p class="text-sm mb-4">
				{s('smartFilter.allStoriesFilteredDescription') || 'Your smart filters have hidden all stories in this category for today.'}
			</p>
			<div class="flex flex-col sm:flex-row gap-2 justify-center">
				<button
					onclick={() => window.location.href = '#settings/smartFilter'}
					class="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
				>
					{s('smartFilter.adjustFilters') || 'Adjust filters'}
				</button>
				<button
					onclick={() => smartContentFilter.toggleEnabled()}
					class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
				>
					{s('smartFilter.disableFiltering') || 'Disable smart filtering'}
				</button>
			</div>
			{:else}
				<p>{s('stories.noStories') || 'No stories available for this category.'}</p>
				<!-- Migration Notice (temporary) -->
				<div class="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-900/20 dark:border-blue-800">
					<h3 class="text-sm font-semibold text-blue-900 mb-1 dark:text-blue-300">Database Migration in Progress</h3>
					<p class="text-sm text-gray-700 dark:text-gray-300">
						Hey, we are wrapping up our database migration. Stories in translated languages will be available from <s>July 9</s> July 10, around noon UTC.
					</p>
				</div>
			{/if}
		</div>
	{:else}
		{#each displayedStories as story, index (story.cluster_number || story.title)}
			{@const isFiltered = false}
			<StoryCard 
				{story}
				storyIndex={index}
				{batchId}
				categoryId={currentCategory}
				isRead={readStories[story.title] || false}
				isExpanded={expandedStories[story.cluster_number?.toString() || story.title] || false}
				onToggle={() => handleStoryToggle(story)}
				onReadToggle={() => handleReadToggle(story)}
				priority={index < 3}
				isFiltered={isFiltered}
				filterKeywords={story._matchedKeywords}
				bind:showSourceOverlay
				bind:currentSource
				bind:sourceArticles
				bind:currentMediaInfo
				bind:isLoadingMediaInfo
			/>
		{/each}
		
		<!-- Filtered stories notification -->
		{#if smartContentFilter.isEnabled && filteredCount > 0}
			<div class="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
				<p>
					{filteredCount === 1 
						? s('smartFilter.storyFiltered', { count: filteredCount.toString() }) || `${filteredCount} story filtered by smart filters`
						: s('smartFilter.storiesFiltered', { count: filteredCount.toString() }) || `${filteredCount} stories filtered by smart filters`}
				</p>
			</div>
		{/if}
		
		<!-- Mark all as read button -->
		{#if !allStoriesRead && displayedStories.length > 0}
			<div class="mt-6 w-full text-center">
				<button
					onclick={markAllAsRead}
					class="w-full rounded-lg bg-gray-100 px-6 py-3 text-gray-800 transition-colors duration-200 hover:bg-gray-200 md:w-auto dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
				>
					{s('article.markAllAsRead') || 'Mark all as read'}
				</button>
			</div>
		{/if}
	{/if}
</div> 