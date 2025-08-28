import type { SupportedLanguage } from '$lib/stores/language.svelte';
import type { Category, Story } from '$lib/types';
import { UrlNavigationService, type NavigationParams } from './urlNavigationService';
import { dataService, dataReloadService } from './dataService';
import { slugify } from '$lib/utils/urlShortener';

export interface NavigationState {
	currentBatchId: string;
	currentCategory: string;
	categories: Category[];
	stories: Story[];
	allCategoryStories: Record<string, Story[]>;
	expandedStories: Record<string, boolean>;
	isLatestBatch: boolean;
}

export interface NavigationCallbacks {
	setDataLanguage: (lang: SupportedLanguage) => void;
	getCurrentDataLanguage: () => SupportedLanguage;
	handleCategoryChange: (categoryId: string, updateUrl: boolean) => void;
	onNavigationComplete?: () => void;
}

/**
 * Service to handle navigation state changes from URL updates
 */
export class NavigationHandlerService {
	private isHandlingNavigation = false;
	private lastHandledUrl = '';
	
	/**
	 * Handle navigation from URL changes
	 */
	async handleUrlNavigation(
		params: NavigationParams,
		state: NavigationState,
		callbacks: NavigationCallbacks
	): Promise<Partial<NavigationState>> {
		// Create a unique key for this navigation request
		const navigationKey = JSON.stringify(params);
		
		// Prevent handling the same navigation twice
		if (this.lastHandledUrl === navigationKey) {
			return {};
		}
		
		// Prevent recursive navigation
		if (this.isHandlingNavigation) return {};
		
		// Skip if all params are undefined (no actual navigation needed)
		if (params.batchId === undefined && 
		    params.categoryId === undefined && 
		    params.storyIndex === undefined && 
		    params.slug === undefined &&
		    params.dataLang === undefined) {
			return {};
		}
		
		this.isHandlingNavigation = true;
		this.lastHandledUrl = navigationKey;
		
		// Safety timeout to prevent getting stuck
		const safetyTimeout = setTimeout(() => {
			console.warn('Navigation handler timeout - resetting state');
			this.isHandlingNavigation = false;
		}, 5000);
		
		const updates: Partial<NavigationState> = {};
		
		try {
			// Handle data language change first
			if (params.dataLang !== undefined && 
			    params.dataLang !== null && 
			    params.dataLang !== callbacks.getCurrentDataLanguage()) {
				// Validate it's a supported language
				if (UrlNavigationService.isValidDataLanguage(params.dataLang)) {
					console.log('Setting data language from URL:', params.dataLang);
					callbacks.setDataLanguage(params.dataLang as SupportedLanguage);
					// Wait a bit for the language change to propagate
					await new Promise(resolve => setTimeout(resolve, 100));
				}
			}
			
			// Handle batch change only if explicitly provided and different
			if (params.batchId !== undefined) {
				// Check if we're switching from current batch to a different one
				const switchingToLatest = !params.batchId && !state.isLatestBatch;
				const switchingToSpecific = params.batchId && params.batchId !== state.currentBatchId;
				
				console.log('🔄 Batch navigation detected:', {
					paramsBatchId: params.batchId,
					currentBatchId: state.currentBatchId,
					isLatestBatch: state.isLatestBatch,
					switchingToLatest,
					switchingToSpecific
				});
				
				if (switchingToLatest) {
					// Navigate to latest batch
					console.log('🔄 Switching to latest batch...');
					updates.isLatestBatch = true;
					dataService.setTimeTravelBatch(null);
					// Lightweight data reload so the feed updates to latest without SplashScreen
					try {
						await dataReloadService.reloadData();
						console.log('✅ Latest batch reload completed');
					} catch (e) {
						console.warn('❌ Failed to reload data for latest batch:', e);
					}
					return updates;
				} else if (switchingToSpecific) {
					// We need to check if this is actually a historical batch
					// For now, we'll rely on the DataLoader's logic which already checked
					// Don't set time travel mode here - let DataLoader handle it
					console.log('🕰️ Switching to historical batch:', params.batchId);
					updates.isLatestBatch = false;
					dataService.setTimeTravelBatch(params.batchId);
					// Lightweight data reload so the feed updates to selected batch without SplashScreen
					try {
						await dataReloadService.reloadData();
						console.log('✅ Historical batch reload completed');
					} catch (error) {
						console.error('❌ Failed to reload data for historical batch:', error);
						// Continue with category/story navigation even if batch reload failed
					}
					return updates;
				}
				// If batch hasn't changed, continue to handle category/story changes
			}
			
			// Handle category change - normalize case
			if (params.categoryId !== undefined) {
				const targetCategory = params.categoryId || 'world';
				// Normalize to match the actual category IDs (lowercase)
				const normalizedTarget = UrlNavigationService.normalizeCategoryId(targetCategory);
				const normalizedCurrent = UrlNavigationService.normalizeCategoryId(state.currentCategory);
				
				console.log('🔍 Category navigation check:', {
					targetCategory,
					normalizedTarget,
					normalizedCurrent,
					needsChange: normalizedTarget !== normalizedCurrent
				});
				
				if (normalizedTarget !== normalizedCurrent) {
					// Find the actual category ID from our categories list
					const actualCategory = state.categories.find(cat => 
						UrlNavigationService.normalizeCategoryId(cat.id) === normalizedTarget
					);
					if (actualCategory) {
						console.log('🔄 Triggering category change to:', actualCategory.id);
						callbacks.handleCategoryChange(actualCategory.id, false);
						// Wait for category change to complete
						await new Promise(resolve => setTimeout(resolve, 50));
					} else {
						// Default to first category if not found
						console.warn('Category not found in list:', normalizedTarget);
						callbacks.handleCategoryChange(state.categories[0]?.id || 'world', false);
						await new Promise(resolve => setTimeout(resolve, 50));
					}
				} else {
					console.log('🚫 Skipping category change - already on target category');
				}
			}
			
			// Handle story expansion - after category is loaded
			if (params.storyIndex !== undefined || params.slug !== undefined) {
				// Clear all expanded stories first
				updates.expandedStories = {};

				// Use the current category stories from allCategoryStories, which includes historical stories
				const categoryStories = state.allCategoryStories[state.currentCategory] || state.stories;
				console.log('🔍 Story expansion - using category stories:', {
					category: state.currentCategory,
					storiesCount: categoryStories.length,
					hasHistorical: categoryStories.some(s => (s as any).__fromHistoricalBatch),
					storyIndex: params.storyIndex,
					slug: params.slug,
					isLatestBatch: state.isLatestBatch,
					currentBatchId: state.currentBatchId
				});

				// Add a small delay to ensure stories are fully processed
				await new Promise(resolve => setTimeout(resolve, 50));

				// Priority 1: slug (new style links)
				if (params.slug) {
					const target = categoryStories.find((s) => slugify(s.title) === params.slug);
					if (target) {
						const baseStoryId = target.cluster_number?.toString() || target.title;
						const batchId = (target as any).__batchId || state.currentBatchId;
						// Use category-aware story ID
						const storyId = `${state.currentCategory}:${batchId}:${baseStoryId}`;
						updates.expandedStories = { [storyId]: true };
						console.log('🎯 Expanding story by slug:', { slug: params.slug, storyId, title: target.title });
						return updates;
					} else {
						console.warn('❌ Story not found by slug:', params.slug, 'in', categoryStories.length, 'stories');
						// Log available slugs for debugging
						const availableSlugs = categoryStories.slice(0, 5).map(s => ({ 
							title: s.title, 
							slug: slugify(s.title),
							batchId: (s as any).__batchId 
						}));
						console.log('🔍 Available slugs (first 5):', availableSlugs);
					}
				}

				// Priority 2: numeric index (legacy links)
				if (params.storyIndex !== null && params.storyIndex !== undefined) {
					// For story index, we need to look at the right subset of stories
					// If we're in latest batch mode, only look at current batch stories
					// If we're in historical batch mode, look at all stories
					let storiesToSearch = categoryStories;
					
					if (state.isLatestBatch) {
						// Only look at current batch stories (not historical)
						storiesToSearch = categoryStories.filter(s => !(s as any).__fromHistoricalBatch);
						console.log('🔍 Latest batch mode - filtering to current stories:', {
							totalStories: categoryStories.length,
							currentBatchStories: storiesToSearch.length,
							targetIndex: params.storyIndex
						});
					} else {
						console.log('🔍 Historical batch mode - using all stories:', {
							totalStories: categoryStories.length,
							targetIndex: params.storyIndex
						});
					}
					
					if (storiesToSearch[params.storyIndex]) {
						const story = storiesToSearch[params.storyIndex];
						const baseStoryId = story.cluster_number?.toString() || story.title;
						const batchId = (story as any).__batchId || state.currentBatchId;
						// Use category-aware story ID
						const storyId = `${state.currentCategory}:${batchId}:${baseStoryId}`;
						updates.expandedStories = { [storyId]: true };
						console.log('🎯 Expanding story by index:', { 
							index: params.storyIndex, 
							storyId, 
							title: story.title,
							isLatestBatch: state.isLatestBatch,
							batchId: (story as any).__batchId,
							category: state.currentCategory
						});
					} else {
						console.warn('❌ Story not found at index:', params.storyIndex, 'in', storiesToSearch.length, 'stories');
						// Log the first few stories for debugging
						const debugStories = storiesToSearch.slice(0, Math.min(15, storiesToSearch.length)).map((s, i) => ({
							index: i,
							title: s.title.substring(0, 50),
							clusterId: s.cluster_number,
							batchId: (s as any).__batchId,
							isHistorical: (s as any).__fromHistoricalBatch
						}));
						console.log('🔍 Available stories for debugging:', debugStories);
					}
				}
			}
			
			return updates;
		} finally {
			// Clear safety timeout and reset flag after a delay to allow state to settle
			clearTimeout(safetyTimeout);
			setTimeout(() => {
				this.isHandlingNavigation = false;
				callbacks.onNavigationComplete?.();
			}, 100);
		}
	}
	
	/**
	 * Check if currently handling navigation
	 */
	isNavigating(): boolean {
		return this.isHandlingNavigation;
	}
	
	/**
	 * Force reset navigation state (for debugging/recovery)
	 */
	resetNavigationState(): void {
		console.log('🔧 Forcing reset of navigation state');
		this.isHandlingNavigation = false;
		this.lastHandledUrl = '';
	}
}

// Export singleton instance
export const navigationHandlerService = new NavigationHandlerService();