/**
 * Icon preloading utilities for improved performance
 */

// Import the emoji mapping from IconDisplay
import type { } from '$lib/components/IconDisplay.svelte';

// In-memory cache for icon data (shared with IconDisplay)
const iconCache = new Map<string, any>();

/**
 * Common emojis used in news stories and categories that should be preloaded
 */
const COMMON_NEWS_EMOJIS = [
	// Politics & Government
	'🏛️', '🗳️', '⚖️', '🏴', '🏳️',
	
	// Economics & Business  
	'💰', '💵', '💳', '📈', '📉', '💼', '🏢', '🏦',
	
	// Technology & Science
	'💻', '📱', '🤖', '🚀', '🔬', '💉', '🧬', '🔋',
	
	// Transportation & Infrastructure
	'✈️', '🚗', '🚂', '🚢', '🚁', '🛣️',
	
	// Weather & Environment  
	'☀️', '🌧️', '❄️', '🌊', '🌍', '🌡️', '♻️',
	
	// Health & Medicine
	'💊', '🩺', '🏥', '❤️',
	
	// Sports & Entertainment
	'⚽', '🏀', '🏆', '🎬', '🎵', '🎭',
	
	// Communication & Media
	'📰', '📺', '📻', '📧', '📞', '💬',
	
	// General News/Documentation
	'📄', '📋', '📊', '🗂️', '📅', '⭐', '❗', '⚠️', 'ℹ️',
	
	// Countries/Regions (common flags)
	'🇺🇸', '🇬🇧', '🇩🇪', '🇫🇷', '🇨🇳', '🇯🇵', '🇷🇺', '🇮🇳', '🇧🇷', '🇨🇦',
	'🇦🇺', '🇰🇷', '🇮🇹', '🇪🇸', '🇳🇱', '🇸🇪', '🇨🇭', '🇦🇹', '🇧🇪', '🇵🇱',
	'🇺🇦', '🇮🇱', '🇹🇷', '🇸🇦', '🇦🇪', '🇪🇬', '🇿🇦', '🇳🇬', '🇲🇽', '🇦🇷',
	
	// UI/Navigation  
	'🏠', '⬆️', '⬇️', '⬅️', '➡️', '🔍', '⚙️', '✅', '❌'
];

// Comprehensive emoji to iconify mapping (copied from IconDisplay)
const EMOJI_TO_ICONIFY: Record<string, string> = {
	// UI, Navigation & Controls
	'🏠': 'heroicons-outline:home',
	'⬆️': 'heroicons-outline:arrow-up',
	'⬇️': 'heroicons-outline:arrow-down',
	'⬅️': 'heroicons-outline:arrow-left',
	'➡️': 'heroicons-outline:arrow-right',
	'🔍': 'heroicons-outline:magnifying-glass',
	'⚙️': 'heroicons-outline:cog-6-tooth',
	'✅': 'heroicons-outline:check-circle',
	'❌': 'heroicons-outline:x-circle',

	// Politics & Government
	'🏛️': 'heroicons-outline:building-library',
	'🗳️': 'material-symbols:how-to-vote',
	'⚖️': 'material-symbols:gavel',

	// Communication & Media
	'📰': 'heroicons-outline:newspaper',
	'📺': 'heroicons-outline:tv',
	'📻': 'heroicons-outline:radio',
	'📧': 'heroicons-outline:envelope',
	'📞': 'heroicons-outline:phone',
	'💬': 'heroicons-outline:chat-bubble-left',

	// Technology & Science
	'💻': 'heroicons-outline:computer-desktop',
	'📱': 'heroicons-outline:device-phone-mobile',
	'🤖': 'mdi:robot-outline',
	'🚀': 'mdi:rocket-launch-outline',
	'🔬': 'material-symbols:science',
	'💉': 'material-symbols:vaccines',
	'🧬': 'material-symbols:biotech',
	'🔋': 'heroicons-outline:battery-100',

	// Transportation
	'✈️': 'material-symbols:flight',
	'🚗': 'material-symbols:directions-car',
	'🚂': 'material-symbols:train',
	'🚢': 'material-symbols:directions-boat',
	'🚁': 'material-symbols:helicopter',

	// Weather & Environment
	'☀️': 'heroicons-outline:sun',
	'🌧️': 'material-symbols:rainy',
	'❄️': 'material-symbols:ac-unit',
	'🌊': 'heroicons-outline:lifebuoy',
	'🌍': 'heroicons-outline:globe-europe-africa',
	'🌡️': 'material-symbols:thermometer',
	'♻️': 'material-symbols:recycling',

	// Health & Medicine
	'💊': 'material-symbols:medication',
	'🩺': 'material-symbols:stethoscope',
	'🏥': 'material-symbols:local-hospital',
	'❤️': 'heroicons-outline:heart',

	// Sports & Entertainment
	'⚽': 'material-symbols:sports-soccer',
	'🏀': 'material-symbols:sports-basketball',
	'🏆': 'heroicons-outline:trophy',
	'🎬': 'heroicons-outline:film',
	'🎵': 'heroicons-outline:musical-note',
	'🎭': 'material-symbols:theater-comedy',

	// Money & Finance
	'💰': 'heroicons-outline:banknotes',
	'💵': 'heroicons-outline:currency-dollar',
	'💳': 'heroicons-outline:credit-card',
	'📈': 'heroicons-outline:arrow-trending-up',
	'📉': 'heroicons-outline:presentation-chart-line',
	'💼': 'heroicons-outline:briefcase',
	'🏢': 'heroicons-outline:building-office',
	'🏦': 'heroicons-outline:building-library',

	// General symbols
	'📄': 'heroicons-outline:document',
	'📋': 'heroicons-outline:clipboard',
	'📊': 'heroicons-outline:chart-bar',
	'🗂️': 'heroicons-outline:folder-plus',
	'📅': 'heroicons-outline:calendar-days',
	'⭐': 'heroicons-outline:star',
	'❗': 'heroicons-outline:exclamation-circle',
	'⚠️': 'heroicons-outline:exclamation-triangle',
	'ℹ️': 'heroicons-outline:information-circle'
};

