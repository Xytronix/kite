<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import { browser } from '$app/environment';
import { useFloating, offset, flip, shift, size } from '@skeletonlabs/floating-ui-svelte';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';
import SmartImage from '../SmartImage.svelte';
// Reference component in a runtime variable so the import is treated as value usage (avoids `useImportType` false-positive)
const _OverlayScrollbarsComponentRuntime = OverlayScrollbarsComponent;
import Portal from 'svelte-portal';
import { scrollLock } from '$lib/utils/scrollLock';
import { s } from '$lib/client/localization.svelte';
import CitationItem from './CitationItem.svelte';
import type { Article } from '$lib/types';

interface Props {
	articles: Article[]; // All available articles
	allArticles?: Article[]; // Additional articles that may not be cited but available for display
	citationNumbers?: number[]; // The actual global citation numbers
	hasCommonKnowledge?: boolean; // Whether [*] appears in the text
	citedItems?: Array<{ article: Article | null; number: number; isCommon?: boolean }>; // All cited items including common knowledge
	citationMapping?: any; // Global citation mapping
}

const { 
	articles, 
	allArticles = [], 
	citationNumbers, 
	hasCommonKnowledge = false, 
	citedItems = [], 
	citationMapping 
}: Props = $props();

// Derive combined articles list
const combinedArticles = $derived([...articles, ...allArticles]);

// State for dynamic sizing
let tooltipMaxHeight = $state(300);

// Floating UI setup
const floating = useFloating({
	placement: 'bottom-start',
	strategy: 'fixed',
	middleware: [
		offset(8),
		flip({
			fallbackPlacements: ['top-start', 'bottom-end', 'top-end']
		}),
		shift({ 
			padding: 8,
			crossAxis: false
		}),
		size({
			apply({ availableHeight }) {
				const minHeight = 200;
				const maxHeight = Math.min(400, window.innerHeight * 0.6);
				const optimalHeight = Math.min(Math.max(minHeight, availableHeight - 16), maxHeight);
				tooltipMaxHeight = optimalHeight;
			}
		})
	]
});

// State
let showTooltip = $state(false);
let currentTooltipId = $state('');
let isMobile = $state(false);
let highlightedNumber = $state<number | undefined>(undefined);
let hideTimeout: number | null = null;
let displayItems = $state<Array<{ article: Article | null; number: number; isCommon?: boolean; isCited?: boolean }>>([]);

// Using any to avoid type issues with external typings
let tooltipScrollbars: any | null = $state(null);
// Dummy helper to illustrate variable reassignment (used by tests / devtools)
function __resetTooltipScrollbars() {
  tooltipScrollbars = null;
}

// Detect mobile device
function detectMobile() {
	return 'ontouchstart' in window || window.innerWidth < 768;
}

