<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import CitationText from './CitationText.svelte';
import SectionSources from './SectionSources.svelte';
import { useCitationProcessing } from '$lib/utils/citationProcessing';
import type { CitationProps } from '$lib/types/citation';
import Icon from '@iconify/svelte';
import { getSectionIcon } from '$lib/constants/sections';
import { experimental } from '$lib/stores/experimental.svelte.js';

// Props
interface Props extends CitationProps {
	content: string;
}

let { content, articles = [], citationMapping }: Props = $props();

// Convert citations to numbered format if mapping is available
const displayContent = $derived.by(() => {
	const processed = useCitationProcessing(content, citationMapping);
	// Ensure we return a string (content is always a string, but TypeScript needs assurance)
	return typeof processed === 'string' ? processed : processed.join(' ');
});

// Extract only the articles that are actually cited in this section
const sectionCitedArticles = $derived.by(() => {
	if (!citationMapping) return [];
	
	const citationNumbers = new Set<number>();
	// Look for citation patterns [1], [2], etc. in the display content
	const citationMatches = displayContent.match(/\[(\d+)\]/g);
	if (citationMatches) {
		citationMatches.forEach((match) => {
			const num = parseInt(match.replace(/[\[\]]/g, ''));
			if (!isNaN(num)) {
				citationNumbers.add(num);
			}
		});
	}
	
	// Get articles for these specific citation numbers
	const citedArticles: typeof articles = [];
	citationNumbers.forEach((num) => {
		const article = citationMapping.numberToArticle.get(num);
		if (article) {
			citedArticles.push(article);
		}
	});
	
	return citedArticles;
});
</script>

<section class="mt-6 rounded-lg bg-[#CED8FB] p-4 dark:bg-[#2A3B5E]">
	<h3 class="mb-2 flex items-center gap-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
		<Icon icon={getSectionIcon('didYouKnow')} class="h-5 w-5 text-gray-700 dark:text-gray-200" />
		<span>{s('section.didYouKnow') || 'Did You Know?'}</span>
	</h3>
	<p class="text-gray-700 dark:text-gray-200">
		<CitationText 
			text={displayContent} 
			inline={false} 
			showFavicons={true}
			{articles} 
			allArticles={articles}
			{citationMapping} 
		/>
	</p>
	
	{#if experimental.sourceIconPosition === 'section-end'}
		<SectionSources articles={sectionCitedArticles} {citationMapping} sectionTitle="Did You Know?" />
	{/if}
</section> 