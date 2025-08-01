<script lang="ts">
import { onMount } from 'svelte';
import { browser } from '$app/environment';
import { page } from '$app/state';
import { language } from '$lib/stores/language.svelte.js';
import { settings } from '$lib/stores/settings.svelte.js';
import { categories as categoriesStore } from '$lib/stores/categories.svelte.js';
import type { SupportedLanguage } from '$lib/stores/language.svelte';
import { dataService, dataReloadService } from '$lib/services/dataService';
import { clearImageCache, getImageCacheStats, extractStoryImages } from '$lib/utils/imagePreloader';
import { imagePreloadingService } from '$lib/services/imagePreloadingService';
import { categorySwipeHandler } from '$lib/utils/categorySwipeHandler';
import { formatTimeAgo } from '$lib/utils/formatTimeAgo';
import { UrlNavigationService, type NavigationParams } from '$lib/services/urlNavigationService';
import { slugify } from '$lib/utils/urlShortener';
import { navigationHandlerService } from '$lib/services/navigationHandlerService';
import { timeTravelBatch } from '$lib/stores/timeTravelBatch.svelte.js';
import { timeTravel } from '$lib/stores/timeTravel.svelte.js';
import type { Category, Story, OnThisDayEvent } from '$lib/types';

import DataLoader from '$lib/components/DataLoader.svelte';
import ClientOnly from '$lib/components/ClientOnly.svelte';
import IntroScreen from '$lib/components/IntroScreen.svelte';
import Header from '$lib/components/Header.svelte';
import Settings from '$lib/components/Settings.svelte';
import CategoryNavigation from '$lib/components/CategoryNavigation.svelte';
import TemporaryCategoryTooltip from '$lib/components/TemporaryCategoryTooltip.svelte';
import Footer from '$lib/components/Footer.svelte';
import StoryList from '$lib/components/StoryList.svelte';
import OnThisDay from '$lib/components/OnThisDay.svelte';
import SourceOverlay from '$lib/components/SourceOverlay.svelte';
import WikipediaPopup from '$lib/components/WikipediaPopup.svelte';
import TimeTravel from '$lib/components/TimeTravel.svelte';
import HistoryManager from '$lib/components/HistoryManager.svelte';
import { s } from '$lib/client/localization.svelte';


// App state
let dataLoaded = $state(false);
const offlineMode = $state(false);
let lastLoadedCategory = $state(''); // Track last loaded category to prevent duplicates
let temporaryCategory = $state<string | null>(null);
let showTemporaryCategoryTooltip = $state(false);
let temporaryCategoryElement = $state<HTMLElement | null>(null);
let desktopCategoryNavigation = $state<any>();

// Derive the header position reactively from the settings store. Using `.by` ensures we
// properly subscribe to the underlying state instead of capturing a static value.
const categoryHeaderPosition = $derived.by(() => settings.categoryHeaderPosition);


// Data state
let categories = $state<Category[]>([]);
let currentCategory = $state('World');

// Track when currentCategory changes  
$effect(() => {
	persistentLogMain('🔍 currentCategory changed', {
		newValue: currentCategory,
		stack: new Error().stack?.split('\n').slice(1, 4).join(' | ')
	});
});
let stories = $state<Story[]>([]);
let onThisDayEvents = $state<OnThisDayEvent[] | null>(null);
let onThisDayLoading = $state(false);
let readStories = $state<Record<string, boolean>>({});
let totalReadCount = $state(0);
// totalStoriesRead is now a derived value based on readStories
let lastUpdated = $state('');
let allCategoryStories = $state<Record<string, Story[]>>({});
let categoryMap = $state<Record<string, string>>({});  // Map category ID to UUID
let currentBatchId = $state<string>('');
let categoryHasMore = $state<Record<string, boolean>>({});
let categoryLimits = $state<Record<string, number>>({});
let batchList = $state<Array<{id: string, createdAt: string}>>([]);
let batchesLoaded = $state(false);
// Track batches and their story counts
let catBatches: { [categoryId: string]: string[] } = {};
let catBatchesIndex: { [categoryId: string]: number } = {};
let catBatchSizes: { [categoryId: string]: { [batchId: string]: number } } = {}; // Track actual batch sizes
let catDailyBatches: { [categoryId: string]: { [dateKey: string]: string[] } } = {}; // Group batches by day

// Flag to show loading indicator when switching categories or fetching more
let storiesLoading = $state<boolean>(false);

async function fetchBatchList() {
    if (batchesLoaded) return;
    try {
        // Fetch batches from the last 30 days to ensure we have historical content
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30); // 30 days ago
        
        console.log('📋 Fetching batch list from', startDate.toISOString(), 'to', endDate.toISOString());
        
        const resp = await fetch(
            `/api/batches?from=${startDate.toISOString()}&to=${endDate.toISOString()}&lang=${language.data}`
        );
        if (resp.ok) {
            const data = await resp.json();
            batchList = data.batches.map((b: any) => ({ id: b.id, createdAt: b.createdAt }));
            batchesLoaded = true;
            console.log('✅ Fetched', batchList.length, 'batches for historical loading');
        } else {
            console.error('❌ Failed to fetch batch list:', resp.status, resp.statusText);
            
            // For API failures (500/502/503), mark all categories as having no more content
            // to prevent infinite retry loops
            if (resp.status >= 500) {
                console.warn('⚠️ API server error detected - disabling load more for all categories');
                Object.keys(categoryHasMore).forEach(cat => {
                    categoryHasMore[cat] = false;
                });
                
                // Set empty batch list to prevent further attempts
                batchList = [];
                batchesLoaded = true;
                return;
            }
        }
    } catch (err) {
        console.error('Failed to fetch batch list', err);
        
        // For network errors, also disable load more to prevent infinite retries
        console.warn('⚠️ Network error fetching batch list - disabling load more for all categories');
        Object.keys(categoryHasMore).forEach(cat => {
            categoryHasMore[cat] = false;
        });
        
        // Set empty batch list to prevent further attempts
        batchList = [];
        batchesLoaded = true;
    }
}

// Helper function to get date key from batch
function getBatchDateKey(batchId: string): string {
    const batchInfo = batchList.find(b => b.id === batchId);
    if (batchInfo) {
        const date = new Date(batchInfo.createdAt);
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    }
    // Fallback for current batch or unknown batches
    return new Date().toISOString().split('T')[0];
}

// State for source overlay
let showSourceOverlay = $state(false);
let currentSource = $state<any>(null);
let sourceArticles = $state<any[]>([]);
let currentMediaInfo = $state<any>(null);
let isLoadingMediaInfo = $state(false);

// State for chaos index
let chaosIndex = $state({
	score: 0,
	summary: '',
	lastUpdated: ''
});

// State for view mode (currently unused but reserved for future map view)
// let viewMode = $state<'list' | 'map'>('list');

// State for Wikipedia popup
let wikipediaPopup = $state({
	visible: false,
	title: '',
	content: '',
	imageUrl: ''
});

// State for story URL management - Initialize with empty reactive objects
let expandedStories = $state<Record<string, boolean>>({});
// Map of category -> expanded stories for that category
let expandedStoriesByCategory = $state<Record<string, Record<string, boolean>>>({});
// NEW: Load persisted expanded story state from localStorage (if available)
if (typeof localStorage !== 'undefined') {
	try {
		const persisted = localStorage.getItem('expandedStoriesByCategory');
		if (persisted) {
			expandedStoriesByCategory = JSON.parse(persisted);
		}
	} catch (err) {
		console.warn('Failed to parse expandedStoriesByCategory from storage', err);
	}
}

