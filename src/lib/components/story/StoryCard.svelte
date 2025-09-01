<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import { sections } from '$lib/stores/sections.svelte.js';
import StoryHeader from './StoryHeader.svelte';
import StorySectionManager from './StorySectionManager.svelte';
import StoryActions from './StoryActions.svelte';
import { browser } from '$app/environment';
import { useViewportPreloading, useHoverPreloading } from '$lib/hooks/useImagePreloading.svelte';
import { autoLinkEntities } from '$lib/utils/autoLinkEntities';
import { autoLinkEntitiesAdvanced } from '$lib/utils/wikidataEntityLinker';
import { prefetchEntitiesFromPlainText } from '$lib/utils/wikidataEntityLinker';
import { autoLinkAcronyms } from '$lib/utils/acronymAutoLink';
import WikipediaTooltip from '$lib/components/WikipediaTooltip.svelte';
import { initializeWikipediaIntegration } from '$lib/utils/wikipediaIntegration';
import { tick, onDestroy } from 'svelte';
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

// Title element helper - anchors scrolling to the actual title line
function getStoryTitleElement(): HTMLElement | null {
	const id = `story-title-${story?.cluster_number}`;
	return browser ? (document.getElementById(id) as HTMLElement | null) : null;
}

// Blur state - re-check filtering in real-time
let isBlurred = $state(isFiltered);
// Track if we already ran the automatic entity linker for this card
let processedAutoLink = $state(false);
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

// Wikipedia integration instance (ensures tooltip manager is initialized before attachments)
let wikipediaIntegration: ReturnType<typeof initializeWikipediaIntegration> | null = null;

function ensureWikipediaIntegration() {
    try {
        if (browser && wikipediaTooltip && !wikipediaIntegration) {
            wikipediaIntegration = initializeWikipediaIntegration(
                wikipediaTooltip,
                {
                    handleWikipediaInteraction: wikipediaTooltip.handleWikipediaInteraction,
                    handleWikipediaLeave: wikipediaTooltip.handleWikipediaLeave,
                },
                {
                    enableAutoLinking: false,
                    enableTooltips: true,
                    autoLinkOnMount: false,
                }
            );
        }
    } catch {}
}

// Scroll to story when expanded: always align the title at the top (below header)
$effect(() => {
    // Clean up any previous timeout whenever the dependency array changes
    if (scrollTimeout) {
        clearTimeout(scrollTimeout);
        scrollTimeout = null;
    }

    // Respect experimental setting: do nothing if scrolling is disabled
    if (experimental.disableStoryScrolling) {
        return;
    }

    if (isExpanded && browser && storyElement) {
        const getHeaderHeight = () => {
            const headerEl = document.querySelector('header') || document.querySelector('nav');
            return headerEl ? (headerEl as HTMLElement).offsetHeight : 60;
        };

        const computeTargetY = () => {
            const headerHeight = getHeaderHeight();
            const anchorEl = getStoryTitleElement() || storyElement;
            const rect = anchorEl.getBoundingClientRect();
            const target = window.pageYOffset + rect.top - headerHeight - 16; // small padding
            return Math.max(0, target);
        };

        const scrollInstant = () => window.scrollTo({ top: computeTargetY(), behavior: 'auto' });
        const scrollSmooth = () => window.scrollTo({ top: computeTargetY(), behavior: 'smooth' });

        // Phase 1: after next microtask, jump to the top instantly (prevents header overlap)
        tick().then(() => {
            if (!storyElement) return;
            scrollInstant();

            // Phase 2: after layout settles a bit, correct position smoothly
            requestAnimationFrame(() => {
                if (!storyElement) return;
                scrollInstant();
            });

            // Phase 3: after transition (~300ms) and image loads begin, smooth-correct again
            scrollTimeout = setTimeout(() => {
                if (!storyElement) return;
                scrollSmooth();
                // Phase 4: one more correction pass a bit later to account for image loads/late layout shifts
                setTimeout(() => {
                    if (!storyElement) { scrollTimeout = null; return; }
                    const desired = computeTargetY();
                    const delta = Math.abs(window.scrollY - desired);
                    if (delta > 24) {
                        window.scrollTo({ top: desired, behavior: 'smooth' });
                    }
                    scrollTimeout = null;
                }, 400);
            }, 350);
        });
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

        // Entity linking based on experimental configuration
        safeRun(0, async () => {
            if (!storyElement) return;
            
            // Ensure tooltip manager is initialized before any attachment attempts
            ensureWikipediaIntegration();
            try { wikipediaIntegration?.attachTooltips(storyElement); } catch {}

            const { entityLinkingMode } = experimental;
            
            try {
                if (entityLinkingMode === 'wikidata') {
                    await autoLinkEntitiesAdvanced(storyElement);
                } else if (entityLinkingMode === 'dbpedia') {
                    await autoLinkEntities(storyElement);
                } else if (entityLinkingMode === 'mixed') {
                    // Try advanced first, then DBpedia-linked for any missed entities
                    await autoLinkEntitiesAdvanced(storyElement);
                    await autoLinkEntities(storyElement);
                }
            } catch (error) {
                console.debug('Entity linking failed:', error);
                // Fallback to DBpedia-linked if Wikidata fails
                if (entityLinkingMode === 'wikidata') {
                    await autoLinkEntities(storyElement);
                }
            }

            // After links are in the DOM, refresh tooltip attachments
            try { wikipediaIntegration?.refreshTooltips(storyElement); } catch {}
        });
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
        processedAutoLinkAcr = false;
        // Keep integration available for next expand; do not cleanup here to avoid re-init churn
    }
});

// Prefetch entity summaries as early as possible to accelerate tooltip readiness
$effect(() => {
    try {
        // Use a lightweight text composed of key story fields
        const parts: string[] = [];
        if (story?.title) parts.push(String(story.title));
        if (story?.short_summary) parts.push(String(story.short_summary));
        if (story?.location) parts.push(String(story.location));
        const seed = parts.filter(Boolean).join('. ');
        if (seed && seed.length > 20) {
            // Fire-and-forget; warms caches during splash/open
            setTimeout(() => prefetchEntitiesFromPlainText(seed).catch(() => {}), 0);
        }
    } catch {}
});

// Cleanup integration on destroy
onDestroy(() => {
    try { wikipediaIntegration?.cleanup(); } catch {}
    wikipediaIntegration = null;
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
                <div role="presentation">
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

                <!-- Single tooltip instance for this card; auto-link code attaches handlers -->
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