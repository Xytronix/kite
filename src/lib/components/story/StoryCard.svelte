<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import { sections } from '$lib/stores/sections.svelte.js';
import StoryHeader from './StoryHeader.svelte';
import StorySectionManager from './StorySectionManager.svelte';
import StoryActions from './StoryActions.svelte';
import { browser } from '$app/environment';
import { useViewportPreloading, useHoverPreloading } from '$lib/hooks/useImagePreloading.svelte';
import { autoLinkPersons } from '$lib/utils/personAutoLink';
import { autoLinkPlaces } from '$lib/utils/placeAutoLink';
import { autoLinkOrgs } from '$lib/utils/orgAutoLink';
import { autoLinkAcronyms } from '$lib/utils/acronymAutoLink';
import WikipediaTooltip from '$lib/components/WikipediaTooltip.svelte';
import { tick } from 'svelte';
import { slide } from 'svelte/transition';
import { experimental } from '$lib/stores/experimental.svelte.js';

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
    onWikipediaClick?: (title: string, content: string, imageUrl?: string, wikiUrl?: string) => void;
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
	filterKeywords = [],
    onWikipediaClick
}: Props = $props();

// Story element reference
let storyElement: HTMLElement;

// Blur state - re-check filtering in real-time
let isBlurred = $state(isFiltered);
// Track if we already ran the automatic person linker for this card
let processedAutoLink = $state(false);
let processedAutoLinkPlaces = $state(false);
let processedAutoLinkOrg = $state(false);
let processedAutoLinkAcr = $state(false);

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

// Preload citation icons on hover/focus
let citationsPreloaded = $state(false);
function preloadCitations() {
	if (!citationsPreloaded && story) {
		citationsPreloaded = true;
		import('$lib/utils/iconPreloader').then(({ preloadStoryCitations }) => {
			preloadStoryCitations(story).catch(err => {
				console.warn('Failed to preload story citations on hover:', err);
			});
		});
	}
}

// Keep reference to any pending scroll timeout so we can cancel it
let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

// Handle story click
function handleStoryClick(event?: Event) {
    const storyId = story.cluster_number?.toString() || story.title;
    console.log('🔄 StoryCard handleStoryClick called', { 
        storyId, 
        isBlurred, 
        isExpanded, 
        hasEvent: !!event 
    });
    
    // Ignore clicks originating from interactive elements
    if (event) {
        const target = event.target as HTMLElement;
        const interactiveSelector = 'a, button, input, textarea, select, label, [role="switch"], [data-no-toggle], .horizontal-scroll-container';
        if (target.closest(interactiveSelector)) {
            console.log('🚫 Click ignored - interactive element');
            return;
        }
    }
    
	// If blurred, reveal and expand
	if (isBlurred) {
		console.log('🔓 Unblurring story:', storyId);
		isBlurred = false;
		// Small delay to let the unblur animation start before expanding
		setTimeout(() => {
			if (onToggle) {
				console.log('🔄 Calling onToggle after unblur for:', storyId);
				onToggle();
			}
		}, 100);
		return;
	}
	
	// Prevent rapid clicking that could cause duplicate calls
	if (scrollTimeout) {
		console.log('🚫 Click ignored - scroll timeout active for:', storyId);
		return;
	}
	
	console.log('🔄 Calling onToggle for:', storyId);
	if (onToggle) onToggle();
}

// Handle read toggle click
function handleReadClick(e: Event) {
	e.stopPropagation();
	if (onReadToggle) onReadToggle();
}

let wikipediaTooltip: WikipediaTooltip | null = $state(null);

function handleWikiInteraction(e: Event) {
    wikipediaTooltip?.handleWikipediaInteraction(e);
}

function handleWikiLeave(e: Event) {
    wikipediaTooltip?.handleWikipediaLeave(e);
}

// Scroll to story when expanded, and cancel pending scroll when collapsed
$effect(() => {
    // Clean up any previous timeout whenever the dependency array changes
    if (scrollTimeout) {
        clearTimeout(scrollTimeout);
        scrollTimeout = null;
    }

    // Skip scrolling if disabled in experimental settings
    if (experimental.disableStoryScrolling) {
        return;
    }

    if (isExpanded && browser && storyElement) {
        // Small delay to ensure the content is rendered
        scrollTimeout = setTimeout(() => {
            // Store current scroll position to prevent unwanted jumps
            const initialScrollY = window.pageYOffset;
            
            // Get the story element's position BEFORE expansion
            const rect = storyElement.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const storyTop = rect.top;
            const storyHeight = rect.height;

            // Calculate header height (fallback to 60px if not found)
            const headerEl = document.querySelector('header') || document.querySelector('nav');
            const headerHeight = headerEl ? (headerEl as HTMLElement).offsetHeight : 60;

            // Estimate expanded content height (rough approximation)
            const estimatedExpandedHeight = storyHeight + 400; // Assume ~400px of additional content when expanded
            const storyBottom = storyTop + estimatedExpandedHeight;

            // Smart scrolling logic:
            // 1. Scroll if title is hidden behind header
            const isTitleHiddenBehindHeader = storyTop < headerHeight + 10;
            
            // 2. Scroll if the expanded story won't fit in the viewport
            const availableSpace = viewportHeight - headerHeight - 40; // 40px padding
            const storyWontFitInViewport = estimatedExpandedHeight > availableSpace && storyTop > headerHeight + 50;
            
            // 3. Scroll if story is mostly cut off at the bottom (less than 30% visible)
            const visibleAtBottom = viewportHeight - storyTop;
            const isMostlyCutOffAtBottom = visibleAtBottom < estimatedExpandedHeight * 0.3 && storyTop > headerHeight + 50;
            
            const shouldScroll = isTitleHiddenBehindHeader || storyWontFitInViewport || isMostlyCutOffAtBottom;

            if (shouldScroll) {
                // Scroll to show the story title with some padding
                const targetY = initialScrollY + storyTop - headerHeight - 20;

                // Use requestAnimationFrame to ensure smooth scrolling
                requestAnimationFrame(() => {
                    window.scrollTo({
                        top: Math.max(0, targetY),
                        behavior: 'smooth'
                    });
                });
            }

            scrollTimeout = null; // clear ref after execution
        }, 150); // Slightly longer delay to ensure DOM is stable
    }

    // Cleanup when component is destroyed
    return () => {
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
            scrollTimeout = null;
        }
    };
});