// Persist map to localStorage whenever it changes
$effect(() => {
	if (typeof localStorage !== 'undefined') {
		try {
			localStorage.setItem('expandedStoriesByCategory', JSON.stringify(expandedStoriesByCategory));
		} catch (err) {
			console.warn('Failed to save expandedStoriesByCategory to storage', err);
		}
	}
});
let isLatestBatch = $state(true);
let historyManager = $state<HistoryManager>();

// Compute current story index from expanded stories
const currentStoryIndex = $derived.by(() => {
	const expandedStoryId = Object.keys(expandedStories).find(id => expandedStories[id]);
	if (!expandedStoryId) return null;
	
	const story = stories.find(s => 
		(s.cluster_number?.toString() === expandedStoryId) || 
		(s.title === expandedStoryId)
	);
	
	return story ? stories.indexOf(story) : null;
});

// Create ordered categories based on store order
const orderedCategories = $derived.by(() => {
	if (categories.length === 0 || categoriesStore.enabled.length === 0) {
		return categories;
	}

	// Filter only enabled categories and order them according to store order
	// Now that the store always uses IDs, we only need to check cat.id
	const enabledCategories = categories.filter(cat => 
		categoriesStore.enabled.includes(cat.id) || 
		(temporaryCategory && cat.id === temporaryCategory) // Include temporary category
	);

	// Sort by store order - use toSorted() to avoid mutations
	return [...enabledCategories].sort((a, b) => {
		const aIndex = categoriesStore.enabled.findIndex(id => id === a.id);
		const bIndex = categoriesStore.enabled.findIndex(id => id === b.id);
		
		// If both categories are in the enabled list, sort by their order
		if (aIndex !== -1 && bIndex !== -1) {
			return aIndex - bIndex;
		}
		
		// If one is temporary (not in enabled list), put it at the end
		if (aIndex === -1 && bIndex !== -1) return 1;  // a is temporary, put after b
		if (aIndex !== -1 && bIndex === -1) return -1; // b is temporary, put after a
		
		// If both are not in enabled (e.g., temporary + disabled), fall back to the master order list
		const orderA = categoriesStore.order.findIndex(id => id === a.id);
		const orderB = categoriesStore.order.findIndex(id => id === b.id);
		return orderA - orderB;
	});
});

// Data loading functions
function handleDataLoaded(data: {
	categories: Category[];
	stories: Story[];
	totalReadCount: number;
	lastUpdated: string;
	currentCategory: string;
	allCategoryStories: Record<string, Story[]>;
	categoryMap: Record<string, string>;
	batchId: string;
	chaosIndex?: number;
	chaosDescription?: string;
	chaosLastUpdated?: string;
	isLatestBatch: boolean;
	temporaryCategory?: string | null;
	onThisDayEvents?: OnThisDayEvent[];
}) {
	// Reset app state for fresh data
	expandedStories = {};
	lastLoadedCategory = '';
	lastEffectLoadedCategory = '';
	
	// Close any open overlays
	if (showSourceOverlay) {
		handleCloseSource();
	}
	if (wikipediaPopup.visible) {
		closeWikipediaPopup();
	}
	
	// Load new data
	categories = data.categories;
	stories = data.stories;
	totalReadCount = data.totalReadCount;
	lastUpdated = data.lastUpdated;
	currentCategory = data.currentCategory;
	// Restore any persisted expanded stories for this category
	expandedStories = { ...(expandedStoriesByCategory[currentCategory] ?? {}) };
	allCategoryStories = data.allCategoryStories;
	categoryMap = data.categoryMap;
	currentBatchId = data.batchId;
	lastLoadedCategory = data.currentCategory; // Set the guard for initial load
	
	// Set OnThisDay events from preloaded data
	if (data.onThisDayEvents) {
		onThisDayEvents = data.onThisDayEvents;
		console.log(`📅 Preloaded ${onThisDayEvents.length} OnThisDay events during splash screen`);
	}
	
	// Use the isLatestBatch value from DataLoader
	isLatestBatch = data.isLatestBatch;
	
	// Set chaos index from initial load
	if (data.chaosIndex !== undefined && data.chaosDescription && data.chaosLastUpdated) {
		chaosIndex = {
			score: data.chaosIndex,
			summary: data.chaosDescription,
			lastUpdated: data.chaosLastUpdated
		};
	}
	
	// Handle temporary category
	if (data.temporaryCategory) {
		temporaryCategory = data.temporaryCategory;
		// Tooltip will appear on hover only
	}
	
	dataLoaded = true;
	
	console.log(`🚀 Loaded ${Object.keys(allCategoryStories).length} categories with ${Object.values(allCategoryStories).flat().length} total stories`);
	
	// Trigger favicon preloading for enabled categories after data is loaded
	if (browser) {
		import('$lib/utils/citationUtils').then(({ preloadCommonFavicons }) => {
			import('$lib/stores/categories.svelte').then(({ categories: categoriesStore }) => {
				const enabledCategories = categoriesStore.enabled;
				preloadCommonFavicons(allCategoryStories, enabledCategories).catch(error => {
					console.warn('Failed to preload favicons after data load:', error);
				});
			});
		});
	}
	
	// After initial data load, clean URL if we're on latest batch but URL had a batchId
	if (browser) {
		const urlParams = parseInitialUrl();

		if (isLatestBatch && urlParams.batchId) {
			// Replace the URL without batchId
			historyManager?.updateUrl({ batchId: null });
		}

		let storyToExpand: Story | undefined;
		if (urlParams.slug) {
			storyToExpand = stories.find(s => slugify(s.title) === urlParams.slug);
		} else if (urlParams.storyIndex !== undefined && urlParams.storyIndex !== null && stories[urlParams.storyIndex]) {
			storyToExpand = stories[urlParams.storyIndex];
		}

		if (storyToExpand) {
			// Expand the story from URL - create new object to avoid mutation
			const story = storyToExpand;
			const storyId = story.cluster_number?.toString() || story.title;
			expandedStories = { ...expandedStories, [storyId]: true };
		}
	}

    // Initialize limits and hasMore map for categories
    categoryLimits = {};
    categoryHasMore = {};
    for (const catId of data.categories.map(c=>c.id)) {
        categoryLimits[catId] = settings.storyCount;
        categoryHasMore[catId] = true; // assume more until proven otherwise
    }

    // Mark initial load as complete
    persistentLogMain('✅ Initial load completed');

    // Fetch list of batches for cross-day load
    fetchBatchList();
}

function handleDataError(error: string) {
	console.error('Data loading error:', error);
	// Could show error state here if needed
	dataLoaded = true; // Still show the app with fallback data
}

// Function to log persistently in main page
function persistentLogMain(message: string, data?: any) {
	if (!browser) return;
	
	const timestamp = new Date().toISOString();
	const logEntry = { timestamp, message: `[MAIN] ${message}`, data, url: window.location.href };
	
	try {
		const logs = JSON.parse(localStorage.getItem('kite-debug-logs') || '[]');
		logs.push(logEntry);
		if (logs.length > 50) logs.splice(0, logs.length - 50);
		localStorage.setItem('kite-debug-logs', JSON.stringify(logs));
	} catch (e) {
		console.warn('Failed to save persistent log:', e);
	}
	
	console.log(`[PERSISTENT MAIN] ${message}`, data || '');
}

