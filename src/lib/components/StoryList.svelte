<script lang="ts">
import { browser } from '$app/environment';
import { s } from '$lib/client/localization.svelte';
import StoryCard from './story/StoryCard.svelte';
import type { Story } from '$lib/types';
import { settings } from '$lib/stores/settings.svelte.js';
import { smartContentFilter } from '$lib/stores/smartContentFilter.svelte';
import { feedDate } from '$lib/stores/feedDate.svelte';
import { onDestroy, onMount } from 'svelte';
import type { ContentScore } from '$lib/algorithms/contentFilter';
import { SmartFilterService } from '$lib/services/smartFilterService';

// Props
interface Props {
	stories?: (Story | DateDivider)[];
	currentCategory: string;
	batchId?: string;
	readStories?: Record<string, boolean>;
	expandedStories?: Record<string, boolean>;
	onStoryToggle?: (storyId: string, updateUrl?: boolean) => void;
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

// Persistent logging function that survives page refreshes
function persistentLog(message: string, data?: any) {
	if (!browser) return;
	
	const timestamp = new Date().toISOString();
	const logEntry = { timestamp, message, data, url: window.location.href };
	
	// Store in localStorage
	try {
		const logs = JSON.parse(localStorage.getItem('kite-debug-logs') || '[]');
		logs.push(logEntry);
		// Keep only last 50 logs to avoid filling localStorage
		if (logs.length > 50) logs.splice(0, logs.length - 50);
		localStorage.setItem('kite-debug-logs', JSON.stringify(logs));
	} catch (e) {
		console.warn('Failed to save persistent log:', e);
	}
	
	console.log(`[PERSISTENT] ${message}`, data || '');
}

// Function to clear persistent logs (call from console: window.clearKiteLogs())
if (browser) {
	(window as any).clearKiteLogs = () => {
		localStorage.removeItem('kite-debug-logs');
		console.log('✅ Kite debug logs cleared');
	};
	
	(window as any).showKiteLogs = () => {
		try {
			const logs = JSON.parse(localStorage.getItem('kite-debug-logs') || '[]');
			console.table(logs);
		} catch (e) {
			console.log('No logs found');
		}
	};
}

// Handle story toggle
function handleStoryToggle(story: Story, updateUrl: boolean = false) {
	const storyId = story.cluster_number?.toString() || story.title;
	
	// Prevent duplicate calls by checking if story is already in the desired state
	const isCurrentlyExpanded = expandedStories[storyId] || false;
	
	onStoryToggle?.(storyId, updateUrl);
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

// State to track whether filtered stories should be shown
let showFilteredStories = $state(false);

// Reset showFilteredStories when filter preferences change (but not for similarity threshold adjustments)
$effect(() => {
	// Watch for changes in filter preferences and reset show state
	// Skip reset for similarity threshold-only changes to prevent unnecessary resets
	const preferences = smartContentFilter.preferences;
	const isEnabled = smartContentFilter.isEnabled;
	showFilteredStories = false;
});

const { displayedStories, filteredCount, hiddenStories } = $derived.by(() => {
    const storyOnly = stories.filter((it): it is Story => !(it as any).__dateDivider);

    // Apply smart content filtering using a local service to keep the callback side-effect free
    if (smartContentFilter.isEnabled) {
        try {
            const filterResult = _localFilterService.filterStories(storyOnly, smartContentFilter.preferences);

            // Create a Set of story IDs to include based on filter mode
            const storyIdsToShow = new Set<string>();
            
            if (showFilteredStories) {
                // Show all stories (filtered + unfiltered)
                [...filterResult.filtered, ...filterResult.removed.map(r => r.story)].forEach(story => {
                    const storyId = story.cluster_number?.toString() || story.title;
                    storyIdsToShow.add(storyId);
                });
            } else {
                // Show only unfiltered stories
                filterResult.filtered.forEach(story => {
                    const storyId = story.cluster_number?.toString() || story.title;
                    storyIdsToShow.add(storyId);
                });
            }

            // Preserve original order of stories and date dividers, but filter stories based on our decision
            const resultStories = stories.filter(item => {
                if ((item as any).__dateDivider) {
                    return true; // Always include date dividers
                }
                const story = item as Story;
                const storyId = story.cluster_number?.toString() || story.title;
                return storyIdsToShow.has(storyId);
            });

            return {
                displayedStories: resultStories as ListItem[],
                filteredCount: filterResult.removed.length, // Always show actual filtered count
                hiddenStories: showFilteredStories ? [] : filterResult.removed.map(r => r.story)
            };
        } catch (error) {
            console.warn('Smart filtering error, falling back to showing all stories:', error);
            // Fallback: show all stories if filtering fails
            return {
                displayedStories: stories as ListItem[],
                filteredCount: 0,
                hiddenStories: []
            };
        }
    }

    // Smart filtering disabled – just return the stories as-is
    return {
        displayedStories: stories as ListItem[],
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
let isLoadingMore = $state(false);
let loadProgress = $state(0);
let progressInterval: number | null = null;
let isMobile = $state(false);
let isAtBottom = $state(false);
let scrollHoldStart = $state(0);
let loadMoreClickGuard = $state(false);
let lastClickTime = $state(0);
let pendingOperations = $state(0);

// Check if device is mobile
$effect(() => {
	if (browser) {
		const checkMobile = () => {
			isMobile = window.innerWidth < 768; // md breakpoint
		};
		checkMobile();
		window.addEventListener('resize', checkMobile);
		
		// Add debugging for page refresh detection
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			console.warn('⚠️ Page is about to refresh/navigate! Event:', e);
			console.trace('Page refresh triggered from:');
		};
		
		const handleUnload = (e: Event) => {
			console.warn('⚠️ Page is unloading! Event:', e);
		};
		
		window.addEventListener('beforeunload', handleBeforeUnload);
		window.addEventListener('unload', handleUnload);
		
		// Add global error handling for unhandled promise rejections
		const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
			console.error('⚠️ Unhandled promise rejection in StoryList:', e.reason);
			console.trace('Unhandled rejection trace:');
			e.preventDefault(); // Prevent the default behavior that might cause navigation
		};
		
		const handleError = (e: ErrorEvent) => {
			console.error('⚠️ Uncaught error in StoryList:', e.error);
			console.trace('Uncaught error trace:');
		};
		
		window.addEventListener('unhandledrejection', handleUnhandledRejection);
		window.addEventListener('error', handleError);
		
		return () => {
			window.removeEventListener('resize', checkMobile);
			window.removeEventListener('beforeunload', handleBeforeUnload);
			window.removeEventListener('unload', handleUnload);
			window.removeEventListener('unhandledrejection', handleUnhandledRejection);
			window.removeEventListener('error', handleError);
		};
	}
});

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

function setupScrollToEndObserver(node: HTMLElement) {
    let lastScrollTime = 0;
    let scrollEndTimeout: number | null = null;
    
    const handleScroll = () => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const distanceFromBottom = documentHeight - (scrollTop + windowHeight);
        
        // Check if we're at the bottom (within 10px tolerance)
        const atBottom = distanceFromBottom <= 10;
        
        if (atBottom && canLoadMore && !isLoadingMore && !isLoading) {
            const now = Date.now();
            
            if (!isAtBottom) {
                // Just reached the bottom
                isAtBottom = true;
                scrollHoldStart = now;
                startScrollProgress();
            }
            
            lastScrollTime = now;
            
            // Clear any existing timeout
            if (scrollEndTimeout) {
                clearTimeout(scrollEndTimeout);
            }
            
            // Set timeout to detect if user stops scrolling
            scrollEndTimeout = window.setTimeout(() => {
                stopScrollProgress();
            }, 100);
        } else if (!atBottom && isAtBottom) {
            // User scrolled away from bottom
            isAtBottom = false;
            stopScrollProgress();
        }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return {
        destroy() {
            window.removeEventListener('scroll', handleScroll);
            if (scrollEndTimeout) {
                clearTimeout(scrollEndTimeout);
            }
        }
    };
}

function startScrollProgress() {
    if (isLoadingMore || !canLoadMore || progressInterval) return;
    
    console.log('Starting scroll progress, canLoadMore:', canLoadMore);
    loadProgress = 0;
    
    progressInterval = window.setInterval(() => {
        loadProgress += 3; // Fill over ~1.7 seconds (100/60 = 1.67)
        
        if (loadProgress >= 100) {
            triggerLoadMore();
        }
    }, 50);
}

function stopScrollProgress() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    isAtBottom = false;
    loadProgress = 0;
}

async function triggerLoadMore() {
    const now = Date.now();
    
    // Prevent rapid clicks (minimum 1 second between clicks)
    if (now - lastClickTime < 1000) {
        persistentLog('🚫 Rapid click blocked', { 
            timeSinceLastClick: now - lastClickTime,
            pendingOperations 
        });
        return;
    }
    
    // Prevent overlapping operations
    if (pendingOperations > 0) {
        persistentLog('🚫 Overlapping operation blocked', { pendingOperations });
        return;
    }
    
    lastClickTime = now;
    pendingOperations++;
    
    persistentLog('🔄 triggerLoadMore called', { 
        canLoadMore, 
        isLoadingMore, 
        isLoading, 
        pendingOperations 
    });
    
    if (!canLoadMore || isLoadingMore || isLoading) {
        persistentLog('🚫 triggerLoadMore blocked by state', { 
            canLoadMore, 
            isLoadingMore, 
            isLoading 
        });
        pendingOperations--;
        return;
    }
    
    stopScrollProgress();
    isLoadingMore = true;
    
    try {
        // Ensure onLoadMore exists and is a function before calling
        if (typeof onLoadMore === 'function') {
            persistentLog('🔄 Calling onLoadMore function...');
        
            // Add timeout wrapper to prevent hanging
            const loadMorePromise = onLoadMore();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Load more timeout after 30 seconds')), 30000);
            });
            
            await Promise.race([loadMorePromise, timeoutPromise]);
            persistentLog('✅ Load more completed successfully');
        } else {
            persistentLog('⚠️ onLoadMore is not a function', { type: typeof onLoadMore });
        }
    } catch (error) {
        persistentLog('❌ Load more failed', { 
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        // Don't rethrow the error
    } finally {
        pendingOperations = Math.max(0, pendingOperations - 1);
        persistentLog('🔄 Cleaning up load more state', { pendingOperations });
        isLoadingMore = false;
        loadProgress = 0;
    }
}

function handleDesktopLoadMore(event: Event) {
    try {
        const now = Date.now();
        persistentLog('🖱️ Desktop load more clicked', { 
            canLoadMore, 
            isLoadingMore, 
            isLoading,
            timeSinceLastClick: now - lastClickTime,
            pendingOperations
        });
        
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        // First check - ensure we can actually load more
        if (!canLoadMore) {
            return false;
        }
        
        // Prevent rapid successive clicks
        if (loadMoreClickGuard) {
            return false;
        }
        
        // Ensure we're not in a loading state before triggering
        if (isLoadingMore || isLoading) {
            return false;
        }
        
        loadMoreClickGuard = true;
        
        triggerLoadMore().catch(error => {
        }).finally(() => {
            // Reset click guard after a delay
            setTimeout(() => {
                loadMoreClickGuard = false;
            }, 1000);
        });
        
        return false; // Prevent any default behavior
    } catch (error) {
        persistentLog('❌ Error in handleDesktopLoadMore', { 
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        loadMoreClickGuard = false;
        return false;
    }
}

// Set up global error handlers with persistent logging
onMount(() => {
	if (!browser) return;
	
	// Display previous logs on page load
	try {
		const previousLogs = JSON.parse(localStorage.getItem('kite-debug-logs') || '[]');
		if (previousLogs.length > 0) {
			console.group('🔍 Previous session logs (last 10):');
			previousLogs.slice(-10).forEach((log: any) => {
				console.log(`[${log.timestamp}] ${log.message}`, log.data || '');
			});
			console.groupEnd();
		}
	} catch (e) {
		console.warn('Failed to load previous logs:', e);
	}
	
	persistentLog('📱 StoryList mounted', { currentCategory });
	
	// Log page refresh events
	const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
		persistentLog('🚨 Page is about to unload/refresh!', {
			reason: event.returnValue || 'unknown',
			stack: new Error().stack
		});
		console.warn('🚨 Page is about to unload/refresh!');
		console.trace('Stack trace for beforeunload event');
	};
	
	const unloadHandler = (event: Event) => {
		persistentLog('🚨 Page unloaded/refreshed!');
		console.warn('🚨 Page unloaded/refreshed!');
	};
	
	// Catch unhandled promise rejections
	const rejectionHandler = (event: PromiseRejectionEvent) => {
		persistentLog('🚨 Unhandled promise rejection', {
			reason: String(event.reason),
			stack: event.reason?.stack || new Error().stack
		});
		console.error('🚨 Unhandled promise rejection:', event.reason);
		console.trace('Stack trace for unhandled rejection');
		event.preventDefault(); // Prevent default behavior
	};
	
	// Catch other uncaught errors
	const errorHandler = (event: ErrorEvent) => {
		persistentLog('🚨 Uncaught error', {
			message: event.message,
			filename: event.filename,
			lineno: event.lineno,
			colno: event.colno,
			error: String(event.error),
			stack: event.error?.stack || new Error().stack
		});
		console.error('🚨 Uncaught error:', event.error);
		console.trace('Stack trace for uncaught error');
	};
	
	window.addEventListener('beforeunload', beforeUnloadHandler);
	window.addEventListener('unload', unloadHandler);
	window.addEventListener('unhandledrejection', rejectionHandler);
	window.addEventListener('error', errorHandler);
	
	return () => {
		window.removeEventListener('beforeunload', beforeUnloadHandler);
		window.removeEventListener('unload', unloadHandler);
		window.removeEventListener('unhandledrejection', rejectionHandler);
		window.removeEventListener('error', errorHandler);
	};
});

onDestroy(() => {
    dividerObserver?.disconnect();
    if (progressInterval) {
        clearInterval(progressInterval);
    }
});
</script>

<div class="story-list">
    {#if isLoading && displayedStories.length === 0}
        <!-- Minimal loading indicator while fetching more stories -->
        <div class="py-8 text-center text-gray-500 dark:text-gray-400">
            <svg class="mx-auto h-6 w-6 animate-spin" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 108 8h-2a6 6 0 11-6-6z"></path>
            </svg>
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
					onclick={() => {
						// Use hash navigation instead of direct location assignment
						window.location.hash = '#settings/smartFilter';
					}}
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
					onToggle={() => handleStoryToggle(story, true)}
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
		{#if smartContentFilter.isEnabled && smartContentFilter.showFilteredCount && filteredCount > 0}
			<div class="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
				<p>
					{showFilteredStories 
						? (s('smartFilter.showingAllStories', { count: filteredCount.toString() }) || `Showing all stories (${filteredCount} were filtered)`)
						: (filteredCount === 1 
							? s('smartFilter.storyFiltered', { count: filteredCount.toString() }) || `${filteredCount} story filtered by content filters`
							: s('smartFilter.storiesFiltered', { count: filteredCount.toString() }) || `${filteredCount} stories filtered by content filters`)}
					• 
					<button 
						class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline transition-colors"
						onclick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							showFilteredStories = !showFilteredStories;
						}}
					>
						{showFilteredStories 
							? (s('smartFilter.hideFiltered') || 'Hide filtered') 
							: (s('smartFilter.showFiltered') || 'Show filtered')}
					</button>
				</p>
			</div>
		{/if}
		
		<!-- Load more section -->
		{#if canLoadMore && !isLoading && pendingOperations === 0}
			{#if isMobile}
				<!-- Mobile: Scroll to end and hold -->
				<div use:setupScrollToEndObserver class="mt-6 flex justify-center py-8">
					{#if isLoadingMore}
						<div class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
							<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 dark:border-gray-400"></div>
							<span class="text-sm">{s('loading.historicalStories') || 'Loading stories from previous days…'}</span>
						</div>
					{:else if isAtBottom && loadProgress > 0}
						<!-- Progressive loading circle when scrolled to bottom -->
						<div class="flex flex-col items-center gap-2">
							<div class="relative w-10 h-10">
								<svg class="w-10 h-10 transform -rotate-90" viewBox="0 0 40 40">
									<circle
										cx="20"
										cy="20"
										r="18"
										stroke="currentColor"
										stroke-width="2"
										fill="none"
										class="text-gray-300 dark:text-gray-600"
									/>
									<circle
										cx="20"
										cy="20"
										r="18"
										stroke="currentColor"
										stroke-width="2"
										fill="none"
										stroke-dasharray="113.1"
										stroke-dashoffset={113.1 - (113.1 * loadProgress) / 100}
										class="text-blue-600 dark:text-blue-400 transition-all duration-75 ease-linear"
										stroke-linecap="round"
									/>
								</svg>
							</div>
							<span class="text-xs text-gray-500 dark:text-gray-400">Keep scrolling... {Math.floor(loadProgress)}%</span>
						</div>
					{:else}
						<!-- Instruction text when not at bottom -->
						<div class="text-center text-xs text-gray-500 dark:text-gray-400">
							Scroll to the bottom to load more
						</div>
					{/if}
				</div>
			{:else}
				<!-- Desktop: Clickable text -->
				<div class="mt-6 text-center">
					{#if isLoadingMore}
						<div class="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
							<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 dark:border-gray-400"></div>
							<span class="text-sm">{s('loading.historicalStories') || 'Loading stories from previous days…'}</span>
						</div>
					{:else}
						<span
							role="button"
							tabindex="0"
							onclick={handleDesktopLoadMore}
							onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDesktopLoadMore(e); } }}
							class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors"
						>
							{s('stories.loadMore') || 'Load more stories'}
						</span>
					{/if}
				</div>
			{/if}
		{:else if pendingOperations > 0}
			<!-- Show pending operation indicator -->
			<div class="mt-6 text-center">
				<div class="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
					<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 dark:border-gray-400"></div>
					<span class="text-sm">Processing load more...</span>
				</div>
			</div>
		{:else if displayedStories.length > 0}
			<!-- Show message when no more content is available -->
			<div class="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
				{s('stories.noMoreToday') || 'No more stories available for today'}
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