// Handle source interaction - renamed from handleCitationInteraction for broader usage
export async function handleSourceInteraction(event: Event, domains: string[], highlightNumber?: number, overrideArticles?: Article[]) {
	const target = event.target as HTMLElement;
	
	// Find the citation wrapper or source wrapper, or use the target itself
	const wrapper = target.closest('.citation-sources') || target.closest('.source-item') || target;
	
	if (wrapper) {
		const tooltipId = `sources-${domains.join('-')}`;
		
		isMobile = detectMobile();
		
		// For mobile clicks, prevent default
		if (isMobile && event.type === 'click') {
			event.preventDefault();
		}
		
		// For desktop hovers, update highlighted number even if tooltip is already showing
		if (!isMobile && event.type === 'mouseover' && showTooltip && currentTooltipId === tooltipId) {
			if (hideTimeout) {
				clearTimeout(hideTimeout);
				hideTimeout = null;
			}
			
			// Update highlighted number and scroll if needed
			if (highlightNumber && highlightedNumber !== highlightNumber) {
				highlightedNumber = highlightNumber;
				setTimeout(() => {
					scrollToHighlightedSource(highlightNumber);
				}, 50);
			}
			return;
		}
		
		// Clear any existing timeout
		if (hideTimeout) {
			clearTimeout(hideTimeout);
			hideTimeout = null;
		}
		
		// Set reference element for floating UI
		floating.elements.reference = wrapper;
		
		// Prepare display items
    if (overrideArticles && overrideArticles.length > 0) {
            // Handle a custom list of articles, possibly across multiple domains
            const domainSet = new Set(overrideArticles.map(a => a.domain));
            const seenLinks = new Set<string>();

            if (citationMapping) {
                const cited: Array<{ article: Article; number: number; isCommon?: boolean; isCited?: boolean }>= [];
                // Collect cited articles that match the provided domains
                for (const [number, mappedArticle] of citationMapping.numberToArticle.entries()) {
                    if (mappedArticle && domainSet.has(mappedArticle.domain)) {
                        if (!seenLinks.has(mappedArticle.link)) {
                            cited.push({ article: mappedArticle, number, isCommon: false, isCited: true });
                            seenLinks.add(mappedArticle.link);
                        }
                    }
                }

                // Add remaining non-cited from override list
                const nonCited: typeof cited = [];
                for (const article of overrideArticles) {
                    if (!seenLinks.has(article.link)) {
                        nonCited.push({ article, number: -1, isCommon: false, isCited: false });
                        seenLinks.add(article.link);
                    }
                }

                // Prefer cited items first, then non-cited; remove duplicates by link
                displayItems = [
                    ...cited.sort((a, b) => (a.number || 0) - (b.number || 0)),
                    ...nonCited.sort((a, b) => a.article.title.localeCompare(b.article.title))
                ];
            } else {
                // No mapping: just unique articles in given order
                displayItems = overrideArticles
                    .filter(a => {
                        if (seenLinks.has(a.link)) return false;
                        seenLinks.add(a.link); return true;
                    })
                    .map((article, idx) => ({ article, number: idx + 1, isCommon: false, isCited: false }));
            }
        } else {
            // Use cited items if available; otherwise prefer articles that have citation mapping numbers first
            if (citedItems.length > 0) {
                // Deduplicate by link
                const seen = new Set<string>();
                displayItems = citedItems.filter(it => {
                    const key = it.article?.link || `${it.isCommon ? 'common' : ''}-${it.number}`;
                    if (seen.has(key)) return false; seen.add(key); return true;
                }).map(item => ({ ...item, isCited: true }));
            } else if (citationMapping) {
                const citedFromMapping: Array<{ article: Article | null; number: number; isCommon?: boolean; isCited?: boolean }> = [];
                for (const [number, mappedArticle] of citationMapping.numberToArticle.entries()) {
                    if (mappedArticle) citedFromMapping.push({ article: mappedArticle, number, isCommon: false, isCited: true });
                }
                const citedLinks = new Set(citedFromMapping.map(i => i.article?.link));
                const nonCited = combinedArticles
                    .filter(a => !citedLinks.has(a.link))
                    .map((a, idx) => ({ article: a, number: -1, isCommon: false, isCited: false }));
                displayItems = [
                    ...citedFromMapping.sort((a, b) => (a.number || 0) - (b.number || 0)),
                    ...nonCited.sort((a, b) => a.article!.title.localeCompare(b.article!.title))
                ];
            } else {
                // Fallback: show all as non-cited
                const seen = new Set<string>();
                displayItems = combinedArticles.filter(a => {
                    if (seen.has(a.link)) return false; seen.add(a.link); return true;
                }).map((article, index) => ({ article, number: index + 1, isCommon: false, isCited: false }));
            }
        }
		
		// Only show tooltip if we have items to display
		if (displayItems.length === 0) {
			return; // Don't show empty tooltip
		}
		
		// Set highlighted number
		highlightedNumber = highlightNumber;
		
		// Set initial state
		currentTooltipId = tooltipId;
		showTooltip = true;
		
		// Auto-scroll to highlighted source after tooltip is rendered
		if (highlightNumber) {
			setTimeout(() => {
				scrollToHighlightedSource(highlightNumber);
			}, 50);
		}
	}
}