// Debug utilities for the browser console
if (browser) {
	(window as any).clearKiteLogs = () => {
		localStorage.removeItem('kite-debug-logs');
		console.log('✅ Kite debug logs cleared');
	};
	
	(window as any).showKiteLogs = () => {
		try {
			const logs = JSON.parse(localStorage.getItem('kite-debug-logs') || '[]');
			console.table(logs.slice(-20)); // Show last 20 logs
			return logs;
		} catch (e) {
			console.log('No logs found');
			return [];
		}
	};
	
	(window as any).showKiteLogsBeforeRefresh = () => {
		try {
			const logs = JSON.parse(localStorage.getItem('kite-debug-logs') || '[]');
			const refreshIndex = logs.findIndex((log: any) => log.message.includes('📱 StoryList mounted'));
			if (refreshIndex > 0) {
				const beforeRefresh = logs.slice(0, refreshIndex);
				console.group('🔍 Logs before last refresh:');
				beforeRefresh.slice(-10).forEach((log: any) => {
					console.log(`[${log.timestamp}] ${log.message}`, log.data || '');
				});
				console.groupEnd();
				return beforeRefresh;
			} else {
				console.log('No refresh detected in logs');
				return [];
			}
		} catch (e) {
			console.log('Error reading logs:', e);
			return [];
		}
	};
}

// Flag to prevent navigation during load more
let isLoadingMore = $state(false);

