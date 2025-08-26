<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import { experimental } from '$lib/stores/experimental.svelte.js';
import CitationText from './CitationText.svelte';
import IconDisplay from '$lib/components/IconDisplay.svelte';
import { replaceWithNumberedCitations, type CitationMapping } from '$lib/utils/citationContext';

// Props
interface Props {
	story: any;
	isRead?: boolean;
	onTitleClick?: () => void;
	onReadClick?: (e: Event) => void;
	citationMapping?: CitationMapping;
}

let { story, isRead = false, onTitleClick, onReadClick, citationMapping }: Props = $props();

// Define colors ordered by perceptual distinctness
// These are maximally distinct colors that work well together
const DISTINCT_COLORS = [
	{ name: 'red', light: '#e74c3c', dark: '#ff6b6b' },
	{ name: 'blue', light: '#3498db', dark: '#74b9ff' },
	{ name: 'green', light: '#2ecc71', dark: '#55efc4' },
	{ name: 'purple', light: '#9b59b6', dark: '#a29bfe' },
	{ name: 'orange', light: '#f39c12', dark: '#fdcb6e' },
	{ name: 'teal', light: '#1abc9c', dark: '#00cec9' },
	{ name: 'pink', light: '#e91e63', dark: '#fd79a8' },
	{ name: 'indigo', light: '#3f51b5', dark: '#7986cb' },
	{ name: 'amber', light: '#ff9800', dark: '#ffb74d' }
];

// Generate topic color class using a smarter selection algorithm
function getTopicColorClass(category: string): string {
	// Create a simple hash from the category string
	let hash = 0;
	for (let i = 0; i < category.length; i++) {
		const char = category.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	
	// Use the hash to select from our distinct colors
	const colorIndex = Math.abs(hash) % DISTINCT_COLORS.length;
	return `topic-color-${colorIndex}`;
}

// Get emoji from story data when experimental settings are enabled
const categoryEmoji = $derived.by(()=>{
    if (experimental.useCategoryEmojis) return story.emoji;
    if (experimental.showCategoryIcons) return story.emoji;
    return '';
});
const articleEmoji = $derived.by(()=>{
    if (experimental.useArticleEmojis) return story.emoji;
    if (experimental.showArticleIcons) return story.emoji;
    return '';
});



// Convert title citations to numbered format if mapping is available
const displayTitle = $derived.by(() => {
	if (!citationMapping) return story.title;
	return replaceWithNumberedCitations(story.title, citationMapping);
});
</script>

<!-- Story Header - Clickable Area -->
<div 
	class="cursor-pointer" 
	role="button"
	tabindex="0"
	onclick={(e) => { e.stopPropagation(); onTitleClick?.(); }}
	onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onTitleClick?.(); } }}
	aria-label="Story header"
>
	<header class="mb-1 flex items-center justify-between">
		<span class="category-label flex items-center gap-1 rounded py-1 text-sm text-gray-700 dark:text-gray-300" data-no-wiki>
			{#if categoryEmoji}
				<IconDisplay emoji={categoryEmoji} className="icon-sm" forceEmoji={experimental.useCategoryEmojis} />
			{/if}
			<span class={getTopicColorClass(story.category)}>
				{story.category}
			</span>
		</span>
	</header>

	<!-- Story Title and Read Button -->
	<div class="flex items-start">
		<div class="flex-grow">
			<div
				data-no-wiki
				class="dark:text-dark-text mb-2 flex cursor-pointer items-center gap-2 text-xl text-gray-800 text-left w-full focus-visible-ring rounded"
				class:font-semibold={!isRead}
				id="story-title-{story.cluster_number}"
				role="button"
				tabindex="0"
				aria-label="Expand story: {story.title}"
				onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onTitleClick?.(); } }}
			>
				{#if articleEmoji}
					<IconDisplay emoji={articleEmoji} className="icon-lg" forceEmoji={experimental.useArticleEmojis} />
				{/if}
				<span class="flex-grow"><CitationText text={displayTitle} showFavicons={false} showNumbers={false} inline={true} articles={story.articles || []} {citationMapping} /></span>
			</div>
		</div>
		
		<!-- Read Status Button -->
		<div class="-mt-3 ml-4 flex-shrink-0">
			<button
				onclick={(e) => { e.stopPropagation(); onReadClick?.(e); }}
				class="focus-visible-ring rounded-full flex items-center justify-center p-1.5 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800"
				class:bg-blue-50={isRead}
				class:dark:bg-blue-950={isRead}
				class:hover:bg-blue-100={isRead}
				class:dark:hover:bg-blue-900={isRead}
				title={s('article.readStatus') || 'Mark as read'}
				aria-label={isRead ? 'Mark as unread' : 'Mark as read'}
			>
				<svg
					class="h-4 w-4 transition-all duration-200"
					class:text-blue-600={isRead}
					class:dark:text-blue-400={isRead}
					class:text-gray-400={!isRead}
					class:dark:text-gray-500={!isRead}
					class:scale-110={isRead}
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>
		</div>
	</div>
</div>

<style>
/* Topic color classes - ordered by perceptual distinctness */
/* Light mode colors */
:global(.topic-color-0) { color: #e74c3c; } /* red */
:global(.topic-color-1) { color: #3498db; } /* blue */
:global(.topic-color-2) { color: #2ecc71; } /* green */
:global(.topic-color-3) { color: #9b59b6; } /* purple */
:global(.topic-color-4) { color: #f39c12; } /* orange */
:global(.topic-color-5) { color: #1abc9c; } /* teal */
:global(.topic-color-6) { color: #e91e63; } /* pink */
:global(.topic-color-7) { color: #3f51b5; } /* indigo */
:global(.topic-color-8) { color: #ff9800; } /* amber */

/* Dark mode variants - optimized for better contrast and distinctness */
:global(.dark .topic-color-0) { color: #ff6b6b; } /* red */
:global(.dark .topic-color-1) { color: #74b9ff; } /* blue */
:global(.dark .topic-color-2) { color: #55efc4; } /* green */
:global(.dark .topic-color-3) { color: #a29bfe; } /* purple */
:global(.dark .topic-color-4) { color: #fdcb6e; } /* orange */
:global(.dark .topic-color-5) { color: #00cec9; } /* teal */
:global(.dark .topic-color-6) { color: #fd79a8; } /* pink */
:global(.dark .topic-color-7) { color: #7986cb; } /* indigo */
:global(.dark .topic-color-8) { color: #ffb74d; } /* amber */
</style> 