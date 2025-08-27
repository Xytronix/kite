<script lang="ts">
import CitationText from './CitationText.svelte';
import SectionSources from './SectionSources.svelte';
import { replaceWithNumberedCitations, type CitationMapping } from '$lib/utils/citationContext';
import { aggregateCitationsFromTexts, aggregateCitationsPerPerspective } from '$lib/utils/citationAggregator';
import type { Article } from '$lib/types';
import Icon from '@iconify/svelte';
import { experimental } from '$lib/stores/experimental.svelte.js';

// Props
interface Props {
	title: string;
	content: string;
	articles?: Article[];
	citationMapping?: CitationMapping;
	icon?: string;
}

let { title, content, articles = [], citationMapping, icon }: Props = $props();

// Convert citations to numbered format if mapping is available
const displayContent = $derived.by(() => {
	if (!citationMapping) return content;
	return replaceWithNumberedCitations(content, citationMapping);
});

// Get cited articles from this section's content
const citedArticles = $derived.by(() => {
	const result = aggregateCitationsFromTexts([displayContent], citationMapping, articles);
	return result.citedArticles;
});

// Get paragraph-level citations (treating the whole content as one paragraph)
const paragraphCitations = $derived.by(() => {
	const result = aggregateCitationsPerPerspective([{ text: displayContent }], citationMapping, articles);
	return result.map((citation) => ({
		articles: citation.citedArticles,
		title: title
	}));
});

// Container classes - align spacing behavior with StorySummary (no reserved height)
const containerClasses = $derived('flex flex-col');
</script>

<section class="mt-6">
	<h3 class="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-800 dark:text-gray-200">
		{#if icon}
			<Icon icon={icon} class="h-5 w-5 text-gray-500 dark:text-gray-400" />
		{/if}
		<span>{title}</span>
	</h3>
	<div class="{containerClasses}">
		<div class="flex-grow">
			<div class="mb-4 text-gray-700 dark:text-gray-300">
		        <CitationText text={displayContent} showFavicons={true} showNumbers={false} {articles} allArticles={articles} {citationMapping} />
			</div>
		</div>
		
		<!-- Section-level sources -->
		{#if experimental.sourceIconPosition === 'section-end'}
			<div class="mt-auto">
				<SectionSources articles={citedArticles} {citationMapping} sectionTitle={title} {paragraphCitations} />
			</div>
		{/if}
	</div>
</section> 