// Triggered by StoryList load more
async function handleLoadMore() {
    try {
        isLoadingMore = true;
        persistentLogMain('🔄 handleLoadMore called', { 
            category: currentCategory,
            canLoadMore: categoryHasMore[currentCategory],
            currentBatchId,
            timeTravelBatchId: timeTravelBatch.batchId,
            isLatestBatch,
            storiesCount: stories?.length || 0
        });
        
        // Double check that we can actually load more
        if (!categoryHasMore[currentCategory]) {
            persistentLogMain('❌ handleLoadMore blocked: categoryHasMore is false', {
                category: currentCategory,
                categoryHasMore: categoryHasMore[currentCategory]
            });
            return;
        }
        
        persistentLogMain('🚀 About to call loadStoriesForCategory', { category: currentCategory });
        await loadStoriesForCategory(currentCategory, true);
        persistentLogMain('✅ loadStoriesForCategory completed', { category: currentCategory });
        
    } catch (error) {
        persistentLogMain('❌ handleLoadMore failed', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        // Prevent any error propagation that could cause page refresh
        return;
    } finally {
        // Always reset the flag
        isLoadingMore = false;
        persistentLogMain('🔧 Load more operation completed, resetting isLoadingMore flag');
    }
}

async function loadStoriesForCategory(categoryId: string, increment: boolean = false) {
    persistentLogMain('🔧 loadStoriesForCategory starting', { categoryId, increment });
    console.log('📖 loadStoriesForCategory called:', { categoryId, increment });
    
    // Prevent duplicate loading calls
    if (storiesLoading && lastLoadedCategory === categoryId && !increment) {
        console.log('❌ Blocked duplicate loading call');
        return;
    }
    
    storiesLoading = true;
	// Handle OnThisDay separately
	if (categoryId === 'onthisday') {
		await loadOnThisDayEvents();
		storiesLoading = false;
		return;
	}
	
	// Compute requested limit
	if (!categoryLimits[categoryId]) {
        categoryLimits[categoryId] = settings.storyCount;
        console.log('🆕 Initialized category limit for', categoryId, 'to:', settings.storyCount, '(user setting)');
    }
    if (increment) {
        const oldLimit = categoryLimits[categoryId];
        
        // Smart completion logic: complete current batch if only a few stories remain
        // This works for both current day and historical batches (each has ~12 stories)
        
        // Determine which batch we're currently loading from
        const currentLoadingIndex = catBatchesIndex[categoryId] || 0;
        const currentLoadingBatch = batchList[currentLoadingIndex];
        
        if (currentLoadingBatch && allCategoryStories[categoryId]) {
            // Get the date for the current batch
            const currentDateKey = getBatchDateKey(currentLoadingBatch.id);
            const batchesForCurrentDay = catDailyBatches[categoryId]?.[currentDateKey] || [currentLoadingBatch.id];
            
            // Calculate total stories from all batches for this day
            let totalDailyBatchSize = 0;
            let storiesFromCurrentDay = 0;
            
            for (const dayBatchId of batchesForCurrentDay) {
                // Add batch size (if known)
                if (catBatchSizes[categoryId]?.[dayBatchId]) {
                    totalDailyBatchSize += catBatchSizes[categoryId][dayBatchId];
                }
            }
            
            // If we don't know the daily batch size yet, use a reasonable default for smart completion
            if (totalDailyBatchSize === 0) {
                totalDailyBatchSize = 12; // Default assumption for current batch
                console.log('📏 Using default daily batch size of 12 (size not yet detected)');
            }
            
            // Count stories from current day
            if (currentLoadingIndex === 0) {
                // Current day - count non-historical stories
                storiesFromCurrentDay = allCategoryStories[categoryId]
                    .filter(item => !(item as any).__dateDivider && !(item as any).__fromHistoricalBatch)
                    .length;
            } else {
                // Historical day - count stories since last date divider
                let storiesAfterLastDivider = 0;
                for (let i = allCategoryStories[categoryId].length - 1; i >= 0; i--) {
                    const item = allCategoryStories[categoryId][i];
                    if ((item as any).__dateDivider) break;
                    if (!(item as any).__dateDivider) storiesAfterLastDivider++;
                }
                storiesFromCurrentDay = storiesAfterLastDivider;
            }
            
            const remainingInCurrentDay = Math.max(0, totalDailyBatchSize - storiesFromCurrentDay);
            const userIncrement = settings.storyCount;
            
            console.log('🔍 Daily completion check:', {
                dateKey: currentDateKey,
                batchesForDay: batchesForCurrentDay.length,
                dailyBatchIds: batchesForCurrentDay.map(id => id.substring(0, 8)),
                storiesFromDay: storiesFromCurrentDay,
                totalDailySize: totalDailyBatchSize || 'unknown',
                remainingInDay: remainingInCurrentDay,
                userSetting: userIncrement,
                shouldComplete: storiesFromCurrentDay > 0 && totalDailyBatchSize > 0 && storiesFromCurrentDay < totalDailyBatchSize && remainingInCurrentDay <= userIncrement * 1.5 && remainingInCurrentDay > 0
            });
            
            // If we have stories from current day and few remaining, complete the day
            if (storiesFromCurrentDay > 0 && totalDailyBatchSize > 0 && storiesFromCurrentDay < totalDailyBatchSize && remainingInCurrentDay <= userIncrement * 1.5 && remainingInCurrentDay > 0) {
                categoryLimits[categoryId] = oldLimit + remainingInCurrentDay;
                console.log('📅 Completing current day: from', oldLimit, 'to', categoryLimits[categoryId], `(+${remainingInCurrentDay} remaining for ${currentDateKey})`);
            } else {
                // Normal increment using user setting
                categoryLimits[categoryId] += settings.storyCount;
                if (currentLoadingIndex === 0) {
                    console.log('📈 Normal increment (current day): from', oldLimit, 'to:', categoryLimits[categoryId], '(+' + settings.storyCount + ' from user setting)');
                } else {
                    console.log('🕰️ Historical increment: from', oldLimit, 'to:', categoryLimits[categoryId], '(+' + settings.storyCount + ' from user setting)');
                }
            }
        } else {
            // Fallback to normal increment
            categoryLimits[categoryId] += settings.storyCount;
            console.log('📈 Fallback increment: from', oldLimit, 'to:', categoryLimits[categoryId], '(+' + settings.storyCount + ' from user setting)');
        }
    }

    let requestedLimit = categoryLimits[categoryId];
    console.log('🎯 Load operation details:', {
        requestedLimit,
        currentCachedCount: allCategoryStories[categoryId]?.filter(item => !(item as any).__dateDivider).length || 0,
        isLoadMore: increment,
        categoryLimit: categoryLimits[categoryId],
        userSetting: settings.storyCount
    });
    console.log('⚙️ User story count setting:', settings.storyCount, '(configured in Settings > General)');

    // Ensure batch list ready
    await fetchBatchList();
    console.log('📋 Batch list ready, total batches:', batchList.length);

    // Track batches consumed for this category
    if (!catBatches[categoryId]) catBatches[categoryId] = [currentBatchId];
    if (!catBatchesIndex[categoryId]) catBatchesIndex[categoryId] = 0;
    
    console.log('🎯 Batch tracking: current batch index', catBatchesIndex[categoryId], 'of', batchList.length);

    // If we have enough cached stories AND this is not a load more operation, use them
    const cachedStoryCount = allCategoryStories[categoryId]?.filter(item => !(item as any).__dateDivider).length || 0;
    console.log('📊 Cached story analysis:', {
        cachedCount: cachedStoryCount,
        requestedLimit,
        isIncrement: increment,
        needsMore: cachedStoryCount < requestedLimit,
        hasEnough: cachedStoryCount >= requestedLimit,
        shouldUseCached: !increment && cachedStoryCount >= requestedLimit
    });
    
    persistentLogMain('📊 Cached story analysis', {
        cachedCount: cachedStoryCount,
        requestedLimit,
        isIncrement: increment,
        needsMore: cachedStoryCount < requestedLimit,
        hasEnough: cachedStoryCount >= requestedLimit,
        shouldUseCached: !increment && cachedStoryCount >= requestedLimit
    });
    
    persistentLogMain('🔍 About to check if should use cached stories');
    
    persistentLogMain('🔍 Checking conditions', {
        increment,
        cachedStoryCount,
        requestedLimit,
        shouldUseCached: !increment && cachedStoryCount >= requestedLimit
    });
    
    if (!increment && cachedStoryCount >= requestedLimit) {
        persistentLogMain('✅ Using cached stories for initial load');
        console.log('✅ Using cached stories for initial load, slicing to:', requestedLimit);
        stories = allCategoryStories[categoryId].slice(0, 
            Math.min(requestedLimit + (allCategoryStories[categoryId].filter(item => (item as any).__dateDivider).length), 
                     allCategoryStories[categoryId].length)
        );
        storiesLoading = false;
        return;
    } else if (increment) {
        persistentLogMain('🔄 Load more operation - entering branch');
        console.log('🔄 Load more operation - will fetch additional stories even if we have cached ones');
        persistentLogMain('🔄 Load more operation - logged to console');
    } else {
        persistentLogMain('🔍 Neither cached nor increment branch');
    }

    persistentLogMain('🔍 After increment branch - continuing to batch check');

    // If we have some cached stories but fewer than requested, 
    // show all cached stories first and check if more batches are available
    persistentLogMain('🔍 Checking if we have cached but need more', {
        cachedStoryCount,
        requestedLimit,
        needsMore: cachedStoryCount > 0 && cachedStoryCount < requestedLimit
    });
    
    if (cachedStoryCount > 0 && cachedStoryCount < requestedLimit) {
        persistentLogMain('📊 Have cached but need more - showing cached first');
        console.log('📊 Have', cachedStoryCount, 'cached stories, need', requestedLimit, 'total. Showing cached first.');
        stories = allCategoryStories[categoryId];
        
        persistentLogMain('🔍 About to check for more batches');
        // Check if we can get more content from additional batches
        const hasMoreBatches = batchList && catBatchesIndex[categoryId] < batchList.length;
        persistentLogMain('🔍 Batch check result', {
            batchListExists: !!batchList,
            currentIndex: catBatchesIndex[categoryId],
            totalBatches: batchList?.length,
            hasMoreBatches
        });
        console.log('🔍 Batch check: index', catBatchesIndex[categoryId], 'of', batchList.length, 'hasMore:', hasMoreBatches);
        
        if (!hasMoreBatches) {
            console.log('🚫 No more batches available, setting limit to cached count');
            categoryLimits[categoryId] = cachedStoryCount;
            categoryHasMore[categoryId] = false;
            storiesLoading = false;
            return;
        }
    }

    try {
        lastLoadedCategory = categoryId;

        // Continue fetching from batches until we reach requestedLimit or no more batches
        let currentIndex = 0;
        if (catBatchesIndex[categoryId] === undefined) catBatchesIndex[categoryId] = 0;

        while (allCategoryStories[categoryId]?.length < requestedLimit && catBatchesIndex[categoryId] < batchList.length) {
            const batchId = batchList[catBatchesIndex[categoryId]].id;
            persistentLogMain('🔄 Processing batch', {
                batchId: batchId.substring(0, 8),
                index: catBatchesIndex[categoryId],
                totalBatches: batchList.length,
                category: categoryId
            });
            
            persistentLogMain('🔄 Entering try block');
            
            try {

            persistentLogMain('🔄 About to check if batchId === currentBatchId', {
                batchId: batchId.substring(0, 8),
                currentBatchId: currentBatchId?.substring(0, 8),
                areEqual: batchId === currentBatchId
            });

            // Remove premature skip - fetch again from current batch until we detect no new unique stories
            if (batchId === currentBatchId) {
                persistentLogMain('🔍 Checking if current batch has more stories');
                // Determine how many unique stories we already have from current day
                const currentDayStories = allCategoryStories[categoryId].filter(it => !(it as any).__dateDivider && !(it as any).__fromHistoricalBatch).length;
                const currentBatchSizeKnown = catBatchSizes[categoryId]?.[batchId];
                const maybeMoreInCurrentBatch = currentBatchSizeKnown === undefined || currentDayStories < currentBatchSizeKnown;

                if (!maybeMoreInCurrentBatch) {
                    console.log('⏭️ Skipping current batch - fully loaded');
                    catBatchesIndex[categoryId]++;
                    continue;
                }
                // else fall through to fetch more from current batch
            }

            // Obtain category uuid for this batch
            persistentLogMain('🔍 About to obtain category UUID');
            let catUuid: string | null = null;
            persistentLogMain('🔍 Declared catUuid variable');
            
            if (batchId === currentBatchId) {
                persistentLogMain('🔍 Batch matches current batch - using categoryMap');
                catUuid = categoryMap[categoryId];
                persistentLogMain('✅ Using current batch', { batchId: batchId.substring(0, 8), catUuid });
                console.log('✅ Using current batch, catUuid:', catUuid);
            } else {
                persistentLogMain('🔍 Different batch - need to fetch categories');
                persistentLogMain('🔍 Fetching categories for batch', { batchId: batchId.substring(0, 8) });
                console.log('🔍 Fetching categories for batch:', batchId);
                try {
                    persistentLogMain('🌐 About to fetch categories', { batchId: batchId.substring(0, 8) });
                    const resp = await fetch(`/api/batches/${batchId}/categories?lang=${language.data}`);
                    persistentLogMain('📡 Categories fetch response', { 
                        batchId: batchId.substring(0, 8), 
                        status: resp.status, 
                        ok: resp.ok 
                    });
                    if (resp.ok) {
                        const data = await resp.json();
                        const catObj = (data.categories || data).find((c: any)=> c.id === categoryId || c.categoryId === categoryId);
                        catUuid = catObj?.id || catObj?.uuid;
                        persistentLogMain('✅ Found catUuid for batch', { 
                            batchId: batchId.substring(0, 8), 
                            catUuid 
                        });
                        console.log('✅ Found catUuid for batch:', catUuid);
                    } else {
                        persistentLogMain('❌ Failed to fetch categories for batch', { 
                            batchId: batchId.substring(0, 8), 
                            status: resp.status 
                        });
                        console.log('❌ Failed to fetch categories for batch:', resp.status);
                    }
                } catch(err) { 
                    persistentLogMain('💥 Categories fetch error', { 
                        batchId: batchId.substring(0, 8), 
                        error: err instanceof Error ? err.message : String(err) 
                    });
                    console.warn('Failed to fetch categories for batch', batchId, err); 
                }
            }

            if (!catUuid) {
                // Fallback: try using the category slug directly
                catUuid = categoryId;
                console.log('⚠️ Using fallback catUuid:', catUuid);
            }

            const remainingNeeded = requestedLimit - (allCategoryStories[categoryId]?.length || 0);
            console.log('📊 Fetching stories:');
            console.log('- Remaining needed:', remainingNeeded);
            const fetchAmount = Math.min(15, remainingNeeded + 5); // Fetch extra to determine batch size
            console.log('- Fetch amount:', fetchAmount, '(+5 extra to detect batch size)');
            console.log('- From batch:', batchId);
            console.log('- Category UUID:', catUuid);

            persistentLogMain('🚀 About to call dataService.loadStories', {
                batchId: batchId.substring(0, 8),
                catUuid,
                fetchAmount
            });
            
            const result = await dataService.loadStories(batchId, catUuid, fetchAmount, language.data);
            
            persistentLogMain('📦 API result received', {
                batchId: batchId.substring(0, 8),
                categoryId,
                storiesReceived: result.stories.length,
                fetchAmount,
                isEmpty: result.stories.length === 0,
                isApiFailure: result.isApiFailure || false
            });
            
            // Check for API failures and stop immediately
            if (result.isApiFailure) {
                persistentLogMain('🛑 API failure detected - stopping load more immediately', {
                    batchId: batchId.substring(0, 8),
                    category: categoryId,
                    reason: 'API server error or network failure'
                });
                // REMOVED: logToTerminalMain call - causing page refreshes
                
                // Set hasMore to false to prevent further attempts
                categoryHasMore[categoryId] = false;
                break;
            }
            
            // Track actual batch size if this is the first time we're seeing this batch
            if (!catBatchSizes[categoryId]) catBatchSizes[categoryId] = {};
            if (!catDailyBatches[categoryId]) catDailyBatches[categoryId] = {};
            
            // Group batches by day
            const dateKey = getBatchDateKey(batchId);
            if (!catDailyBatches[categoryId][dateKey]) {
                catDailyBatches[categoryId][dateKey] = [];
            }
            if (!catDailyBatches[categoryId][dateKey].includes(batchId)) {
                catDailyBatches[categoryId][dateKey].push(batchId);
                console.log('📅 Grouped batch', batchId.substring(0, 8), 'under date:', dateKey);
            }
            
            if (!catBatchSizes[categoryId][batchId]) {
                // If we got fewer stories than we asked for, this batch is smaller
                if (result.stories.length < fetchAmount) {
                    catBatchSizes[categoryId][batchId] = result.stories.length;
                    console.log('📏 Detected batch size:', batchId.substring(0, 8), '→', result.stories.length, 'stories (smaller than expected)');
                } else {
                    // We got what we asked for, but there might be more - we'll update this later
                    catBatchSizes[categoryId][batchId] = result.stories.length;
                    console.log('📏 Partial batch size recorded:', batchId.substring(0, 8), '→', result.stories.length, 'stories (may have more)');
                }
            } else {
                // Update batch size if we got more stories than previously recorded
                const newTotal = catBatchSizes[categoryId][batchId] + result.stories.length;
                catBatchSizes[categoryId][batchId] = Math.max(catBatchSizes[categoryId][batchId], newTotal);
                console.log('📏 Updated batch size:', batchId.substring(0, 8), '→', catBatchSizes[categoryId][batchId], 'stories');
            }
            
            if (!allCategoryStories[categoryId]) allCategoryStories[categoryId] = [];

            if (result.stories.length > 0) {                
                // Filter out duplicate stories before adding
                const existingStoryIds = new Set(
                    allCategoryStories[categoryId]
                        .filter(item => !(item as any).__dateDivider)
                        .map(story => (story as any).cluster_number?.toString() || (story as any).title)
                );
                
                console.log('🔍 Existing story IDs:', existingStoryIds.size);
                
                // For historical batches, use different deduplication logic
                let newStories;
                if (batchId === currentBatchId) {
                    // Current batch: strict deduplication by cluster_number
                    newStories = result.stories.filter(story => {
                        const storyId = story.cluster_number?.toString() || story.title;
                        const isDuplicate = existingStoryIds.has(storyId);
                        if (isDuplicate) {
                            console.log('🔄 Duplicate story found (current batch):', storyId, '- Title:', story.title.substring(0, 50) + '...');
                        }
                        return !isDuplicate;
                    });
                } else {
                    // Historical batch: more lenient deduplication - allow similar stories from different days
                    // Use title-based deduplication with similarity check instead of cluster numbers
                    const existingTitles = new Set(
                        allCategoryStories[categoryId]
                            .filter(item => !(item as any).__dateDivider)
                            .map(story => (story as any).title.toLowerCase().trim())
                    );
                    
                    newStories = result.stories.filter(story => {
                        const titleKey = story.title.toLowerCase().trim();
                        const isDuplicate = existingTitles.has(titleKey);
                        if (isDuplicate) {
                            console.log('🔄 Duplicate title found (historical batch):', story.title.substring(0, 50) + '...');
                        }
                        return !isDuplicate;
                    });
                    
                    console.log('📅 Historical batch: using title-based deduplication instead of cluster numbers');
                }
                
                console.log('📝 After duplicate filtering:', newStories.length, 'unique stories to add');
                
                // Only add stories and date divider if we have unique content
                if (newStories.length > 0) {
                    // Insert date divider when starting new batch (if not latest) - moved inside this block
                    if (batchId !== currentBatchId && !catBatches[categoryId]?.includes(batchId)) {
                        const batchInfo = batchList.find(b => b.id === batchId);
                        let batchDate = new Date().toISOString(); // fallback to today
                        
                        if (batchInfo) {
                            batchDate = batchInfo.createdAt;
                        } else {
                            // If not in batch list, try to fetch batch info
                            try {
                                const batchResponse = await fetch(`/api/batches/${batchId}`);
                                if (batchResponse.ok) {
                                    const batchData = await batchResponse.json();
                                    batchDate = batchData.createdAt;
                                }
                            } catch (err) {
                                console.warn('Failed to fetch batch date for', batchId, err);
                            }
                        }
                        
                        console.log('📅 Adding date divider for batch:', batchId, 'with date:', batchDate);
                        allCategoryStories[categoryId].push({ __dateDivider: true, date: batchDate } as any);
                        catBatches[categoryId].push(batchId);
                    }
                    
                    // Mark historical stories for load more logic
                    if (batchId !== currentBatchId) {
                        newStories.forEach(story => {
                            (story as any).__fromHistoricalBatch = true;
                        });
                    }
                    
                    allCategoryStories[categoryId].push(...newStories);
                    console.log('📚 Added', newStories.length, 'new stories. Total stories now:', allCategoryStories[categoryId].filter(item => !(item as any).__dateDivider).length);
                } else {
                    console.log('⚠️ No unique stories found in batch', batchId, '- continuing to next batch');
                }
                
                // Mark this batch as processed if we got fewer stories than requested
                if (result.stories.length < fetchAmount) {
                    console.log('🏁 Batch', batchId, 'fully processed - got', result.stories.length, 'out of', fetchAmount, 'requested');
                    if (!catBatches[categoryId].includes(batchId)) {
                        catBatches[categoryId].push(batchId);
                    }
                }
            } else {
                console.log('📭 No stories returned from batch', batchId);
                // Mark empty batch as processed
                if (!catBatches[categoryId].includes(batchId)) {
                    catBatches[categoryId].push(batchId);
                }
            }

            } catch (batchError) {
                persistentLogMain('❌ Error processing batch', {
                    batchId: batchId.substring(0, 8),
                    error: batchError instanceof Error ? batchError.message : String(batchError),
                    stack: batchError instanceof Error ? batchError.stack : undefined,
                    category: categoryId
                });                
                // Don't let one failed batch break the entire load more operation
                console.warn('Failed to process batch', batchId, '- continuing to next batch:', batchError);
                
                // Mark this batch as processed to avoid retrying it
                if (!catBatches[categoryId].includes(batchId)) {
                    catBatches[categoryId].push(batchId);
                }
            }

            // Always increment batch index to progress through historical batches
            persistentLogMain('➡️ Incrementing batch index', {
                oldIndex: catBatchesIndex[categoryId],
                newIndex: catBatchesIndex[categoryId] + 1,
                category: categoryId
            });
            catBatchesIndex[categoryId]++;
            
            // If we didn't get enough unique stories from this batch, continue to next batch
            // This ensures we aggregate content from multiple historical batches if needed
            const currentStoryCount = allCategoryStories[categoryId].filter(item => !(item as any).__dateDivider).length;
            if (currentStoryCount < requestedLimit && catBatchesIndex[categoryId] < batchList.length) {
                persistentLogMain('🔄 Need more stories - continuing to next batch', {
                    currentStoryCount,
                    requestedLimit,
                    batchIndex: catBatchesIndex[categoryId],
                    totalBatches: batchList.length
                });
                console.log('🔄 Need more stories (have', currentStoryCount, '/', requestedLimit, ') - continuing to next historical batch');
                continue;
            } else if (currentStoryCount >= requestedLimit) {
                persistentLogMain('✅ Reached story target', {
                    currentStoryCount,
                    requestedLimit
                });
                console.log('✅ Reached story target:', currentStoryCount, '/', requestedLimit);
                break;
            } else {
                persistentLogMain('🔚 No more batches available', {
                    currentStoryCount,
                    requestedLimit,
                    totalBatches: batchList.length
                });
                console.log('🔚 No more batches available. Final count:', currentStoryCount, '/', requestedLimit);
                break;
            }
        }

        // Update hasMore flag
        // Allow further loading as long as there are still batches left to inspect
        const hasMoreBatches = catBatchesIndex[categoryId] < batchList.length;
        const oldHasMore = categoryHasMore[categoryId];
        categoryHasMore[categoryId] = hasMoreBatches;
                
        console.log('🏁 Load more results: showing', Math.min(requestedLimit, allCategoryStories[categoryId]?.filter(item => !(item as any).__dateDivider).length || 0), 'of', allCategoryStories[categoryId]?.filter(item => !(item as any).__dateDivider).length || 0, 'cached stories. More available:', categoryHasMore[categoryId]);
    
    // Always slice to the requested limit, including date dividers in the correct positions
    const allItems = allCategoryStories[categoryId] || [];
    const storyCount = allItems.filter(item => !(item as any).__dateDivider).length;
    
    // Only show up to the requested limit of actual stories, but include date dividers
    if (storyCount > requestedLimit) {
        let storiesShown = 0;
        let sliceIndex = 0;
        
        for (let i = 0; i < allItems.length; i++) {
            if ((allItems[i] as any).__dateDivider) {
                // Include date divider
                sliceIndex = i + 1;
            } else {
                // Count actual story
                storiesShown++;
                if (storiesShown >= requestedLimit) {
                    sliceIndex = i + 1;
                    break;
                }
            }
        }
        
        stories = allItems.slice(0, sliceIndex);
        console.log('✂️ Sliced to show exactly', requestedLimit, 'stories with date dividers included');
    } else {
        stories = allItems;
        console.log('✅ Showing all', storyCount, 'cached stories (within limit)');
    }
        
        storiesLoading = false;

    } catch (error) {
        persistentLogMain('❌ Fatal error in loadStoriesForCategory', {
            category: categoryId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });        
        console.error('Error loading cross-day stories:', error);
        
        // Set hasMore to false to prevent further attempts that might cause more errors
        categoryHasMore[categoryId] = false;
        
        storiesLoading = false;
        
        // Don't rethrow the error to prevent page refresh
        // The UI will show what stories we have so far
    }
}

async function loadOnThisDayEvents() {
	try {
		onThisDayLoading = true;
		lastLoadedCategory = 'onthisday';
		
		// If we already have preloaded OnThisDay events, use them
		if (onThisDayEvents && onThisDayEvents.length > 0) {
			console.log('📅 Using preloaded OnThisDay events');
			// OnThisDay doesn't have read count or timestamp in the same format
			// We could add these later if needed
		} else {
			// Fall back to loading from API if not preloaded
			console.log('📅 Loading OnThisDay events from API');
			const events = await dataService.loadOnThisDayEvents(language.data);
			onThisDayEvents = events;
		}
	} catch (error) {
		console.error('Error loading OnThisDay events:', error);
		// Set empty array to show proper empty state
		onThisDayEvents = [];
	} finally {
		onThisDayLoading = false;
	}
}


onMount(() => {
	persistentLogMain('📱 Main page mounted');
	
	// Initialize time travel batch store and clear stale batches
	timeTravelBatch.init();
	if (timeTravelBatch.isStale()) {
		console.log('🗑️ Clearing stale time travel batch on page mount');
		timeTravelBatch.set(null);
		// Also clear the UI state
		timeTravel.reset();
	}
	
	// Check for data language in URL first
	const urlParams = parseInitialUrl();
	if (urlParams.dataLang && urlParams.dataLang !== language.data) {
		// Validate it's a supported language
		if (UrlNavigationService.isValidDataLanguage(urlParams.dataLang)) {
			console.log('Setting data language from URL on mount:', urlParams.dataLang);
			language.setData(urlParams.dataLang as SupportedLanguage);
		}
	}
	
	// Load saved read stories from localStorage
	try {
		const saved = localStorage.getItem('readStories');
		if (saved) {
			const savedReadStories = JSON.parse(saved);
			readStories = savedReadStories;
			// totalStoriesRead is now derived from readStories automatically
		}
	} catch (error) {
		console.error('Error loading saved stories:', error);
	}

	// Handle URL hash navigation
	function handleHashChange() {
		const hash = window.location.hash.slice(1); // Remove the #
		persistentLogMain('🔍 handleHashChange called', { hash });
		if (hash.startsWith('settings')) {
			// Extract tab name if provided (e.g., #settings/filter)
			const parts = hash.split('/');
			const tab = parts[1] || undefined;
			persistentLogMain('⚙️ Opening settings from hash', { tab });
			settings.open(tab);
			// Clear the hash without disrupting SvelteKit's router
			// Use a timeout to ensure the settings modal opens first
			setTimeout(() => {
				persistentLogMain('🔄 About to call goto to clear hash');
				import('$app/navigation').then(({ goto }) => {
					persistentLogMain('🔄 Calling goto to clear hash');
					goto(window.location.pathname + window.location.search, { replaceState: true, noscroll: true, keepfocus: true });
				});
			}, 50);
		}
	}

	// Check initial hash
	handleHashChange();

	// Listen for hash changes
	window.addEventListener('hashchange', handleHashChange);

	// Cleanup
	return () => {
		window.removeEventListener('hashchange', handleHashChange);
	};
});

// Helper functions
const getLastUpdated = $derived(lastUpdated || s('loading.default') || 'Loading...');
const parseInitialUrl = (): NavigationParams => {
	if (!browser) return {};
	const params = UrlNavigationService.parseUrl(page.url);
	console.log('🔍 Parsing URL:', page.url.href, 'Result:', params);
	return params;
};
const handleIntroClose = () => settings.setShowIntro(false);

// Handle category change
function handleCategoryChange(category: string, updateUrl: boolean = true) {
	persistentLogMain('🔄 handleCategoryChange called', {
		category,
		updateUrl,
		currentCategory,
		isNoChange: category === currentCategory
	});
	
	// Skip if no actual change needed
	if (category === currentCategory) {
		persistentLogMain('🚫 Skipping handleCategoryChange - no change needed');
		return;
	}
	
	// Execute state mutations immediately (removed setTimeout delay)
	persistentLogMain('🔄 handleCategoryChange executing immediately', { category, updateUrl });
	
	currentCategory = category;
	
	// Reset view mode when changing categories (when map view is implemented)
	// if (category.toLowerCase() !== 'world') {
	// 	viewMode = 'list';
	// }

	// Save current expanded state
	expandedStoriesByCategory[currentCategory] = { ...expandedStories };

	// Restore expanded stories for new category if available
	expandedStories = { ...(expandedStoriesByCategory[category] ?? {}) };
	
	// Clear temporary category if user manually navigates
	if (updateUrl && temporaryCategory) {
		categoriesStore.removeTemporary();
		temporaryCategory = null;
		showTemporaryCategoryTooltip = false;
	}

	// Update the effect tracking variable to prevent duplicate loading
	lastEffectLoadedCategory = category;
	
	// Load stories for the new category (will be instant for preloaded categories)
	persistentLogMain('🔄 About to call loadStoriesForCategory from handleCategoryChange');
	loadStoriesForCategory(category);
	
	// Update URL to reflect new category (unless we're handling a URL change)
	if (historyManager && updateUrl && !navigationHandlerService.isNavigating()) {
		persistentLogMain('🔄 About to call historyManager.updateUrl');
		historyManager.updateUrl({ categoryId: category, storyIndex: null });
	}
	
	// Chaos index is already loaded with the batch data
}

// Wikipedia popup handlers
const handleWikipediaClick = (title: string, content: string, imageUrl?: string) => {
	wikipediaPopup = { visible: true, title, content, imageUrl: imageUrl || '' };
};

const closeWikipediaPopup = () => {
	wikipediaPopup = { visible: false, title: '', content: '', imageUrl: '' };
};

// Clicking a story should expand/collapse it without triggering a full page navigation. 
// We therefore disable the automatic URL update that caused SvelteKit to reload the page.
function handleStoryToggle(storyId: string, updateUrl: boolean = false) {
    // Determine if clicked story is already expanded
    const currentlyExpanded = expandedStories[storyId];

    // Clone existing map
    const newExpandedStories: Record<string, boolean> = { ...expandedStories };

    if (currentlyExpanded) {
        // Collapse only this story
        delete newExpandedStories[storyId];

        if (updateUrl && historyManager) {
            historyManager.updateUrl({ storyIndex: null });
        }
    } else {
        // Expand clicked story in addition to others
        newExpandedStories[storyId] = true;

        // Mark as read
        const story = stories.find(
            (s) => s.cluster_number?.toString() === storyId || s.title === storyId,
        );
        if (story) {
            // Use the story ID for consistency instead of title
            const readStoryId = story.cluster_number?.toString() || story.title;
            readStories = { ...readStories, [readStoryId]: true };

            if (updateUrl && historyManager) {
                const storyIndex = stories.indexOf(story);
                const slug = story.title ? slugify(story.title) : undefined;
                // Prefer new slug-only URLs; keep numeric index out of the path
                historyManager.updateUrl({ storyIndex, slug });
            }
        }
    }

    expandedStories = newExpandedStories;
    // Persist per-category map
    expandedStoriesByCategory[currentCategory] = { ...expandedStories };
}

// Derived value for total stories read count
const totalStoriesRead = $derived(Object.values(readStories).filter(Boolean).length);

// Effect for saving to localStorage (side effects only, no state mutation)
$effect(() => {
	// Save to localStorage
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem('readStories', JSON.stringify(readStories));
	}
});