// Handle mouse leave from sources
export function handleSourceLeave(event: Event) {
	if (isMobile) return;
	
	const relatedTarget = (event as MouseEvent).relatedTarget as Node;
	const tooltip = floating.elements.floating;
	const reference = floating.elements.reference;
	
	// If moving to the tooltip itself, don't hide it
	if (tooltip && relatedTarget && tooltip.contains(relatedTarget)) {
		return;
	}
	
    // If we're moving to the same wrapper or another citation number, don't hide
	if (relatedTarget && relatedTarget instanceof Element) {
        if (relatedTarget.closest('.citation-number')) {
            return;
        }
        const targetWrapper = relatedTarget.closest('.citation-sources') || relatedTarget.closest('.source-item');
		if (targetWrapper && targetWrapper === reference) {
			return;
		}
	}
	
    hideTimeout = window.setTimeout(() => {
		hideTooltip();
    }, 220);
}

// Handle tooltip mouse leave
function handleTooltipLeave(event: MouseEvent) {
	if (isMobile) return;
	
	const relatedTarget = event.relatedTarget as Node;
	const reference = floating.elements.reference;
	
	// If moving back to the sources, don't hide
	if (relatedTarget && relatedTarget instanceof Element) {
		const targetWrapper = relatedTarget.closest('.citation-sources') || relatedTarget.closest('.source-item');
		if (targetWrapper && targetWrapper === reference) {
			return;
		}
	}
	
    hideTimeout = window.setTimeout(() => {
		hideTooltip();
    }, 220);
}

// Handle tooltip mouse enter (cancel hide timeout)
function handleTooltipEnter() {
	if (hideTimeout) {
		clearTimeout(hideTimeout);
		hideTimeout = null;
	}
}

// Hide tooltip
function hideTooltip() {
	showTooltip = false;
	currentTooltipId = '';
	highlightedNumber = undefined;
	displayItems = [];
}

// Allow external callers (e.g., StorySources) to force hide
export function forceHide() {
    hideTooltip();
}

// Scroll to highlighted source in tooltip
function scrollToHighlightedSource(citationNumber: number) {
	if (!tooltipScrollbars?.osInstance || !showTooltip) return;
	
	// Find the highlighted citation element by its actual citation number
	const highlightedElement = floating.elements.floating?.querySelector(`[data-citation-number="${citationNumber}"]`);
	
    if (highlightedElement) {
        // Scroll the highlighted element into view within the tooltip viewport only
        highlightedElement.scrollIntoView({
            behavior: 'auto',
            block: 'nearest',
            inline: 'nearest'
        });
		
		// Also update the OverlayScrollbars instance
		setTimeout(() => {
			tooltipScrollbars.osInstance()?.update(true);
		}, 25);
	}
}

// Close mobile modal
function closeMobileModal() {
	hideTooltip();
}

// Lock/unlock page scroll for mobile
$effect(() => {
	if (isMobile && showTooltip) {
		scrollLock.lock();
		return () => {
			scrollLock.unlock();
		};
	} else {
		scrollLock.unlock();
	}
});

// Hide tooltip on scroll (desktop only)
function hideTooltipOnScroll() {
	if (!isMobile && showTooltip) {
		hideTooltip();
	}
}

// Get unique display items for rendering
function getUniqueDisplayItems() {
	const seen = new Set();
	const unique = [];
	
	for (const item of displayItems) {
		if (item.isCommon) {
			// Only add common knowledge once
			if (!seen.has('common')) {
				seen.add('common');
				unique.push(item);
			}
		} else if (item.article) {
			// Only add each unique article once (by link as unique identifier)
			const articleKey = item.article.link;
			if (!seen.has(articleKey)) {
				seen.add(articleKey);
				unique.push(item);
			}
		}
	}
	
	// Sort: cited articles first (by number), then non-cited (alphabetically)
	return unique.sort((a, b) => {
		if (a.isCommon && !b.isCommon) return 1;
		if (!a.isCommon && b.isCommon) return -1;
		if (a.isCommon && b.isCommon) return 0;
		if (a.isCited && !b.isCited) return -1;
		if (!a.isCited && b.isCited) return 1;
		if (a.isCited && b.isCited) return (a.number || 0) - (b.number || 0);
		return a.article!.title.localeCompare(b.article!.title);
	});
}

