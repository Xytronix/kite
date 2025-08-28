<script lang="ts">
import { browser } from '$app/environment';
import { s } from '$lib/client/localization.svelte';
import StoryCard from './story/StoryCard.svelte';
import type { Story } from '$lib/types';
import { settings } from '$lib/stores/settings.svelte.js';
import { experimental } from '$lib/stores/experimental.svelte.js';
import { smartContentFilter } from '$lib/stores/smartContentFilter.svelte';
import { feedDate } from '$lib/stores/feedDate.svelte';
import { onDestroy, onMount } from 'svelte';
import type { ContentScore } from '$lib/algorithms/contentFilter';
import { SmartFilterService } from '$lib/services/smartFilterService';
import { preloadStoryIcons, preloadCommonIcons, preloadSourceIcons } from '$lib/utils/iconPreloader';
import { language } from '$lib/stores/language.svelte.js';
import { dataService } from '$lib/services/dataService';
import { timeTravel } from '$lib/stores/timeTravel.svelte.js';

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

// Prevent rapid story toggle calls at StoryList level too
let storyListToggleTimeout: ReturnType<typeof setTimeout> | null = null;
let lastStoryListToggleId: string | null = null;

// Handle story toggle
function handleStoryToggle(story: Story, updateUrl: boolean = false) {
	const baseStoryId = story.cluster_number?.toString() || story.title;
	const storyBatchId = (story as any).__batchId || batchId;
	// Use category-aware story ID to prevent cross-category expansion
	const storyId = `${currentCategory}:${storyBatchId}:${baseStoryId}`;
	
	console.log('📱 StoryList handleStoryToggle called', { 
		storyId, 
		title: story.title.substring(0, 50),
		updateUrl,
		currentlyExpanded: expandedStories[storyId] || false,
		storyBatchId,
		propBatchId: batchId,
		storyOwnBatchId: (story as any).__batchId
	});
	
	// Prevent rapid duplicate calls at StoryList level
	if (storyListToggleTimeout && lastStoryListToggleId === storyId) {
		console.log('🚫 StoryList: Ignoring rapid duplicate toggle for:', storyId);
		return;
	}
	
	// Clear any existing timeout
	if (storyListToggleTimeout) {
		clearTimeout(storyListToggleTimeout);
	}
	
	// Set debounce timeout
	lastStoryListToggleId = storyId;
	storyListToggleTimeout = setTimeout(() => {
		storyListToggleTimeout = null;
		lastStoryListToggleId = null;
	}, 200); // 200ms debounce at StoryList level
	
	onStoryToggle?.(storyId, updateUrl);
}

// Handle read toggle
function handleReadToggle(story: Story) {
	const baseStoryId = story.cluster_number?.toString() || story.title;
	const storyBatchId = (story as any).__batchId || batchId;
	// Use category-aware story ID for read state as well
	const storyId = `${currentCategory}:${storyBatchId}:${baseStoryId}`;
	
	readStories[storyId] = !readStories[storyId];
}

