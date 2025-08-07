import { preloadStoryIcons } from '$lib/utils/iconPreloader';
import type { Story } from '$lib/types';

/**
 * Hook to automatically preload icons when stories are provided
 */
export function useIconPreloading(stories: Story[]) {
	// Preload icons whenever stories change
	$effect(() => {
		if (stories.length > 0) {
			preloadStoryIcons(stories);
		}
	});
}

/**
 * Hook to preload icons for a single story
 */
export function useStoryIconPreloading(story: Story | null) {
	$effect(() => {
		if (story) {
			preloadStoryIcons([story]);
		}
	});
}