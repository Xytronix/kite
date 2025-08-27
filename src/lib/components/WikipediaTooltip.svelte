<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import { browser } from '$app/environment';
import { useFloating, offset, flip, shift, arrow, size } from '@skeletonlabs/floating-ui-svelte';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';
import Portal from 'svelte-portal';
import { scrollLock } from '$lib/utils/scrollLock';
import { fetchWikipediaContent, fetchWikipediaContentWithEnhancedSearch, type WikipediaContent } from '$lib/services/wikipediaService';
import { s } from '$lib/client/localization.svelte';
import { openMapLocation, getMapServiceName, isAppleDevice } from '$lib/utils/mapUtils';
import Icon from '@iconify/svelte';

// Enhanced location search function (similar to StorySummary's fetchWikipediaContentWithCrossLanguage)
async function fetchWikipediaContentForLocation(locationName: string): Promise<WikipediaContent | null> {
	console.debug('Fetching Wikipedia content for location in tooltip:', locationName);
	
	// Clean the location name - remove common prefixes that might interfere
	let cleanLocation = locationName.trim();
	
	// Remove common prefixes like "Learn more about", "in", "at", etc.
	cleanLocation = cleanLocation.replace(/^(?:learn more about|in|at|from|near|over|across|around|into)\s+/i, '');
	
	try {
		const { resolveWikiTitleWithContext } = await import('$lib/utils/wikiResolver');
		
		// Try multiple search variations for better results
		const searchVariations = [
			cleanLocation, // Original: "Gaza City, Palestinian Territories"
			cleanLocation.split(',')[0].trim(), // First part: "Gaza City"
			cleanLocation.replace(/,.*$/, '').trim(), // Remove everything after comma: "Gaza City"
		];
		
		// Remove duplicates
		const uniqueVariations = [...new Set(searchVariations)];
		
		for (const variation of uniqueVariations) {
			console.debug('Trying Wikipedia search for location variation:', variation);
			
			// Use wikiResolver to properly resolve the place with context validation
			const resolveResult = await resolveWikiTitleWithContext(variation, 'place');
			
			if (resolveResult) {
				console.debug('WikiResolver found for location variation:', variation, resolveResult);
				
				// Get the full Wikipedia content using the resolved title and Q-ID
				// Prefer Q-ID if available for better cross-language support
				const wikiId = resolveResult.qid || resolveResult.title;
				const wikiContent = await fetchWikipediaContent(wikiId);
				
				if (wikiContent && wikiContent.extract && wikiContent.extract !== 'Failed to load Wikipedia content.') {
					console.debug('Successfully fetched Wikipedia content for location variation:', variation);
					return wikiContent;
				}
			}
		}
		
		console.debug('No Wikipedia place found for any variation of:', cleanLocation);
		return null;
		
	} catch (error) {
		console.debug('Wikipedia location search failed:', error);
		return null;
	}
}

interface Props {
	onWikipediaClick?: (title: string, content: string, imageUrl?: string, wikiUrl?: string) => void;
	onWikipediaContentFound?: (wikiId: string, wikiUrl: string, title: string) => void;
}

let { onWikipediaClick, onWikipediaContentFound }: Props = $props();

// State for dynamic sizing
let tooltipMaxHeight = $state(300);

// Floating UI setup
const floating = useFloating({
	placement: 'bottom-start',
	strategy: 'fixed', // Use fixed positioning since we're using Portal
	middleware: [
		offset(8), // 8px gap from trigger
		flip({
			fallbackPlacements: ['top-start', 'bottom-end', 'top-end', 'bottom', 'top']
		}), // More fallback options for better positioning
		shift({ 
			padding: 8,
			crossAxis: true // Allow cross-axis shifting for better positioning with virtual references
		}), // Shift within viewport with padding
		size({
			apply({ availableHeight, availableWidth, elements }) {
				// Calculate optimal height based on available space
				// Min: 200px, Max: 500px or 60% of viewport height
				const minHeight = 200;
				const maxHeight = Math.min(500, window.innerHeight * 0.6);
				const optimalHeight = Math.min(Math.max(minHeight, availableHeight - 16), maxHeight);
				tooltipMaxHeight = optimalHeight;
			}
		})
		// arrow({ element: () => arrowElement }) // Arrow pointing to trigger - temporarily removed
	]
});