// Mark all as read - only mark stories that were visible when button was clicked
function markAllAsRead() {
	// Capture current displayed stories at the time of button click
	const storiesToMark = [...displayedStories];
	
	// Defer state mutations to avoid issues when called from reactive contexts
	setTimeout(() => {
		for (const it of storiesToMark) {
			if ((it as any).__dateDivider) continue;
			const story = it as Story;
			const baseStoryId = story.cluster_number?.toString() || story.title;
			const storyBatchId = (story as any).__batchId || batchId;
			// Use category-aware story ID for mark all as read
			const storyId = `${currentCategory}:${storyBatchId}:${baseStoryId}`;
			readStories[storyId] = true;
		}
		console.log('✅ Marked', storiesToMark.filter(it => !(it as any).__dateDivider).length, 'stories as read');
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

// Preload icons when stories change - IMMEDIATELY, not in effect
$effect(() => {
	if (stories.length > 0) {
		const storyItems = stories.filter((item): item is Story => !(item as any).__dateDivider);
		if (storyItems.length > 0) {
			// Preload ALL story icons immediately - no delays
			preloadStoryIcons(storyItems, true);
			preloadSourceIcons(storyItems);
		}
	}
});

// Remove date dividers that are not followed by at least one story
function removeOrphanDateDividers(items: Array<ListItem | any>): ListItem[] {
	const output: ListItem[] = [];
	let pendingDivider: any = null;
	for (const it of items) {
		if ((it as any)?.__dateDivider) {
			pendingDivider = it;
			continue;
		}
		// It's a story
		if (pendingDivider) {
			output.push(pendingDivider as any);
			pendingDivider = null;
		}
		output.push(it as any);
	}
	// Drop trailing divider if present (pendingDivider not followed by a story)
	return output;
}

// Remove the leading date divider when a time travel indicator already shows the day above
function maybeRemoveLeadingDateDivider(items: ListItem[]): ListItem[] {
	try {
		const selected = timeTravel.selectedDate;
		if (!selected || !items || items.length === 0) return items;
		const first: any = items[0];
		if (first?.__dateDivider && first.date) {
			const dividerKey = new Date(first.date).toISOString().split('T')[0];
			const selectedKey = new Date(selected).toISOString().split('T')[0];
			if (dividerKey === selectedKey) {
				return items.slice(1);
			}
		}
		return items;
	} catch {
		return items;
	}
}

const { displayedStories, filteredCount, hiddenStories } = $derived.by(() => {
	const storyOnly = stories.filter((it): it is Story => !(it as any).__dateDivider);

	// Partition into today's stories and historical stories
	const todaysStories: Story[] = [];
	const historicalStories: Story[] = [];
	for (const st of storyOnly) {
		if ((st as any).__fromHistoricalBatch) historicalStories.push(st);
		else todaysStories.push(st);
	}

	// Apply smart content filtering ONLY to today's stories to avoid hiding historical content
	if (smartContentFilter.isEnabled) {
		try {
			const filterResult = _localFilterService.filterStories(todaysStories, smartContentFilter.preferences);

			// Build allowlist for today's stories based on filter mode
			const allowedTodayIds = new Set<string>();
			if (showFilteredStories) {
				[...filterResult.filtered, ...filterResult.removed.map((r) => r.story)].forEach((story) => {
					const storyId = story.cluster_number?.toString() || story.title;
					allowedTodayIds.add(storyId);
				});
			} else {
				filterResult.filtered.forEach((story) => {
					const storyId = story.cluster_number?.toString() || story.title;
					allowedTodayIds.add(storyId);
				});
			}

			// Preserve original order and include:
			// - All date dividers (cleaned up later)
			// - All historical stories
			// - Only allowed today's stories
			const prelim = stories.filter((item) => {
				if ((item as any).__dateDivider) return true;
				const st = item as Story;
				if ((st as any).__fromHistoricalBatch) return true; // never hide historical stories
				const storyId = st.cluster_number?.toString() || st.title;
				return allowedTodayIds.has(storyId);
			});

			const cleaned = removeOrphanDateDividers(prelim);
			return {
				displayedStories: maybeRemoveLeadingDateDivider(cleaned as ListItem[]),
				filteredCount: filterResult.removed.length,
				hiddenStories: showFilteredStories ? [] : filterResult.removed.map((r) => r.story)
			};
		} catch (error) {
			console.warn('Smart filtering error, falling back to showing all stories:', error);
			return {
				displayedStories: maybeRemoveLeadingDateDivider(removeOrphanDateDividers(stories as any) as ListItem[]),
				filteredCount: 0,
				hiddenStories: []
			};
		}
	}

	// Smart filtering disabled – include everything, then clean orphan dividers
	return {
		displayedStories: maybeRemoveLeadingDateDivider(removeOrphanDateDividers(stories as any) as ListItem[]),
		filteredCount: 0,
		hiddenStories: []
	};
});

// Check if all stories are read
const allStoriesRead = $derived(
	displayedStories.filter(it => !(it as any).__dateDivider).every((s: any) => {
		const baseStoryId = s.cluster_number?.toString() || s.title;
		const storyBatchId = (s as any).__batchId || batchId;
		// Use category-aware story ID for read check
		const storyId = `${currentCategory}:${storyBatchId}:${baseStoryId}`;
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

// Determine if we should offer switching to English based on availability today
let canOfferEnglishSwitch = $state(false);
let checkingEnglishAvailability = $state(false);
const englishAvailabilityCache = new Map<string, boolean>();
let englishCheckToken = 0;
let englishCheckTimer: ReturnType<typeof setTimeout> | null = null;

// Spinner visibility with debounce to prevent flashing on fast transitions
let showLoadingSpinner = $state(false);
let spinnerTimer: ReturnType<typeof setTimeout> | null = null;

$effect(() => {
    // Debounce spinner to avoid flash on quick loads or empty-category switches
    if (isLoading) {
        if (spinnerTimer) clearTimeout(spinnerTimer);
        spinnerTimer = setTimeout(() => {
            showLoadingSpinner = true;
        }, 200); // show only if loading lasts >200ms
    } else {
        if (spinnerTimer) {
            clearTimeout(spinnerTimer);
            spinnerTimer = null;
        }
        showLoadingSpinner = false;
    }
});

async function checkEnglishAvailability(categoryId: string) {
    try {
        if (!categoryId || categoryId.toLowerCase() === 'onthisday') {
            canOfferEnglishSwitch = false;
            return;
        }
        const myToken = ++englishCheckToken;
        const cached = englishAvailabilityCache.get(categoryId);
        if (cached !== undefined) {
            canOfferEnglishSwitch = cached;
            return;
        }
        if (checkingEnglishAvailability) return;
        checkingEnglishAvailability = true;

        // Load latest batch and check if there is at least one English story for this category
        const initialData = await dataService.loadInitialData('en');
        // Normalize category ID to match API-provided IDs
        let actualCategoryId = categoryId;
        try {
            const { UrlNavigationService } = await import('$lib/services/urlNavigationService');
            const normalizedTarget = UrlNavigationService.normalizeCategoryId(categoryId);
            const matched = initialData.categories.find(c => UrlNavigationService.normalizeCategoryId(c.id) === normalizedTarget);
            if (matched) actualCategoryId = matched.id;
        } catch {}
        const categoryUuid = initialData.categoryMap[actualCategoryId];
        if (!categoryUuid) {
            englishAvailabilityCache.set(categoryId, false);
            canOfferEnglishSwitch = false;
            return;
        }
        const result = await dataService.loadStories(initialData.batchId, categoryUuid, 1, 'en');
        const available = (result?.stories?.length || 0) > 0;
        if (myToken !== englishCheckToken) {
            return;
        }
        englishAvailabilityCache.set(categoryId, available);
        canOfferEnglishSwitch = available;
    } catch {
        canOfferEnglishSwitch = false;
    } finally {
        checkingEnglishAvailability = false;
    }
}

$effect(() => {
    // Only check when empty, not already English, category is known, and not actively loading
    if (
        displayedStories.length === 0 &&
        language.data !== 'en' &&
        currentCategory &&
        !isLoading &&
        !isLoadingMore &&
        pendingOperations === 0
    ) {
        if (englishCheckTimer) clearTimeout(englishCheckTimer);
        englishCheckTimer = setTimeout(() => {
            checkEnglishAvailability(currentCategory);
        }, 200);
    } else {
        if (englishCheckTimer) {
            clearTimeout(englishCheckTimer);
            englishCheckTimer = null;
        }
    }
});

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
    let scrollDirection = 0; // Track scroll direction
    let lastScrollTop = 0;
    
    const handleScroll = () => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const distanceFromBottom = documentHeight - (scrollTop + windowHeight);
        
        // Track scroll direction
        scrollDirection = scrollTop > lastScrollTop ? 1 : -1;
        lastScrollTop = scrollTop;
        
        // More conservative bottom detection - require being very close and scrolling down
        const atBottom = distanceFromBottom <= 5 && scrollDirection > 0;
        
        // Additional checks to prevent accidental triggering
        const hasMinimumContent = documentHeight > windowHeight * 1.5; // Ensure there's enough content
        const isScrollingDown = scrollDirection > 0;
        
        if (atBottom && canLoadMore && !isLoadingMore && !isLoading && hasMinimumContent && isScrollingDown) {
            const now = Date.now();
            
            if (!isAtBottom) {
                // Just reached the bottom - require intentional scrolling
                isAtBottom = true;
                scrollHoldStart = now;
                startScrollProgress();
            }
            
            lastScrollTime = now;
            
            // Clear any existing timeout
            if (scrollEndTimeout) {
                clearTimeout(scrollEndTimeout);
            }
            
            // Longer timeout to ensure user really wants to load more
            scrollEndTimeout = window.setTimeout(() => {
                stopScrollProgress();
            }, 200);
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
        loadProgress += 1.5; // Fill over ~3.3 seconds (100/30 = 3.33) - slower for more control
        
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
        pendingOperations = Math.max(0, pendingOperations - 1);
        return;
    }
    
    stopScrollProgress();
    isLoadingMore = true;
    
    // Create a safety timeout to prevent hanging
    const safetyTimeout = setTimeout(() => {
        if (isLoadingMore) {
            persistentLog('⏰ Safety timeout triggered - resetting load more state');
            isLoadingMore = false;
            loadProgress = 0;
            pendingOperations = Math.max(0, pendingOperations - 1);
        }
    }, 45000); // 45 second safety timeout
    
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
            throw new Error('onLoadMore is not a function');
        }
    } catch (error) {
        persistentLog('❌ Load more failed', { 
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        
        // If it's a timeout or network error, disable further load more attempts
        if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('network'))) {
            persistentLog('🛑 Disabling load more due to persistent error');
            // Note: We can't directly modify canLoadMore here as it's a prop
            // The parent component should handle this through error propagation
        }
    } finally {
        clearTimeout(safetyTimeout);
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
	
	// Preload common icons immediately
	preloadCommonIcons();
	
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
    {#if (isLoading || showLoadingSpinner || pendingOperations > 0) && displayedStories.length === 0}
        <!-- Debounced loading indicator -->
        <div class="py-8 text-center text-gray-500 dark:text-gray-400">
            <div class="mx-auto h-6 w-6 rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-gray-500 dark:border-t-gray-300 animate-spin"></div>
        </div>
    {:else if displayedStories.length === 0}
        <div class="py-10">
            {#if smartContentFilter.isEnabled && filteredCount > 0}
			<!-- All stories filtered message -->
			<p class="text-base font-medium mb-2 text-center text-gray-700 dark:text-gray-300">
				{s('smartFilter.allStoriesFiltered') || 'All stories in this category were filtered'}
			</p>
			<p class="text-sm mb-4 text-center text-gray-500 dark:text-gray-400">
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
				<div class="mx-auto max-w-md text-center">
					<img src="/svg/doggo_1.svg" alt="No stories today" class="mx-auto h-28 w-auto opacity-90 dark:opacity-80" />
					<h3 class="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
						{s('stories.noneTodayTitle') || 'No stories today'}
					</h3>
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
						{s('stories.noneTodayMsg') || 'Looks like there are no stories for this category today. Check back tomorrow.'}
					</p>
					{#if language.data !== 'en' && canOfferEnglishSwitch}
						<div class="mt-4 text-sm text-gray-600 dark:text-gray-400">
							<p class="mb-2">{s('stories.noSourcesInLanguage') || 'Sources may not be available in this language yet.'}</p>
							<button
								onclick={() => {
									try {
										if (browser) {
											const url = new URL(window.location.href);
											url.searchParams.set('data_lang', 'en');
											window.history.replaceState({}, '', url.toString());
										}
										language.setData('en' as any);
									} catch {}
								}}
								class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-300 text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors"
							>
								{s('stories.switchToEnglish') || 'Switch to English'}
							</button>
						</div>
					{/if}
					{#if canLoadMore && !isLoading && pendingOperations === 0}
						<button
							onclick={() => triggerLoadMore()}
							class="group mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white bg-gradient-to-r from-gray-700 via-gray-600 to-gray-800 hover:from-gray-700 hover:to-gray-700 dark:from-gray-600 dark:via-gray-600 dark:to-gray-700 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 transition-all"
							aria-label={s('stories.loadMore') || 'Load stories from previous days'}
						>
							{s('stories.loadMoreFromPrevious') || 'Load stories from previous days'}
							<svg class="h-4 w-4 opacity-90 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
								<path d="M7.293 14.707a1 1 0 0 1 0-1.414L10.586 10 7.293 6.707a1 1 0 1 1 1.414-1.414l4 4a1 1 0 0 1 0 1.414l-4 4a1 1 0 0 1-1.414 0z" />
							</svg>
						</button>
					{:else}
						<p class="mt-5 text-xs text-gray-400 dark:text-gray-500">
							{s('stories.noMoreToday') || 'No historical stories available right now.'}
						</p>
					{/if}
				</div>
			{/if}
        </div>
    {:else}
		{#each displayedStories as item, index (((item as any).__dateDivider ? `divider:${(item as any).date}` : `${currentCategory}:${((item as any).__batchId || batchId)}:${(((item as any).cluster_number) ? (item as any).cluster_number.toString() : (item as any).title)}`))}
			{#if (item as any).__dateDivider}
				<div use:observeDateDivider data-date={(item as DateDivider).date} class="my-8 flex items-center justify-center">
					<div class="flex items-center w-full max-w-xs">
						<div class="flex-1 h-px bg-gradient-to-r from-transparent to-gray-300 dark:to-gray-600"></div>
						<div class="px-4 py-2 bg-white dark:bg-gray-900 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
							<time class="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
								{new Date((item as DateDivider).date).toLocaleDateString('en', { 
									month: 'short', 
									day: 'numeric',
									year: new Date((item as DateDivider).date).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
								})}
							</time>
						</div>
						<div class="flex-1 h-px bg-gradient-to-l from-transparent to-gray-300 dark:to-gray-600"></div>
					</div>
				</div>
			{:else}
				{@const story = item as FilteredStory}
				{@const isFiltered = false}
				{@const baseStoryId = story.cluster_number?.toString() || story.title}
				{@const storyBatchId = (story as any).__batchId || batchId}
				{@const storyId = `${currentCategory}:${storyBatchId}:${baseStoryId}`}
				{@const actualStoryIndex = (() => {
					// For story indexing, we need to count only stories from the same batch context
					// to avoid counting stories from previous batches when loading more
					const storiesToCount = stories.filter(s => {
						if ((s as any).__dateDivider) return false;
						// Only count stories from the same batch as the current story
						const sBatchId = (s as any).__batchId || batchId;
						return sBatchId === storyBatchId;
					});
					return storiesToCount.findIndex(s => ((s as Story).cluster_number?.toString() || (s as Story).title) === baseStoryId);
				})()}
				<StoryCard 
					{story}
					storyIndex={actualStoryIndex}
					batchId={storyBatchId}
					categoryId={currentCategory}
					isRead={readStories[storyId] || false}
					isExpanded={expandedStories[storyId] || false}
					onToggle={() => handleStoryToggle(story, true)}
					onReadToggle={() => handleReadToggle(story)}
					priority={actualStoryIndex < 3}
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
		

		
		<!-- Load more section (only when feature enabled) -->
		{#if experimental.enableHistoricalLoadMore && canLoadMore && !isLoading && pendingOperations === 0 && settings.storyCount >= 3}
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
				{#if settings.storyCount >= 3}
				<div class="mt-6 text-center">
					{#if isLoadingMore}
						<div class="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
							<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 dark:border-gray-400"></div>
							<span class="text-sm">{s('loading.historicalStories') || 'Loading stories from previous days…'}</span>
						</div>
					{:else}
						<button
							onclick={handleDesktopLoadMore}
							class="group inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white bg-gradient-to-r from-gray-700 via-gray-600 to-gray-800 hover:from-gray-700 hover:to-gray-700 dark:from-gray-600 dark:via-gray-600 dark:to-gray-700 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 transition-all"
							aria-label={s('stories.loadMore') || 'Load more stories'}
						>
							<span>{s('stories.loadMore') || 'Load more stories'}</span>
							<svg class="h-4 w-4 opacity-90 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
								<path d="M7.293 14.707a1 1 0 0 1 0-1.414L10.586 10 7.293 6.707a1 1 0 1 1 1.414-1.414l4 4a1 1 0 0 1 0 1.414l-4 4a1 1 0 0 1-1.414 0z" />
							</svg>
						</button>
					{/if}
				</div>
				{/if}
			{/if}
		{:else if pendingOperations > 0}
			<!-- Show pending operation indicator -->
			<div class="mt-6 text-center">
				<div class="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
					<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 dark:border-gray-400"></div>
					<span class="text-sm">Processing load more...</span>
				</div>
			</div>
		{:else if experimental.enableHistoricalLoadMore && displayedStories.length > 0 && !canLoadMore}
			<!-- Show message when no more content is available -->
			<div class="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
				{s('stories.noMoreToday') || 'No more stories available for today'}
			</div>
		{/if}


	{/if}
</div> 