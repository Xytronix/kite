import { browser } from '$app/environment';

export interface LocationInfo {
	country?: string;
	region?: string;
	timezone?: string;
	locale?: string;
	suggestedCategories: string[];
	suggestedUILanguage?: string;
	suggestedDataLanguage?: string;
}

// Mapping of country codes to relevant category suggestions and languages
const COUNTRY_CATEGORY_MAP: Record<string, { categories: string[], uiLanguage?: string, dataLanguage?: string }> = {
	'US': { categories: ['usa', 'business', 'tech', 'sports'], uiLanguage: 'en', dataLanguage: 'en' },
	'GB': { categories: ['uk', 'business', 'tech', 'sports'], uiLanguage: 'en', dataLanguage: 'en' },
	'CA': { categories: ['canada', 'business', 'tech', 'sports'], uiLanguage: 'en', dataLanguage: 'en' },
	'AU': { categories: ['australia', 'business', 'tech', 'sports'], uiLanguage: 'en', dataLanguage: 'en' },
	'DE': { categories: ['germany', 'business', 'tech', 'sports'], uiLanguage: 'de', dataLanguage: 'de' },
	'FR': { categories: ['france', 'business', 'tech', 'sports'], uiLanguage: 'fr', dataLanguage: 'fr' },
	'JP': { categories: ['japan', 'business', 'tech', 'sports'], uiLanguage: 'ja', dataLanguage: 'ja' },
	'IN': { categories: ['india', 'business', 'tech', 'sports'], uiLanguage: 'en', dataLanguage: 'en' },
	'BR': { categories: ['brazil', 'business', 'tech', 'sports'], uiLanguage: 'pt', dataLanguage: 'pt' },
	'MX': { categories: ['mexico', 'business', 'tech', 'sports'], uiLanguage: 'es', dataLanguage: 'es' },
	'IT': { categories: ['italy', 'business', 'tech', 'sports'], uiLanguage: 'it', dataLanguage: 'it' },
	'ES': { categories: ['spain', 'business', 'tech', 'sports'], uiLanguage: 'es', dataLanguage: 'es' },
	'NL': { categories: ['netherlands', 'business', 'tech', 'sports'], uiLanguage: 'nl', dataLanguage: 'nl' },
	'SE': { categories: ['sweden', 'business', 'tech', 'sports'], uiLanguage: 'sv', dataLanguage: 'sv' },
	'NO': { categories: ['norway', 'business', 'tech', 'sports'], uiLanguage: 'no', dataLanguage: 'no' },
	'DK': { categories: ['denmark', 'business', 'tech', 'sports'], uiLanguage: 'da', dataLanguage: 'da' },
	'FI': { categories: ['finland', 'business', 'tech', 'sports'], uiLanguage: 'fi', dataLanguage: 'fi' },
};

// Mapping of browser language codes to supported languages
const BROWSER_LANGUAGE_MAP: Record<string, { uiLanguage: string, dataLanguage: string }> = {
	'en': { uiLanguage: 'en', dataLanguage: 'en' },
	'de': { uiLanguage: 'de', dataLanguage: 'de' },
	'fr': { uiLanguage: 'fr', dataLanguage: 'fr' },
	'es': { uiLanguage: 'es', dataLanguage: 'es' },
	'it': { uiLanguage: 'it', dataLanguage: 'it' },
	'pt': { uiLanguage: 'pt', dataLanguage: 'pt' },
	'nl': { uiLanguage: 'nl', dataLanguage: 'nl' },
	'ja': { uiLanguage: 'ja', dataLanguage: 'ja' },
	'ko': { uiLanguage: 'ko', dataLanguage: 'ko' },
	'zh': { uiLanguage: 'zh', dataLanguage: 'zh' },
	'ru': { uiLanguage: 'ru', dataLanguage: 'ru' },
	'sv': { uiLanguage: 'sv', dataLanguage: 'sv' },
	'no': { uiLanguage: 'no', dataLanguage: 'no' },
	'da': { uiLanguage: 'da', dataLanguage: 'da' },
	'fi': { uiLanguage: 'fi', dataLanguage: 'fi' },
};

// Timezone to region mapping for additional context
const TIMEZONE_REGION_MAP: Record<string, string[]> = {
	'America/New_York': ['usa', 'business'],
	'America/Los_Angeles': ['usa', 'tech', 'business'],
	'America/Chicago': ['usa', 'business'],
	'America/Denver': ['usa', 'business'],
	'Europe/London': ['uk', 'business'],
	'Europe/Berlin': ['germany', 'business'],
	'Europe/Paris': ['france', 'business'],
	'Europe/Rome': ['italy', 'business'],
	'Europe/Madrid': ['spain', 'business'],
	'Europe/Amsterdam': ['netherlands', 'business'],
	'Europe/Stockholm': ['sweden', 'business'],
	'Europe/Oslo': ['norway', 'business'],
	'Europe/Copenhagen': ['denmark', 'business'],
	'Europe/Helsinki': ['finland', 'business'],
	'Asia/Tokyo': ['japan', 'tech', 'business'],
	'Asia/Shanghai': ['china', 'tech', 'business'],
	'Asia/Kolkata': ['india', 'tech', 'business'],
	'Australia/Sydney': ['australia', 'business'],
	'Australia/Melbourne': ['australia', 'business'],
	'America/Toronto': ['canada', 'business'],
	'America/Vancouver': ['canada', 'tech', 'business'],
	'America/Sao_Paulo': ['brazil', 'business'],
	'America/Mexico_City': ['mexico', 'business'],
};

