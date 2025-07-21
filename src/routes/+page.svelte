<script lang="ts">
import { onMount } from 'svelte';
import { browser } from '$app/environment';
import { page } from '$app/state';
import { dataLanguage } from '$lib/stores/dataLanguage.svelte.js';
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
import type { Category, Story, OnThisDayEvent } from '$lib/types';

import DataLoader from '$lib/components/DataLoader.svelte';
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
let stories = $state<Story[]>([]);
let onThisDayEvents = $state<OnThisDayEvent[]>([]);
let readStories = $state<Record<string, boolean>>({});
let totalReadCount = $state(0);
// totalStoriesRead is now a derived value based on readStories
let lastUpdated = $state('');
let allCategoryStories = $state<Record<string, Story[]>>({});
let categoryMap = $state<Record<string, string>>({});  // Map category ID to UUID
let currentBatchId = $state<string>('');
let categoryHasMore = $state<Record<string, boolean>>({});
let categoryLimits = $state<Record<string, number>>({});
let catBatches = $state<Record<string, string[]>>({});
let catBatchesIndex = $state<Record<string, number>>({});
// List of batch IDs (newest first) for cross-day fetching
let batchList = $state<string[]>([]);
let batchesLoaded = $state(false);

// Flag to show loading indicator when switching categories or fetching more
let storiesLoading = $state<boolean>(false);

async function fetchBatchList() {
    if (batchesLoaded) return;
    try {
        const resp = await fetch(`/api/batches?lang=${dataLanguage.current}`);
        if (resp.ok) {
            const data = await resp.json();
            batchList = data.batches.map((b: any) => b.id);
            batchesLoaded = true;
        }
    } catch (err) {
        console.error('Failed to fetch batch list', err);
    }
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
		// Temporary category should appear where it would naturally fit
		if (a.id === temporaryCategory) return -1;
		if (b.id === temporaryCategory) return 1;
		
		const aIndex = categoriesStore.enabled.findIndex(id => id === a.id);
		const bIndex = categoriesStore.enabled.findIndex(id => id === b.id);
		return aIndex - bIndex;
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
}) {
	// Reset app state for fresh data
	expandedStories = {};
	lastLoadedCategory = '';
	
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
		showTemporaryCategoryTooltip = true;
	}
	
	dataLoaded = true;
	
	console.log(`🚀 Loaded ${Object.keys(allCategoryStories).length} categories with ${Object.values(allCategoryStories).flat().length} total stories`);
	
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

    // Fetch list of batches for cross-day load
    fetchBatchList();
}

function handleDataError(error: string) {
	console.error('Data loading error:', error);
	// Could show error state here if needed
	dataLoaded = true; // Still show the app with fallback data
}

// Triggered by StoryList load more
function handleLoadMore() {
    loadStoriesForCategory(currentCategory, true);
}

async function loadStoriesForCategory(categoryId: string, increment: boolean = false) {
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
    }
    if (increment) {
        categoryLimits[categoryId] += settings.storyCount;
    }

    let requestedLimit = categoryLimits[categoryId];

    // If we already have enough, just slice
    if (allCategoryStories[categoryId] && allCategoryStories[categoryId].length >= requestedLimit) {
        stories = allCategoryStories[categoryId];
        lastLoadedCategory = categoryId;
        storiesLoading = false;
        return;
    }

    // Ensure batch list ready
    await fetchBatchList();

    // Track batches consumed for this category
    if (!catBatches[categoryId]) catBatches[categoryId] = [currentBatchId];
    if (!catBatchesIndex[categoryId]) catBatchesIndex[categoryId] = 0;

    try {
        lastLoadedCategory = categoryId;

        // Continue fetching from batches until we reach requestedLimit or no more batches
        let currentIndex = 0;
        if (catBatchesIndex[categoryId] === undefined) catBatchesIndex[categoryId] = 0;

        while (allCategoryStories[categoryId]?.length < requestedLimit && catBatchesIndex[categoryId] < batchList.length) {
            const batchId = batchList[catBatchesIndex[categoryId]];

            // Obtain category uuid for this batch
            let catUuid: string | null = null;
            if (batchId === currentBatchId) {
                catUuid = categoryMap[categoryId];
            } else {
                try {
                    const resp = await fetch(`/api/batches/${batchId}/categories?lang=${dataLanguage.current}`);
                    if (resp.ok) {
                        const data = await resp.json();
                        const catObj = (data.categories || data).find((c: any)=> c.id === categoryId || c.categoryId === categoryId);
                        catUuid = catObj?.id || catObj?.uuid;
                    }
                } catch(err) { console.warn('Failed to fetch categories for batch', batchId, err); }
            }

            if (!catUuid) {
                // Fallback: try using the category slug directly
                catUuid = categoryId;
            }

            const remainingNeeded = requestedLimit - (allCategoryStories[categoryId]?.length || 0);
            const fetchAmount = Math.min(settings.storyCount, remainingNeeded);

            const result = await dataService.loadStories(batchId, catUuid, fetchAmount, dataLanguage.current);
            if (!allCategoryStories[categoryId]) allCategoryStories[categoryId] = [];

            if (result.stories.length > 0) {
                // Insert date divider when starting new batch (if not latest)
                if (batchId !== currentBatchId && !catBatches[categoryId]?.includes(batchId)) {
                    allCategoryStories[categoryId].push({ __dateDivider: true, date: batchId } as any);
                    catBatches[categoryId].push(batchId);
                }
                allCategoryStories[categoryId].push(...result.stories);
            }

            catBatchesIndex[categoryId]++;

            if (result.stories.length < fetchAmount) {
                // No more stories in this batch, will move to next on next loop
                continue;
            }
        }

        // Update hasMore flag
        // Allow further loading as long as there are still batches left to inspect
        categoryHasMore[categoryId] = catBatchesIndex[categoryId] < batchList.length;

        stories = allCategoryStories[categoryId];
        storiesLoading = false;

    } catch (error) {
        console.error('Error loading cross-day stories:', error);
        storiesLoading = false;
    }
}