// State
let showTooltip = $state(false);
let tooltipTitle = $state('');
let tooltipContent = $state('');
let tooltipImage = $state('');
let tooltipFullImage = $state('');
let tooltipWikiUrl = $state('');
let currentTooltipId = $state('');
let isMobile = $state(false);
let isLoading = $state(false);
let tooltipFlag = $state('');
let currentWikiId = $state('');
let currentWikiAttrId = $state('');
let imageObjectPosition = $state('50% 30%');
let imageFitMode = $state('contain');

// Elements
let arrowElement: HTMLElement;
let hideTimeout: number | null = null;
let showTimeout: number | null = null;
let lastProcessedId = $state('');
let lastProcessedTime = $state(0);

// OverlayScrollbars instance
let tooltipScrollbars: any = $state();

// Detect mobile device
function detectMobile() {
	return 'ontouchstart' in window || window.innerWidth < 768;
}

// Create a virtual reference element for better positioning on multi-line text
function createVirtualReference(event: Event, element: HTMLElement) {
	const mouseEvent = event as MouseEvent;
	const touchEvent = event as TouchEvent;
	
	let clientX: number | undefined;
	let clientY: number | undefined;
	
	// Get coordinates from mouse or touch event
	if (mouseEvent.clientX !== undefined && mouseEvent.clientY !== undefined) {
		clientX = mouseEvent.clientX;
		clientY = mouseEvent.clientY;
	} else if (touchEvent.touches && touchEvent.touches.length > 0) {
		clientX = touchEvent.touches[0].clientX;
		clientY = touchEvent.touches[0].clientY;
	}
	
	// Try to get the text range at the interaction position for more precise positioning
	if (document.caretRangeFromPoint && clientX !== undefined && clientY !== undefined) {
		try {
			const range = document.caretRangeFromPoint(clientX, clientY);
			if (range) {
				// Check if the range is within our target element or its children
				const rangeContainer = range.startContainer.nodeType === Node.TEXT_NODE 
					? range.startContainer.parentElement 
					: range.startContainer as Element;
				
				if (rangeContainer && (element.contains(rangeContainer) || rangeContainer === element)) {
					const rect = range.getBoundingClientRect();
					if (rect.width > 0 && rect.height > 0) {
						return {
							getBoundingClientRect() {
								return {
									width: Math.max(rect.width, 1),
									height: Math.max(rect.height, 1),
									top: rect.top,
									right: rect.right,
									bottom: rect.bottom,
									left: rect.left,
									x: rect.x,
									y: rect.y,
								};
							},
						};
					}
				}
			}
		} catch (error) {
			console.debug('Range detection failed, using mouse position:', error);
		}
	}
	
	// Fallback: create a virtual reference based on mouse/touch position
	if (clientX !== undefined && clientY !== undefined) {
		return {
			getBoundingClientRect() {
				return {
					width: 1,
					height: 1,
					top: clientY,
					right: clientX + 1,
					bottom: clientY + 1,
					left: clientX,
					x: clientX,
					y: clientY,
				};
			},
		};
	}
	
	// Final fallback: use the original element but try to get a better position
	// For multi-line elements, use the first line's position
	const elementRect = element.getBoundingClientRect();
	const computedStyle = window.getComputedStyle(element);
	const lineHeight = parseFloat(computedStyle.lineHeight) || elementRect.height;
	
	// If the element is much taller than a single line, position at the first line
	if (elementRect.height > lineHeight * 1.5) {
		return {
			getBoundingClientRect() {
				return {
					width: elementRect.width,
					height: lineHeight,
					top: elementRect.top,
					right: elementRect.right,
					bottom: elementRect.top + lineHeight,
					left: elementRect.left,
					x: elementRect.x,
					y: elementRect.y,
				};
			},
		};
	}
	
	return element;
}

