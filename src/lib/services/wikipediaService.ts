import { browser } from '$app/environment';
import { language } from '$lib/stores/language.svelte.js';

// Wikipedia content cache (key: "<lang>:<wikiId>")
const wikipediaCache = new Map<string, any>();

// Failed Wikipedia entries cache (key: "<lang>:<wikiId>") - tracks entries that failed to load
const wikipediaFailedCache = new Map<string, boolean>();

export interface WikipediaContent {
	extract: string;
	thumbnail: { source: string } | null;
	originalImage: { source: string } | null;
	title: string;
	wikiUrl: string;
}

/**
 * Check if a Wikipedia entry has previously failed to load
 */
export function hasWikipediaEntryFailed(wikiId: string, lang?: string): boolean {
	const uiLang = (lang || (browser ? language.ui : 'en')) || 'en';
	const wikiLang = normalizeWikiLang(uiLang);
	let id: string;
	try {
		id = decodeURIComponent(wikiId);
	} catch {
		id = wikiId;
	}
	const cacheKey = `${wikiLang}:${id}`;
	return wikipediaFailedCache.has(cacheKey);
}

/**
 * Lightweight validation to check if a Wikipedia entry likely exists
 * Uses HEAD request to avoid downloading full content
 */
export async function validateWikipediaEntry(wikiId: string, lang?: string): Promise<boolean> {
	// First check if we already know it failed
	if (hasWikipediaEntryFailed(wikiId, lang)) {
		return false;
	}

	const uiLang = (lang || (browser ? language.ui : 'en')) || 'en';
	const wikiLang = normalizeWikiLang(uiLang);
	let id: string;
	try {
		id = decodeURIComponent(wikiId);
	} catch {
		id = wikiId;
	}

	try {
		let url: string;
		
		// Check if this is a Wikidata Q-ID
		if (/^Q\d+$/.test(id)) {
			// For Q-IDs, first resolve to actual Wikipedia page
			const wikidataUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${id}&props=sitelinks&sitefilter=${wikiLang}wiki&format=json&origin=*`;
			const wikidataResponse = await fetch(wikidataUrl, { method: 'HEAD' });
			if (!wikidataResponse.ok) {
				markWikipediaEntryAsFailed(id, uiLang);
				return false;
			}
		}
		
		// Use REST API summary endpoint for validation
		url = `https://${wikiLang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(id)}`;
		const response = await fetch(url, { method: 'HEAD' });
		
		if (!response.ok) {
			// Try search fallback
			const searchUrl = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(id)}&srlimit=1&format=json&origin=*`;
			const searchResp = await fetch(searchUrl);
			if (!searchResp.ok) {
				markWikipediaEntryAsFailed(id, uiLang);
				return false;
			}
			const searchData = await searchResp.json();
			if (!searchData?.query?.search?.[0]?.title) {
				markWikipediaEntryAsFailed(id, uiLang);
				return false;
			}
		}
		
		return true;
	} catch (error) {
		markWikipediaEntryAsFailed(id, uiLang);
		return false;
	}
}

/**
 * Mark a Wikipedia entry as failed
 */
function markWikipediaEntryAsFailed(wikiId: string, lang?: string): void {
	const uiLang = (lang || (browser ? language.ui : 'en')) || 'en';
	const wikiLang = normalizeWikiLang(uiLang);
	let id: string;
	try {
		id = decodeURIComponent(wikiId);
	} catch {
		id = wikiId;
	}
	const cacheKey = `${wikiLang}:${id}`;
	wikipediaFailedCache.set(cacheKey, true);
}

/**
 * Clear the failed Wikipedia entries cache
 */
export function clearWikipediaFailedCache() {
	wikipediaFailedCache.clear();
}

/**
 * Fetch Wikipedia content from API
 * Supports both regular Wikipedia page IDs and Wikidata Q-IDs
 */
export async function fetchWikipediaContent(wikiId: string, lang?: string): Promise<WikipediaContent> {
    // Some callers may already pass an encoded page title (e.g. "Ren%C3%A9_Descartes")
    // which would become *double* encoded below when we call encodeURIComponent again.
    // To avoid 404 errors resulting from double-encoding, we attempt to decode once.
    let id: string;
    try {
        id = decodeURIComponent(wikiId);
    } catch {
        // If decoding fails (malformed URI) just use the original value
        id = wikiId;
    }

    const uiLang = (lang || (browser ? language.ui : 'en')) || 'en';
    const wikiLang = normalizeWikiLang(uiLang);
    const cacheKey = `${wikiLang}:${id}`;

    // Check cache first
    if (wikipediaCache.has(cacheKey)) {
        return wikipediaCache.get(cacheKey)!;
    }

    try {
        let url: string;
        let data: any;
        let summaryLang = wikiLang; // language we will ultimately query in

        // Check if this is a Wikidata Q-ID
        if (/^Q\d+$/.test(id)) {
            // First, resolve the Q-ID to get the actual Wikipedia page in the requested language
            const wikidataUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${id}&props=sitelinks&sitefilter=${wikiLang}wiki&format=json&origin=*`;
            const wikidataResponse = await fetch(wikidataUrl);

            if (!wikidataResponse.ok) {
                throw new Error('Failed to fetch Wikidata entity');
            }

            const wikidataData = await wikidataResponse.json();
            const entity = wikidataData.entities?.[id];
            const localizedTitle = entity?.sitelinks?.[`${wikiLang}wiki`]?.title as string | undefined;
            const enwikiTitle = entity?.sitelinks?.enwiki?.title as string | undefined;
            const pageTitle = localizedTitle || enwikiTitle;

            if (!pageTitle) {
                throw new Error('No Wikipedia page found for this entity');
            }

            // If we had to fall back to English, make sure we query en.wikipedia.org
            if (!localizedTitle) {
                summaryLang = 'en';
            }

            // Now fetch the Wikipedia content using the resolved title
            url = `https://${summaryLang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
            console.log(`Resolved Q-ID ${id} to Wikipedia page: ${pageTitle} (${summaryLang})`);
        } else {
            // Regular Wikipedia page ID / title
            url = `https://${wikiLang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(id)}`;
        }

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Failed to fetch Wikipedia content');
        }

        data = await response.json();
        const result: WikipediaContent = {
            extract: data.extract || 'No summary available.',
            thumbnail: data.thumbnail || null,
            originalImage: data.originalimage || null,
            title: data.title || '',
            wikiUrl: data.content_urls?.desktop?.page || `https://${summaryLang}.wikipedia.org/wiki/${encodeURIComponent(data.title || id)}`
        };

        // Cache the content
        wikipediaCache.set(cacheKey, result);
        return result;
    } catch (error) {
        console.warn('Primary Wikipedia fetch failed, attempting fallbacks:', error);

        // 1) Attempt a search-based fallback in the requested language to find the closest article title
        try {
            const searchUrl = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(id)}&srlimit=1&format=json&origin=*`;
            const searchResp = await fetch(searchUrl);
            if (searchResp.ok) {
                const searchData = await searchResp.json();
                const altTitle: string | undefined = searchData?.query?.search?.[0]?.title;
                if (altTitle) {
                    // Recursively fetch using the best-match title
                    return await fetchWikipediaContent(altTitle, uiLang);
                }
            }
        } catch {/* ignore search fallback errors */}

        // 2) If we already tried English or userLang === 'en', give up directly
        if (wikiLang === 'en') {
            markWikipediaEntryAsFailed(id, uiLang);
            return {
                extract: 'Failed to load Wikipedia content.',
                thumbnail: null,
                originalImage: null,
                title: '',
                wikiUrl: ''
            };
        }

        // 3) Try fetching summary in English to obtain its Wikidata ID
        try {
            const enSummaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(id)}`;
            const enData = await safeJsonFetch(enSummaryUrl);
            const qid = enData?.wikibase_item as string | undefined;

            if (qid && /^Q\d+$/.test(qid)) {
                // Recursively fetch using Q-ID which has full language logic
                return await fetchWikipediaContent(qid, uiLang);
            }
        } catch {/* ignore */}
        // 4) Final failure
        markWikipediaEntryAsFailed(id, uiLang);
        return {
            extract: 'Failed to load Wikipedia content.',
            thumbnail: null,
            originalImage: null,
            title: '',
            wikiUrl: ''
        };
    }
}

