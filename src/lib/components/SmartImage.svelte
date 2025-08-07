<script lang="ts">
	import { getFaviconUrls, getIconifyIcon, getFaviconUrlSync, getIconifyIconSync, getFaviconUrlsSync, getLogoDevUrl, getLogoDevTickerUrl, getGoogleFaviconUrl } from '$lib/utils/citationUtils';
	import IconDisplay from './IconDisplay.svelte';
	import { experimental } from '$lib/stores/experimental.svelte.js';
	import { iconService } from '$lib/services/iconService';
	import Icon from './Icon.svelte';

	// Inline globe SVG for instant loading
	const GLOBE_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.721 12.752q.03-.373.029-.752c0-1.524-.35-2.967-.973-4.252a12.8 12.8 0 0 1-4.34 2.709a19 19 0 0 1-.214 4.772a17.2 17.2 0 0 0 5.498-2.477m-7.087 2.798a17.3 17.3 0 0 0 .332-4.647c-.952.227-1.945.347-2.966.347s-2.014-.12-2.966-.347a17.5 17.5 0 0 0 .332 4.647a17.4 17.4 0 0 0 5.268 0m-4.862 1.569a19 19 0 0 0 4.456 0A17.2 17.2 0 0 1 12 21.724a17.2 17.2 0 0 1-2.228-4.605M7.777 15.23a19 19 0 0 1-.214-4.773a12.8 12.8 0 0 1-4.34-2.709a9.7 9.7 0 0 0-.944 5.004a17.2 17.2 0 0 0 5.498 2.477m13.579-.476a9.77 9.77 0 0 1-7.478 6.816a18.6 18.6 0 0 0 1.988-4.718a18.6 18.6 0 0 0 5.49-2.098m-18.712 0c1.682.97 3.53 1.687 5.49 2.098a18.6 18.6 0 0 0 1.988 4.718a9.77 9.77 0 0 1-7.478-6.816M13.878 2.43a9.76 9.76 0 0 1 6.116 3.986a11.3 11.3 0 0 1-3.746 2.504a18.6 18.6 0 0 0-2.37-6.49M12 2.276a17.15 17.15 0 0 1 2.805 7.121a11.3 11.3 0 0 1-5.61 0A17.15 17.15 0 0 1 12 2.276m-1.878.154a18.6 18.6 0 0 0-2.37 6.49a11.3 11.3 0 0 1-3.746-2.504a9.75 9.75 0 0 1 6.116-3.985"/></svg>`;

	interface Props {
		domain?: string;
		src?: string;
		alt: string;
		class?: string;
		size?: number;
		loading?: 'lazy' | 'eager';
		fallbackUrls?: string[];
		preferIconify?: boolean; // When true, prioritize iconify icons over image URLs
		addBackground?: boolean; // Add white background for transparent icons
	}

	let { 
		domain, 
		src, 
		alt, 
		class: className = '', 
		size = 32,
		loading = 'lazy',
		fallbackUrls = [],
		preferIconify = false,
		addBackground = false
	}: Props = $props();


	// State for image URLs and iconify
	let imageUrls = $state<string[]>([]);
	let currentIndex = $state(0);
	let hasError = $state(false);
	let imgElement = $state<HTMLImageElement | undefined>();
	let iconifyIcon = $state<string | null>(null);
	let useIconify = $state(false);
	let imageLoaded = $state(false);
	let isLoading = $state(true); // Track loading state
	
	// Track last loaded props to prevent unnecessary reloads
	let lastLoadedDomain = $state<string | undefined>(undefined);
	let lastLoadedSrc = $state<string | undefined>(undefined);
	let lastPreferIconify = $state<boolean>(false);
	
	// Create a unique ID for this component instance to prevent cross-contamination
	const componentId = Math.random().toString(36).substring(7);
	
	// Debug logging to understand what's happening
	$effect(() => {
		if (!domain) return;
		console.log(`🔍 SmartImage Debug for ${domain}:`, {
			addBackground,
			instantCacheCheck,
			useIconify,
			iconifyIcon,
			imageLoaded,
			isLoading,
			imageUrls: imageUrls.length,
			currentIndex,
			renderingBranch: (() => {
				if (addBackground) return 'WITH_BACKGROUND';
				if (instantCacheCheck?.type === 'iconify') return 'NO_BG_ICONIFY_CACHED';
				if (useIconify && iconifyIcon) return 'NO_BG_ICONIFY_LOADED';
				if (imageLoaded && imgElement) return 'NO_BG_IMAGE_LOADED';
				if (imageUrls.length > 0 || isLoading) return 'NO_BG_LOADING';
				return 'NO_BG_FALLBACK';
			})()
		});
	});
	
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
		}
		
		// Don't show loading state if we have instant cache available
		if (instantCacheCheck) {
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
		
		// Reset state when changing domains to prevent icon mixing
		imageLoaded = false;
		useIconify = false;
		iconifyIcon = null;
		hasError = false;
		currentIndex = 0;
		isLoading = true; // Start loading
		
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
					isLoading = false; // Done loading
					return; // Exit immediately - no async loading needed!
				}
			}
			
			// Check favicon cache
			const cachedUrls = getFaviconUrlsSync(domain, size);
			if (cachedUrls && cachedUrls.length > 0) {
				imageUrls = cachedUrls;
				currentIndex = 0;
				hasError = false;
				// Keep isLoading = true until actual image loads
				return; // Exit immediately - no async loading needed!
			}
		}
		
		// Only do async loading if not in cache
		async function loadUrls() {
			try {
				// Reset state for uncached items
				useIconify = false;
				iconifyIcon = null;
				
				if (src) {
					imageUrls = [src, ...fallbackUrls];
				} else if (domain) {
					// Cache miss - fallback using proper prioritization order
					
					// 0. Check for iconify icon first if preferred (experimental setting)
					if (shouldPreferIconify) {
						try {
							const iconName = await getIconifyIcon(domain);
					if (iconName) {
						iconifyIcon = iconName;
						useIconify = true;
						isLoading = false; // Done loading
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
				} else if (fallbackUrls.length > 0) {
					imageUrls = fallbackUrls;
				}
				
				currentIndex = 0;
				hasError = false;
			} catch (error) {
				hasError = true;
			}
		}
		
		loadUrls();
	});

	function handleError() {
		if (currentIndex < imageUrls.length - 1) {
			currentIndex++;
		} else {
			// Try iconify as final fallback if not already using it
			const shouldPreferIconify = preferIconify || experimental.preferIconifyIcons;
			if (!useIconify && domain && !shouldPreferIconify) {
				getIconifyIcon(domain).then(iconName => {
					if (iconName) {
						iconifyIcon = iconName;
						useIconify = true;
						isLoading = false; // Done loading
					} else {
						// Use inline globe as final fallback
						iconifyIcon = 'inline-globe';
						useIconify = true;
						isLoading = false; // Done loading
					}
				}).catch(() => {
					// Use inline globe as final fallback
					iconifyIcon = 'inline-globe';
					useIconify = true;
					isLoading = false; // Done loading
				});
			} else if (!useIconify) {
				// Use inline globe as final fallback
				iconifyIcon = 'inline-globe';
				useIconify = true;
				isLoading = false; // Done loading
			}
		}
	}

	function handleLoad() {
		hasError = false;
		imageLoaded = true;
		isLoading = false; // Done loading
		if (imgElement) {
			imgElement.style.display = 'block';
		}
	}

	// Use a more controlled approach for image src updates
	$effect(() => {
		if (imgElement && imageUrls[currentIndex] && !useIconify) {
			// Only update if this is truly our image element
			if (imgElement.dataset.componentId === componentId) {
				imgElement.src = imageUrls[currentIndex];
			}
		}
	});
</script>

<!-- Conditionally wrap with background -->
<!-- Debug: addBackground={addBackground} -->
{#if addBackground}
	{#key componentId}
		{#if instantCacheCheck && instantCacheCheck.type === 'iconify'}
			<!-- ICONIFY CACHED ICON (highest priority) -->
			<div class="{className} relative bg-white rounded-full flex items-center justify-center">
				<Icon icon={instantCacheCheck.value} class="w-4/5 h-4/5" />
			</div>
		{:else if useIconify && iconifyIcon}
			<!-- ICONIFY LOADED ICON -->
			<div class="{className} relative bg-white rounded-full flex items-center justify-center">
				{#if iconifyIcon === 'inline-globe'}
					<div class="w-4/5 h-4/5 opacity-50 flex items-center justify-center">
						{@html GLOBE_SVG}
					</div>
				{:else}
					<Icon icon={iconifyIcon} class="w-4/5 h-4/5" />
				{/if}
			</div>
		{:else if imageLoaded && imgElement}
			<!-- IMAGE LOADED -->
			<div class="{className} relative bg-white rounded-full flex items-center justify-center">
				<img
					bind:this={imgElement}
					alt={alt}
					class="w-full h-full object-cover rounded-full"
					{loading}
					data-component-id={componentId}
					onerror={handleError}
					onload={handleLoad}
				/>
			</div>
		{:else if imageUrls.length > 0 || isLoading}
			<!-- LOADING STATE - NO BACKGROUND UNTIL CONTENT LOADS -->
			<div class="{className} relative">
				<!-- Hidden img element for loading -->
				<img
					bind:this={imgElement}
					alt={alt}
					class="w-full h-full rounded-full object-cover"
					{loading}
					style="display: none;"
					data-component-id={componentId}
					onerror={handleError}
					onload={handleLoad}
				/>
				<!-- Loading globe without background -->
				<div class="w-full h-full opacity-40 flex items-center justify-center">
					{@html GLOBE_SVG}
				</div>
			</div>
		{:else}
			<!-- FINAL FALLBACK -->
			<div class="{className} relative bg-white rounded-full flex items-center justify-center">
				<div class="w-4/5 h-4/5 opacity-50 flex items-center justify-center">
					{@html GLOBE_SVG}
				</div>
			</div>
		{/if}
	{/key}
{:else}
<!-- No background version -->
<div class="{className} relative">
	{#key componentId}
		{#if instantCacheCheck && instantCacheCheck.type === 'iconify'}
			<!-- ICONIFY CACHED ICON (highest priority) -->
			<Icon icon={instantCacheCheck.value} class="w-full h-full" />
		{:else if useIconify && iconifyIcon}
			<!-- ICONIFY LOADED ICON -->
			{#if iconifyIcon === 'inline-globe'}
				<div class="w-full h-full opacity-50 flex items-center justify-center">
					{@html GLOBE_SVG}
				</div>
			{:else}
				<Icon icon={iconifyIcon} class="w-full h-full" />
			{/if}
		{:else if imageLoaded && imgElement}
			<!-- IMAGE LOADED -->
			<img
				bind:this={imgElement}
				alt={alt}
				class="w-full h-full rounded-full object-cover"
				{loading}
				data-component-id={componentId}
				onerror={handleError}
				onload={handleLoad}
			/>
		{:else if imageUrls.length > 0 || isLoading}
			<!-- LOADING STATE -->
			<!-- Hidden img element for loading -->
			<img
				bind:this={imgElement}
				alt={alt}
				class="w-full h-full rounded-full object-cover"
				{loading}
				style="display: none;"
				data-component-id={componentId}
				onerror={handleError}
				onload={handleLoad}
			/>
			<!-- Loading globe -->
			<div class="w-full h-full opacity-40 flex items-center justify-center">
				{@html GLOBE_SVG}
			</div>
		{:else}
			<!-- FINAL FALLBACK -->
			<div class="w-full h-full opacity-50 flex items-center justify-center">
				{@html GLOBE_SVG}
			</div>
		{/if}
	{/key}
</div>
{/if}

