<script lang="ts">
	import { getFaviconUrls, getIconifyIcon, getFaviconUrlSync, getIconifyIconSync, getFaviconUrlsSync, getLogoDevUrl, getLogoDevTickerUrl, getGoogleFaviconUrl } from '$lib/utils/citationUtils';
	import IconDisplay from './IconDisplay.svelte';
	import { experimental } from '$lib/stores/experimental.svelte.js';

	interface Props {
		domain?: string;
		src?: string;
		alt: string;
		class?: string;
		size?: number;
		loading?: 'lazy' | 'eager';
		fallbackUrls?: string[];
		preferIconify?: boolean; // When true, prioritize iconify icons over image URLs
	}

	let { 
		domain, 
		src, 
		alt, 
		class: className = '', 
		size = 32,
		loading = 'lazy',
		fallbackUrls = [],
		preferIconify = false
	}: Props = $props();

	// State for image URLs and iconify
	let imageUrls = $state<string[]>([]);
	let currentIndex = $state(0);
	let hasError = $state(false);
	let isLoading = $state(true);
	let isInitializing = $state(true); // Track if we're still setting up URLs
	let imgElement = $state<HTMLImageElement | undefined>();
	let iconifyIcon = $state<string | null>(null);
	let useIconify = $state(false);
	
	// Track last loaded props to prevent unnecessary reloads
	let lastLoadedDomain = $state<string | undefined>(undefined);
	let lastLoadedSrc = $state<string | undefined>(undefined);
	let lastPreferIconify = $state<boolean>(false);
	
	// Instant cache check on component creation
	const instantCacheCheck = $derived.by(() => {
		if (!domain || src) return null;
		const shouldPreferIconify = preferIconify || experimental.preferIconifyIcons;

		// Check iconify cache first if preferred
		if (shouldPreferIconify) {
			const cachedIconName = getIconifyIconSync(domain);
			if (cachedIconName) {
				return { type: 'iconify', value: cachedIconName };
			}
		}

		// Check favicon cache
		const cachedUrls = getFaviconUrlsSync(domain, size);
		if (cachedUrls && cachedUrls.length > 0) {
			return { type: 'favicon', list: cachedUrls };
		}
		return null;
	});

	// Seed imageUrls immediately if we have cached favicons so normal logic handles fallback
	$effect(() => {
		if (!src && instantCacheCheck && instantCacheCheck.type === 'favicon' && imageUrls.length === 0) {
			imageUrls = instantCacheCheck.list;
			currentIndex = 0;
			useIconify = false;
			iconifyIcon = null;
			isInitializing = false;
			isLoading = false;
		}
	});

	// Update URLs when props change
	$effect(() => {
		// Check if we need to reload based on prop changes
		const shouldPreferIconify = preferIconify || experimental.preferIconifyIcons;
		const needsReload = 
			domain !== lastLoadedDomain || 
			src !== lastLoadedSrc || 
			shouldPreferIconify !== lastPreferIconify;
			
		if (!needsReload) return;
		
		// Update tracking variables
		lastLoadedDomain = domain;
		lastLoadedSrc = src;
		lastPreferIconify = shouldPreferIconify;
		
		// IMMEDIATE synchronous cache check - no async needed!
		if (domain && !src) {
			// Check iconify cache first if preferred
			if (shouldPreferIconify) {
				const cachedIconName = getIconifyIconSync(domain);
				if (cachedIconName) {
					iconifyIcon = cachedIconName;
					useIconify = true;
					isInitializing = false;
					isLoading = false;
					return; // Exit immediately - no async loading needed!
				}
			}
			
			// Check favicon cache
			const cachedUrls = getFaviconUrlsSync(domain, size);
			if (cachedUrls && cachedUrls.length > 0) {
				imageUrls = cachedUrls;
				currentIndex = 0;
				hasError = false;
				isInitializing = false;
				isLoading = false; // No loading state for cached items!
				return; // Exit immediately - no async loading needed!
			}
		}
		
		// Only do async loading if not in cache
		async function loadUrls() {
			try {
				// Reset state for uncached items
				useIconify = false;
				iconifyIcon = null;
				
				// If we reach here, show loading skeleton while fetching
				isInitializing = true;
				isLoading = true;
				
				if (src) {
					imageUrls = [src, ...fallbackUrls];
					isInitializing = false;
				} else if (domain) {
					// Cache miss - fallback using proper prioritization order
					
					// 0. Check for iconify icon first if preferred (experimental setting)
					if (shouldPreferIconify) {
						try {
							const iconName = await getIconifyIcon(domain);
							if (iconName) {
								iconifyIcon = iconName;
								useIconify = true;
								isInitializing = false;
								isLoading = false;
								return;
							}
						} catch (error) {
							// Silent fallback - no console spam
						}
					}
					
					// Build URLs in proper prioritization order
					const urls: string[] = [];
					
					// 1. Logo.dev and logo.dev ticker
					urls.push(getLogoDevUrl(domain, size, { format: 'png', retina: true }));
					urls.push(getLogoDevTickerUrl(domain));
					
					// 5. Google Favicons (skip 2-4 for cache miss to be faster)
					urls.push(getGoogleFaviconUrl(domain, size));
					
					// 6. Basic site favicon as final fallback
					const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
					urls.push(`https://${cleanDomain}/favicon.ico`);
					
					imageUrls = urls;
					isInitializing = false;
				} else if (fallbackUrls.length > 0) {
					imageUrls = fallbackUrls;
					isInitializing = false;
				} else {
					isInitializing = false;
				}
				
				currentIndex = 0;
				hasError = false;
				
				// If we're not using iconify, keep loading state until image loads
				if (!useIconify) {
					isLoading = true;
				}
			} catch (error) {
				hasError = true;
				isLoading = false;
				isInitializing = false;
			}
		}
		
		loadUrls();
	});

	function handleError() {
		
		if (currentIndex < imageUrls.length - 1) {
			currentIndex++;
			isLoading = true;
		} else {
			// Try iconify as final fallback if not already using it
			const shouldPreferIconify = preferIconify || experimental.preferIconifyIcons;
			if (!useIconify && domain && !shouldPreferIconify) {
				getIconifyIcon(domain).then(iconName => {
					if (iconName) {
						iconifyIcon = iconName;
						useIconify = true;
						isLoading = false;
					} else {
						hasError = true;
						isLoading = false;
					}
				}).catch(() => {
					hasError = true;
					isLoading = false;
				});
			} else {
				hasError = true;
				isLoading = false;
			}
		}
	}

	function handleLoad() {
		isLoading = false;
		hasError = false;
	}

	$effect(() => {
		if (imgElement && imageUrls[currentIndex] && !useIconify) {
			imgElement.src = imageUrls[currentIndex];
		}
	});
