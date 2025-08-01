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
					console.log('⚠️ SKIPPING dataReloadService.reloadData() to prevent page refresh during load more');
					// await dataReloadService.reloadData(); // DISABLED: This causes page refresh
					return updates; // Let the reload handle everything else
				} else if (switchingToSpecific) {
					// We need to check if this is actually a historical batch
					// For now, we'll rely on the DataLoader's logic which already checked
					// Don't set time travel mode here - let DataLoader handle it
					console.log('🕰️ Switching to historical batch:', params.batchId);
					console.log('⚠️ SKIPPING dataReloadService.reloadData() to prevent page refresh during load more');
					// try {
					// 	await dataReloadService.reloadData(); // DISABLED: This causes page refresh
					// 	console.log('✅ Historical batch reload completed');
					// } catch (error) {
					// 	console.error('❌ Failed to reload data for historical batch:', error);
					// 	// Continue with category/story navigation even if batch reload failed
					// }
					return updates; // Let the reload handle everything else
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

				const categoryStories = state.allCategoryStories[state.currentCategory] || state.stories;

				// Priority 1: slug (new style links)
				if (params.slug) {
					const target = categoryStories.find((s) => slugify(s.title) === params.slug);
					if (target) {
						const storyId = target.cluster_number?.toString() || target.title;
						updates.expandedStories = { [storyId]: true };
						// Nothing more to do
						return updates;
					}
				}

				// Priority 2: numeric index (legacy links)
				if (params.storyIndex !== null && params.storyIndex !== undefined) {
					if (categoryStories[params.storyIndex]) {
						const story = categoryStories[params.storyIndex];
						const storyId = story.cluster_number?.toString() || story.title;
						updates.expandedStories = { [storyId]: true };
					}
				}
			}
			
			return updates;
		} finally {
			// Reset flag after a delay to allow state to settle
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
}

// Export singleton instance
export const navigationHandlerService = new NavigationHandlerService();