// Auto-link person names once when expanded
$effect(() => {
    if (isExpanded && !processedAutoLink && storyElement) {
        processedAutoLink = true;
        // Wrap delayed tasks to ensure the element still exists when the callback runs
        const safeRun = (delay: number, fn: () => void) => {
            setTimeout(() => {
                if (storyElement) fn();
            }, delay);
        };

        safeRun(0, () => autoLinkPersons(storyElement!));
        // Also link places separately (after persons to avoid overlaps)
        safeRun(10, () => autoLinkPlaces(storyElement!));

        safeRun(20, () => autoLinkOrgs(storyElement!));
        safeRun(30, () => autoLinkAcronyms(storyElement!));

        // Prefetch Wikipedia summaries for all linked wiki IDs in background
        safeRun(100, () => {
            if (!storyElement) return;
            const anchors = storyElement.querySelectorAll('a[data-wiki-id]');
            const ids = Array.from(anchors).map(a => decodeURIComponent(a.getAttribute('data-wiki-id') || ''));
            const uniqueIds = Array.from(new Set(ids));
            import('$lib/services/wikipediaService').then(mod => {
                uniqueIds.forEach(id => mod.fetchWikipediaContent(id));
            });
        });
    }
});

// After isExpanded effect for auto-link
$effect(() => {
    // Reset processed flags when story collapses so links regenerate next time
    if (!isExpanded) {
        processedAutoLink = false;
        processedAutoLinkPlaces = false;
        processedAutoLinkOrg = false;
        processedAutoLinkAcr = false;
    }
});

// Keep story anchored when section settings (enabled/disabled) change
$effect(() => {
    const _ = JSON.stringify(sections.settings); // react to any toggle

    if (!isExpanded || !browser || !storyElement) return;

    const beforeTop = storyElement.getBoundingClientRect().top;

    tick().then(() => {
        if (!storyElement) return;
        const afterTop = storyElement.getBoundingClientRect().top;
        const delta = afterTop - beforeTop;
        if (delta !== 0) {
            window.scrollBy({ top: delta, left: 0 });
        }
    });
});
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<article
	bind:this={storyElement}
	id="story-{story.cluster_number}"
	aria-label="News story: {story.title}"
	class="relative py-2 cursor-pointer transition-all duration-300 ease-in-out border-b"
	class:border-gray-200={!isExpanded && !isBlurred}
	class:dark:border-gray-700={!isExpanded && !isBlurred}
	class:border-transparent={isExpanded || isBlurred}
	onmouseenter={() => { hoverPreloader.handleMouseEnter(); preloadCitations(); }}
	onmouseleave={hoverPreloader.handleMouseLeave}
	onfocus={() => { hoverPreloader.handleMouseEnter(); preloadCitations(); }}
	onclick={isBlurred ? handleStoryClick : undefined}
	onkeydown={isBlurred ? (e) => e.key === 'Enter' && handleStoryClick() : undefined}
	role={isBlurred ? "button" : null}
	tabindex={isBlurred ? 0 : -1}
>
	<!-- Blurrable Content -->
	<div class="transition-all duration-300 ease-in-out" class:blur-lg={isBlurred}>
		<!-- Story Header -->
		<StoryHeader 
			{story}
			{isRead}
			onTitleClick={handleStoryClick}
			onReadClick={handleReadClick}
		/>

		<!-- Expanded Content -->
		{#if isExpanded}
			<div 
				class="dark:bg-dark-bg flex flex-col bg-white py-4" 
				role="region" 
				aria-label="Story content"
				transition:slide={{ duration: 300, axis: 'y' }}
			>
				
				<!-- Dynamic Sections based on user settings -->
                <div role="presentation"
                    onmouseover={handleWikiInteraction}
                    onmouseleave={handleWikiLeave}
                    onfocus={handleWikiInteraction}
                    onblur={handleWikiLeave}
                    onclick={handleWikiInteraction}
                    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleWikiInteraction(e); }}
                >
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

                <!-- Tooltip instance -->
                <WikipediaTooltip bind:this={wikipediaTooltip} {onWikipediaClick} />

                </div>
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