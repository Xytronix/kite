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

// Minimal state tracking
let lastUrl = $state('');
let initialized = $state(false);

// Debug export for checking state
export function getNavigationState() {
	return {
		lastUrl,
		initialized,
		currentPageUrl: browser ? window.location.href : ''
	};
}

// Force reset navigation state (for debugging)
export function resetNavigationState() {
	console.log('🔧 HistoryManager navigation state reset');
}

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
	if (!browser) return;
	
	try {
		const newUrl = buildUrl(params);
		
		// Only update if URL actually changed
		if (newUrl !== lastUrl) {
			lastUrl = newUrl;
			skReplaceState(newUrl, { keepfocus: true, noscroll: true });
		}
	} catch (error) {
		console.warn('HistoryManager updateUrl error:', error);
	}
}

// Navigate to new URL with history entry
export function navigateTo(params: Partial<NavigationParams>) {
	if (!browser) return;
	
	try {
		const newUrl = buildUrl(params);
		
		// Only navigate if URL actually changed
		if (newUrl !== lastUrl) {
			lastUrl = newUrl;
			goto(newUrl, {
				keepfocus: true,
				noscroll: true,
				state: { restored: false }
			});
		}
	} catch (error) {
		console.warn('HistoryManager navigateTo error:', error);
	}
}

// Simple initialization - only run once
$effect(() => {
	if (!browser || initialized) return;
	
	initialized = true;
	const urlString = UrlNavigationService.getFullUrl(page.url);
	lastUrl = urlString;
	
	// Parse URL and trigger navigation if we have parameters
	const params = UrlNavigationService.parseUrl(page.url);
	const hasParams = params.batchId || params.categoryId || params.storyIndex !== undefined || params.dataLang;
	
	if (hasParams && onNavigate) {
		// Use setTimeout to avoid blocking the UI
		setTimeout(() => {
			onNavigate(params);
		}, 0);
	}
});
</script>