// Handle Wikipedia link interaction
export async function handleWikipediaInteraction(event: Event) {
	const target = event.target as HTMLElement;
	
	// Find the actual Wikipedia element, even if we clicked on a child element
	const wikiLink = target.closest('[data-wiki-id]') as HTMLElement;
	
	if (wikiLink) {
		const interactionType = event.type;
		let wikiId = wikiLink.getAttribute('data-wiki-id') || '';
		currentWikiAttrId = wikiId;
		const title = wikiLink.getAttribute('title') || wikiLink.textContent?.trim() || wikiId || '';
		const href = wikiLink.getAttribute('href') || wikiLink.getAttribute('data-url') || '';
		
		// Properly decode URL-encoded Wikipedia IDs
		if (wikiId.includes('%')) {
			try {
				const decoded = decodeURIComponent(wikiId);
				console.debug('Decoded Wikipedia ID:', wikiId, '->', decoded);
				wikiId = decoded;
			} catch (error) {
				console.debug('Failed to decode Wikipedia ID:', wikiId, error);
			}
		}
		
		const tooltipId = `${wikiId}-${title}`;
		const now = Date.now();
		
		// Debounce rapid tooltip changes (prevent flickering from multiple rapid events)
		if (lastProcessedId === tooltipId && (now - lastProcessedTime) < 100) {
			console.debug('Debouncing rapid tooltip change for same ID:', tooltipId);
			return;
		}
		lastProcessedId = tooltipId;
		lastProcessedTime = now;
		
		isMobile = detectMobile();
		
		// For mobile clicks, prevent default link behavior
		if (isMobile && event.type === 'click') {
			event.preventDefault();
		}
		
		// For desktop hovers, skip if already showing same tooltip
		if (!isMobile && event.type === 'mouseover' && showTooltip && currentTooltipId === tooltipId) {
			// Cancel any pending hide timeout since we're still on the same element
			if (hideTimeout) {
				clearTimeout(hideTimeout);
				hideTimeout = null;
			}
			return;
		}
		
		// Clear any existing timeouts
		if (hideTimeout) {
			clearTimeout(hideTimeout);
			hideTimeout = null;
		}
		if (showTimeout) {
			clearTimeout(showTimeout);
			showTimeout = null;
		}
		
		// Create a virtual reference element for better positioning on multi-line text
		const virtualReference = createVirtualReference(event, wikiLink);
		floating.elements.reference = virtualReference;
		
		// Set initial state
		currentTooltipId = tooltipId;
		currentWikiId = wikiId; // Store the current wikiId for location detection
		tooltipTitle = title; // Use the actual title instead of "Loading..." to reduce flicker
		
		// Check for conflicts with auto-linking
		const isOnThisDay = wikiLink.closest('.onthisday-content') !== null;
		const hasBackendQID = wikiId.startsWith('Q');
		const allSameElements = document.querySelectorAll(`[data-wiki-id="${wikiLink.getAttribute('data-wiki-id')}"]`);
		
		// Debug: Log the Wikipedia ID being processed
		console.debug('WikipediaTooltip processing:', {
			originalWikiId: wikiLink.getAttribute('data-wiki-id'),
			decodedWikiId: wikiId,
			title,
			href,
			isQID: hasBackendQID,
			element: wikiLink.tagName,
			content: wikiLink.textContent?.substring(0, 50),
			interactionType,
			isOnThisDay,
			duplicateCount: allSameElements.length,
			elementIndex: Array.from(allSameElements).indexOf(wikiLink)
		});
		
		// Handle conflicts between backend QIDs and auto-linked content
		if (allSameElements.length > 1) {
			console.debug('Multiple elements with same wiki-id detected:', allSameElements.length);
			
			// If this is OnThisDay content with a backend QID, prioritize it over auto-linked content
			if (isOnThisDay && hasBackendQID) {
				// Remove any auto-linked duplicates that might conflict
				allSameElements.forEach((el, index) => {
					if (el !== wikiLink && !el.closest('.onthisday-content')) {
						console.debug('Removing conflicting auto-linked element:', el);
						// Replace the auto-linked element with plain text
						const textNode = document.createTextNode(el.textContent || '');
						el.parentNode?.replaceChild(textNode, el);
					}
				});
			} else {
				// For non-OnThisDay content, only process the first element to avoid conflicts
				const firstElement = allSameElements[0];
				if (wikiLink !== firstElement) {
					console.debug('Skipping duplicate element, processing only the first occurrence');
					return;
				}
			}
		}
		tooltipContent = '';
		tooltipImage = '';
		tooltipFullImage = '';
		// For Q-IDs, ignore the href and wait for resolution. For regular titles, use href or construct URL
		if (wikiId.startsWith('Q')) {
			tooltipWikiUrl = ''; // Will be set after Q-ID resolution
		} else {
			tooltipWikiUrl = href || `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiId.replace(/ /g, '_'))}`;
		}
		// Check if this element is still valid after conflict resolution
		if (!wikiLink.parentNode) {
			console.debug('Element was removed during conflict resolution, aborting tooltip');
			return;
		}
		
		// For desktop hover, add a small delay to prevent flickering on quick mouse movements
		const showDelay = (!isMobile && event.type === 'mouseover') ? 200 : 0;
		
		// Start with loading state
		isLoading = true;
		
		// Show tooltip with optional delay
		if (showDelay > 0) {
			showTimeout = window.setTimeout(() => {
				showTooltip = true;
				showTimeout = null;
			}, showDelay);
		} else {
			showTooltip = true;
		}
		
		// Fetch Wikipedia content with enhanced features
		try {
			let loadedData: WikipediaContent | null = null;
			
			// Debug: Check for multiple elements with same data-wiki-id
			const allSameElements = document.querySelectorAll(`[data-wiki-id="${wikiLink.getAttribute('data-wiki-id')}"]`);
			if (allSameElements.length > 1) {
				console.debug('Multiple elements found with same wiki-id:', wikiId, 'count:', allSameElements.length);
			}
			
			// Priority 1: For Q-IDs, always use direct Wikipedia API to resolve properly
			if (wikiId.startsWith('Q')) {
				console.debug('Fetching Q-ID content:', wikiId);
				loadedData = await fetchWikipediaContent(wikiId);
			}
			// Priority 2: Direct Wikipedia API for exact titles (most reliable for backend-provided links)
			else {
				console.debug('Fetching direct Wikipedia content:', wikiId);
				loadedData = await fetchWikipediaContent(wikiId);
				
				// Priority 3: For location-like names, try enhanced location search if direct fetch failed
				if (!loadedData && (wikiId.includes(',') || /\b(city|town|village|county|state|province|territory|island|mountain|river|lake)\b/i.test(wikiId))) {
					console.debug('Trying enhanced location search:', wikiId);
					loadedData = await fetchWikipediaContentForLocation(wikiId);
				}
				
				// Priority 4: Enhanced search with Knowledge Graph as final fallback
				if (!loadedData) {
					console.debug('Trying enhanced search fallback:', wikiId);
					loadedData = await fetchWikipediaContentWithEnhancedSearch(wikiId);
				}
			}
			
			// Update tooltip if it's still showing for the same ID (or about to show)
			if ((showTooltip || showTimeout) && currentTooltipId === tooltipId) {
				// If we have a show timeout, clear it and show immediately since we have content
				if (showTimeout) {
					clearTimeout(showTimeout);
					showTimeout = null;
					showTooltip = true;
				}
				if (loadedData && loadedData.extract && loadedData.extract !== 'Failed to load Wikipedia content.') {
					// Valid content found - update tooltip
					tooltipTitle = loadedData.title || title; // Use the resolved Wikipedia title or fallback to original title
					tooltipContent = loadedData?.extract || 'No summary available.';
					tooltipImage = loadedData?.thumbnail?.source || '';
					tooltipFullImage = loadedData?.originalImage?.source || tooltipImage;
					// Always use the resolved URL from the API, especially important for Q-IDs
					const resolvedUrl = loadedData?.wikiUrl;
					const fallbackUrl = tooltipWikiUrl;
					
					// Always use the resolved URL from the API which respects the language setting
					tooltipWikiUrl = resolvedUrl || fallbackUrl;
					
					// Adjust image focal point to avoid cutting off faces in tall portraits
					try {
						const original = (loadedData as any)?.originalImage;
						const thumb = (loadedData as any)?.thumbnail;
						const width = original?.width || thumb?.width;
						const height = original?.height || thumb?.height;
						if (width && height) {
							const aspect = width / height;
							// Bias focal point upward to keep heads in-frame across orientations
							if (aspect < 0.95) {
								// Portrait
								imageObjectPosition = '50% 30%';
							} else if (aspect < 1.2) {
								// Near-square
								imageObjectPosition = '50% 40%';
							} else if (aspect < 2.2) {
								// Landscape (common) — lift slightly to avoid cutting off faces
								imageObjectPosition = '50% 40%';
							} else {
								// Very wide panoramas — lift a bit more
								imageObjectPosition = '50% 45%';
							}

							// Prefer contain to show as much of the image as possible
							imageFitMode = 'contain';
						} else {
							imageObjectPosition = '50% 30%';
							imageFitMode = 'contain';
						}
					} catch {}


					// Country flag detection – if description contains 'country' etc.
					const desc = (loadedData as any)?.description as string | undefined;
					if (desc && /\bcountry\b/i.test(desc)) {
						tooltipFlag = getFlagEmoji(loadedData.title);
					} else {
						tooltipFlag = '';
					}
					
					// Set loading to false
					isLoading = false;

					// Notify parent component that Wikipedia content was found
					if (typeof onWikipediaContentFound === 'function') {
						onWikipediaContentFound(wikiId, tooltipWikiUrl, loadedData.title || title);
					}

					// If this was a click/tap interaction and a callback is provided, open full popup
					if (interactionType === 'click' && typeof onWikipediaClick === 'function') {
						// Prefer full-size image if available
						const imgUrl = loadedData?.originalImage?.source || loadedData?.thumbnail?.source || '';
						// Hide any tooltip that may have appeared
						hideTooltip();
						// Defer call slightly to allow tooltip hide state
						setTimeout(() => {
							onWikipediaClick(loadedData.title || wikiId, loadedData.extract || '', imgUrl, loadedData.wikiUrl);
						}, 0);
					}
					
					// Update scrollbars after content loads
					setTimeout(() => {
						try {
							if (tooltipScrollbars?.osInstance) {
								const instance = tooltipScrollbars.osInstance();
								if (instance) {
									instance.update(true);
								}
							}
						} catch (error) {
							// Silently handle scrollbar update errors
							console.debug('Scrollbar update failed:', error);
						}
					}, 10);
				} else {
					// No valid content found - show error message instead of hiding
					console.debug('No valid Wikipedia content found for tooltip:', wikiId, 'loadedData:', loadedData);
					tooltipContent = 'Wikipedia content not available for this item.';
					tooltipImage = '';
					tooltipFullImage = '';
					isLoading = false;
					
					// For mobile clicks, still hide since there's no useful content
					if (interactionType === 'click' && isMobile) {
						hideTooltip();
					}
				}
			}
		} catch (error) {
			console.error('Error loading Wikipedia content:', error);
			// Show error message instead of hiding tooltip
			if ((showTooltip || showTimeout) && currentTooltipId === tooltipId) {
				if (showTimeout) {
					clearTimeout(showTimeout);
					showTimeout = null;
					showTooltip = true;
				}
				tooltipContent = 'Error loading Wikipedia content.';
				tooltipImage = '';
				tooltipFullImage = '';
				isLoading = false;
			}
		}
	}
}

