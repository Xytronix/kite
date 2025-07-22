<script lang="ts">
	// Props using Svelte 5 runes syntax
	interface Props {
		emoji?: string;
		className?: string;
		forceEmoji?: boolean; // when true, always render raw emoji, skip mapping
	}

	let { emoji, className = 'icon-lg', forceEmoji = false }: Props = $props();

	// State for the fetched icon data
	let iconData = $state<any>(null);
	let loadingState = $state<'idle' | 'loading' | 'success' | 'error'>('idle');

	// In-memory cache to avoid redundant API calls
	const iconCache = new Map<string, any>();

	// Comprehensive Functional Emoji to Iconify Mapping
	const EMOJI_TO_ICONIFY: Record<string, string> = {
		// UI, Navigation & Controls
		'🏠': 'heroicons-outline:home',
		'🏡': 'heroicons-outline:home-modern',
		'⬆️': 'heroicons-outline:arrow-up',
		'⬇️': 'heroicons-outline:arrow-down',
		'⬅️': 'heroicons-outline:arrow-left',
		'➡️': 'heroicons-outline:arrow-right',
		'↗️': 'heroicons-outline:arrow-up-right',
		'↘️': 'heroicons-outline:arrow-down-right',
		'↙️': 'heroicons-outline:arrow-down-left',
		'↖️': 'heroicons-outline:arrow-up-left',
		'↕️': 'heroicons-outline:arrows-up-down',
		'↔️': 'heroicons-outline:arrows-right-left',
		'🔄': 'heroicons-outline:arrow-path',
		'↩️': 'heroicons-outline:arrow-uturn-left',
		'↪️': 'heroicons-outline:arrow-uturn-right',
		'⤴️': 'heroicons-outline:arrow-trending-up',
		'⤵️': 'heroicons-outline:arrow-trending-down',
		'🔝': 'heroicons-outline:arrow-up-circle',
		'🔙': 'heroicons-outline:arrow-left-circle',
		'🔜': 'heroicons-outline:arrow-right-circle',
		'✅': 'heroicons-outline:check-circle',
		'❌': 'heroicons-outline:x-circle',
		'➕': 'heroicons-outline:plus-circle',
		'➖': 'heroicons-outline:minus-circle',
		'✔️': 'heroicons-outline:check-circle',
		'❎': 'heroicons-outline:x-circle',
		'🔍': 'heroicons-outline:magnifying-glass',
		'🔎': 'heroicons-outline:magnifying-glass-plus',
		'🔒': 'heroicons-outline:lock-closed',
		'🔓': 'heroicons-outline:lock-open',
		'🔑': 'heroicons-outline:key',
		'⚙️': 'heroicons-outline:cog-6-tooth',
		'🛠️': 'heroicons-outline:wrench-screwdriver',
		'🔧': 'heroicons-outline:wrench',
		'✏️': 'heroicons-outline:pencil',
		'🗑️': 'heroicons-outline:trash',
		'🚪': 'heroicons-outline:arrow-right-on-rectangle',
		'🎛️': 'heroicons-outline:funnel',
		'📤': 'heroicons-outline:arrow-up-tray',
		'👤': 'heroicons-outline:user',
		'👥': 'heroicons-outline:users',
		'📎': 'heroicons-outline:paper-clip',
		'📥': 'heroicons-outline:arrow-down-tray',

		// User Roles & People
		'🧑‍💻': 'heroicons-outline:code-bracket',
		'🧑‍🏫': 'heroicons-outline:academic-cap',
		'🧑‍🎓': 'heroicons-outline:user-circle',
		'🧑‍🎨': 'heroicons-outline:paint-brush',

		// Communication
		'📧': 'heroicons-outline:envelope',
		'📨': 'heroicons-outline:envelope-open',
		'📞': 'heroicons-outline:phone',
		'📱': 'heroicons-outline:device-phone-mobile',
		'💬': 'heroicons-outline:chat-bubble-left',
		'💭': 'heroicons-outline:chat-bubble-oval-left',
		'🗨️': 'heroicons-outline:chat-bubble-left-ellipsis',
		'📢': 'heroicons-outline:megaphone',
		'📣': 'heroicons-outline:speaker-wave',
		'📠': 'material-symbols:fax',
		'🤝': 'material-symbols:handshake',

		// Files, Documents & Office
		'📁': 'heroicons-outline:folder',
		'📂': 'heroicons-outline:folder-open',
		'📄': 'heroicons-outline:document',
		'📃': 'heroicons-outline:document-text',
		'📋': 'heroicons-outline:clipboard',
		'📊': 'heroicons-outline:chart-bar',
		'📈': 'heroicons-outline:arrow-trending-up',
		'📉': 'heroicons-outline:presentation-chart-line',
		'🗂️': 'heroicons-outline:folder-plus',
		'🗃️': 'heroicons-outline:archive-box',
		'📑': 'heroicons-outline:document-duplicate',
		'📜': 'heroicons-outline:document-text',
		'📰': 'heroicons-outline:newspaper',
		'📓': 'heroicons-outline:book-open',
		'📚': 'heroicons-outline:queue-list',
		'💼': 'heroicons-outline:briefcase',
		'🏢': 'heroicons-outline:building-office',
		'🏪': 'heroicons-outline:building-storefront',
		'🏦': 'heroicons-outline:building-library',
		'🖨️': 'heroicons-outline:printer',
		'💾': 'material-symbols:save',
		'🗳️': 'material-symbols:how-to-vote',
		'🔖': 'heroicons-outline:bookmark',
		'🗓️': 'heroicons-outline:calendar',
		'📅': 'heroicons-outline:calendar-days',

		// Money & Finance
		'💳': 'heroicons-outline:credit-card',
		'💰': 'heroicons-outline:banknotes',
		'💵': 'heroicons-outline:currency-dollar',
		'💴': 'heroicons-outline:currency-yen',
		'💶': 'heroicons-outline:currency-euro',
		'💷': 'heroicons-outline:currency-pound',
		'🪙': 'heroicons-outline:currency-dollar',

		// Technology & Devices
		'💻': 'heroicons-outline:computer-desktop',
		'⌨️': 'material-symbols:keyboard',
		'🖱️': 'material-symbols:mouse',
		'💿': 'material-symbols:album',
		'🔌': 'material-symbols:power',
		'🔋': 'heroicons-outline:battery-100',
		'📡': 'material-symbols:signal-cellular-alt',

		// Space & Sci-Fi
		'🧑‍🚀': 'mdi:astronaut', // Reworked
		'🤖': 'mdi:robot-outline',
		'🧠': 'mdi:brain',
		'🚀': 'mdi:rocket-launch-outline',
		'🛰️': 'mdi:satellite-outline',
		'🪐': 'hugeicons:saturn', // Corrected with user-provided icon
		'🌌': 'mdi:galaxy',
		'🛸': 'mdi:ufo-outline',
		'🌐': 'mdi:web',

		// Media & Entertainment
		'▶️': 'heroicons-outline:play',
		'⏸️': 'heroicons-outline:pause',
		'⏹️': 'heroicons-outline:stop',
		'⏭️': 'heroicons-outline:forward',
		'⏮️': 'heroicons-outline:backward',
		'⏯️': 'heroicons-outline:play-pause',
		'🔊': 'heroicons-outline:speaker-wave',
		'🔇': 'heroicons-outline:speaker-x-mark',
		'📷': 'heroicons-outline:camera',
		'🎥': 'heroicons-outline:video-camera',
		'🎬': 'heroicons-outline:film',
		'🎵': 'heroicons-outline:musical-note',
		'📺': 'heroicons-outline:tv',
		'📻': 'heroicons-outline:radio',
		'🎧': 'material-symbols:headphones',
		'🎼': 'heroicons-outline:musical-note',
		'🎹': 'material-symbols:piano',
		'🥁': 'material-symbols:music-note',
		'🎷': 'material-symbols:music-note',
		'🎺': 'material-symbols:music-note',
		'🎸': 'material-symbols:music-note',
		'🪕': 'material-symbols:music-note',
		'🎻': 'material-symbols:music-note',
		'🎭': 'material-symbols:theater-comedy',
		'🎪': 'material-symbols:festival',

		// Transportation
		'🚗': 'material-symbols:directions-car',
		'🚕': 'material-symbols:local-taxi',
		'🚙': 'material-symbols:time-to-leave',
		'🚌': 'material-symbols:directions-bus',
		'🚓': 'material-symbols:local-police',
		'🚑': 'material-symbols:ambulance',
		'🚒': 'material-symbols:fire-truck',
		'🚚': 'material-symbols:local-shipping',
		'🚜': 'material-symbols:tractor',
		'🚲': 'material-symbols:directions-bike',
		'🛵': 'material-symbols:two-wheeler',
		'✈️': 'material-symbols:flight',
		'🛫': 'material-symbols:flight-takeoff',
		'🛬': 'material-symbols:flight-land',
		'🚁': 'material-symbols:helicopter',
		'🚂': 'material-symbols:train',
		'🚋': 'material-symbols:tram',
		'🚠': 'material-symbols:cable-car',
		'⛵': 'material-symbols:sailing',
		'🛶': 'material-symbols:kayaking',
		'🚤': 'material-symbols:directions-boat',
		'🚢': 'material-symbols:directions-boat',
		'📍': 'heroicons-outline:map-pin',
		'🧑‍✈️': 'material-symbols:flight',

		// Science & Health
		'🔬': 'material-symbols:science',
		'🧪': 'material-symbols:science',
		'🧬': 'material-symbols:biotech',
		'💉': 'material-symbols:vaccines',
		'💊': 'material-symbols:medication',
		'🩺': 'material-symbols:stethoscope',
		'🔭': 'material-symbols:telescope',
		'🧲': 'material-symbols:magnet-on',
		'🧑‍🔬': 'material-symbols:science',
		'🧻': 'material-symbols:inventory',
		'🧼': 'material-symbols:cleaning-services',
		'❤️': 'heroicons-outline:heart',

		// Nature & Weather
		'☀️': 'heroicons-outline:sun',
		'🌤️': 'material-symbols:partly-cloudy-day',
		'⛅': 'material-symbols:cloud',
		'☁️': 'heroicons-outline:cloud',
		'🌦️': 'material-symbols:rainy',
		'🌧️': 'material-symbols:rainy',
		'⛈️': 'material-symbols:thunderstorm',
		'🌨️': 'material-symbols:weather-snowy',
		'❄️': 'material-symbols:ac-unit',
		'🌬️': 'material-symbols:air',
		'🌪️': 'material-symbols:tornado',
		'🌫️': 'material-symbols:foggy',
		'🌊': 'heroicons-outline:lifebuoy',
		'💧': 'material-symbols:water-drop',
		'🌡️': 'material-symbols:thermometer',
		'🌍': 'heroicons-outline:globe-europe-africa',
		'🌎': 'heroicons-outline:globe-americas',
		'🌏': 'heroicons-outline:globe-asia-australia',
		'🕊️': 'material-symbols:eco',
		'🌈': 'material-symbols:rainbow',
		'🗻': 'material-symbols:landscape',
		'🗿': 'material-symbols:landscape',
		'🦚': 'material-symbols:emoji-nature',
		'🦒': 'material-symbols:emoji-nature',
		'🐓': 'material-symbols:pets',

		// Sports & Activities
		'⚽': 'material-symbols:sports-soccer',
		'🏀': 'material-symbols:sports-basketball',
		'🏈': 'material-symbols:sports-football',
		'⚾': 'material-symbols:sports-baseball',
		'🎾': 'material-symbols:sports-tennis',
		'🏐': 'material-symbols:sports-volleyball',
		'🏉': 'material-symbols:sports-rugby',
		'🏓': 'material-symbols:sports-tennis',
		'🏸': 'material-symbols:sports-tennis',
		'🥅': 'material-symbols:sports-soccer',
		'🏑': 'material-symbols:sports-hockey',
		'🏏': 'material-symbols:sports-cricket',
		'🎱': 'material-symbols:sports-esports',
		'🏆': 'heroicons-outline:trophy',

		// Food & Drink
		'🥨': 'material-symbols:restaurant',
		'🧋': 'material-symbols:local-drink',

		// Shopping
		'🛒': 'heroicons-outline:shopping-cart',
		'🛍️': 'heroicons-outline:shopping-bag',
		'🏷️': 'heroicons-outline:tag',

		// Symbols & Miscellaneous
		'⭐': 'heroicons-outline:star',
		'⛔': 'heroicons-outline:no-symbol',
		'❗': 'heroicons-outline:exclamation-circle',
		'⚠️': 'heroicons-outline:exclamation-triangle',
		'ℹ️': 'heroicons-outline:information-circle',
		'❓': 'heroicons-outline:question-mark-circle',
		'⏰': 'heroicons-outline:clock',
		'⏳': 'heroicons-outline:hourglass',
		'🎯': 'material-symbols:gps-fixed',
		'🎲': 'material-symbols:casino',
		'🃏': 'material-symbols:casino',
		'🆘': 'material-symbols:warning-outline-rounded',
		'💥': 'heroicons-outline:bolt',
		'🪖': 'material-symbols:security',
		'🪄': 'material-symbols:auto-awesome',
		'☮️': 'material-symbols:emoji-flags',
		'♻️': 'material-symbols:recycling',
		'🔗': 'heroicons-outline:link'
	};

	// Track all unmapped emojis during a session (dev utility)
	const missingIcons = new Set<string>();

	// Expose the set globally in dev for easy inspection
	if (typeof window !== 'undefined') {
		(window as any).__missingIcons = missingIcons;
		(window as any).logMissingIcons = () => {
			console.info('🔍 All missing icons:', Array.from(missingIcons).join(' '));
		};
	}

	/**
	 * Converts a single character (like an emoji) into its corresponding Iconify icon name.
	 * Handles normalization, aliases, and programmatic mappings (e.g., for flags).
	 * @param emoji The emoji or character to map.
	 * @returns The full Iconify icon name (e.g., `heroicons-outline:home`) or `null`.
	 */
	function getIconName(emoji: string): string | null {
		if (!emoji) return null;

		// 1. Normalize the input emoji
		const trimmed = emoji.trim();
		const normalized = trimmed.replace(/[\uFE0E\uFE0F]/g, ''); // Remove variation selectors

		// 2. Check for a direct mapping
		let mapped = EMOJI_TO_ICONIFY[trimmed] || EMOJI_TO_ICONIFY[normalized] || null;
		if (mapped) return mapped;

		// 3. Programmatic mapping for flags
		// Check if the emoji is a Regional Indicator Symbol pair (a flag)
		if (/^[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]$/.test(normalized)) {
			const countryCode = [...normalized]
				.map((char) => String.fromCodePoint(char.codePointAt(0)! - 0x1f1e6 + 0x61))
				.join('');
			return `circle-flags:${countryCode}`;
		}

		// 4. Log unmapped emojis for debugging
		if (!missingIcons.has(normalized)) {
			missingIcons.add(normalized);
			console.warn(`🚫 Unmapped emoji: "${emoji}" (normalized: "${normalized}")`);
		}

		return null;
	}

	const iconName = $derived(getIconName(emoji || ''));

	// Reactive effect to fetch icon data when the iconName changes
	$effect(() => {
		if (!iconName) {
			iconData = null;
			loadingState = 'idle';
			return;
		}

		// Use cached data if available
		if (iconCache.has(iconName)) {
			iconData = iconCache.get(iconName);
			loadingState = 'success';
			return;
		}

		// Split icon name into prefix and name for the API call
		const parts = iconName.split(':');
		if (parts.length !== 2) {
			iconData = null;
			loadingState = 'error'; // Invalid icon name format
			return;
		}
		const [prefix, name] = parts;

		let isCancelled = false;
		iconData = null; // Reset state while fetching
		loadingState = 'loading';

		// Fetch icon data from the public Iconify API
		fetch(`https://api.iconify.design/${prefix}.json?icons=${name}`)
			.then((response) => {
				if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
				return response.json();
			})
			.then((data) => {
				if (isCancelled || !data?.icons?.[name]) {
					if (!isCancelled) loadingState = 'error';
					return;
				}

				// Extract the core properties for the icon
				const iconProps = data.icons[name];
				const fullIconData = {
					body: iconProps.body,
					left: iconProps.left ?? data.left ?? 0,
					top: iconProps.top ?? data.top ?? 0,
					width: iconProps.width ?? data.width ?? 16,
					height: iconProps.height ?? data.height ?? 16
				};

				// Cache and set the data
				iconCache.set(iconName, fullIconData);
				iconData = fullIconData;
				loadingState = 'success';
			})
			.catch((err) => {
				console.error(`Failed to fetch icon: ${iconName}`, err);
				if (!isCancelled) {
					iconData = null; // Clear on error
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
{:else if forceEmoji && emoji}
	<!-- Fallback to rendering the emoji character if no icon is mapped or fetch failed -->
	<span
		class={className + ' inline-flex items-center justify-center overflow-hidden'}
		style="font-size:1em; line-height:1;"
	>{emoji}</span>
{:else if (loadingState === 'error' || !iconName) && emoji}
	<!-- Placeholder while icon data is loading -->
	<span class={className + ' inline-block'} style="line-height:1;"></span>
{/if}