/**
 * Clear the Wikipedia cache
 */
export function clearWikipediaCache() {
	wikipediaCache.clear();
}

/**
 * Get cache size
 */
export function getWikipediaCacheSize(): number {
	return wikipediaCache.size;
}

// Add a separate cache for domain look-ups to avoid mixing keys with page/Q-IDs
const wikipediaDomainCache = new Map<string, WikipediaContent>();

/**
 * Attempt to resolve a news source domain (e.g. "cnn.com") to a Wikipedia page
 * and return its summary data.
 *
 * The heuristic is:
 * 1. Strip protocol / path and keep the hostname
 * 2. Pick the second-level domain (e.g. "cnn" from "www.cnn.com")
 * 3. Use Wikipedia's search API to find the most relevant article
 * 4. Return the {@link WikipediaContent} for the first result, or null if none found
 */
export async function fetchWikipediaContentForDomain(domain: string, lang?: string): Promise<WikipediaContent | null> {
    const uiLang = (lang || (browser ? language.ui : 'en')) || 'en';
    const wikiLang = normalizeWikiLang(uiLang);
    // Normalise domain (remove protocol, path, port)
    let hostname = domain.trim();
    if (hostname.startsWith('http://') || hostname.startsWith('https://')) {
        hostname = hostname.replace(/^https?:\/\//, '');
    }
    // Remove any path after the domain
    hostname = hostname.split('/')[0];

    const cacheKey = `${wikiLang}:${hostname}`;
    // If we have already fetched this domain, return cached value
    if (wikipediaDomainCache.has(cacheKey)) {
        return wikipediaDomainCache.get(cacheKey)!;
    }

    // Derive a basic search query from the hostname – take the second-level label
    const parts = hostname.split('.');
    let query = parts.length >= 2 ? parts[parts.length - 2] : hostname;
    // Replace common edge-case labels (e.g. co.uk)
    if (['co', 'com', 'net', 'org', 'gov'].includes(query) && parts.length >= 3) {
        query = parts[parts.length - 3];
    }
    // Replace hyphens with spaces for better search matching
    query = query.replace(/-/g, ' ');

    try {
        // 1. Search for the most relevant Wikipedia article in the requested language
        const searchUrl = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`;
        const searchResp = await fetch(searchUrl);
        if (!searchResp.ok) throw new Error('Failed to search Wikipedia');
        const searchData = await searchResp.json();
        const firstResultTitle: string | undefined = searchData?.query?.search?.[0]?.title;

        if (!firstResultTitle) {
            return null; // Nothing found
        }

        // 2. Fetch the summary for that article
        const summary = await fetchWikipediaContent(firstResultTitle, uiLang);
        // Cache the result for future look-ups
        wikipediaDomainCache.set(cacheKey, summary);
        return summary;
    } catch (err) {
        console.error('Error fetching Wikipedia content for domain:', domain, err);
        return null;
    }
}

// Generic cache for arbitrary search queries (e.g. person names, concepts)
const wikipediaSearchCache = new Map<string, WikipediaContent>();

/**
 * Fetch Wikipedia summary for an arbitrary query string (e.g. person name, concept).
 * Uses the search API to resolve to the most relevant article then returns its summary.
 * Returns `null` when nothing relevant is found.
 */
export async function fetchWikipediaContentBySearch(query: string, lang?: string): Promise<WikipediaContent | null> {
    const uiLang = (lang || (browser ? language.ui : 'en')) || 'en';
    const wikiLang = normalizeWikiLang(uiLang);
    const normalized = query.trim().toLowerCase();
    if (!normalized) return null;

    const cacheKey = `${wikiLang}:${normalized}`;
    // Return cached
    if (wikipediaSearchCache.has(cacheKey)) {
        return wikipediaSearchCache.get(cacheKey)!;
    }

    try {
        const searchUrl = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`;
        const resp = await fetch(searchUrl);
        if (!resp.ok) throw new Error('Failed to search Wikipedia');
        const data = await resp.json();
        const title: string | undefined = data?.query?.search?.[0]?.title;
        if (!title) return null;

        const summary = await fetchWikipediaContent(title, uiLang);
        wikipediaSearchCache.set(cacheKey, summary);
        return summary;
    } catch (err) {
        console.error('Error fetching Wikipedia content for query:', query, err);
        return null;
    }
}

// helper to safely fetch URL returning JSON or null
async function safeJsonFetch(url: string): Promise<any | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

// Map language codes used in UI to Wikipedia sub-domains
function normalizeWikiLang(lang: string | undefined): string {
    if (!lang) return 'en';
    const lower = lang.toLowerCase();
    const overrides: Record<string, string> = {
        'pt-br': 'pt',
        'zh-hans': 'zh',
        'zh-hant': 'zh',
        'nb': 'no'
    };
    if (overrides[lower]) return overrides[lower];
    // Take first segment before dash (e.g. "en-us" -> "en")
    return lower.split('-')[0] || 'en';
}