/**
 * Get iconify icon name for an emoji
 */
function getIconName(emoji: string): string | null {
	if (!emoji) return null;
	
	const trimmed = emoji.trim();
	const normalized = trimmed.replace(/[\uFE0E\uFE0F]/g, ''); // Remove variation selectors
	
	// Check direct mapping
	let mapped = EMOJI_TO_ICONIFY[trimmed] || EMOJI_TO_ICONIFY[normalized] || null;
	if (mapped) return mapped;
	
	// Check for flags (Regional Indicator Symbols)
	if (/^[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]$/.test(normalized)) {
		const countryCode = [...normalized]
			.map((char) => String.fromCodePoint(char.codePointAt(0)! - 0x1f1e6 + 0x61))
			.join('');
		return `circle-flags:${countryCode}`;
	}
	
	return null;
}

/**
 * Preload common news emojis to improve performance
 * Call this during splash screen or app initialization
 */
export async function preloadCommonNewsEmojis(): Promise<void> {
	console.log('🚀 Preloading', COMMON_NEWS_EMOJIS.length, 'common news emojis...');
	
	const preloadPromises = COMMON_NEWS_EMOJIS.map(async (emoji) => {
		const iconName = getIconName(emoji);
		if (!iconName || iconCache.has(iconName)) return;
		
		try {
			const parts = iconName.split(':');
			if (parts.length !== 2) return;
			
			const [prefix, name] = parts;
			const url = `https://api.iconify.design/${prefix}.json?icons=${name}`;
			const response = await fetch(url);
			
			if (!response.ok) return;
			
			const data = await response.json();
			const iconProps = data.icons?.[name];
			if (!iconProps) return;
			
			const fullIconData = {
				body: iconProps.body,
				left: iconProps.left ?? data.left ?? 0,
				top: iconProps.top ?? data.top ?? 0,
				width: iconProps.width ?? data.width ?? 16,
				height: iconProps.height ?? data.height ?? 16
			};
			
			iconCache.set(iconName, fullIconData);
		} catch (error) {
			// Silently fail for individual icons
		}
	});
	
	const results = await Promise.allSettled(preloadPromises);
	const succeeded = results.filter(r => r.status === 'fulfilled').length;
	console.log(`✅ Preloaded ${succeeded}/${COMMON_NEWS_EMOJIS.length} news emoji icons`);
} 