// Handle source overlay close
const handleCloseSource = () => {
	showSourceOverlay = false;
	currentSource = null;
	sourceArticles = [];
	currentMediaInfo = null;
	isLoadingMediaInfo = false;
};

// Handle navigation from URL changes
const handleUrlNavigation = async (params: NavigationParams) => {
	// Skip navigation processing during load more operations
	if (isLoadingMore) {
		persistentLogMain('🚫 Skipping URL navigation during load more operation', {
			params,
			isLoadingMore
		});
		return;
	}
	
	persistentLogMain('🔄 handleUrlNavigation called', {
		params,
		isLoadingMore
	});
	
	const updates = await navigationHandlerService.handleUrlNavigation(params, {
		currentBatchId,
		currentCategory,
		categories,
		stories,
		allCategoryStories,
		expandedStories,
		isLatestBatch
	}, {
		setDataLanguage: (lang: SupportedLanguage) => language.setData(lang),
		getCurrentDataLanguage: () => language.data,
		handleCategoryChange
	});
	
	// Apply state updates
	if (updates.isLatestBatch !== undefined) isLatestBatch = updates.isLatestBatch;
	if (updates.expandedStories !== undefined) {
		// Directly set the expanded stories from navigation
		expandedStories = updates.expandedStories;
	}
};