</script>

{#if instantCacheCheck && instantCacheCheck.type === 'iconify'}
    <!-- Instant cached iconify display; iconify rarely fails so safe to inline -->
    <div class={className} style="width: {size}px; height: {size}px;">
        <img 
            src="https://api.iconify.design/{instantCacheCheck.value.replace(':', '/')}.svg" 
            alt={alt}
            style="width: 100%; height: 100%;"
        />
    </div>
{:else if isInitializing}
	<!-- Loading skeleton while initializing -->
	<div 
		class="{className} bg-gray-100 dark:bg-gray-800 animate-pulse rounded"
		style="width: {size}px; height: {size}px;"
	></div>
{:else if useIconify && iconifyIcon}
	<!-- Use iconify icon directly -->
	<div class={className} style="width: {size}px; height: {size}px;">
		<img 
			src="https://api.iconify.design/{iconifyIcon.replace(':', '/')}.svg" 
			alt={alt}
			style="width: 100%; height: 100%;"
			onerror={handleError}
			onload={handleLoad}
		/>
	</div>
{:else if imageUrls.length > 0 && !useIconify}
	<img
		bind:this={imgElement}
		alt={alt}
		class={className}
		{loading}
		onerror={handleError}
		onload={handleLoad}
		style:opacity={hasError ? 0.5 : 1}
		style:transition="opacity 0.15s ease"
	/>
{:else}
	<!-- Clean Iconify globe fallback when no URLs available -->
	<div class={className} style="width: {size}px; height: {size}px;">
		<img 
			src="https://api.iconify.design/heroicons-outline/globe-alt.svg" 
			alt={alt}
			style="width: 100%; height: 100%; opacity: 0.6;"
			class="text-gray-400 dark:text-gray-500"
		/>
	</div>
{/if} 