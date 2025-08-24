<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import { dataService } from '$lib/services/dataService';
import { language } from '$lib/stores/language.svelte.js';
import type { MediaInfo } from '$lib/types';
import { getTimeAgo, getMostRecentArticleDate } from '$lib/utils/getTimeAgo';
import SmartImage from '../SmartImage.svelte';
import SourceTooltip from './SourceTooltip.svelte';
import Icon from '@iconify/svelte';
import { getSectionIcon } from '$lib/constants/sections';

// Props
interface Props {
	domains: any[];
	articles: any[];
	citationMapping?: any;
	showSourceOverlay?: boolean;
	currentSource?: any;
	sourceArticles?: any[];
	currentMediaInfo?: MediaInfo | null;
	isLoadingMediaInfo?: boolean;
}

let { 
	domains, 
	articles, 
	citationMapping,
	showSourceOverlay = $bindable(false),
	currentSource = $bindable(null),
	sourceArticles = $bindable([]),
	currentMediaInfo = $bindable(null),
	isLoadingMediaInfo = $bindable(false)
}: Props = $props();

// State
let showAllSources = $state(false);
let visibleSources = $state(typeof window !== 'undefined' && window.innerWidth <= 768 ? 4 : 8);

// Source tooltip reference
let sourceTooltip: SourceTooltip;

// All unique domains across articles for the global icon tooltip
const allArticleDomains = $derived.by(() => {
    const set = new Set<string>();
    (articles || []).forEach(a => { if (a?.domain) set.add(a.domain); });
    return Array.from(set);
});

// Handle window resize
if (typeof window !== 'undefined') {
	window.addEventListener('resize', () => {
		visibleSources = window.innerWidth <= 768 ? 4 : 8;
	});
}

// Handle source click
async function handleSourceClick(domain: any) {
	currentSource = domain;
	sourceArticles = articles.filter(a => a.domain === domain?.name) || [];
	currentMediaInfo = null;
	isLoadingMediaInfo = true;
	
	// Fetch media info for this specific domain
	if (domain?.name) {
		try {
			const mediaInfo = await dataService.loadMediaDataForHost(domain.name, language.data);
			currentMediaInfo = mediaInfo;
		} catch (error) {
			console.error('Failed to load media info for domain:', domain.name, error);
			currentMediaInfo = null;
		}
	}
	
	isLoadingMediaInfo = false;
	showSourceOverlay = true;
}

// Handle source hover for tooltip
function handleSourceHover(event: Event, domain: any) {
	if (!sourceTooltip) return;
	
	// Get all articles for this domain
	const domainArticles = articles.filter(a => a.domain === domain?.name) || [];
	
	sourceTooltip.handleSourceInteraction(event, [domain?.name || 'unknown'], undefined, domainArticles);
}

// Handle source hover leave
function handleSourceLeave(event: Event) {
	if (!sourceTooltip) return;
	sourceTooltip.handleSourceLeave(event);
}

// Build a complete domain list: union of provided domains and all article domains
const combinedDomains = $derived.by(() => {
    const map = new Map<string, any>();
    // Seed with provided domain objects (prefer richer objects)
    (domains || []).forEach((d: any) => {
        const name = d?.name || String(d || '').trim();
        if (name && !map.has(name)) map.set(name, d);
    });
    // Add any domains found in articles
    (articles || []).forEach((a: any) => {
        const name = a?.domain;
        if (name && !map.has(name)) map.set(name, { name });
    });
    return Array.from(map.values());
});

// Sort domains: cited first by their minimum citation number, then non‑cited alphabetically
const sortedDomains = $derived.by(() => {
    const list = combinedDomains || [];
    const domainToMinCitation = new Map<string, number>();
    if (citationMapping?.numberToArticle) {
        for (const [num, art] of citationMapping.numberToArticle.entries()) {
            if (art?.domain) {
                const prev = domainToMinCitation.get(art.domain);
                if (prev == null || num < prev) domainToMinCitation.set(art.domain, num);
            }
        }
    }
    return [...list].sort((a: any, b: any) => {
        const aMin = domainToMinCitation.get(a?.name);
        const bMin = domainToMinCitation.get(b?.name);
        const aCited = aMin != null;
        const bCited = bMin != null;
        if (aCited !== bCited) return aCited ? -1 : 1;
        if (aCited && bCited) return (aMin as number) - (bMin as number);
        return String(a?.name || '').localeCompare(String(b?.name || ''));
    });
});

