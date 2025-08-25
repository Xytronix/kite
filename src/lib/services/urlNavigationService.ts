import type { SupportedLanguage } from '$lib/stores/language.svelte';
import { SUPPORTED_LANGUAGES } from '$lib/constants/languages';
import { normalizeForUrl } from '$lib/utils/categoryIdTransform';

export interface NavigationParams {
	batchId?: string | null;
	categoryId?: string | null;
	storyIndex?: number | null;
	dataLang?: string | null;
	slug?: string | null;
}

export interface ParsedUrl extends NavigationParams {
	isValid: boolean;
}

/**
 * Service to handle URL parsing and navigation logic
 */
export class UrlNavigationService {
	/**
	 * Parse a URL to extract navigation parameters
	 */
	static parseUrl(url: URL): ParsedUrl {
		const pathSegments = url.pathname.split('/').filter(Boolean);
		const params: ParsedUrl = { isValid: true };
		
		// Extract data_lang from query parameters
		const dataLangParam = url.searchParams.get('data_lang');
		if (dataLangParam) {
			params.dataLang = dataLangParam;
		}
		
		if (pathSegments.length === 0) {
			// Root path - valid but no params
			return params;
		}
		
		// Check if first segment looks like a batch ID
		const firstSegment = pathSegments[0];
		const isBatchId = this.isBatchId(firstSegment);
		
		// Helper to extract storyIndex from a path segment
		const extractStoryParams = (segment?: string | null) => {
			if (!segment) return;

			// Check if segment is a pure number (story index)
			const numericMatch = segment.match(/^\d+$/);
			if (numericMatch) {
				params.storyIndex = parseInt(segment);
				params.slug = null;
				return;
			}

			// Legacy support: Segment starts with number followed by slug
			const legacyMatch = segment.match(/^(\d+)-(.*)$/);
			if (legacyMatch) {
				params.storyIndex = parseInt(legacyMatch[1]);
				params.slug = legacyMatch[2];
				return;
			}

			// Pure slug without leading index (legacy)
			params.slug = segment;
			params.storyIndex = null;
		};

		if (!isBatchId) {
			// No batch ID, this is latest batch with category
			params.batchId = null;
			params.categoryId = pathSegments[0];
			extractStoryParams(pathSegments[1] || null);
		} else {
			// Has batch ID
			params.batchId = pathSegments[0];
			params.categoryId = pathSegments[1] || null;
			extractStoryParams(pathSegments[2] || null);
		}

		// Validate story index if present (and not null)
		if (params.storyIndex !== null && params.storyIndex !== undefined) {
			if (isNaN(params.storyIndex) || params.storyIndex < 0) {
				params.isValid = false;
			}
		}
		
		return params;
	}
	
	/**
	 * Build a URL from navigation parameters
	 */
	static buildUrl(params: NavigationParams, currentDataLang?: SupportedLanguage): string {
		const { batchId, categoryId, storyIndex, slug } = params;

		// Start path
		let url = '/';
		if (batchId) {
			url += `${batchId}`;
		}

		if (categoryId) {
			// Ensure leading slash when no batchId
			if (!batchId && url === '/') {
				url += categoryId;
			} else {
				url += `/${categoryId}`;
			}
		}

		// Use numeric index format (restore original format)
		if (storyIndex !== null && storyIndex !== undefined) {
			url += `/${storyIndex}`;
		}

		// Add data language as query parameter
		const dataLang = params.dataLang || currentDataLang;
		if (dataLang) {
			url += `?data_lang=${dataLang}`;
		}

		return url;
	}
	
	/**
	 * Check if a string looks like a batch ID
	 */
	static isBatchId(str: string): boolean {
		// Date pattern (YYYY-MM-DD) or UUID pattern
		return /^\d{4}-\d{2}-\d{2}/.test(str) || 
		       /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(str);
	}
	
	/**
	 * Validate if a language code is supported
	 */
	static isValidDataLanguage(lang: string): boolean {
		return SUPPORTED_LANGUAGES.some(language => language.code === lang);
	}
	
	/**
	 * Normalize category ID for comparison
	 */
	static normalizeCategoryId(categoryId: string): string {
		return normalizeForUrl(categoryId);
	}
	
	/**
	 * Compare two URLs to see if they're different (including query params)
	 */
	static areUrlsDifferent(url1: string, url2: string): boolean {
		return url1 !== url2;
	}
	
	/**
	 * Extract just the path from a URL (no query params)
	 */
	static getPathOnly(url: URL): string {
		return url.pathname;
	}
	
	/**
	 * Get the full URL including query params
	 */
	static getFullUrl(url: URL): string {
		return url.href;
	}
}