// Track last loaded category to prevent duplicate loads
let lastEffectLoadedCategory = $state('');

// Single consolidated effect to handle all category-related logic
$effect(() => {
	if (!browser || !dataLoaded) return;
	
	// Step 1: Initialize category if needed (only once)
	if (orderedCategories.length > 0 && 
	    !orderedCategories.find(cat => cat.id === currentCategory) &&
	    !(temporaryCategory && currentCategory === temporaryCategory)) {
		console.log(`🔧 Setting initial category to: ${orderedCategories[0].id}`);
		currentCategory = orderedCategories[0].id;
		return; // Exit early to let the effect re-run with the new category
	}
	
	// Step 2: Update swipe handler (side effect only)
	if (orderedCategories.length > 0 && currentCategory) {
		categorySwipeHandler.updateState(orderedCategories, currentCategory, handleCategoryChange);
	}
	
	// Step 3: Load stories if category is valid and hasn't been loaded by this effect
	if (currentCategory && 
	    currentCategory !== lastEffectLoadedCategory &&
	    orderedCategories.find(cat => cat.id === currentCategory)) {
		
		console.log(`🔧 Loading stories for category: ${currentCategory}`);
		lastEffectLoadedCategory = currentCategory;
		
		// Load stories without modifying reactive state
		queueMicrotask(() => {
			loadStoriesForCategory(currentCategory);
		});
	}
});

