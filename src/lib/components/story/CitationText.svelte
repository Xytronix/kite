<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import type { ParsedTextSegment, Citation } from '$lib/utils/citationUtils';
import type { Article } from '$lib/types';
import type { CitationMapping } from '$lib/utils/citationContext';
import SourceTooltip from './SourceTooltip.svelte';
import SmartImage from '../SmartImage.svelte';
import Icon from '$lib/components/Icon.svelte';
import { experimental } from '$lib/stores/experimental.svelte.js';

// Props
interface Props {
	text: string;
	showFavicons?: boolean;
	forceShowFavicons?: boolean; // Force show favicons regardless of experimental setting
	showNumbers?: boolean;
	inline?: boolean; // Whether to render inline (for list items) or as block (for paragraphs)
	articles?: Article[]; // Articles for citation tooltip
    allArticles?: Article[]; // Full story articles for the global sources icon/tooltip
	citationMapping?: CitationMapping; // Global citation mapping
	citationTooltip?: SourceTooltip; // External tooltip reference for shared tooltips
}

let { 
	text, 
	showFavicons = false, // Changed default to false (most common usage)
	forceShowFavicons = false,
	showNumbers = false,
	inline = true, // Changed default to true (most common usage)
    articles = [],
    allArticles = [],
	citationMapping,
	citationTooltip: externalTooltip
}: Props = $props();