// Unique cited article counts per domain (dedupe by link/title)
const citedCountsByDomain = $derived.by(() => {
    const result = new Map<string, number>();
    const map = citationMapping?.numberToArticle;
    if (!map) return result;
    const domainToLinks = new Map<string, Set<string>>();
    for (const art of map.values()) {
        if (!art?.domain) continue;
        const key = (art as any).link || (art as any).title || '';
        if (!key) continue;
        if (!domainToLinks.has(art.domain)) domainToLinks.set(art.domain, new Set<string>());
        domainToLinks.get(art.domain)!.add(key);
    }
    for (const [dom, set] of domainToLinks) {
        result.set(dom, set.size);
    }
    return result;
});
</script>

<section class="mt-6">
    <div class="mb-4 flex items-center justify-between">
        <h3 class="flex items-center gap-2 text-xl font-semibold text-gray-800 dark:text-gray-200">
            <Icon 
                icon={getSectionIcon('sources')} 
                class="h-5 w-5 text-gray-500 dark:text-gray-400 cursor-pointer" 
                title={s('section.sources') || 'Sources'}
                role="button"
                tabindex="0"
                onmouseenter={(e) => sourceTooltip?.handleSourceInteraction(e, allArticleDomains, undefined, articles)}
                onmouseleave={(e) => sourceTooltip?.handleSourceLeave(e)}
                onfocus={(e) => sourceTooltip?.handleSourceInteraction(e, allArticleDomains, undefined, articles)}
                onblur={(e) => sourceTooltip?.handleSourceLeave(e)}
                onclick={(e) => sourceTooltip?.handleSourceInteraction(e, allArticleDomains, undefined, articles)}
                onkeydown={(e) => ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') && sourceTooltip?.handleSourceInteraction(e, allArticleDomains, undefined, articles)}
            />
            <span>{s('section.sources') || 'Sources'}</span>
        </h3>
		{#if domains.length > visibleSources}
			<button
				onclick={() => showAllSources = !showAllSources}
				class="text-gray-600 hover:text-gray-800 focus-visible-ring dark:text-gray-400 dark:hover:text-gray-200"
				aria-label={showAllSources ? 'Show fewer sources' : 'Show all sources'}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="ml-1 inline-block h-5 w-5 transform transition-transform duration-200"
					class:rotate-180={showAllSources}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19 9l-7 7-7-7"
					/>
				</svg>
			</button>
		{/if}
	</div>
	
    <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {#each sortedDomains as domain, index}
            {#if index < visibleSources || showAllSources}
            <button type="button"
                class="source-item grid grid-cols-[2.5rem_1fr] grid-rows-[auto_auto] w-full gap-x-2 rounded-lg py-2 pl-2 text-left transition-colors hover:bg-gray-100 focus-visible-ring dark:hover:bg-gray-700"
				onclick={(e) => { e.stopPropagation(); handleSourceClick(domain);} }
				onmouseenter={(e) => handleSourceHover(e, domain)}
				onmouseleave={handleSourceLeave}
				aria-label={`Show articles from ${domain?.name || 'Unknown'}`}
				title={`Show articles from ${domain?.name || 'Unknown'}`}
				>
                    <!-- Icon column centered across card -->
                    <div class="row-span-2 col-start-1 flex items-center justify-center">
                        <SmartImage
                            domain={domain?.name}
                            alt={`${domain?.name || 'Unknown'} Favicon`}
                            class="h-6 w-6 rounded-full"
                            size={48}
                            loading="eager"
                            preferIconify={true}
                            addBackground={true}
                            backgroundMode="transparent-only"
                        />
                    </div>
                    <span class="col-start-2 truncate text-base font-semibold">
                        {domain?.name || 'Unknown'}
                    </span>
                    <div class="col-start-2 flex flex-col text-xs text-gray-500 dark:text-gray-400 leading-5">
                        {#if articles}
                            {@const articleCount = articles.filter(a => a.domain === domain?.name).length}
                            {@const mostRecentDate = getMostRecentArticleDate(articles, domain?.name)}
                            {@const citedCount = citedCountsByDomain.get(domain?.name) || 0}
                            <span>
                                {#if mostRecentDate && articleCount > 0}
                                    {getTimeAgo(mostRecentDate)} · {articleCount === 1 ? s('sources.article', { count: articleCount.toString() }) : s('sources.articles', { count: articleCount.toString() })}
                                {:else}
                                    {articleCount === 1 ? s('sources.article', { count: articleCount.toString() }) : s('sources.articles', { count: articleCount.toString() })}
                                {/if}
                            </span>
                            <span>{citedCount} cited</span>
                        {:else}
                            <span>{s('sources.articles', { count: '0' })}</span>
                            <span>0 cited</span>
                        {/if}
                    </div>
				</button>
			{/if}
        {/each}
	</div>
</section>

<!-- Source Tooltip for source hover -->
<SourceTooltip 
	bind:this={sourceTooltip}
	{articles}
	{citationMapping}
	citedItems={[]}
/>