// If the temporary category gets permanently enabled by the user (e.g., via Settings),
// clear the temporary state so it no longer shows the tooltip.
$effect(() => {
    if (temporaryCategory && categoriesStore.enabled.includes(temporaryCategory)) {
        console.log('Temporary category now permanently enabled, cleaning up');
        categoriesStore.removeTemporary();
        temporaryCategory = null;
        showTemporaryCategoryTooltip = false;
    }
});
// Language changes are now handled by DataLoader through the reload service
// Chaos index will be reloaded with all other data when language changes

// Update reference element for tooltip whenever navigation or temporary category changes
$effect(() => {
	if (!browser) return;
	if (temporaryCategory && desktopCategoryNavigation) {
		temporaryCategoryElement = desktopCategoryNavigation.getCategoryElement(temporaryCategory);
	} else {
		temporaryCategoryElement = null;
	}
});

// Show tooltip only on hover/focus of the temporary category element
$effect(() => {
	if (!browser || !temporaryCategoryElement) return;

	const handleEnter = () => {
		showTemporaryCategoryTooltip = true;
	};
	const handleLeave = () => {
		showTemporaryCategoryTooltip = false;
	};

	temporaryCategoryElement.addEventListener('mouseenter', handleEnter);
	temporaryCategoryElement.addEventListener('focus', handleEnter);
	temporaryCategoryElement.addEventListener('mouseleave', handleLeave);
	temporaryCategoryElement.addEventListener('blur', handleLeave);

	// Cleanup listeners when element changes or component unmounts
	return () => {
		temporaryCategoryElement?.removeEventListener('mouseenter', handleEnter);
		temporaryCategoryElement?.removeEventListener('focus', handleEnter);
		temporaryCategoryElement?.removeEventListener('mouseleave', handleLeave);
		temporaryCategoryElement?.removeEventListener('blur', handleLeave);
	};
});