async function loadOnThisDayEvents() {
	try {
		lastLoadedCategory = 'onthisday';
		const events = await dataService.loadOnThisDayEvents(dataLanguage.current);
		onThisDayEvents = events;
		// OnThisDay doesn't have read count or timestamp in the same format
		// We could add these later if needed
	} catch (error) {
		console.error('Error loading OnThisDay events:', error);
		// Keep existing events on error
	}
}


onMount(() => {
	// Check for data language in URL first
	const urlParams = parseInitialUrl();
	if (urlParams.dataLang && urlParams.dataLang !== dataLanguage.current) {
		// Validate it's a supported language
		if (UrlNavigationService.isValidDataLanguage(urlParams.dataLang)) {
			console.log('Setting data language from URL on mount:', urlParams.dataLang);
			dataLanguage.set(urlParams.dataLang as SupportedLanguage);
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
		if (hash.startsWith('settings')) {
			// Extract tab name if provided (e.g., #settings/filter)
			const parts = hash.split('/');
			const tab = parts[1] || undefined;
			settings.open(tab);
			// Clear the hash without disrupting SvelteKit's router
			import('$app/navigation').then(({ goto }) => {
				goto(window.location.pathname + window.location.search, { replaceState: true, noscroll: true, keepfocus: true });
			});
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
const parseInitialUrl = (): NavigationParams => browser ? UrlNavigationService.parseUrl(page.url) : {};
const handleIntroClose = () => settings.setShowIntro(false);

// Handle category change
function handleCategoryChange(category: string, updateUrl: boolean = true) {
	// Defer state mutations to avoid issues when called from effects or async contexts
	setTimeout(() => {
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

		// Load stories for the new category (will be instant for preloaded categories)
		loadStoriesForCategory(category);
		
		// Update URL to reflect new category (unless we're handling a URL change)
		if (historyManager && updateUrl && !navigationHandlerService.isNavigating()) {
			historyManager.updateUrl({ categoryId: category, storyIndex: null });
		}
		
		// Chaos index is already loaded with the batch data
	}, 0);
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
            readStories = { ...readStories, [story.title]: true };

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
	const updates = await navigationHandlerService.handleUrlNavigation(params, {
		currentBatchId,
		currentCategory,
		categories,
		stories,
		allCategoryStories,
		expandedStories,
		isLatestBatch
	}, {
		setDataLanguage: (lang: SupportedLanguage) => dataLanguage.set(lang),
		getCurrentDataLanguage: () => dataLanguage.current,
		handleCategoryChange
	});
	
	// Apply state updates
	if (updates.isLatestBatch !== undefined) isLatestBatch = updates.isLatestBatch;
	if (updates.expandedStories !== undefined) {
		// Directly set the expanded stories from navigation
		expandedStories = updates.expandedStories;
	}
};

// Effect for state updates (category initialization) - runs before DOM updates
$effect.pre(() => {
	if (!dataLoaded) return;
	
	// Initialize category if needed
	// Don't reset if we have a temporary category that matches current
	if (orderedCategories.length > 0 && 
	    !orderedCategories.find(cat => cat.id === currentCategory) &&
	    !(temporaryCategory && currentCategory === temporaryCategory)) {
		currentCategory = orderedCategories[0].id;
	}
});

// Effect for side effects (swipe handler and loading stories)
$effect(() => {
	if (!dataLoaded) return;
	
	// Update swipe handler
	if (orderedCategories.length > 0) {
		categorySwipeHandler.updateState(orderedCategories, currentCategory, handleCategoryChange);
	}
	
	// Load stories if category is valid 
	if (currentCategory && orderedCategories.find(cat => cat.id === currentCategory)) {
		loadStoriesForCategory(currentCategory);
		// Removed chaos index loading here - it's already loaded from DataLoader
	}
});

// Language changes are now handled by DataLoader through the reload service
// Chaos index will be reloaded with all other data when language changes

// Update temporary category element reference when needed
$effect.pre(() => {
	if (temporaryCategory && desktopCategoryNavigation && showTemporaryCategoryTooltip) {
		temporaryCategoryElement = desktopCategoryNavigation.getCategoryElement(temporaryCategory);
	} else {
		temporaryCategoryElement = null;
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

{#if !dataLoaded}
	{@const initialUrlParams = parseInitialUrl()}
	<DataLoader 
		onDataLoaded={handleDataLoaded}
		onError={handleDataError}
		initialBatchId={initialUrlParams.batchId}
		initialCategoryId={initialUrlParams.categoryId}
	/>
{:else}
	<!-- History Manager for URL state -->
	<HistoryManager
		bind:this={historyManager}
		batchId={isLatestBatch ? null : currentBatchId}
		categoryId={currentCategory}
		onNavigate={handleUrlNavigation}
	/>
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
						onWikipediaClick={handleWikipediaClick}
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