// Handle mouse leave from Wikipedia link
export function handleWikipediaLeave(event: Event) {
	if (isMobile) return; // Mobile tooltips are manually closed
	
	// Cancel any pending show timeout
	if (showTimeout) {
		clearTimeout(showTimeout);
		showTimeout = null;
		return;
	}
	
	const relatedTarget = (event as MouseEvent).relatedTarget as Node;
	const tooltip = floating.elements.floating;
	
	// If moving to the tooltip itself, don't hide it
	if (tooltip && relatedTarget && tooltip.contains(relatedTarget)) {
		return;
	}
	
	// For virtual references, we need to check the original Wikipedia element
	const currentWikiElement = (event.target as HTMLElement).closest('[data-wiki-id]') as HTMLElement;
	
	// Check if we're moving to ANY part of the same Wikipedia element
	if (relatedTarget && relatedTarget instanceof Element && currentWikiElement) {
		const targetWikiLink = relatedTarget.closest('[data-wiki-id]');
		
		// If we're moving to the same Wikipedia element (same data-wiki-id), don't hide
		if (targetWikiLink && 
			targetWikiLink.getAttribute('data-wiki-id') === currentWikiElement.getAttribute('data-wiki-id')) {
			return;
		}
	}
	
	// Simple timeout with reduced delay since we have unified hover zone
	hideTimeout = window.setTimeout(() => {
		hideTooltip();
	}, 150); // Short delay for smooth UX
}

