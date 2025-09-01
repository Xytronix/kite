import { mediaService } from '$lib/services/mediaService';
import { fetchWikipediaContentForDomain } from '$lib/services/wikipediaService';
import type { MediaInfo } from '$lib/types';

// Cache for domain to organization name mappings
const domainNameCache = new Map<string, string>();

/**
 * Decode HTML entities in text
 */
function decodeHtmlEntities(text: string): string {
	if (typeof document === 'undefined') return text;
	const textarea = document.createElement('textarea');
	textarea.innerHTML = text;
	return textarea.value;
}

/**
 * Get a user-friendly organization name for a domain
 * Uses multiple sources: media data, Wikipedia, and domain processing
 * Falls back to the domain if no organization name is found
 */
export async function getOrganizationName(domain: string, language: string = 'en'): Promise<string> {
	const cacheKey = `${domain}:${language}`;

	// Check cache first
	if (domainNameCache.has(cacheKey)) {
		return domainNameCache.get(cacheKey)!;
	}

	let organizationName = extractOrganizationNameFromDomain(domain); // Better fallback

	try {
		// Try to get media info first (most reliable)
		const mediaInfo = await mediaService.getMediaInfoForDomain(domain, language);
		if (mediaInfo?.organization && mediaInfo.organization !== domain) {
			organizationName = decodeHtmlEntities(mediaInfo.organization);
		} else {
			// If no media info, try Wikipedia as fallback
			try {
				const wikipediaInfo = await fetchWikipediaContentForDomain(domain);
				if (wikipediaInfo?.title) {
					const title = wikipediaInfo.title;
					// Check if it's a media organization page
					if (title.includes('(website)') || title.includes('(news') || title.includes('(media')) {
						// Extract the base name before parentheses
						const baseName = title.split('(')[0].trim();
						if (baseName && baseName !== domain) {
							organizationName = decodeHtmlEntities(baseName);
						}
					}
					// For other Wikipedia titles that might be organization names
					else if (!title.toLowerCase().includes('disambiguation') &&
						!title.toLowerCase().includes('may refer to') &&
						title !== domain &&
						title.length < 100) { // Reasonable length for org name
						organizationName = decodeHtmlEntities(title);
					}
				}
			} catch (wikipediaError) {
				// Wikipedia lookup failed, keep the domain or media info result
				console.debug(`Wikipedia lookup failed for ${domain}:`, wikipediaError);
			}
		}
	} catch (error) {
		console.warn(`Failed to get organization name for ${domain}:`, error);
		// Keep domain as fallback
	}

	// Cache the result
	domainNameCache.set(cacheKey, organizationName);

	return organizationName;
}

/**
 * Get organization names for multiple domains in parallel
 */
export async function getOrganizationNames(domains: string[], language: string = 'en'): Promise<Map<string, string>> {
	const results = new Map<string, string>();

	// Process all domains in parallel
	const promises = domains.map(async (domain) => {
		const name = await getOrganizationName(domain, language);
		results.set(domain, name);
	});

	await Promise.all(promises);
	return results;
}

/**
 * Extract a clean organization name from a domain
 * Removes common prefixes/suffixes and capitalizes appropriately
 */
export function extractOrganizationNameFromDomain(domain: string): string {
	if (!domain) return domain;

	// Remove protocol if present
	let cleanDomain = domain.replace(/^https?:\/\//, '');

	// Remove www prefix
	cleanDomain = cleanDomain.replace(/^www\./, '');

	// Remove path and query parameters
	cleanDomain = cleanDomain.split('/')[0].split('?')[0];

	// Extract the main part (before the TLD)
	const parts = cleanDomain.split('.');
	let orgName = parts.length >= 2 ? parts[parts.length - 2] : cleanDomain;

	// Handle special cases like co.uk
	if (['co', 'com', 'net', 'org', 'gov'].includes(orgName) && parts.length >= 3) {
		orgName = parts[parts.length - 3];
	}

	// Clean up the name
	orgName = orgName.replace(/[-_]/g, ' '); // Replace hyphens and underscores with spaces

	// Add word breaks for very long compound words (like "iphoneincanada")
	if (orgName.length > 12 && !orgName.includes(' ')) {
		// Insert word break opportunities for better wrapping
		orgName = orgName.replace(/([a-z])([A-Z])/g, '$1\u200B$2'); // Zero-width space before capitals
		orgName = orgName.replace(/([a-zA-Z])(\d)/g, '$1\u200B$2'); // Zero-width space before numbers
		orgName = orgName.replace(/(\d)([a-zA-Z])/g, '$1\u200B$2'); // Zero-width space after numbers
	}

	// Capitalize appropriately
	if (orgName.length <= 4) {
		// Short names (likely acronyms) - uppercase
		orgName = orgName.toUpperCase();
	} else {
		// Longer names - title case
		orgName = orgName.charAt(0).toUpperCase() + orgName.slice(1).toLowerCase();
	}

	return orgName;
}

/**
 * Clear the domain name cache (useful for testing or when language changes)
 */
export function clearDomainNameCache(): void {
	domainNameCache.clear();
}