// Decode HTML entities to render text like R&amp;D as R&D
function decodeHtmlEntities(text: string): string {
    if (typeof document === 'undefined') return text;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

// Parse text and format citations
const parsedData = $derived.by(() => {
	// Ensure text is a string
	const textString = typeof text === 'string' ? text : String(text || '');
	
	// Parse citations - text should already have numbered citations if citationMapping is provided
	// Also handle [*] for common knowledge
	const citationPattern = /\[(\d+|\*)\]/g;
	const segments: ParsedTextSegment[] = [];
	const citations: Citation[] = [];
	const citedArticleIndices: number[] = []; // Track which articles are actually cited
	let lastIndex = 0;
	let match;
	
	while ((match = citationPattern.exec(textString)) !== null) {
		// Add text before citation
		if (match.index > lastIndex) {
			segments.push({
				type: 'text',
				content: textString.slice(lastIndex, match.index)
			});
		}
		
		const citationText = match[1];
		const fullText = match[0];
		
		// Handle common knowledge citations
		if (citationText === '*') {
			const citation: Citation = {
				id: `citation-common`,
				domain: 'common',
				articleId: 'common',
				fullText,
				number: -1 // Special marker for common knowledge
			};
			
			segments.push({
				type: 'citation',
				content: fullText,
				citation
			});
			
			citations.push(citation);
		} else {
			// Handle numbered citations
			const citationNumber = parseInt(citationText);
			
			// Get article from citation mapping or fallback to direct index
			let article: Article | undefined;
			
			if (citationMapping) {
				// Use the citation mapping to get the article
				article = citationMapping.numberToArticle.get(citationNumber);
			} else {
				// Fallback to direct array index
				article = articles[citationNumber - 1];
			}
			
			if (article) {
				const citation: Citation = {
					id: `citation-${citationNumber}`,
					domain: article.domain,
					articleId: citationNumber.toString(),
					fullText,
					number: citationNumber
				};
				
				segments.push({
					type: 'citation',
					content: fullText,
					citation
				});
				
				citations.push(citation);
				
				// Find the article index in the articles array
				const articleIndex = articles.indexOf(article);
				if (articleIndex >= 0) {
					citedArticleIndices.push(articleIndex);
				}
			} else {
				// No matching article, treat as text
				segments.push({
					type: 'text',
					content: fullText
				});
			}
		}
		
		lastIndex = match.index + match[0].length;
	}
	
	// Add remaining text
	if (lastIndex < textString.length) {
		segments.push({
			type: 'text',
			content: textString.slice(lastIndex)
		});
	}
	
	return {
		formattedSegments: segments,
		citations,
		citedArticleIndices
	};
});

// Get unique domains for favicon display
const uniqueDomains = $derived.by(() => {
	const domains = new Set<string>();
	parsedData.citations.forEach(citation => {
		if (citation.domain && citation.domain !== 'common') {
			domains.add(citation.domain);
		}
	});
	const result = Array.from(domains);
	// Debug log for favicon display
	if (showFavicons && forceShowFavicons) {
		console.log('CitationText debug:', {
			showFavicons,
			forceShowFavicons,
			uniqueDomainsLength: result.length,
			uniqueDomains: result,
			citations: parsedData.citations,
			experimental: experimental.sourceIconPosition
		});
	}
	return result;
});

// State for showing citation sources
let showSources = $state(false);

// Check if any citations are common knowledge
const hasCommonKnowledge = $derived.by(() => {
	return parsedData.citations.some(citation => citation.domain === 'common');
});

// Citation tooltip reference
let citationTooltip = $state<SourceTooltip | undefined>();

// Use external tooltip if provided, otherwise use internal one
const tooltipReference = $derived(externalTooltip || citationTooltip);

// Get only the articles that are cited in this text with their citation numbers
const citedArticlesWithNumbers = $derived.by(() => {
	return parsedData.citations
		.map(citation => ({
			article: citation.domain === 'common' ? null : (citationMapping ? citationMapping.numberToArticle.get(citation.number!) : articles[citation.number! - 1]),
			number: citation.number!,
			isCommon: citation.domain === 'common'
		})) as Array<{ article: Article | null; number: number; isCommon?: boolean }>;
});

// Just the articles for backwards compatibility
const citedArticles = $derived.by(() => {
	return citedArticlesWithNumbers
		.filter((item): item is { article: Article; number: number } => !!item.article)
		.map(item => item.article);
});

// All unique domains across the passed-in articles (for the global sources icon)
const allArticleDomains = $derived.by(() => {
    const pool = (allArticles && allArticles.length > 0) ? allArticles : (articles || []);
    return Array.from(new Set(pool.map(a => a.domain))).filter(Boolean) as string[];
});
</script>

<div class="citation-wrapper">
	<!-- Main content -->
	<div class="citation-content {inline ? 'inline' : 'block'}">
		{#if inline}
			<!-- Inline rendering for list items -->
			{#each parsedData.formattedSegments as segment}
				{#if segment.type === 'text'}
					{decodeHtmlEntities(segment.content)}
				{:else if segment.type === 'citation'}
					{#if showNumbers}
						<span class="citation-number text-blue-600 dark:text-blue-400 text-xs align-super cursor-help" title="Source: {segment.citation?.domain}">
							{segment.content}
						</span>
					{:else}
						<!-- Show as clean numbered citation -->
						<span 
							class="citation-number text-blue-600 dark:text-blue-400 text-xs align-super cursor-help font-medium hover:bg-blue-100 dark:hover:bg-blue-900 rounded px-0.5 transition-colors" 
							title="{segment.citation?.domain === 'common' ? 'Common knowledge' : `Source ${segment.citation?.number}: ${segment.citation?.domain}`}"
							role="button"
							tabindex="0"
							aria-label="{segment.citation?.domain === 'common' ? 'Common knowledge citation' : `Citation ${segment.citation?.number}: ${segment.citation?.domain}`}"
							onmouseover={(e) => tooltipReference?.handleSourceInteraction(e, uniqueDomains, segment.citation?.number)}
							onmouseleave={(e) => tooltipReference?.handleSourceLeave(e)}
							onfocus={(e) => tooltipReference?.handleSourceInteraction(e, uniqueDomains, segment.citation?.number)}
							onblur={(e) => tooltipReference?.handleSourceLeave(e)}
							onclick={(e) => tooltipReference?.handleSourceInteraction(e, uniqueDomains, segment.citation?.number)}
							onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && tooltipReference?.handleSourceInteraction(e, uniqueDomains, segment.citation?.number)}
						>
							{segment.content}
						</span>
					{/if}
				{/if}
			{/each}
		{:else}
			<!-- Block rendering for paragraphs -->
			<p class="mb-2">
				{#each parsedData.formattedSegments as segment}
					{#if segment.type === 'text'}
						{decodeHtmlEntities(segment.content)}
					{:else if segment.type === 'citation'}
						{#if showNumbers}
							<span class="citation-number text-blue-600 dark:text-blue-400 text-xs align-super cursor-help" title="Source: {segment.citation?.domain}">
								{segment.content}
							</span>
						{:else}
							<!-- Show as clean numbered citation -->
							<span 
								class="citation-number text-blue-600 dark:text-blue-400 text-xs align-super cursor-help font-medium hover:bg-blue-100 dark:hover:bg-blue-900 rounded px-0.5 transition-colors" 
								title="{segment.citation?.domain === 'common' ? 'Common knowledge' : `Source ${segment.citation?.number}: ${segment.citation?.domain}`}"
								role="button"
								tabindex="0"
								aria-label="{segment.citation?.domain === 'common' ? 'Common knowledge citation' : `Citation ${segment.citation?.number}: ${segment.citation?.domain}`}"
								onmouseover={(e) => tooltipReference?.handleSourceInteraction(e, uniqueDomains, segment.citation?.number)}
								onmouseleave={(e) => tooltipReference?.handleSourceLeave(e)}
								onfocus={(e) => tooltipReference?.handleSourceInteraction(e, uniqueDomains, segment.citation?.number)}
								onblur={(e) => tooltipReference?.handleSourceLeave(e)}
								onclick={(e) => tooltipReference?.handleSourceInteraction(e, uniqueDomains, segment.citation?.number)}
								onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && tooltipReference?.handleSourceInteraction(e, uniqueDomains, segment.citation?.number)}
							>
								{segment.content}
							</span>
						{/if}
					{/if}
				{/each}
			</p>
		{/if}
	</div>

	<!-- Citation sources with favicons - only show inline if position is set to 'inline' or forced -->
    {#if showFavicons && uniqueDomains.length > 0 && (forceShowFavicons || experimental.sourceIconPosition === 'inline')}
        <div class="citation-sources flex items-center">
        <!-- Global sources icon that reveals ALL sources for this text block -->
        <button
            class="mr-2 inline-flex items-center justify-center rounded p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
            aria-label="View all sources"
            onmouseover={(e) => tooltipReference?.handleSourceInteraction(e, allArticleDomains, undefined, allArticles)}
            onmouseleave={(e) => tooltipReference?.handleSourceLeave(e)}
            onfocus={(e) => tooltipReference?.handleSourceInteraction(e, allArticleDomains, undefined, allArticles)}
            onblur={(e) => tooltipReference?.handleSourceLeave(e)}
            onclick={(e) => tooltipReference?.handleSourceInteraction(e, allArticleDomains, undefined, allArticles)}
            onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && tooltipReference?.handleSourceInteraction(e, allArticleDomains, undefined, allArticles)}
            type="button"
        >
            <Icon icon="tabler:sitemap" class="h-4 w-4" />
        </button>
        <span class="text-xs text-gray-500 dark:text-gray-400 mr-2">
            {s(uniqueDomains.length === 1 ? 'citation.source' : 'citation.sources')}
        </span>
        <div class="flex items-center -space-x-3">
			{#each uniqueDomains.slice(0, 5) as domain, index}
				<div 
					class="favicon-wrapper relative w-6 h-6 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center hover:z-10 transition-all hover:scale-110 cursor-pointer overflow-hidden"
					style="z-index: {5 - index}"
					title={domain}
					role="button"
					tabindex="0"
					aria-label="View citations from {domain}"
		onmouseover={(e) => {
			e.stopPropagation();
			const domainArticles = articles.filter(a => a.domain === domain);
			tooltipReference?.handleSourceInteraction(e, [domain], undefined, domainArticles);
		}}
		onmouseleave={(e) => {
			e.stopPropagation();
			tooltipReference?.handleSourceLeave(e);
		}}
		onfocus={(e) => {
			e.stopPropagation();
			const domainArticles = articles.filter(a => a.domain === domain);
			tooltipReference?.handleSourceInteraction(e, [domain], undefined, domainArticles);
		}}
		onblur={(e) => {
			e.stopPropagation();
			tooltipReference?.handleSourceLeave(e);
		}}
		onclick={(e) => {
			e.stopPropagation();
            // On click (especially mobile), show ALL section sources rather than per-domain
            tooltipReference?.handleSourceInteraction(e, allArticleDomains, undefined, allArticles);
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.stopPropagation();
                tooltipReference?.handleSourceInteraction(e, allArticleDomains, undefined, allArticles);
			}
		}}
				>
					<SmartImage 
						domain={domain}
						alt="{domain} favicon" 
						class="w-full h-full"
						size={24}
						loading="eager"
						preferIconify={true}
						addBackground={true}
					/>
				</div>
			{/each}
			{#if uniqueDomains.length > 5}
				<div class="ml-3 text-xs text-gray-500 dark:text-gray-400">
					+{uniqueDomains.length - 5} more
				</div>
			{/if}
		</div>
	</div>
	{/if}

	<!-- Numbered citations list (if using numbered format) -->
	{#if showNumbers && parsedData.citations.length > 0 && !inline}
	<button 
		class="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
		onclick={() => showSources = !showSources}
	>
		{showSources ? 'Hide' : 'Show'} sources
	</button>
	
	{#if showSources}
		<div class="citation-list mt-2 text-sm text-gray-600 dark:text-gray-400">
			{#each parsedData.citations as citation, index}
				<div class="citation-item">
					[{index + 1}] {citation.domain}
					{#if citation.domain !== 'common'}
						<SmartImage 
							domain={citation.domain}
							alt="{citation.domain} favicon" 
							class="inline-block w-4 h-4 ml-1 rounded-full"
							size={32}
							loading="eager"
							preferIconify={true}
							addBackground={true}
						/>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
	{/if}
</div>

<!-- Source Tooltip (only if no external tooltip provided) -->
{#if !externalTooltip}
	<SourceTooltip 
		bind:this={citationTooltip} 
		articles={citedArticles}
		allArticles={articles}
		citationNumbers={citedArticlesWithNumbers.map(item => item.number)} 
		hasCommonKnowledge={hasCommonKnowledge}
		citedItems={citedArticlesWithNumbers}
		{citationMapping}
	/>
{/if}

<style>
	.citation-wrapper {
		display: block;
	}
	
	.citation-content {
		display: block;
	}
	
	.citation-content.inline {
		display: inline;
	}
	
	.citation-sources {
		margin-top: 0.25rem;
	}
	
	.citation-number {
		font-weight: 500;
		margin: 0;
		margin-right: -2px;
		letter-spacing: -0.5px;
	}
	
	.favicon-wrapper {
		transition: transform 0.2s, z-index 0.2s;
	}
	
	.citation-list {
		border-left: 2px solid;
		padding-left: 0.75rem;
		margin-top: 0.5rem;
	}
	
	.citation-item {
		display: flex;
		align-items: center;
		margin-bottom: 0.25rem;
	}
</style>