// Handle tooltip mouse leave
function handleTooltipLeave(event: MouseEvent) {
	if (isMobile) return;
	
	const relatedTarget = event.relatedTarget as Node;
	
	// If moving back to any Wikipedia element with the same ID, don't hide
	if (relatedTarget && relatedTarget instanceof Element && (currentWikiAttrId || currentWikiId)) {
		const targetWikiLink = relatedTarget.closest('[data-wiki-id]');
		if (targetWikiLink) {
			const attrVal = targetWikiLink.getAttribute('data-wiki-id') || '';
			// Prefer raw attribute comparison; fallback to decoded/normalized comparison
			if (currentWikiAttrId && attrVal === currentWikiAttrId) {
				return;
			}
			try {
				const decodedAttr = attrVal.includes('%') ? decodeURIComponent(attrVal) : attrVal;
				if (currentWikiId && decodedAttr.replace(/ /g, '_') === currentWikiId.replace(/ /g, '_')) {
					return;
				}
			} catch {}
		}
	}
	
	// Simple timeout - if we're truly leaving, hide the tooltip
	hideTimeout = window.setTimeout(() => {
		hideTooltip();
	}, 150); // Consistent short delay
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
	// Clear any pending show timeout
	if (showTimeout) {
		clearTimeout(showTimeout);
		showTimeout = null;
	}
	showTooltip = false;
	currentTooltipId = '';
	currentWikiAttrId = '';
	isLoading = false;
}

