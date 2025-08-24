<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { s } from '$lib/client/localization.svelte';
	import { dataService, dataReloadService } from '$lib/services/dataService';
	import { language } from '$lib/stores/language.svelte.js';
	import { categories as categoriesStore } from '$lib/stores/categories.svelte.js';
	import { sections } from '$lib/stores/sections.svelte.js';
	import { settings } from '$lib/stores/settings.svelte.js';
	import { imagePreloadingService } from '$lib/services/imagePreloadingService.js';
	import { timeTravelBatch } from '$lib/stores/timeTravelBatch.svelte.js';
	import { timeTravel } from '$lib/stores/timeTravel.svelte.js';
	import { formatTimeAgo } from '$lib/utils/formatTimeAgo';
	import { onThisDayService } from '$lib/services/onThisDayService.js';
	import { testConnectionQuality } from '$lib/utils/fetchWithRetry.js';
	import type { Category, Story, OnThisDayEvent } from '$lib/types';
	import SplashScreen from './SplashScreen.svelte';

	// Props
	interface Props {
		onDataLoaded?: (data: {
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
		}) => void;
		onError?: (error: string) => void;
		initialBatchId?: string | null;
		initialCategoryId?: string | null;
	}

	const { onDataLoaded, onError, initialBatchId, initialCategoryId }: Props = $props();

	// Flag to hide progress/details on warm cache loads
	let skipProgressDetails = false;

	// Check for post-maintenance flag immediately to avoid flash
	// Only consider it valid if it's recent (within 30 seconds)
	const checkPostMaintenance = () => {
		if (typeof localStorage === 'undefined') return false;
		const flag = localStorage.getItem('kite-post-maintenance');
		if (!flag) return false;
		
		const timestamp = parseInt(flag);
		const now = Date.now();
		const isRecent = (now - timestamp) < 30000; // 30 seconds
		
		if (!isRecent) {
			// Clean up old flag
			localStorage.removeItem('kite-post-maintenance');
			return false;
		}
		
		return true;
	};
	
	const isPostMaintenance = checkPostMaintenance();
	
	// Persistent logging function for DataLoader
	const persistentLogDataLoader = (message: string, data?: any) => {
		if (typeof window === 'undefined') return;
		
		const timestamp = new Date().toISOString();
		const logEntry = { timestamp, message: `[DATALOADER] ${message}`, data, url: window.location.href };
		
		try {
			const logs = JSON.parse(localStorage.getItem('kite-debug-logs') || '[]');
			logs.push(logEntry);
			if (logs.length > 50) logs.splice(0, logs.length - 50);
			localStorage.setItem('kite-debug-logs', JSON.stringify(logs));
		} catch (e) {
			console.warn('Failed to save persistent log:', e);
		}
		
		console.log(`[PERSISTENT DATALOADER] ${message}`, data || '');
	};

	// Track DataLoader initialization
	persistentLogDataLoader('🚀 DataLoader component initializing', {
		timestamp: Date.now(),
		isPostMaintenance,
		initialBatchId,
		initialCategoryId,
		url: typeof window !== 'undefined' ? window.location.href : 'server'
	});

	// Determine initial loading flag - always start with true for SSR compatibility
	const shouldShowInitialLoading = (() => {
	    // Always start with loading on server-side
	    if (typeof window === 'undefined') {
	        console.log('🔧 Server-side: Will show initial loading');
	        return true;
	    }
	    
	    if (isPostMaintenance) {
	        console.log('🔧 Skipping initial loading: post-maintenance detected');
	        persistentLogDataLoader('🔧 Skipping initial loading: post-maintenance detected');
	        return false;
	    }
	    
	    // Check if we already have cached data from a previous DataLoader instance
	    const hasCachedData = typeof window !== 'undefined' && window.localStorage.getItem('kite-has-loaded-data') === 'true';

	    // We keep showing the splash screen with full progress even on warm loads
	    return true;
	})();

	// Loading state
	let initialLoading = $state(shouldShowInitialLoading);
	let loadingProgress = $state(0);
	let hasError = $state(false);
	let errorMessage = $state('');

	// Set an initial loading stage right away. This avoids mutating state from inside a $effect,
	// which is disallowed in Svelte 5.
	let loadingStage = $state(s('loading.initializing') || 'Initializing...');

	// Data state
	let categories = $state<Category[]>([]);
	let stories = $state<Story[]>([]);
	let totalReadCount = $state(0);
	let lastUpdated = $state('');
	let currentCategory = $state('');
	let allCategoryStories = $state<Record<string, Story[]>>({});
	let isLatestBatch = $state(true);
	let onThisDayEvents = $state<OnThisDayEvent[]>([]);
	let storiesToPreloadIcons = $state<Story[]>([]);

	// Add afterInitial flag
	let afterInitial = $state(false);

	// When initial load completes, mark afterInitial
	// (we will add after the first initialLoading=false)

	// Retry state for loadInitialData function
	let retryCount = $state(0);
	let retryTimeout = $state<NodeJS.Timeout | null>(null);
	let connectionQuality = $state<'excellent' | 'good' | 'fair' | 'poor' | null>(null);
	let isSlowConnection = $state(false);

	// Helper function to get the first enabled category in user-defined order
	function getFirstEnabledCategory(availableCategories: Category[]): string {
		// Get enabled categories in user-defined order (categoriesStore.enabled is already ordered)
		const enabledCategoryIds = categoriesStore.enabled;
		
		// Find the first enabled category that exists in available categories
		for (const categoryId of enabledCategoryIds) {
			if (availableCategories.some(cat => cat.id === categoryId)) {
				console.log(`✨ Using first enabled category from user order: ${categoryId}`);
				return categoryId;
			}
		}
		
		// Fallback 1: Try 'World' if available
		if (availableCategories.some(cat => cat.id === 'World')) {
			console.log(`🌍 No enabled categories available, falling back to 'World'`);
			return 'World';
		}
		
		// Fallback 2: Use first available category
		const fallback = availableCategories.length > 0 ? availableCategories[0].id : 'World';
		console.log(`🔄 Using first available category as fallback: ${fallback}`);
		return fallback;
	}

	// Function to preload all images for stories with timeout handling
	async function preloadCategoryImages(stories: Story[]) {
		// Set a fallback timeout that's shorter than the service timeout
		const fallbackTimeout = new Promise<void>((resolve) => {
			setTimeout(() => {
				console.log('⏱️ Fallback timeout reached, continuing with loading...');
				// Bump progress so the splash doesn’t stall mid-way
				loadingProgress = Math.max(loadingProgress, 85);
				resolve();
			}, 300); // Reduced to 300ms to prevent blank page delays
		});
		
		try {
			await Promise.race([
				imagePreloadingService.preloadCategory(stories),
				fallbackTimeout
			]);
		} catch (error) {
			console.warn('Image preloading failed, continuing without cache:', error);
		}
	}

	// Main data loading function
	async function loadInitialData() {
		persistentLogDataLoader('🔄 loadInitialData() called', {
			timestamp: Date.now(),
			retryCount,
			callStack: new Error().stack?.split('\n').slice(1, 5).join(' | ') // Show first few stack frames
		});
		
		try {
			// Test connection quality on first attempt
			if (retryCount === 0) {
				loadingStage = s('loading.testing') || 'Testing connection...';
				loadingProgress = 5;
				
				try {
					const connectionTest = await testConnectionQuality();
					connectionQuality = connectionTest.quality;
					isSlowConnection = connectionTest.quality === 'poor' || connectionTest.quality === 'fair';
					
					if (isSlowConnection) {
						console.log(`🐌 Slow connection detected (${connectionTest.quality}, ${Math.round(connectionTest.responseTime)}ms). Using extended timeouts.`);
					} else {
						console.log(`⚡ Good connection detected (${connectionTest.quality}, ${Math.round(connectionTest.responseTime)}ms).`);
					}
				} catch (error) {
					console.warn('Connection test failed, assuming poor connection:', error);
					connectionQuality = 'poor';
					isSlowConnection = true;
				}
			}
			
			// Skip separate story-loading stage – SplashScreen handles all loading UI
			loadingStage = '';
			loadingProgress = 30;

			console.log('🚀 Starting initial data load from kite.kagi.com');

			// Store batch info to avoid duplicate API calls
			let providedBatchInfo: { id: string; createdAt: string; totalReadCount?: number } | undefined;
			
			// Check if we have a batch ID from URL
			if (initialBatchId) {
				// First, resolve the batch ID if it's a date format
				let resolvedBatchId = initialBatchId;
				if (/^\d{4}-\d{2}-\d{2}$/.test(initialBatchId)) {
					console.log('🔍 Resolving date-based batch ID:', initialBatchId);
					const { resolveBatchId } = await import('$lib/utils/urlShortener');
					const resolved = await resolveBatchId(initialBatchId);
					if (resolved) {
						resolvedBatchId = resolved;
						console.log('✅ Resolved to UUID:', resolvedBatchId);
					} else {
						console.warn('⚠️ Could not resolve batch date, falling back to latest');
						resolvedBatchId = null;
					}
				}
				
				if (resolvedBatchId) {
					// Get the latest batch to compare
					const latestResponse = await fetch(`/api/batches/latest?lang=${language.data}`);
					if (latestResponse.ok) {
						const latestBatch = await latestResponse.json();
						
						// Only set time travel mode if this is NOT the latest batch
						if (resolvedBatchId !== latestBatch.id) {
							console.log('🎯 Setting time travel mode for historical batch:', resolvedBatchId);
							dataService.setTimeTravelBatch(resolvedBatchId);
							isLatestBatch = false;
							
							// Also set the time travel UI state so the banner shows
							// We need to get the batch info to set the correct date
							try {
								const batchResponse = await fetch(`/api/batches/${resolvedBatchId}`);
								if (batchResponse.ok) {
									const batchData = await batchResponse.json();
									const batchDate = new Date(batchData.createdAt);
									console.log('🎯 Setting time travel UI state for date:', batchDate);
									timeTravel.selectDate(batchDate);
									timeTravel.selectBatch(resolvedBatchId);
									
									// Store the batch info to pass to batchService
									providedBatchInfo = { id: batchData.id, createdAt: batchData.createdAt, totalReadCount: batchData.totalReadCount };
								}
							} catch (error) {
								console.warn('Failed to get batch info for time travel UI:', error);
							}
						} else {
							console.log('🎯 Batch from URL is the latest batch, not setting time travel mode');
							isLatestBatch = true;
							// Store the latest batch info to avoid duplicate fetch
							providedBatchInfo = { id: latestBatch.id, createdAt: latestBatch.createdAt, totalReadCount: latestBatch.totalReadCount };
						}
					}
				} else {
					// resolvedBatchId is null (couldn't resolve date), fall back to latest
					console.log('🎯 Could not resolve batch ID, falling back to latest');
					isLatestBatch = true;
				}
			} else {
				// No batch ID in URL means we're viewing the latest
				isLatestBatch = true;
			}

			// Load initial data (batch info + categories) - pass batch info if we have it
			const initialData = await dataService.loadInitialData(language.data, providedBatchInfo);
			categories = initialData.categories;
			const { batchId, categoryMap, chaosIndex, chaosDescription, chaosLastUpdated } = initialData;
			totalReadCount = initialData.totalReadCount;
			
			// Initialize categories store with loaded data
			categoriesStore.setAllCategories(categories);
			categoriesStore.init();
			categoriesStore.initWithDefaults();
			
			// Filter enabled categories to only those that exist in the current batch
			const availableCategoryIds = categories.map(cat => cat.id);
			const validEnabledCategories = categoriesStore.enabled.filter(catId => 
				availableCategoryIds.includes(catId)
			);
			
			// Debug logging for historical batch category issues
			if (!isLatestBatch) {
				console.log('🕰️ Loading historical batch:', batchId);
				console.log('📋 Available categories in historical batch:', availableCategoryIds);
				console.log('⚙️ User enabled categories:', categoriesStore.enabled);
				console.log('✅ Valid enabled categories for this batch:', validEnabledCategories);
			}
			
			// Update enabled categories to remove any that don't exist in current batch
			if (validEnabledCategories.length !== categoriesStore.enabled.length) {
				const missingCategories = categoriesStore.enabled.filter(cat => !availableCategoryIds.includes(cat));
				console.warn('⚠️ Some enabled categories are not available in current batch:', missingCategories);
				console.log('🔧 Updating enabled categories from', categoriesStore.enabled, 'to', validEnabledCategories);
				categoriesStore.setEnabled(validEnabledCategories);
			}
			
			// Ensure we have at least one valid category
			if (validEnabledCategories.length === 0) {
				console.warn('⚠️ No enabled categories available in batch, using first available category');
				if (categories.length > 0) {
					categoriesStore.setEnabled([categories[0].id]);
					validEnabledCategories.push(categories[0].id);
				}
			}
			
			// Initialize sections store
			sections.init();
			
			// Get only enabled categories except OnThisDay (case-insensitive)
			// Use validEnabledCategories to ensure we only try to load existing categories
			const enabledCategories = validEnabledCategories.filter(cat => 
				cat.toLowerCase() !== 'onthisday'
			);
			
			console.log(`📦 Preloading enabled categories: ${enabledCategories.join(', ')} (${enabledCategories.length} categories)`);
			
			// If we have a category from URL that's not enabled, we need to include it
			const categoriesToLoad = [...enabledCategories];
			let temporaryCategoryId: string | null = null;
			
			if (initialCategoryId && !enabledCategories.includes(initialCategoryId)) {
				// Check if this category exists in the available categories
				if (availableCategoryIds.includes(initialCategoryId)) {
					console.log('Including non-enabled category from URL:', initialCategoryId);
					categoriesToLoad.push(initialCategoryId);
					temporaryCategoryId = initialCategoryId;
					// Temporarily add to enabled categories so it shows in the navigation
					categoriesStore.addTemporary(initialCategoryId);
				}
			}
			
			// Use category from URL if provided, otherwise default to first enabled category
			const targetCategory = initialCategoryId || getFirstEnabledCategory(categories);
			currentCategory = targetCategory;
			
			console.log(`🎯 Target category set to: ${targetCategory} ${initialCategoryId ? '(from URL)' : '(first enabled)'}`);

			// Load stories for enabled categories only (plus any from URL)
			const categoryPromises = categoriesToLoad.map(async (categoryId) => {
				if (categoryId.toLowerCase() === 'onthisday') {
					return { categoryId, stories: [], readCount: 0, timestamp: Date.now() / 1000 };
				}

				// Add timeout wrapper for historical batch loading
				const loadWithTimeout = async (): Promise<{ categoryId: string, stories: Story[], readCount: number, timestamp: number }> => {
					try {
						const categoryUuid = categoryMap[categoryId];
						if (!categoryUuid) {
							console.warn(`Category UUID not found for ${categoryId} in batch ${batchId}`);
							return { categoryId, stories: [], readCount: 0, timestamp: Date.now() / 1000 };
						}
						
						console.log(`📦 Loading stories for category ${categoryId} from batch ${batchId}...`);
						const result = await dataService.loadStories(batchId, categoryUuid, settings.storyCount, language.data);
						console.log(`✅ Loaded ${result.stories.length} stories for category ${categoryId}`);
						return { categoryId, stories: result.stories, readCount: result.readCount, timestamp: result.timestamp };
					} catch (error) {
						console.warn(`❌ Failed to load stories for category ${categoryId} from batch ${batchId}:`, error);
						return { categoryId, stories: [], readCount: 0, timestamp: Date.now() / 1000 };
					}
				};

				// Add timeout to prevent getting stuck on historical batches
				const timeoutPromise = new Promise<{ categoryId: string, stories: Story[], readCount: number, timestamp: number }>((resolve) => {
					setTimeout(() => {
						console.warn(`⏰ Timeout loading category ${categoryId} from batch ${batchId}, returning empty result`);
						resolve({ categoryId, stories: [], readCount: 0, timestamp: Date.now() / 1000 });
					}, 1000); // Reduced to 1 second to prevent blank page delays
				});

				return Promise.race([loadWithTimeout(), timeoutPromise]);
			});

			// Load OnThisDay events only if available AND enabled by user
			const onThisDayPromise = async (): Promise<OnThisDayEvent[]> => {
				const isOnThisDayEnabled = validEnabledCategories.some(cat => cat.toLowerCase() === 'onthisday');
				if (!initialData.hasOnThisDay || !isOnThisDayEnabled) {
					console.log('📅 OnThisDay is disabled or not available for this batch');
					return [];
				}
				
				console.log('📅 OnThisDay is enabled - loading events...');
				try {
					const events = await onThisDayService.loadOnThisDayEvents(language.data);
					console.log(`✅ Loaded ${events.length} OnThisDay events`);
					return events;
				} catch (error) {
					console.warn('Failed to load OnThisDay events:', error);
					return [];
				}
			};

			// Track progress during category loading
			let loadedCategories = 0;
			const totalCategories = categoriesToLoad.length;
			
			const trackingPromises = categoryPromises.map(async (promise, index) => {
				const result = await promise;
				loadedCategories++;
				loadingProgress = 30 + (loadedCategories / totalCategories) * 30; // 30-60% for category loading
				loadingStage = `Loading categories... (${loadedCategories}/${totalCategories})`;
				console.log(`📊 Category loading progress: ${loadedCategories}/${totalCategories} (${Math.round(loadingProgress)}%)`);
				return result;
			});

			// Use Promise.allSettled to prevent getting stuck if some categories fail
			const [categoryResults, onThisDayEventsResult] = await Promise.all([
				Promise.allSettled(trackingPromises).then(results => {
					const successful = results
						.filter(result => result.status === 'fulfilled')
						.map(result => (result as PromiseFulfilledResult<any>).value);
					
					const failed = results.filter(result => result.status === 'rejected');
					if (failed.length > 0) {
						console.warn(`⚠️ ${failed.length} categories failed to load, continuing with ${successful.length} successful`);
						failed.forEach((result, index) => {
							console.error(`❌ Category ${index} failed:`, (result as PromiseRejectedResult).reason);
						});
					}
					
					return successful;
				}),
				onThisDayPromise()
			]);

			// Set OnThisDay events
			onThisDayEvents = onThisDayEventsResult;
			
			// Store all category stories
			allCategoryStories = {};
			let maxTimestamp = 0;
			let totalReadCountSum = 0;
			
			for (const result of categoryResults) {
				// Ensure story uniqueness by cluster_number or title
				const uniqueStories = result.stories.filter((story, index, arr) => {
					const storyId = story.cluster_number?.toString() || story.title;
					return arr.findIndex(s => (s.cluster_number?.toString() || s.title) === storyId) === index;
				});
				
				allCategoryStories[result.categoryId] = uniqueStories;
				maxTimestamp = Math.max(maxTimestamp, result.timestamp);
				totalReadCountSum += result.readCount;
			}

			// Set initial display to target category (from URL or first enabled)
			stories = allCategoryStories[targetCategory] || [];
			// Pass stories to preload icons for
			storiesToPreloadIcons = stories;
			// Use batch totalReadCount if available, otherwise fall back to sum
			if (!totalReadCount || totalReadCount === 0) {
				totalReadCount = totalReadCountSum;
			}
			lastUpdated = formatTimeAgo(maxTimestamp, s);

			// Image preloading is now handled by the service which checks time travel mode internally
			loadingStage = s('loading.images') || 'Preloading first category images...';
			loadingProgress = 65; // start image phase above 50% so bar continues moving
			
			// Skip progress animation - jump directly to 85% for instant loading
			loadingProgress = 85;

			// Only preload images for the first category to keep initial load fast
			// Skip image preloading for post-maintenance loads since images should be cached
			if (!isPostMaintenance) {
				const firstCategoryStories = allCategoryStories[targetCategory] || [];
				console.log(`📦 Preloading images for first category: ${targetCategory} (${firstCategoryStories.length} stories)`);
				console.log(`📚 Enabled categories preloaded: ${enabledCategories.length} (${Object.values(allCategoryStories).flat().length} total stories)`);
				
				if (firstCategoryStories.length > 0) {
					try {
						await preloadCategoryImages(firstCategoryStories);
						console.log('✅ Image preloading completed successfully');
					} catch (error) {
						console.warn('⚠️ Image preloading failed or timed out, continuing with loading:', error);
						// Continue loading even if image preloading fails/times out
					}
				}
			} else {
				console.log('🔄 Post-maintenance load - skipping image preloading (using cache)');
			}

			// Set progress to 85% after image step (no animation needed)
			loadingProgress = Math.max(loadingProgress, 85);

			loadingStage = s('loading.finishing') || 'Finishing up...';
			loadingProgress = 90;
			
			loadingProgress = 100;
			loadingStage = s('loading.ready') || 'Ready!';

			// Mark that we have loaded data to prevent flash on future DataLoader remounts
			if (typeof window !== 'undefined') {
				window.localStorage.setItem('kite-has-loaded-data', 'true');
				persistentLogDataLoader('✅ Marked data as loaded in localStorage to prevent future flashes');
			}

			// Skip delay for post-maintenance loads for faster transition
			const finishLoading = () => {
				if (onDataLoaded) {
					onDataLoaded({
						categories,
						stories,
						totalReadCount,
						lastUpdated,
						currentCategory,
						allCategoryStories, // Pass all preloaded stories
						categoryMap,
						batchId,
						chaosIndex,
						chaosDescription,
						chaosLastUpdated,
						isLatestBatch,
						temporaryCategory: temporaryCategoryId,
						onThisDayEvents
					});
				}

				// Hide splash screen only after parent processed data
				initialLoading = false;
				afterInitial = true; // Mark after initial load completes
			};

			// Execute finishLoading immediately - no delays
			finishLoading();

		} catch (error) {
			console.error('Error loading initial data:', error);
			
			// Enhanced network error detection
			const isNetworkError = error instanceof Error && (
				error.message.includes('Failed to get latest batch') ||
				error.message.includes('Internal Server Error') ||
				error.message.includes('Server error') ||
				error.message.includes('fetch') ||
				error.message.includes('Network connection failed') ||
				error.message.includes('timeout') ||
				error.message.includes('aborted') ||
				error.message.includes('Failed to load') ||
				error.name === 'TypeError' ||
				error.name === 'NetworkError' ||
				error.name === 'AbortError'
			);
			
			// Adaptive retry limits based on connection quality
			const maxRetries = isSlowConnection ? 8 : 5; // More retries for slow connections
			
			// Track retry attempts
			if (!retryCount) {
				retryCount = 0;
			}
			
			if (isNetworkError && retryCount < maxRetries) {
				retryCount++;
				
				// Adaptive retry delay based on connection quality and attempt
				let baseDelay = isSlowConnection ? 3000 : 1500;
				const multiplier = isSlowConnection ? 1.3 : 1.5;
				const maxDelay = isSlowConnection ? 20000 : 12000;
				
				const retryDelay = Math.min(baseDelay * Math.pow(multiplier, retryCount - 1), maxDelay);
				
				// Add jitter to prevent thundering herd
				const jitter = Math.random() * 0.3 * retryDelay;
				const finalDelay = retryDelay + jitter;
				
				console.log(`🔄 Network error detected (attempt ${retryCount}/${maxRetries}), retrying in ${Math.round(finalDelay/1000)}s...`);
				persistentLogDataLoader('🔄 Network error - scheduling retry', {
					attempt: retryCount,
					maxRetries,
					delayMs: Math.round(finalDelay),
					errorMessage: error instanceof Error ? error.message : String(error)
				});
				
				// Enhanced loading message with connection context
				const connectionInfo = connectionQuality ? ` (${connectionQuality} connection)` : '';
				loadingStage = s('loading.retrying') || `Connection issue, retrying... (${retryCount}/${maxRetries})${connectionInfo}`;
				
				// Retry after a delay, but prevent multiple concurrent retries
				if (!retryTimeout) {
					retryTimeout = setTimeout(() => {
						console.log(`🔄 Retrying data load (attempt ${retryCount + 1})...`);
						persistentLogDataLoader('🔄 Retry timeout fired - calling loadInitialData', {
							attempt: retryCount + 1
						});
						retryTimeout = null;
						loadInitialData();
					}, finalDelay);
				}
				return;
			}
			
			// Reset retry count and clear any pending timeout for future attempts
			retryCount = 0;
			if (retryTimeout) {
				clearTimeout(retryTimeout);
				retryTimeout = null;
			}
			
			hasError = true;
			errorMessage = error instanceof Error ? error.message : 'Failed to load data';
			loadingStage = s('loading.error') || 'Error loading data';
			
			// Provide more helpful error messages
			if (error instanceof Error) {
				if (error.message.includes('Internal Server Error')) {
					errorMessage = 'The news service is temporarily unavailable. Please try again in a few minutes.';
				} else if (error.message.includes('Network connection failed')) {
					errorMessage = 'Unable to connect to the news service. Please check your internet connection.';
				}
			}
			
			// Show error for a bit then continue with fallback
			setTimeout(() => {
				initialLoading = false;
				
				if (onError) {
					onError(errorMessage);
				}
			}, 1000); // Reduced error display time to prevent blank page delays
		}
	}

	// Comprehensive reload function for language changes
	async function reloadAllData() {
		try {
			console.log(`🌍 reloadAllData called - Data language changed to ${language.data}, reloading all data...`);
			
			// Load initial data (batch info + categories)
			const initialData = await dataService.loadInitialData(language.data);
			categories = initialData.categories;
			const { batchId, categoryMap, chaosIndex, chaosDescription, chaosLastUpdated } = initialData;
			totalReadCount = initialData.totalReadCount;
			
			// Update categories store with new data
			categoriesStore.setAllCategories(categories);
			
			// Filter enabled categories to only those that exist in the current batch
			const availableCategoryIds = categories.map(cat => cat.id);
			const validEnabledCategories = categoriesStore.enabled.filter(catId => 
				availableCategoryIds.includes(catId)
			);
			
			// Update enabled categories to remove any that don't exist in current batch
			if (validEnabledCategories.length !== categoriesStore.enabled.length) {
				console.warn('Some enabled categories are not available in current batch, updating enabled list');
				categoriesStore.setEnabled(validEnabledCategories);
			}
			
			// Get all enabled categories except OnThisDay (case-insensitive)
			const enabledCategories = validEnabledCategories.filter(cat => 
				cat.toLowerCase() !== 'onthisday'
			);
			
			// If we have a category from URL that's not enabled, we need to include it
			const categoriesToLoad = [...enabledCategories];
			let temporaryCategoryId: string | null = null;
			
			if (initialCategoryId && !enabledCategories.includes(initialCategoryId)) {
				// Check if this category exists in the available categories
				if (availableCategoryIds.includes(initialCategoryId)) {
					console.log('Including non-enabled category from URL (latest batch):', initialCategoryId);
					categoriesToLoad.push(initialCategoryId);
					temporaryCategoryId = initialCategoryId;
					// Temporarily add to enabled categories so it shows in the navigation
					categoriesStore.addTemporary(initialCategoryId);
				}
			}
			
			const firstEnabledCategory = initialCategoryId || getFirstEnabledCategory(categories);
			currentCategory = firstEnabledCategory;
			
			console.log(`🎯 Language reload: Target category set to: ${firstEnabledCategory} ${initialCategoryId ? '(from URL)' : '(first enabled)'}`);

			// Load stories for enabled categories only (plus any from URL)
			const categoryPromises = categoriesToLoad.map(async (categoryId) => {
				// Add timeout wrapper for language reload
				const loadWithTimeout = async (): Promise<{ categoryId: string, stories: Story[], readCount: number, timestamp: number }> => {
					try {
						const categoryUuid = categoryMap[categoryId];
						if (!categoryUuid) {
							console.warn(`Category UUID not found for ${categoryId} during language reload`);
							return { categoryId, stories: [], readCount: 0, timestamp: Date.now() / 1000 };
						}
						
						console.log(`📦 Language reload: Loading stories for category ${categoryId}...`);
						const result = await dataService.loadStories(batchId, categoryUuid, settings.storyCount, language.data);
						console.log(`✅ Language reload: Loaded ${result.stories.length} stories for category ${categoryId}`);
						return { categoryId, stories: result.stories, readCount: result.readCount, timestamp: result.timestamp };
					} catch (error) {
						console.warn(`❌ Language reload: Failed to load stories for category ${categoryId}:`, error);
						return { categoryId, stories: [], readCount: 0, timestamp: Date.now() / 1000 };
					}
				};

				// Add timeout to prevent getting stuck during language reload
				const timeoutPromise = new Promise<{ categoryId: string, stories: Story[], readCount: number, timestamp: number }>((resolve) => {
					setTimeout(() => {
						console.warn(`⏰ Language reload: Timeout loading category ${categoryId}, returning empty result`);
						resolve({ categoryId, stories: [], readCount: 0, timestamp: Date.now() / 1000 });
					}, 8000); // 8 second timeout for language reload
				});

				return Promise.race([loadWithTimeout(), timeoutPromise]);
			});

			const categoryResults = await Promise.all(categoryPromises);
			
			// Store all category stories
			allCategoryStories = {};
			let maxTimestamp = 0;
			let totalReadCountSum = 0;
			
			for (const result of categoryResults) {
				// Ensure story uniqueness by cluster_number or title
				const uniqueStories = result.stories.filter((story, index, arr) => {
					const storyId = story.cluster_number?.toString() || story.title;
					return arr.findIndex(s => (s.cluster_number?.toString() || s.title) === storyId) === index;
				});
				
				allCategoryStories[result.categoryId] = uniqueStories;
				maxTimestamp = Math.max(maxTimestamp, result.timestamp);
				totalReadCountSum += result.readCount;
			}

			// Set initial display to current category (from URL or first enabled)
			stories = allCategoryStories[currentCategory] || [];
			// Use batch totalReadCount if available, otherwise fall back to sum
			if (!totalReadCount || totalReadCount === 0) {
				totalReadCount = totalReadCountSum;
			}
			lastUpdated = formatTimeAgo(maxTimestamp, s);

			// Preload images for the current category
			const firstCategoryStories = allCategoryStories[currentCategory] || [];
			if (firstCategoryStories.length > 0) {
				await preloadCategoryImages(firstCategoryStories);
			}

			console.log(`✅ Language reload complete: ${enabledCategories.length} enabled categories, ${Object.values(allCategoryStories).flat().length} total stories`);
			
			// Notify parent component with updated data
			if (onDataLoaded) {
				onDataLoaded({
					categories,
					stories,
					totalReadCount,
					lastUpdated,
					currentCategory,
					allCategoryStories,
					categoryMap,
					batchId,
					chaosIndex,
					chaosDescription,
					chaosLastUpdated,
					isLatestBatch,
					temporaryCategory: temporaryCategoryId,
					onThisDayEvents
				});
			}

		} catch (error) {
			console.error('Error reloading data for language change:', error);
			
			if (onError) {
				onError(error instanceof Error ? error.message : 'Failed to reload data');
			}
		}
	}

	// Load data when component mounts
	onMount(() => {
		persistentLogDataLoader('📍 onMount() called - DataLoader mounting', {
			timestamp: Date.now(),
			isPostMaintenance,
			initialBatchId,
			initialCategoryId
		});
		
		// Initialize time travel batch store to restore or clear stale state
		timeTravelBatch.init();
		
		// Check if we have a stale time travel batch and clear it
		if (timeTravelBatch.isStale()) {
			console.log('🗑️ Clearing stale time travel batch on mount');
			persistentLogDataLoader('🗑️ Clearing stale time travel batch on mount');
			timeTravelBatch.set(null);
		}
		
		if (isPostMaintenance) {
			// Clear the flag now that we've used it
			localStorage.removeItem('kite-post-maintenance');
			console.log('🔄 Post-maintenance reload - skipping splash screen');
			persistentLogDataLoader('🔄 Post-maintenance reload - skipping splash screen');
		} else {
			console.log('🚀 DataLoader mounted - loading initial data');
			persistentLogDataLoader('🚀 DataLoader mounted - loading initial data');
		}
		
		persistentLogDataLoader('🔄 About to call loadInitialData from onMount');
		loadInitialData();
		
		// Register reload callback
		dataReloadService.onReload(reloadAllData);
		
		persistentLogDataLoader('✅ onMount() completed');
	});
	
	// Track when component is destroyed
	onDestroy(() => {
		const stack = new Error().stack?.split('\n').slice(1, 8).join(' | ') || 'no stack';
		persistentLogDataLoader('💀 DataLoader component destroying/unmounting', {
			timestamp: Date.now(),
			destroyStack: stack
		});
		
		// Only log in development mode to reduce console noise
		if (browser && window.location.hostname === 'localhost') {
			console.log('🔍 DataLoader destroyed by:', stack);
		}
		
		// Clear any pending timeouts
		if (retryTimeout) {
			clearTimeout(retryTimeout);
			retryTimeout = null;
		}
	});
	
	// Watch for batch changes (time travel mode toggle)
	let lastProcessedBatchId: string | null = null;
	
	// Track when batch changes and trigger reload
	$effect(() => {
		if (!browser) return;
		const currentBatchId = timeTravelBatch.batchId;
		
		persistentLogDataLoader('⚡ $effect triggered - batch watcher', {
			currentBatchId: currentBatchId?.substring(0, 8) || 'null',
			lastProcessedBatchId: lastProcessedBatchId?.substring(0, 8) || 'null',
			initialLoading,
			isFirstRun: lastProcessedBatchId === null
		});
		
		// Initialize on first run
		if (lastProcessedBatchId === null) {
			lastProcessedBatchId = currentBatchId;
			persistentLogDataLoader('🔧 First run of batch watcher - initializing');
			return;
		}
		
		// Check if we need to reload
		if (currentBatchId !== lastProcessedBatchId && !initialLoading) {
			console.log(`🔄 Batch changed from ${lastProcessedBatchId} to ${currentBatchId}, triggering reload...`);
			persistentLogDataLoader('🔄 Batch changed - triggering reload', {
				from: lastProcessedBatchId?.substring(0, 8) || 'null',
				to: currentBatchId?.substring(0, 8) || 'null'
			});
			
			// Update tracking variable first
			lastProcessedBatchId = currentBatchId;
			
			// Trigger reload without modifying reactive state in the effect
			queueMicrotask(() => {
				afterInitial = true; // ensure corner spinner
				isLatestBatch = currentBatchId === null;
				initialLoading = true;
				loadingProgress = 0;
				loadingStage = s('loading.loadingData') || 'Loading news data...';
				
				persistentLogDataLoader('🔄 About to call loadInitialData from batch watcher');
				// Trigger reload after state is updated
				setTimeout(() => {
					loadInitialData();
				}, 100);
			});
		}
	});
</script>

{#if initialLoading}
    <SplashScreen 
        showProgress={true}
        progress={loadingProgress}
        stage={loadingStage}
        hasError={hasError}
        errorMessage={errorMessage}
        storiesToPreload={storiesToPreloadIcons}
        onRetry={() => {
            // Reset error state and retry
            hasError = false;
            errorMessage = '';
            loadingProgress = 0;
            loadingStage = s('loading.initializing') || 'Initializing...';
            retryCount = 0; // Reset retry count for manual retry
            if (retryTimeout) {
                clearTimeout(retryTimeout);
                retryTimeout = null;
            }
            loadInitialData();
        }}
    />
{:else}
    <!-- DataLoader is done loading - render nothing (invisible) -->
    <div style="display: none;"></div>
{/if} 