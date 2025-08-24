import { mediaService } from '$lib/services/mediaService';
import type { MediaInfo } from '$lib/types';

// Cache for domain to organization name mappings
const domainNameCache = new Map<string, string>();

/**
 * Get a user-friendly organization name for a domain
 * Falls back to the domain if no organization name is found
 */
export async function getOrganizationName(domain: string, language: string = 'en'): Promise<string> {
	const cacheKey = `${domain}:${language}`;
	
	// Check cache first
	if (domainNameCache.has(cacheKey)) {
		return domainNameCache.get(cacheKey)!;
	}
	
	try {
		const mediaInfo = await mediaService.getMediaInfoForDomain(domain, language);
		const organizationName = mediaInfo?.organization || domain;
		
		// Cache the result
		domainNameCache.set(cacheKey, organizationName);
		
		return organizationName;
	} catch (error) {
		console.warn(`Failed to get organization name for ${domain}:`, error);
		// Cache the fallback
		domainNameCache.set(cacheKey, domain);
		return domain;
	}
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
 * Clear the domain name cache (useful for testing or when language changes)
 */
export function clearDomainNameCache(): void {
	domainNameCache.clear();
}