// Calculate the highest citation number in current display items
const maxCitationNumber = $derived.by(() => {
	let maxNum = 0;
	for (const item of displayItems) {
		if (item.number && item.number > maxNum && item.number > 0) {
			maxNum = item.number;
		}
	}
	return maxNum;
});

// Determine tooltip title - standardized to 'Sources'
function getTooltipTitle() {
	return 'Sources';
}

// Setup scroll listener
onMount(() => {
	if (browser) {
		window.addEventListener('scroll', hideTooltipOnScroll, { passive: true });
	}
    // Global guards: hide if pointer leaves both reference and tooltip
    function isInside(el: Node | null): boolean {
        const tooltip = floating.elements.floating as HTMLElement | undefined;
        const reference = floating.elements.reference as HTMLElement | undefined;
        if (!el || !(el instanceof Element)) return false;
        // Consider ANY valid trigger wrapper as inside to avoid hiding while transitioning
        const anyWrapper = el.closest('.citation-sources, .source-item, .citation-number');
        return !!(
            (tooltip && tooltip.contains(el)) ||
            (reference && reference.contains(el)) ||
            anyWrapper
        );
    }
    function handleGlobalPointerMove(e: PointerEvent) {
        if (isMobile || !showTooltip) return;
        if (!isInside(e.target as Node)) {
            if (!hideTimeout) hideTimeout = window.setTimeout(() => hideTooltip(), 180);
        } else if (hideTimeout) {
            clearTimeout(hideTimeout); hideTimeout = null;
        }
    }
    function handleGlobalClick(e: Event) {
        if (isMobile || !showTooltip) return;
        if (!isInside(e.target as Node)) hideTooltip();
    }
    if (browser) {
        window.addEventListener('pointermove', handleGlobalPointerMove, { passive: true });
        window.addEventListener('click', handleGlobalClick, true);
    }
    onDestroy(() => {
        if (browser) {
            window.removeEventListener('pointermove', handleGlobalPointerMove as any);
            window.removeEventListener('click', handleGlobalClick as any, true as any);
        }
    });
});

onDestroy(() => {
	if (hideTimeout) {
		clearTimeout(hideTimeout);
	}
	if (browser) {
		window.removeEventListener('scroll', hideTooltipOnScroll);
	}
	// Make sure scroll is unlocked
	if (showTooltip) {
		scrollLock.unlock();
	}
});

function adjustViewportToElement(el: HTMLElement) {
    try {
        const os = tooltipScrollbars?.osInstance?.();
        const viewport = os?.elements().viewport as HTMLElement | undefined;
        const root = viewport ?? (floating.elements.floating as HTMLElement | undefined);
        if (!root) return;

        // Compute positions relative to root scroll
        const rootRect = root.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const elTop = elRect.top - rootRect.top + root.scrollTop;
        const elBottom = elTop + el.offsetHeight;
        const viewTop = root.scrollTop;
        const viewBottom = viewTop + root.clientHeight;
        const margin = 10;

        if (elTop < viewTop + margin) {
            root.scrollTop = Math.max(0, elTop - margin);
        } else if (elBottom > viewBottom - margin) {
            root.scrollTop = Math.max(0, elBottom - root.clientHeight + margin);
        }
        os?.update(true);
    } catch {}
}

$effect(() => {
    if (!showTooltip || highlightedNumber == null) return;
    const os = tooltipScrollbars?.osInstance?.();
    const viewport = os?.elements().viewport as HTMLElement | undefined;
    const root = viewport ?? (floating.elements.floating as HTMLElement | undefined);
    if (!root) return;
    const el = root.querySelector(`[data-citation-number="${highlightedNumber}"]`) as HTMLElement | null;
    if (!el) return;
    adjustViewportToElement(el);
});

// Remove older center-scrolling effect to avoid sudden jumps

</script>

