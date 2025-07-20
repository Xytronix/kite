<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import StoryHeader from './StoryHeader.svelte';
import StorySectionManager from './StorySectionManager.svelte';
import StoryActions from './StoryActions.svelte';
import { browser } from '$app/environment';
import { useViewportPreloading, useHoverPreloading } from '$lib/hooks/useImagePreloading.svelte';

// Props
interface Props {
	story: any;
	storyIndex?: number;
	batchId?: string;
	categoryId?: string;
	isRead?: boolean;
	isExpanded?: boolean;
	onToggle?: () => void;
	onReadToggle?: () => void;
	showSourceOverlay?: boolean;
	currentSource?: any;
	sourceArticles?: any[];
	currentMediaInfo?: any;
	isLoadingMediaInfo?: boolean;
	priority?: boolean; // For high-priority stories (first few visible)
	isFiltered?: boolean;
	filterKeywords?: string[];
}

let { 
	story,
	storyIndex,
	batchId,
	categoryId,
	isRead = false, 
	isExpanded = false, 
	onToggle, 
	onReadToggle, 
	showSourceOverlay = $bindable(false),
	currentSource = $bindable(null),
	sourceArticles = $bindable([]),
	currentMediaInfo = $bindable(null),
	isLoadingMediaInfo = $bindable(false),
	priority = false,
	isFiltered = false,
	filterKeywords = []
}: Props = $props();

// Story element reference
let storyElement: HTMLElement;

// Blur state - re-check filtering in real-time
let isBlurred = $state(isFiltered);

// Re-check if story should still be blurred when filter changes
$effect(() => {
	// Reset blur state to match current filter state
	isBlurred = isFiltered;
});

// Use hooks for preloading
const viewportPreloader = useViewportPreloading(
	() => storyElement,
	story,
	{ priority }
);

const hoverPreloader = useHoverPreloading(story, { priority });

// Track if images are preloaded
let imagesPreloaded = $derived(viewportPreloader.isPreloaded || hoverPreloader.isPreloaded);

// Keep reference to any pending scroll timeout so we can cancel it
let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

// Handle story click
function handleStoryClick() {
	// If blurred, reveal and expand
	if (isBlurred) {
		isBlurred = false;
		// Small delay to let the unblur animation start before expanding
		setTimeout(() => {
			if (onToggle) onToggle();
		}, 100);
		return;
	}
	if (onToggle) onToggle();
}

// Handle read toggle click
function handleReadClick(e: Event) {
	e.stopPropagation();
	if (onReadToggle) onReadToggle();
}



// Scroll to story when expanded, and cancel pending scroll when collapsed
$effect(() => {
    // Clean up any previous timeout whenever the dependency array changes
    if (scrollTimeout) {
        clearTimeout(scrollTimeout);
        scrollTimeout = null;
    }

    if (isExpanded && browser && storyElement) {
        // Small delay to ensure the content is rendered
        scrollTimeout = setTimeout(() => {
            // Get the story element's position
            const rect = storyElement.getBoundingClientRect();
            const currentScrollY = window.pageYOffset;

            // Only scroll if the story is not already in view
            const viewportHeight = window.innerHeight;
            const storyTop = rect.top;

            // Check if story is already properly visible (not cut off)
            const isVisible = storyTop >= 0 && storyTop < viewportHeight * 0.3;

            if (!isVisible) {
                // Calculate header height (fallback to 60px if not found)
                const headerEl = document.querySelector('header') || document.querySelector('nav');
                const headerHeight = headerEl ? (headerEl as HTMLElement).offsetHeight : 60;

                // Scroll to show the story title with some padding
                const targetY = currentScrollY + storyTop - headerHeight - 20;

                window.scrollTo({
                    top: Math.max(0, targetY),
                    behavior: 'smooth'
                });
            }

            scrollTimeout = null; // clear ref after execution
        }, 100);
    }

    // Cleanup when component is destroyed
    return () => {
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
            scrollTimeout = null;
        }
    };
});
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<article
	bind:this={storyElement}
	id="story-{story.cluster_number}"
	aria-label="News story: {story.title}"
	class="relative py-2 transition-all duration-300 cursor-pointer"
	class:border-b={!isExpanded}
	class:border-gray-200={!isExpanded}
	class:dark:border-gray-700={!isExpanded}
	onmouseenter={hoverPreloader.handleMouseEnter}
	onmouseleave={hoverPreloader.handleMouseLeave}
	onfocus={hoverPreloader.handleMouseEnter}
	onclick={handleStoryClick}
	onkeydown={(e) => e.key === 'Enter' && handleStoryClick()}
	role={isBlurred ? "button" : null}
	tabindex={isBlurred ? 0 : -1}
>
	<!-- Blurrable Content -->
	<div class="transition-all duration-300" class:blur-lg={isBlurred}>
		<!-- Story Header -->
		<StoryHeader 
			{story}
			{isRead}
			onTitleClick={handleStoryClick}
			onReadClick={handleReadClick}
		/>

		<!-- Expanded Content -->
		{#if isExpanded}
			<div class="dark:bg-dark-bg flex flex-col bg-white py-4" role="region" aria-label="Story content">
				
				<!-- Dynamic Sections based on user settings -->
				<StorySectionManager 
					{story}
					{imagesPreloaded}
					bind:showSourceOverlay
					bind:currentSource
					bind:sourceArticles
					bind:currentMediaInfo
					bind:isLoadingMediaInfo
				/>

				<!-- Action Buttons -->
				<StoryActions 
					{story}
					{batchId}
					{categoryId}
					{storyIndex}
					onClose={handleStoryClick}
				/>
			</div>
		{/if}
	</div>
	
	<!-- Blur Warning Overlay -->
	{#if isBlurred && filterKeywords && filterKeywords.length > 0}
		<div class="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex items-center gap-3 px-4">
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('smartFilter.filteredBecause') || 'Hidden due to filter:'}
			</span>
			<div class="flex items-center gap-2">
				{#each filterKeywords.slice(0, 3) as keyword}
					<span class="text-xs font-semibold text-gray-800 dark:text-gray-200 bg-white/50 dark:bg-black/30 px-2 py-0.5 rounded">
						{keyword}
					</span>
				{/each}
				{#if filterKeywords.length > 3}
					<span class="text-xs text-gray-600 dark:text-gray-400">
						+{filterKeywords.length - 3}
					</span>
				{/if}
			</div>
			<span class="text-xs text-gray-600 dark:text-gray-400 italic">
				{s('smartFilter.clickToReveal') || 'Click to show'}
			</span>
			<button
				class="ml-3 px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 focus-visible-ring"
				onclick={(e) => { e.stopPropagation(); handleStoryClick(); }}
			>
				{s('smartFilter.showButton') || 'Show'}
			</button>
		</div>
	{/if}
</article> 