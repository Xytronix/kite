import { iconService } from '$lib/services/iconService';

// Comprehensive Emoji to Iconify Mapping (moved from IconDisplay)
export const EMOJI_TO_ICONIFY: Record<string, string> = {
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
	'🧑‍🚀': 'mdi:astronaut',
	'🤖': 'mdi:robot-outline',
	'🧠': 'mdi:brain',
	'🚀': 'mdi:rocket-launch-outline',
	'🛰️': 'mdi:satellite-outline',
	'🪐': 'hugeicons:saturn',
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

/**
 * Convert emoji to Iconify icon name
 */
export function getIconName(emoji: string): string | null {
	if (!emoji) return null;

	// Normalize the input emoji
	const trimmed = emoji.trim();
	const normalized = trimmed.replace(/[\uFE0E\uFE0F]/g, ''); // Remove variation selectors

	// Check for direct mapping
	let mapped = EMOJI_TO_ICONIFY[trimmed] || EMOJI_TO_ICONIFY[normalized] || null;
	if (mapped) return mapped;

	// Programmatic mapping for flags
	if (/^[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]$/.test(normalized)) {
		const countryCode = [...normalized]
			.map((char) => String.fromCodePoint(char.codePointAt(0)! - 0x1f1e6 + 0x61))
			.join('');
		return `circle-flags:${countryCode}`;
	}

	return null;
}

/**
 * Extract all emojis from story data and preload their icons
 */
export function preloadStoryIcons(stories: any[], highPriority: boolean = false): void {
	const iconsToPreload = new Set<string>();

	stories.forEach(story => {
		// Extract emojis from story
		if (story.emoji) {
			const iconName = getIconName(story.emoji);
			if (iconName) {
				iconsToPreload.add(iconName);
			}
		}

		// Extract emojis from articles if they have them
		if (story.articles) {
			story.articles.forEach((article: any) => {
				if (article.emoji) {
					const iconName = getIconName(article.emoji);
					if (iconName) {
						iconsToPreload.add(iconName);
					}
				}
			});
		}
	});

	// Preload all unique icons
	if (iconsToPreload.size > 0) {
		console.log(`📰 Found ${iconsToPreload.size} story icons to preload from ${stories.length} stories${highPriority ? ' (high priority)' : ''}`);
		iconService.preload(Array.from(iconsToPreload), highPriority);
	}
}

/**
 * Preload domain-specific icons from story sources
 */
export function preloadSourceIcons(stories: any[]): void {
	const sourceIcons = new Set<string>();
	
	stories.forEach(story => {
		if (story.articles) {
			story.articles.forEach((article: any) => {
				if (article.domain) {
					// Add common source icons that might be used
					// These are common iconify icons used for news sources
					const commonSourceIcons = [
						'simple-icons:' + article.domain.toLowerCase().replace(/[^a-z0-9]/g, ''),
						'logos:' + article.domain.toLowerCase().replace(/[^a-z0-9]/g, ''),
						'mdi:newspaper',
						'heroicons-outline:globe-alt'
					];
					commonSourceIcons.forEach(icon => sourceIcons.add(icon));
				}
			});
		}
	});

	if (sourceIcons.size > 0) {
		console.log(`🌐 Preloading ${sourceIcons.size} potential source icons`);
		iconService.preload(Array.from(sourceIcons), false);
	}
}

/**
 * Preload citation icons and favicon data for a specific story (when story detail is opened)
 */
export async function preloadStoryCitations(story: any): Promise<void> {
	if (!story || !story.articles) return;
	
	const domains = new Set<string>();
	
	// Extract all unique domains from the story's articles
	story.articles.forEach((article: any) => {
		if (article.domain) {
			domains.add(article.domain);
		}
	});
	
	if (domains.size === 0) return;
	
	console.log(`📰 Preloading citation data for ${domains.size} domains in story`);
	
	// Import the preload function from citationUtils
	const { preloadCommonFavicons } = await import('$lib/utils/citationUtils');
	
	// Create a fake category structure with just this story
	const fakeCategories = { story: [story] };
	
	// Preload all favicon data for these domains
	await preloadCommonFavicons(fakeCategories, ['story']);
	
	// Also preload potential iconify icons
	const iconifyIcons = new Set<string>();
	domains.forEach(domain => {
		// Try common icon patterns
		const patterns = [
			'simple-icons:' + domain.toLowerCase().replace(/[^a-z0-9]/g, ''),
			'logos:' + domain.toLowerCase().replace(/[^a-z0-9]/g, ''),
		];
		patterns.forEach(icon => iconifyIcons.add(icon));
	});
	
	if (iconifyIcons.size > 0) {
		iconService.preload(Array.from(iconifyIcons), true); // High priority for story details
	}
}

/**
 * Preload common UI icons that are frequently used
 */
export function preloadCommonIcons(): void {
	const commonIcons = [
		'heroicons-outline:home',
		'heroicons-outline:newspaper',
		'heroicons-outline:globe-europe-africa',
		'heroicons-outline:star',
		'heroicons-outline:heart',
		'heroicons-outline:check-circle',
		'heroicons-outline:x-circle',
		'heroicons-outline:exclamation-triangle',
		'heroicons-outline:information-circle',
		'heroicons-outline:magnifying-glass',
		'heroicons-outline:cog-6-tooth',
		// SourceOverlay icons
		'tabler:map-pin',
		'tabler:user',
		'tabler:building',
		'tabler:tag',
		'tabler:external-link',
		// SmartImage fallback icons
		'heroicons-outline:globe-alt',
		'mdi:newspaper'
	];

	console.log('🎨 Preloading common UI icons');
	iconService.preload(commonIcons, true); // High priority for UI icons
}