class LocationService {
	private cachedLocation: LocationInfo | null = null;

	/**
	 * Detect user location using passive browser information
	 * No prompts or explicit permission requests
	 */
	async detectLocation(): Promise<LocationInfo> {
		if (this.cachedLocation) {
			return this.cachedLocation;
		}

		if (!browser) {
			return this.getDefaultLocation();
		}

		const locationInfo: LocationInfo = {
			suggestedCategories: []
		};

		try {
			// Get browser locale information
			const locale = navigator.language || navigator.languages?.[0];
			if (locale) {
				locationInfo.locale = locale;
				const countryCode = this.extractCountryFromLocale(locale);
				if (countryCode) {
					locationInfo.country = countryCode;
				}
			}

			// Get timezone information
			const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (timezone) {
				locationInfo.timezone = timezone;
				
				// Extract region info from timezone if country not already detected
				if (!locationInfo.country) {
					const regionFromTimezone = this.extractRegionFromTimezone(timezone);
					if (regionFromTimezone) {
						locationInfo.region = regionFromTimezone;
					}
				}
			}

			// Generate suggested categories and languages based on detected location
			locationInfo.suggestedCategories = this.generateSuggestedCategories(locationInfo);
			const suggestedLanguages = this.generateSuggestedLanguages(locationInfo);
			locationInfo.suggestedUILanguage = suggestedLanguages.uiLanguage;
			locationInfo.suggestedDataLanguage = suggestedLanguages.dataLanguage;

			this.cachedLocation = locationInfo;
			return locationInfo;

		} catch (error) {
			console.warn('Failed to detect location:', error);
			return this.getDefaultLocation();
		}
	}

	/**
	 * Extract country code from browser locale
	 */
	private extractCountryFromLocale(locale: string): string | undefined {
		// Locale format is usually "en-US", "fr-FR", etc.
		const parts = locale.split('-');
		if (parts.length >= 2) {
			return parts[1].toUpperCase();
		}
		return undefined;
	}

	/**
	 * Extract region information from timezone
	 */
	private extractRegionFromTimezone(timezone: string): string | undefined {
		// Extract continent/region from timezone like "America/New_York"
		const parts = timezone.split('/');
		if (parts.length >= 1) {
			return parts[0].toLowerCase();
		}
		return undefined;
	}

	/**
	 * Generate suggested categories based on location info
	 */
	private generateSuggestedCategories(locationInfo: LocationInfo): string[] {
		const suggestions = new Set<string>();

		// Always include core categories
		suggestions.add('world');
		suggestions.add('business');
		suggestions.add('tech');
		suggestions.add('science');
		suggestions.add('sports');
		suggestions.add('onthisday');

		// Add country-specific suggestions
		if (locationInfo.country && COUNTRY_CATEGORY_MAP[locationInfo.country]) {
			COUNTRY_CATEGORY_MAP[locationInfo.country].categories.forEach(cat => suggestions.add(cat));
		}

		// Add timezone-specific suggestions
		if (locationInfo.timezone && TIMEZONE_REGION_MAP[locationInfo.timezone]) {
			TIMEZONE_REGION_MAP[locationInfo.timezone].forEach(cat => suggestions.add(cat));
		}

		// Add region-based suggestions
		if (locationInfo.region === 'america') {
			suggestions.add('usa'); // Default to USA for American timezones
		} else if (locationInfo.region === 'europe') {
			suggestions.add('business'); // Emphasize business for European users
		} else if (locationInfo.region === 'asia') {
			suggestions.add('tech'); // Emphasize tech for Asian users
		}

		return Array.from(suggestions);
	}

	/**
	 * Generate suggested languages based on location info
	 */
	private generateSuggestedLanguages(locationInfo: LocationInfo): { uiLanguage: string, dataLanguage: string } {
		// First try country-specific language mapping
		if (locationInfo.country && COUNTRY_CATEGORY_MAP[locationInfo.country]) {
			const countryInfo = COUNTRY_CATEGORY_MAP[locationInfo.country];
			if (countryInfo.uiLanguage && countryInfo.dataLanguage) {
				return {
					uiLanguage: countryInfo.uiLanguage,
					dataLanguage: countryInfo.dataLanguage
				};
			}
		}

		// Then try browser locale language mapping
		if (locationInfo.locale) {
			const browserLang = locationInfo.locale.split('-')[0].toLowerCase();
			if (BROWSER_LANGUAGE_MAP[browserLang]) {
				return BROWSER_LANGUAGE_MAP[browserLang];
			}
		}

		// Default to English UI and English data (translated content)
		return { uiLanguage: 'en', dataLanguage: 'en' };
	}

	/**
	 * Get default location when detection fails
	 */
	private getDefaultLocation(): LocationInfo {
		return {
			suggestedCategories: ['world', 'usa', 'business', 'tech', 'science', 'sports', 'gaming', 'onthisday'],
			suggestedUILanguage: 'en',
			suggestedDataLanguage: 'en'
		};
	}

	/**
	 * Clear cached location (useful for testing or manual refresh)
	 */
	clearCache(): void {
		this.cachedLocation = null;
	}

	/**
	 * Get location info synchronously if already cached
	 */
	getCachedLocation(): LocationInfo | null {
		return this.cachedLocation;
	}
}

export const locationService = new LocationService();