{#if showTooltip}
	{#if !isMobile}
		<!-- Desktop Tooltip -->
		<Portal>
			<div
				bind:this={floating.elements.floating}
				class="absolute top-0 left-0 z-[2000] w-80 max-w-[min(320px,calc(100vw-16px))] rounded-lg border border-gray-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700 {floating.isPositioned ? 'opacity-100' : 'opacity-0 invisible'}"
				style={floating.floatingStyles}
				onmouseenter={handleTooltipEnter}
				onmouseleave={handleTooltipLeave}
				role="tooltip"
			>
				<!-- Content -->
				<OverlayScrollbarsComponent
					bind:this={tooltipScrollbars}
					class="w-full overflow-hidden transition-[max-height] duration-200"
					style="max-height: {tooltipMaxHeight}px"
					defer
					options={{
						overflow: {
							x: 'hidden',
							y: 'scroll'
						},
						scrollbars: {
							autoHide: 'leave',
							autoHideDelay: 300
						}
					}}
				>
					<div class="p-3">
					{#if displayItems.length > 0}
						<div class="flex items-center -space-x-3 mb-2">
                            {#each Array.from(new Set(displayItems.filter(i => i.article).map(i=>i.article.domain))).slice(0,6) as dom}
                            <SmartImage domain={dom} alt={dom} class="w-4 h-4 rounded-full" size={16} loading="eager" preferIconify={true} addBackground={true} backgroundMode="transparent-only" />
							{/each}
						</div>
					{/if}
					<h4 class="mb-3 font-semibold text-gray-800 dark:text-gray-200">{getTooltipTitle()}</h4>
						
						<div class="citation-list {maxCitationNumber >= 10 ? 'double-digit' : ''} space-y-3">
							{#if displayItems.length > 0}
								{#each getUniqueDisplayItems() as item}
									<CitationItem {item} {highlightedNumber} showCitationNumber={item.isCited} {maxCitationNumber} />
								{/each}
							{:else}
								<div class="text-sm text-gray-500 dark:text-gray-400">No sources available</div>
							{/if}
						</div>
						
					</div>
				</OverlayScrollbarsComponent>
			</div>
		</Portal>
	{:else}
		<!-- Mobile Modal -->
		<Portal>
			<div
				class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 dark:bg-black/80"
				onclick={closeMobileModal}
				onkeydown={(e) => e.key === 'Escape' && closeMobileModal()}
				role="dialog"
				aria-modal="true"
				aria-labelledby="sources-modal-title"
				tabindex="-1"
			>
				<div
					class="flex h-full w-full flex-col bg-white shadow-xl dark:bg-gray-800"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
					role="presentation"
				>
					<!-- Header -->
					<div class="flex items-center border-b border-gray-200 p-4 dark:border-gray-700">
						<button
							class="mr-3 rounded-full p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
							onclick={closeMobileModal}
							aria-label={s('common.back')}
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
							</svg>
						</button>
						<h3 id="sources-modal-title" class="flex-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
							{getTooltipTitle()}
						</h3>
					</div>

					<!-- Content -->
					<OverlayScrollbarsComponent
						class="flex-1 overflow-hidden"
						defer
						options={{
							overflow: {
								x: 'hidden',
								y: 'scroll'
							},
							scrollbars: {
								autoHide: 'leave',
								autoHideDelay: 300
							}
						}}
					>
						<div class="p-4">
						<h4 class="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-200">{getTooltipTitle()}</h4>
							
							<div class="citation-list {maxCitationNumber >= 10 ? 'double-digit' : ''} space-y-3">
							{#if displayItems.length > 0}
								{#each getUniqueDisplayItems() as item}
									<CitationItem {item} {highlightedNumber} isMobile={true} showCitationNumber={item.isCited} {maxCitationNumber} />
								{/each}
								{:else}
									<div class="text-sm text-gray-500 dark:text-gray-400">No sources available</div>
								{/if}
							</div>
							
						</div>
					</OverlayScrollbarsComponent>
				</div>
			</div>
		</Portal>
	{/if}
{/if}