// Debug effect to track batch changes
$effect(() => {
    if (browser) {
        console.log('🔍 timeTravelBatch.batchId changed to:', timeTravelBatch.batchId);
    }
});

// Debug helper for testing (only in development)
if (browser && typeof window !== 'undefined') {
	(window as any).kiteDebug = {
		getCacheStats: getImageCacheStats,
		clearCache: clearImageCache,
		preloadCurrentCategory: () => imagePreloadingService.preloadCategory(stories),
		getCurrentStories: () => stories,
		getCurrentCategory: () => currentCategory,
		getAllCategoryStories: () => allCategoryStories,
		getPreloadedCategories: () => Object.keys(allCategoryStories),
		getImageUrls: () => {
			const allUrls: string[] = [];
			stories.forEach(story => {
				allUrls.push(...extractStoryImages(story));
			});
			return [...new Set(allUrls)];
		},
		getAllImageUrls: () => {
			const allUrls: string[] = [];
			Object.values(allCategoryStories).flat().forEach(story => {
				allUrls.push(...extractStoryImages(story));
			});
			return [...new Set(allUrls)];
		},
		showPreloadingSettings: () => {
			console.log('🔧 Enabling preloading settings tab');
			if ((window as any).kiteSettingsDebug && (window as any).kiteSettingsDebug.enablePreloadingTab) {
				(window as any).kiteSettingsDebug.enablePreloadingTab();
				console.log('✅ Preloading settings tab enabled permanently. Open settings to see it.');
				return '✅ Preloading tab enabled permanently. Open settings to see it.';
			} else {
				console.log('❌ Settings component not available. Please refresh and try again.');
				return '❌ Settings component not available. Please refresh and try again.';
			}
		},
		hidePreloadingSettings: () => {
			console.log('🔧 Disabling preloading settings tab');
			if ((window as any).kiteSettingsDebug && (window as any).kiteSettingsDebug.disablePreloadingTab) {
				(window as any).kiteSettingsDebug.disablePreloadingTab();
				console.log('✅ Preloading settings tab disabled.');
				return '✅ Preloading tab disabled.';
			} else {
				console.log('❌ Settings component not available. Please refresh and try again.');
				return '❌ Settings component not available. Please refresh and try again.';
			}
		}
	};
} 
</script>

<svelte:head>
	<title>{s('app.title') || 'Kite'} - {s('app.motto') || 'News. Elevated.'}</title>
</svelte:head>

<!-- DataLoader rendered both on server and client -->
<DataLoader 
    onDataLoaded={handleDataLoaded}
    onError={handleDataError}
    initialBatchId={parseInitialUrl().batchId}
    initialCategoryId={parseInitialUrl().categoryId}
/>

<!-- Client-only HistoryManager and main content -->
{#if dataLoaded}
    <ClientOnly>
        <HistoryManager
            bind:this={historyManager}
            batchId={isLatestBatch ? null : currentBatchId}
            categoryId={currentCategory}
            onNavigate={handleUrlNavigation}
        />
    </ClientOnly>

    <!-- Category Navigation - Mobile only (fixed positioning) -->
	<div class="md:hidden">
		<CategoryNavigation 
			categories={orderedCategories}
			{currentCategory} 
			onCategoryChange={handleCategoryChange}
			mobilePosition={categoryHeaderPosition}
			temporaryCategory={temporaryCategory}
			showTemporaryTooltip={false}
		/>
	</div>

	<!-- Main Content -->
	<main 
		class="pb-[56px] md:pb-0 {categoryHeaderPosition === 'top' ? 'pt-12 md:pt-0' : ''}"
		ontouchstart={categorySwipeHandler.handleTouchStart}
		ontouchend={categorySwipeHandler.handleTouchEnd}
	>
		<div class="container mx-auto max-w-[732px] px-4 py-8">
			<Header 
				{offlineMode} 
				{totalReadCount} 
				{totalStoriesRead} 
				{getLastUpdated}
				{chaosIndex}
			/>
			
			<!-- Category Navigation - Desktop (normal document flow) -->
			<div class="hidden md:block">
				<CategoryNavigation 
					bind:this={desktopCategoryNavigation}
					categories={orderedCategories}
					{currentCategory} 
					onCategoryChange={handleCategoryChange}
					mobilePosition="bottom"
					temporaryCategory={temporaryCategory}
					showTemporaryTooltip={showTemporaryCategoryTooltip}
				/>
			</div>
			
			<div>
			<!-- News Content -->
				{#if currentCategory === 'onthisday'}
					<OnThisDay 
						stories={onThisDayEvents}
						isLoading={onThisDayLoading}
						onWikipediaClick={handleWikipediaClick}
						onRetry={loadOnThisDayEvents}
					/>
				{:else}
					<StoryList 
						{stories}
						{currentCategory}
						batchId={currentBatchId}
						{expandedStories}
						onStoryToggle={handleStoryToggle}
						bind:readStories
						bind:showSourceOverlay
						bind:currentSource
						bind:sourceArticles
						bind:currentMediaInfo
						bind:isLoadingMediaInfo
						onLoadMore={handleLoadMore}
						canLoadMore={categoryHasMore[currentCategory]}
						isLoading={storiesLoading}
					/>
				{/if}
			</div>
			

			
			<!-- Footer -->
			<Footer 
				{currentCategory}
				onShowAbout={() => settings.setShowIntro(true)}
			/>
		</div>
	</main>
{/if}

<!-- Settings Modal -->
<Settings 
	visible={settings.isOpen} 
	{categories}
	onClose={() => settings.close()}
	onShowAbout={() => { settings.close(); settings.setShowIntro(true); }}
/>

<!-- Time Travel Modal -->
<TimeTravel />

<!-- Source Overlay -->
<SourceOverlay 
	isOpen={showSourceOverlay}
	{currentSource}
	{sourceArticles}
	{currentMediaInfo}
	{isLoadingMediaInfo}
	onClose={handleCloseSource}
/>

<!-- Wikipedia Popup -->
<WikipediaPopup 
	visible={wikipediaPopup.visible}
	title={wikipediaPopup.title}
	content={wikipediaPopup.content}
	imageUrl={wikipediaPopup.imageUrl}
	onClose={closeWikipediaPopup}
/>

<!-- Temporary Category Tooltip -->
<TemporaryCategoryTooltip 
	show={showTemporaryCategoryTooltip}
	referenceElement={temporaryCategoryElement}
/>

<!-- Intro Screen Modal -->
<IntroScreen 
	visible={settings.showIntro}
	onClose={handleIntroClose}
/>