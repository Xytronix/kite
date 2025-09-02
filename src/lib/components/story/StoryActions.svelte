<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import { page } from '$app/state';
import ShareButton from '../ShareButton.svelte';
import ReportButton from '../ReportButton.svelte';
import { generateShareUrl, slugify } from '$lib/utils/urlShortener';
import { browser } from '$app/environment';
import { UrlNavigationService } from '$lib/services/urlNavigationService';
import { language } from '$lib/stores/language.svelte.js';

// Props
interface Props {
	story: any;
	onClose?: () => void;
	batchId?: string;
	categoryId?: string;
	storyIndex?: number;
}

let { story, onClose, batchId, categoryId, storyIndex }: Props = $props();

// Get current navigation params from URL if not provided
const navigationParams = $derived.by(() => {
	if (batchId && categoryId && storyIndex !== undefined) {
		return { batchId, categoryId, storyIndex, dataLang: language.data };
	}
	
	// Fall back to parsing from current URL
	const params = UrlNavigationService.parseUrl(page.url);
	return {
		batchId: params.batchId || batchId,
		categoryId: params.categoryId || categoryId,
		storyIndex: params.storyIndex ?? storyIndex,
		dataLang: params.dataLang || language.data
	};
});



// Build canonical link for reporting
const reportUrl = $derived.by(() => {
    if (!browser) return '';
    const base = window.location.origin;
    const slug = story?.title ? slugify(story.title) : undefined;
    return generateShareUrl(base, {
        batchId: navigationParams.batchId,
        categoryId: navigationParams.categoryId,
        storyIndex: navigationParams.storyIndex,
        dataLang: navigationParams.dataLang,
        slug
    });
});
</script>

<div class="order-last mt-6 flex w-full items-center justify-center md:px-0">
	<!-- Left side: Share Button -->
	<div class="flex-1 flex justify-start gap-2">
		<ShareButton
			title={story.title}
			description={story.short_summary}
			batchId={navigationParams.batchId}
			categoryId={navigationParams.categoryId}
			storyIndex={navigationParams.storyIndex}
			dataLang={navigationParams.dataLang}
			class="text-gray-600 transition-all duration-200 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700"
		/>
		<ReportButton
			{story}
			url={reportUrl}
			class="text-gray-600 transition-all duration-200 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700"
		/>
	</div>

	<!-- Center: Close Button -->
	<button
		onclick={(e) => { e.stopPropagation(); onClose?.(); }}
		class="group inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white bg-gradient-to-r from-gray-700 via-gray-600 to-gray-800 hover:from-gray-700 hover:to-gray-700 dark:from-gray-600 dark:via-gray-600 dark:to-gray-700 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 transition-all"
		aria-label={s('article.closeStory') || 'Close'}
	>
		<span>{s('article.closeStory') || 'Close'}</span>
		<svg class="h-4 w-4 opacity-90 group-hover:rotate-90 transition-transform" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
			<path d="M10 8.586l4.95-4.95a1 1 0 1 1 1.414 1.414L11.414 10l4.95 4.95a1 1 0 1 1-1.414 1.414L10 11.414l-4.95 4.95a1 1 0 0 1-1.414-1.414L8.586 10l-4.95-4.95A1 1 0 0 1 5.05 3.636L10 8.586z"/>
		</svg>
	</button>
	
	<!-- Right side: Empty spacer for balance -->
	<div class="flex-1"></div>
</div> 