// Close mobile modal
function closeMobileModal() {
	hideTooltip();
}

// Check if current content is location-related
const isLocationContent = $derived.by(() => {
	return currentWikiId && (
		currentWikiId.includes(',') || 
		/\b(city|town|village|county|state|province|territory|island|mountain|river|lake)\b/i.test(currentWikiId)
	);
});

// Handle Apple Maps button click
function handleAppleMapsClick() {
	if (currentWikiId) {
		// Force Apple Maps by creating a maps:// URL
		const encodedLocation = encodeURIComponent(currentWikiId);
		const link = document.createElement("a");
		link.href = `maps://maps.apple.com/?q=${encodedLocation}`;
		link.style.display = "none";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
}

// Handle Google Maps button click
function handleGoogleMapsClick() {
	if (currentWikiId) {
		// Force Google Maps
		const encodedLocation = encodeURIComponent(currentWikiId);
		const googleMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;
		window.open(googleMapUrl, "_blank");
	}
}

// Lock/unlock page scroll for mobile
$effect(() => {
	if (isMobile && showTooltip) {
		scrollLock.lock();
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

// Setup scroll listener
onMount(() => {
	if (browser) {
		window.addEventListener('scroll', hideTooltipOnScroll, { passive: true });
	}

    function isInside(el: Node | null): boolean {
        const tooltip = floating.elements.floating as HTMLElement | undefined;
        if (!el || !(el instanceof Element)) return false;
        
        // Check if inside tooltip
        if (tooltip && tooltip.contains(el)) return true;
        
        // For virtual references, check if inside any Wikipedia element with the same ID
        const wikiElement = el.closest('[data-wiki-id]');
        if (wikiElement) {
            const attrVal = wikiElement.getAttribute('data-wiki-id') || '';
            if (currentWikiAttrId && attrVal === currentWikiAttrId) return true;
            try {
                const decodedAttr = attrVal.includes('%') ? decodeURIComponent(attrVal) : attrVal;
                if (currentWikiId && decodedAttr.replace(/ /g, '_') === currentWikiId.replace(/ /g, '_')) {
                    return true;
                }
            } catch {}
        }
        
        return false;
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
	if (showTimeout) {
		clearTimeout(showTimeout);
	}
	if (browser) {
		window.removeEventListener('scroll', hideTooltipOnScroll);
	}
	// Make sure scroll is unlocked
	if (showTooltip) {
		scrollLock.unlock();
	}
});
</script>

<!-- Helper to derive flag emoji from country name using ISO mapping -->
<script lang="ts" module>
const countryToIso: Record<string, string> = {
    'United States': 'US',
    'United Kingdom': 'GB',
    Canada: 'CA',
    Germany: 'DE',
    France: 'FR',
    Italy: 'IT',
    Spain: 'ES',
    China: 'CN',
    India: 'IN',
    Japan: 'JP',
    Australia: 'AU'
    // add more as needed
};

export function getFlagEmoji(countryName: string): string {
    const iso = countryToIso[countryName];
    if (!iso) return '';
    const codePoints = [...iso.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65);
    return String.fromCodePoint(...codePoints);
}
</script>


{#if showTooltip}
	{#if !isMobile}
		<!-- Desktop Tooltip -->
		<Portal>
			<div
				bind:this={floating.elements.floating}
				class="absolute top-0 left-0 z-[2000] w-80 max-w-[min(320px,calc(100vw-16px))] rounded-lg border border-gray-300 bg-white shadow-lg transition-opacity duration-200 dark:border-gray-600 dark:bg-gray-700 {floating.isPositioned ? 'opacity-100' : 'opacity-0 invisible'}"
				style={floating.floatingStyles}
				onmouseenter={handleTooltipEnter}
				onmouseleave={handleTooltipLeave}
				role="tooltip"
			>
				<!-- Arrow - temporarily commented out -->
				<!-- <div
					bind:this={arrowElement}
					class="arrow border border-gray-300 dark:border-gray-600"
					style={floating.arrowStyles}
					data-placement={floating.placement}
				></div> -->

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
						<h4 class="mb-2 font-semibold text-gray-800 dark:text-gray-200 break-words">
                            {#if tooltipFlag}{tooltipFlag}&nbsp;{/if}{tooltipTitle}
                        </h4>
						
						{#if isLoading}
							<div class="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
								<div class="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500"></div>
								<span>Loading...</span>
							</div>
						{:else}
							{#if tooltipImage}
								<img
									src={tooltipImage}
									alt={tooltipTitle}
									class="mb-2 h-40 w-full rounded"
									style="object-fit: {imageFitMode}; object-position: {imageObjectPosition}"
									loading="lazy"
								/>
							{/if}
							<p class="text-sm text-gray-600 dark:text-gray-400 break-words">{tooltipContent}</p>
						{/if}
					</div>
				</OverlayScrollbarsComponent>
			</div>
		</Portal>
	{:else}
		<!-- Mobile Modal (Fullscreen) -->
		<Portal>
			<div
				class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 dark:bg-black/80"
				onclick={closeMobileModal}
				onkeydown={(e) => e.key === 'Escape' && closeMobileModal()}
				role="dialog"
				aria-modal="true"
				aria-labelledby="wikipedia-modal-title"
				tabindex="-1"
			>
			<div
				class="flex h-full w-full flex-col bg-white shadow-xl dark:bg-gray-800"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
				role="presentation"
			>
				<!-- Header with arrow back button -->
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
					<h3 id="wikipedia-modal-title" class="flex-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
						{tooltipTitle}
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
						{#if isLoading}
							<div class="flex items-center justify-center space-x-2 py-8 text-gray-500 dark:text-gray-400">
								<div class="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500"></div>
								<span>Loading Wikipedia content...</span>
							</div>
						{:else}
							{#if tooltipFullImage || tooltipImage}
								<img
									src={tooltipFullImage || tooltipImage}
									alt={tooltipTitle}
									class="mb-4 h-56 w-full rounded-lg shadow-sm"
									style="object-fit: {imageFitMode}; object-position: {imageObjectPosition}"
									loading="lazy"
								/>
							{/if}
							<p class="text-gray-700 dark:text-gray-300">{tooltipContent}</p>
							<div class="mt-4 flex flex-wrap gap-2">
								{#if tooltipWikiUrl}
									<a
										href={tooltipWikiUrl}
										target="_blank"
										rel="noopener noreferrer"
										class="inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
									>
										{s('wikipedia.readMore')}
										<Icon icon="mdi:external-link" class="ml-1 h-3 w-3" />
									</a>
								{/if}
								
								{#if isLocationContent}
									<button
										onclick={handleAppleMapsClick}
										class="inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
									>
										<Icon icon="simple-icons:apple" class="mr-2 h-4 w-4" />
										Apple Maps
									</button>
									<button
										onclick={handleGoogleMapsClick}
										class="inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
									>
										<Icon icon="mdi:google-maps" class="mr-2 h-4 w-4" />
										Google Maps
									</button>
								{/if}
							</div>
						{/if}
					</div>
				</OverlayScrollbarsComponent>
			</div>
		</div>
		</Portal>
	{/if}
{/if}