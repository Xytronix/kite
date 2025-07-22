<script lang="ts">
import { browser } from '$app/environment';
import { page } from '$app/state';
import { goto, replaceState as skReplaceState } from '$app/navigation';
import { language } from '$lib/stores/language.svelte.js';
import { UrlNavigationService, type NavigationParams } from '$lib/services/urlNavigationService';

interface Props {
	batchId: string;
	categoryId: string;
	storyIndex?: number | null;
	onNavigate?: (params: NavigationParams) => void;
}

const { 
	batchId = $bindable(),
	categoryId = $bindable(),
	storyIndex = $bindable(null),
	onNavigate
}: Props = $props();

// Track if we're restoring from history to prevent loops
let isRestoringFromHistory = $state(false);
let previousUrl = $state('');

// Build URL based on current state
function buildUrl(params?: Partial<NavigationParams>): string {
	const navigationParams: NavigationParams = {
		batchId: params?.batchId !== undefined ? params.batchId : batchId,
		categoryId: params?.categoryId !== undefined ? params.categoryId : categoryId,
		storyIndex: params?.storyIndex !== undefined ? params.storyIndex : storyIndex,
		slug: params?.slug,
	};
	
	return UrlNavigationService.buildUrl(navigationParams, language.data);
}

// Update URL without triggering navigation
export function updateUrl(params?: Partial<NavigationParams>) {
	if (!browser || isRestoringFromHistory) return;
	
	const newUrl = buildUrl(params);
	
	// Only update if URL actually changed
	if (newUrl !== previousUrl) {
		previousUrl = newUrl;
		// Use the History API directly to update the address bar without triggering
		// SvelteKit navigation. This avoids a full page reload / data fetch which
		// previously caused the splash screen and redirect flashes when expanding
		// or collapsing a story card.
		skReplaceState(newUrl, { keepfocus: true, noscroll: true });
	}
}

// Navigate to new URL with history entry
export function navigateTo(params: Partial<NavigationParams>) {
	if (!browser || isRestoringFromHistory) return;
	
	const newUrl = buildUrl(params);
	
	// Only navigate if URL actually changed
	if (newUrl !== previousUrl) {
		previousUrl = newUrl;
		// Use SvelteKit's goto with sensible defaults so navigation feels seamless
		//  • keepfocus: prevent focus loss during internal navigation
		//  • noscroll: retain the current scroll position unless the route explicitly handles it
		//  • state: mirror the url parameters so we can read them in popstate events if needed later
		goto(newUrl, {
			keepfocus: true,
			noscroll: true,
			state: { restored: false }
		});
	}
}

// Track if initial load has been processed
let initialLoadProcessed = $state(false);

// Handle initial page load and browser navigation
$effect(() => {
	if (!browser) return;
	
	// Parse current URL
	const params = UrlNavigationService.parseUrl(page.url);
	const urlString = UrlNavigationService.getFullUrl(page.url);
	
	// Handle initial page load state updates
	if (!initialLoadProcessed) {
		initialLoadProcessed = true;
		previousUrl = urlString;
		
		// Only set navigation flag if we have actual URL parameters to process
		const hasParams = params.batchId !== undefined || 
		                 params.categoryId !== undefined || 
		                 params.storyIndex !== undefined ||
		                 params.dataLang !== undefined;
		                 
		if (hasParams) {
			isRestoringFromHistory = true;
		}
		return;
	}
	
	// Check if we need to restore state from URL (browser navigation)
	if (UrlNavigationService.areUrlsDifferent(urlString, previousUrl) && !isRestoringFromHistory) {
		isRestoringFromHistory = true;
		previousUrl = urlString;
	}
});

// Handle navigation side effects
$effect(() => {
	if (!browser || !onNavigate) return;
	
	// Parse current URL for navigation
	const params = UrlNavigationService.parseUrl(page.url);
	const urlString = UrlNavigationService.getFullUrl(page.url);
	
	// Handle initial navigation
	if (initialLoadProcessed && isRestoringFromHistory && UrlNavigationService.areUrlsDifferent(urlString, '')) {
		const hasParams = params.batchId !== undefined || 
		                 params.categoryId !== undefined || 
		                 params.storyIndex !== undefined ||
		                 params.dataLang !== undefined;
		
		if (hasParams) {
			onNavigate(params);
			
			// Reset flag after navigation
			setTimeout(() => {
				isRestoringFromHistory = false;
			}, 100);
		}
	}
});

// Track previous props to detect actual changes
let previousBatchId = $state<string>();
let previousCategoryId = $state<string>();
let previousStoryIndex = $state<number | null>();

// Update URL when props change
$effect(() => {
	if (!browser || isRestoringFromHistory || !initialLoadProcessed) return;
	
	// Only update URL if props actually changed
	const batchChanged = batchId !== previousBatchId;
	const categoryChanged = categoryId !== previousCategoryId;
	const storyChanged = storyIndex !== previousStoryIndex;
	
	if (batchChanged || categoryChanged || storyChanged) {
		previousBatchId = batchId;
		previousCategoryId = categoryId;
		previousStoryIndex = storyIndex;
		
		// Update URL to reflect current state
		updateUrl();
	}
});
</script>