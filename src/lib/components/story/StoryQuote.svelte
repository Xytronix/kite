<script lang="ts">
import CitationText from './CitationText.svelte';
import { replaceWithNumberedCitations, type CitationMapping } from '$lib/utils/citationContext';
import type { Article } from '$lib/types';
import Icon from '$lib/components/Icon.svelte';
import { getSectionIcon } from '$lib/constants/sections';

// Props
interface Props {
	quote: string;
	author?: string;
	attribution?: string;
	sourceUrl?: string;
	sourceDomain?: string;
	articles?: Article[];
	citationMapping?: CitationMapping;
}

let { quote, author, attribution, sourceUrl, sourceDomain, articles = [], citationMapping }: Props = $props();

// Convert citations to numbered format if mapping is available
const displayQuote = $derived.by(() => {
	if (!citationMapping) return quote;
	return replaceWithNumberedCitations(quote, citationMapping);
});

// Remove surrounding straight or smart quotes if present
function removeOuterQuotes(text: string): string {
    const t = (text || '').trim();
    const pairs: Array<[string, string]> = [["\"", "\""], ["“", "”"], ["'", "'"], ["‘", "’"]];
    for (const [open, close] of pairs) {
        if (t.startsWith(open) && t.endsWith(close) && t.length >= open.length + close.length + 1) {
            return t.slice(open.length, t.length - close.length).trim();
        }
    }
    return t;
}

const displayCleanQuote = $derived.by(() => removeOuterQuotes(displayQuote));
</script>

<section class="my-8 rounded-lg bg-[#F3F6FE] p-4 dark:bg-gray-700">
    <div class="relative">
        <Icon 
            icon={getSectionIcon('quotes')} 
            class="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 text-gray-700 dark:text-gray-200" 
            aria-hidden="true"
        />
        <blockquote class="text-lg text-black dark:text-white pl-10">
            <CitationText text={displayCleanQuote} showFavicons={true} showNumbers={false} {articles} allArticles={articles} {citationMapping} />
        </blockquote>
    </div>
	{#if author || attribution}
		<p class="mt-2 text-left text-gray-700 dark:text-gray-300">
			{#if sourceUrl}
				<a
					href={sourceUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="text-[#183FDC] hover:underline dark:text-[#5B89FF]"
				>
					{author}{attribution ? ` in the ${attribution}` : ''}{sourceDomain && !attribution ? ` (via ${sourceDomain})` : ''}
				</a>
			{:else}
				<span>{author}{attribution ? ` in the ${attribution}` : ''}</span>
			{/if}
		</p>
	{/if}
</section> 