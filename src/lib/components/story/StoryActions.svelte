<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import { page } from '$app/state';
import ShareButton from '../ShareButton.svelte';
import ReportButton from '../ReportButton.svelte';
import { generateShareUrl, slugify } from '$lib/utils/urlShortener';
import { browser } from '$app/environment';
import { UrlNavigationService } from '$lib/services/urlNavigationService';
import { dataLanguage } from '$lib/stores/dataLanguage.svelte';

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
		return { batchId, categoryId, storyIndex, dataLang: dataLanguage.current };
	}
	
	// Fall back to parsing from current URL
	const params = UrlNavigationService.parseUrl(page.url);
	return {
		batchId: params.batchId || batchId,
		categoryId: params.categoryId || categoryId,
		storyIndex: params.storyIndex ?? storyIndex,
		dataLang: params.dataLang || dataLanguage.current
	};
});

// Extract topicId from the query string when viewing topic feeds
const topicId = $derived.by(() => {
    if (navigationParams.categoryId === 'topics') {
        return page.url.searchParams.get('topic');
    }
    return null;
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
        topicId,
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
			topicId={topicId}
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
		class="focus:ring-opacity-75 rounded-lg bg-black px-6 py-3 font-semibold text-white transition-colors duration-200 ease-in-out hover:bg-gray-800 focus:ring-2 focus:ring-gray-400 focus:outline-none"
	>
		{s('article.closeStory') || 'Close'}
	</button>

	<!-- Right side: Empty spacer for balance -->
	<div class="flex-1"></div>
</div> 