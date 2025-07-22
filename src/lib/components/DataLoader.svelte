<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { s } from '$lib/client/localization.svelte';
	import { dataService, dataReloadService } from '$lib/services/dataService';
	import { dataLanguage } from '$lib/stores/dataLanguage.svelte.js';
	import { categories as categoriesStore } from '$lib/stores/categories.svelte.js';
	import { sections } from '$lib/stores/sections.svelte.js';
	import { imagePreloadingService } from '$lib/services/imagePreloadingService.js';
	import { timeTravelBatch } from '$lib/stores/timeTravelBatch.svelte.js';
	import { timeTravel } from '$lib/stores/timeTravel.svelte.js';
	import { formatTimeAgo } from '$lib/utils/formatTimeAgo';
	import type { Category, Story } from '$lib/types';
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
		}) => void;
		onError?: (error: string) => void;
		initialBatchId?: string | null;
		initialCategoryId?: string | null;
	}

	const { onDataLoaded, onError, initialBatchId, initialCategoryId }: Props = $props();

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
	
	// Determine initial loading flag
	const shouldShowInitialLoading = (() => {
	    if (isPostMaintenance) return false;
	    if (typeof window !== 'undefined' && sessionStorage.getItem('kite-loaded')) return false;
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

	// Function to preload all images for stories with timeout handling
	async function preloadCategoryImages(stories: Story[]) {
		// Set a fallback timeout that's shorter than the service timeout
		const fallbackTimeout = new Promise<void>((resolve) => {
			setTimeout(() => {
				console.log('⏱️ Fallback timeout reached, continuing with loading...');
				// Bump progress so the splash doesn’t stall mid-way
				loadingProgress = Math.max(loadingProgress, 85);
				resolve();
			}, 3000); // 3-second fallback – keep UX snappy
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
		try {
			loadingStage = '...';
			loadingProgress = 10;

			// Store batch info to avoid duplicate API calls
			let providedBatchInfo: { id: string; createdAt: string; totalReadCount?: number } | undefined;
			
			// Check if we have a batch ID from URL
			if (initialBatchId) {
				// First, get the latest batch to compare
				const latestResponse = await fetch(`/api/batches/latest?lang=${dataLanguage.current}`);
				if (latestResponse.ok) {
					const latestBatch = await latestResponse.json();
					
					// Only set time travel mode if this is NOT the latest batch
					if (initialBatchId !== latestBatch.id) {
						console.log('🎯 Setting time travel mode for historical batch:', initialBatchId);
						dataService.setTimeTravelBatch(initialBatchId);
						isLatestBatch = false;
						
						// Also set the time travel UI state so the banner shows
						// We need to get the batch info to set the correct date
						try {
							const batchResponse = await fetch(`/api/batches/${initialBatchId}`);
							if (batchResponse.ok) {
								const batchData = await batchResponse.json();
								const batchDate = new Date(batchData.createdAt);
								console.log('🎯 Setting time travel UI state for date:', batchDate);
								timeTravel.selectDate(batchDate);
								timeTravel.selectBatch(initialBatchId);
								
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
				// No batch ID in URL means we're viewing the latest
				isLatestBatch = true;
			}

			// Load initial data (batch info + categories) - pass batch info if we have it
			const initialData = await dataService.loadInitialData(dataLanguage.current, providedBatchInfo);
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
			
			// Update enabled categories to remove any that don't exist in current batch
			if (validEnabledCategories.length !== categoriesStore.enabled.length) {
				console.warn('Some enabled categories are not available in current batch, updating enabled list');
				categoriesStore.setEnabled(validEnabledCategories);
			}
			
			// Initialize sections store
			sections.init();
			
			loadingStage = s('loading.stories') || 'Loading all category stories...';
			loadingProgress = 30;

			// Get all enabled categories except OnThisDay (case-insensitive)
			// Use validEnabledCategories to ensure we only try to load existing categories
			const enabledCategories = validEnabledCategories.filter(cat => 
				cat.toLowerCase() !== 'onthisday'
			);
			
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
			
			// Use category from URL if provided, otherwise use first enabled
			const targetCategory = initialCategoryId || enabledCategories[0] || 'World';
			currentCategory = targetCategory;

			// Load stories for ALL enabled categories (plus any from URL)
			const categoryPromises = categoriesToLoad.map(async (categoryId) => {
				try {
					const categoryUuid = categoryMap[categoryId];
					if (!categoryUuid) {
						console.warn(`Category UUID not found for ${categoryId}`);
						return { categoryId, stories: [], readCount: 0, timestamp: Date.now() / 1000 };
					}
					const result = await dataService.loadStories(batchId, categoryUuid, 12, dataLanguage.current);
					return { categoryId, stories: result.stories, readCount: result.readCount, timestamp: result.timestamp };
				} catch (error) {
					console.warn(`Failed to load stories for category ${categoryId}:`, error);
					return { categoryId, stories: [], readCount: 0, timestamp: Date.now() / 1000 };
				}
			});

			const categoryResults = await Promise.all(categoryPromises);
			
			// Store all category stories
			allCategoryStories = {};
			let maxTimestamp = 0;
			let totalReadCountSum = 0;
			
			for (const result of categoryResults) {
				allCategoryStories[result.categoryId] = result.stories;
				maxTimestamp = Math.max(maxTimestamp, result.timestamp);
				totalReadCountSum += result.readCount;
			}

			// Set initial display to target category (from URL or first enabled)
			stories = allCategoryStories[targetCategory] || [];
			// Use batch totalReadCount if available, otherwise fall back to sum
			if (!totalReadCount || totalReadCount === 0) {
				totalReadCount = totalReadCountSum;
			}
			lastUpdated = formatTimeAgo(maxTimestamp, s);

			// Image preloading is now handled by the service which checks time travel mode internally
			loadingStage = s('loading.images') || 'Preloading first category images...';
			loadingProgress = 65; // start image phase above 50% so bar continues moving
			
			// Animate progress from 65 → 85 % while images preload
			// Use faster animation for post-maintenance loads
			const startAnimatingProgress = () => {
				const start = performance.now();
				const duration = isPostMaintenance ? 200 : 2000; // Much faster for post-maintenance

				const step = () => {
					const elapsed = performance.now() - start;
					const t = Math.min(1, elapsed / duration);
					// ease-out curve (sqrt)
					const eased = Math.sqrt(t);
					loadingProgress = 65 + eased * (85 - 65);
					if (t < 1) {
						progressAnimId = requestAnimationFrame(step);
					}
				};
				progressAnimId = requestAnimationFrame(step);
			};

			let progressAnimId: number | null = null;
			if (!isPostMaintenance) {
				startAnimatingProgress();
			} else {
				// Skip animation for post-maintenance, jump directly to 85%
				loadingProgress = 85;
			}

			// Only preload images for the first category to keep initial load fast
			// Skip image preloading for post-maintenance loads since images should be cached
			if (!isPostMaintenance) {
				const firstCategoryStories = allCategoryStories[targetCategory] || [];
				console.log(`📦 Preloading images for first category: ${targetCategory} (${firstCategoryStories.length} stories)`);
				console.log(`📚 Total categories preloaded: ${enabledCategories.length} (${Object.values(allCategoryStories).flat().length} total stories)`);
				
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

			// Ensure progress animation stops and set progress to 85 after image step
			if (progressAnimId !== null) {
				cancelAnimationFrame(progressAnimId);
				progressAnimId = null;
			}
			loadingProgress = Math.max(loadingProgress, 85);

			loadingStage = s('loading.finishing') || 'Finishing up...';
			loadingProgress = 90;
			
			loadingProgress = 100;
			loadingStage = s('loading.ready') || 'Ready!';

			initialLoading = false;

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
						temporaryCategory: temporaryCategoryId
					});
				}
			};

			// Skip delay for post-maintenance loads for faster transition
			if (isPostMaintenance) {
				finishLoading();
			} else {
				setTimeout(finishLoading, 100);
			}

		} catch (error) {
			console.error('Error loading initial data:', error);
			hasError = true;
			errorMessage = error instanceof Error ? error.message : 'Failed to load data';
			loadingStage = s('loading.error') || 'Error loading data';
			
			// Show error for a bit then continue with fallback
			setTimeout(() => {
				initialLoading = false;
				
				if (onError) {
					onError(errorMessage);
				}
			}, 2000);
		}
	}

	// Comprehensive reload function for language changes
	async function reloadAllData() {
		try {
			console.log(`🌍 reloadAllData called - Data language changed to ${dataLanguage.current}, reloading all data...`);
			
			// Load initial data (batch info + categories)
			const initialData = await dataService.loadInitialData(dataLanguage.current);
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
			
			const firstEnabledCategory = initialCategoryId || enabledCategories[0] || 'World';
			currentCategory = firstEnabledCategory;

			// Load stories for ALL enabled categories (plus any from URL)
			const categoryPromises = categoriesToLoad.map(async (categoryId) => {
				try {
					const categoryUuid = categoryMap[categoryId];
					if (!categoryUuid) {
						console.warn(`Category UUID not found for ${categoryId}`);
						return { categoryId, stories: [], readCount: 0, timestamp: Date.now() / 1000 };
					}
					const result = await dataService.loadStories(batchId, categoryUuid, 12, dataLanguage.current);
					return { categoryId, stories: result.stories, readCount: result.readCount, timestamp: result.timestamp };
				} catch (error) {
					console.warn(`Failed to load stories for category ${categoryId}:`, error);
					return { categoryId, stories: [], readCount: 0, timestamp: Date.now() / 1000 };
				}
			});

			const categoryResults = await Promise.all(categoryPromises);
			
			// Store all category stories
			allCategoryStories = {};
			let maxTimestamp = 0;
			let totalReadCountSum = 0;
			
			for (const result of categoryResults) {
				allCategoryStories[result.categoryId] = result.stories;
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

			console.log(`✅ Language reload complete: ${enabledCategories.length} categories, ${Object.values(allCategoryStories).flat().length} total stories`);
			
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
					temporaryCategory: temporaryCategoryId
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
		if (isPostMaintenance) {
			// Clear the flag now that we've used it
			localStorage.removeItem('kite-post-maintenance');
			console.log('🔄 Post-maintenance reload - skipping splash screen');
		} else {
			console.log('🚀 DataLoader mounted - loading initial data');
		}
		
		loadInitialData();
		
		// Register reload callback
		dataReloadService.onReload(reloadAllData);
	});
	
	// Watch for batch changes (time travel mode toggle)
	let lastProcessedBatchId: string | null = null;
	let needsReload = $state(false);
	
	// Track when batch changes and trigger reload
	$effect(() => {
		if (!browser) return;
		const currentBatchId = timeTravelBatch.batchId;
		
		// Check if we need to reload
		if (currentBatchId !== lastProcessedBatchId && !initialLoading && lastProcessedBatchId !== null) {
			console.log(`🔄 Batch changed from ${lastProcessedBatchId} to ${currentBatchId}, triggering reload...`);
			
			// Update state
			lastProcessedBatchId = currentBatchId;
			isLatestBatch = currentBatchId === null;
			initialLoading = true;
			loadingProgress = 0;
			loadingStage = s('loading.loadingData') || 'Loading news data...';
			needsReload = true;
		} else {
			lastProcessedBatchId = currentBatchId;
		}
	});
	
	// Handle reload trigger
	$effect(() => {
		if (needsReload) {
			needsReload = false;
			setTimeout(() => {
				loadInitialData();
			}, 100);
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
	/>
{/if} 