<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import StoryCard from './story/StoryCard.svelte';
import type { Story } from '$lib/types';
import { storyCount } from '$lib/stores/storyCount.svelte.js';
import { smartContentFilter } from '$lib/stores/smartContentFilter.svelte';
import { feedDate } from '$lib/stores/feedDate.svelte';
import { onDestroy } from 'svelte';
import type { ContentScore } from '$lib/algorithms/contentFilter';
import { SmartFilterService } from '$lib/services/smartFilterService';

// Props
interface Props {
	stories?: (Story | DateDivider)[];
	currentCategory: string;
	batchId?: string;
	readStories?: Record<string, boolean>;
	expandedStories?: Record<string, boolean>;
	onStoryToggle?: (storyId: string) => void;
	showSourceOverlay?: boolean;
	currentSource?: unknown;
	sourceArticles?: unknown[];
	currentMediaInfo?: unknown;
	isLoadingMediaInfo?: boolean;
	onLoadMore?: () => void;
	canLoadMore?: boolean;
    isLoading?: boolean;
}

type DateDivider = { __dateDivider: true; date: string };
type FilteredStory = Story & { _filterScore?: ContentScore };
type ListItem = FilteredStory | DateDivider;

// biome-ignore lint/style/useConst: Svelte 5 props with bindable values need let
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
	isLoadingMediaInfo = $bindable(false),
	onLoadMore,
	canLoadMore = false,
    isLoading = false
}: Props = $props();

// Handle story toggle
function handleStoryToggle(story: Story) {
	const storyId = story.cluster_number?.toString() || story.title;
	
	onStoryToggle?.(storyId);
}

// Handle read toggle
function handleReadToggle(story: Story) {
	const storyId = story.cluster_number?.toString() || story.title;
	
	readStories[storyId] = !readStories[storyId];
}

// Mark all as read
function markAllAsRead() {
	// Defer state mutations to avoid issues when called from reactive contexts
	setTimeout(() => {
		for (const it of displayedStories) {
			if ((it as any).__dateDivider) continue;
			const story = it as Story;
			const storyId = story.cluster_number?.toString() || story.title;
			readStories[storyId] = true;
		}
	}, 0);
}

// Check if a story is currently being filtered
function isStoryFiltered(story: Story): boolean {
	if (!smartContentFilter.isEnabled) return false;
	
	// Check if this story would be filtered
	const result = smartContentFilter.filterStories([story]);
	return result.filtered.length === 0;
}

const _localFilterService = new SmartFilterService();

const { displayedStories, filteredCount, hiddenStories } = $derived.by(() => {
    // First apply story count limit
    const limitedStories = stories.slice(0, storyCount.current);
    const storyOnly = limitedStories.filter((it): it is Story => !(it as any).__dateDivider);

    // Apply smart content filtering using a local service to keep the callback side-effect free
    if (smartContentFilter.isEnabled) {
        const filterResult = _localFilterService.filterStories(storyOnly, smartContentFilter.preferences);

        return {
            displayedStories: [
                // Keep existing date divider items in place
                ...limitedStories.filter(it => (it as any).__dateDivider),
                ...filterResult.filtered
            ] as ListItem[],
            filteredCount: filterResult.removed.length,
            hiddenStories: filterResult.removed.map(r => r.story)
        };
    }

    // Smart filtering disabled – just return the limited list
    return {
        displayedStories: limitedStories as ListItem[],
        filteredCount: 0,
        hiddenStories: []
    };
});

// Check if all stories are read
const allStoriesRead = $derived(
	displayedStories.filter(it => !(it as any).__dateDivider).every((s: any) => {
		const storyId = s.cluster_number?.toString() || s.title;
		return readStories[storyId];
	})
);

// IntersectionObserver to detect which date divider is currently centered
let dividerObserver: IntersectionObserver;

function observeDateDivider(node: HTMLElement) {
    if (!dividerObserver) {
        dividerObserver = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        const date = (entry.target as HTMLElement).dataset.date || null;
                        feedDate.set(date);
                    }
                }
            },
            {
                root: null,
                rootMargin: '-50% 0px -50% 0px', // Middle of viewport
                threshold: 0
            }
        );
    }

    dividerObserver.observe(node);

    return {
        destroy() {
            dividerObserver.unobserve(node);
        }
    };
}

onDestroy(() => {
    dividerObserver?.disconnect();
});
</script>

<div class="story-list">
    {#if isLoading}
        <!-- Loading indicator -->
        <div class="py-8 text-center text-gray-500 dark:text-gray-400">
            <p>{s('loading.stories') || 'Loading stories…'}</p>
        </div>
    {:else if displayedStories.length === 0}
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
				<p class="text-red-500 dark:text-red-400 font-medium">
					{s('stories.noStories') || 'No stories available for this category.'}
				</p>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
					{s('stories.errorMessage') || 'Please check your connection or try again later.'}
				</p>
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
		{#each displayedStories as item, index (index)}
			{#if (item as any).__dateDivider}
				<div use:observeDateDivider data-date={(item as DateDivider).date} class="my-4 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
					{new Date((item as DateDivider).date).toLocaleDateString('en', { year:'numeric', month:'long', day:'numeric'})}
				</div>
			{:else}
				{@const story = item as FilteredStory}
				{@const isFiltered = false}
				<StoryCard 
					{story}
					storyIndex={index}
					{batchId}
					categoryId={currentCategory}
					isRead={readStories[story.cluster_number?.toString() || story.title] || false}
					isExpanded={expandedStories[story.cluster_number?.toString() || story.title] || false}
					onToggle={() => handleStoryToggle(story)}
					onReadToggle={() => handleReadToggle(story)}
					priority={index < 3}
					isFiltered={isFiltered}
					filterKeywords={story._filterScore?.reasons || []}
					bind:showSourceOverlay
					bind:currentSource
					bind:sourceArticles
					bind:currentMediaInfo
					bind:isLoadingMediaInfo
				/>
			{/if}
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
		
		<!-- Load More button -->
		{#if canLoadMore}
			<div class="mt-6 w-full text-center">
				<button
					onclick={onLoadMore}
					class="w-full rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors duration-200 hover:bg-blue-700 md:w-auto"
				>
					{s('stories.loadMore') || 'Load more stories'}
				</button>
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