<script lang="ts">
	import { iconService, type IconData } from '$lib/services/iconService';
	import { getIconName } from '$lib/utils/iconPreloader';

	// Props using Svelte 5 runes syntax
	interface Props {
		emoji?: string;
		className?: string;
		forceEmoji?: boolean; // when true, always render raw emoji, skip mapping
	}

	let { emoji, className = 'icon-lg', forceEmoji = false }: Props = $props();
	
	// Use forceEmoji to skip icon mapping when requested
	const shouldUseIcon = $derived(!forceEmoji && emoji);

	// State for the fetched icon data
	let iconData = $state<IconData | null>(null);
	let loadingState = $state<'idle' | 'loading' | 'success' | 'error'>('idle');

	const iconName = $derived(shouldUseIcon ? getIconName(emoji || '') : null);

	// Immediately check for cached icon on iconName change
	$effect(() => {
		if (iconName) {
			const cached = iconService.getCachedIcon(iconName);
			if (cached) {
				iconData = cached;
				loadingState = 'success';
			}
		}
	});

	// Reactive effect to fetch icon data when the iconName changes
	$effect(() => {
		if (!iconName) {
			iconData = null;
			loadingState = 'idle';
			return;
		}

		// Check if already cached - get synchronously if available
		const cachedIcon = iconService.getCachedIcon(iconName);
		if (cachedIcon) {
			iconData = cachedIcon;
			loadingState = 'success';
			return;
		}

		// For uncached icons, show emoji immediately and load icon in background
		loadingState = 'loading';
		iconData = null;

		let isCancelled = false;

		// Start fetching the icon in background
		iconService.getIcon(iconName).then(data => {
			if (!isCancelled) {
				iconData = data;
				loadingState = data ? 'success' : 'error';
			}
		}).catch(error => {
			if (!isCancelled) {
				console.warn(`Failed to load icon: ${iconName}`, error);
				iconData = null;
				loadingState = 'error';
			}
		});

		// Cleanup function to prevent state updates on unmounted components
		return () => {
			isCancelled = true;
		};
	});
</script>

{#if loadingState === 'success' && iconData}
	<!-- Render the icon as an inline SVG with a dynamic viewBox -->
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="{iconData.left} {iconData.top} {iconData.width} {iconData.height}"
		class={className}
		aria-hidden="true"
		role="img"
		fill="currentColor"
	>
		{@html iconData.body}
	</svg>
{:else if emoji}
	<!-- Show emoji immediately - no loading states, just emoji while icon loads -->
	<span
		class={className + ' inline-flex items-center justify-center text-center'}
		style="font-size: {className.includes('icon-sm') ? '0.65em' : '0.75em'}; line-height: 1; transform: scale({className.includes('icon-sm') ? '0.8' : '0.9'});"
	>{emoji}</span>
{:else}
	<!-- Only show loading indicator if no emoji is available -->
	<div class="{className} inline-flex items-center justify-center">
		<div class="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
	</div>
{/if}