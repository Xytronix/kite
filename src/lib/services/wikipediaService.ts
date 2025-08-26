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
    entityType?: string; // e.g., "Person", "Organization", "Place"
    confidence?: number; // 0-1 confidence score
    googleKgMID?: string; // Google Knowledge Graph MID
    wikidataQID?: string; // Wikidata Q-ID
}

/**
 * Check if a Wikipedia entry has previously failed to load
 */
export function hasWikipediaEntryFailed(wikiId: string, lang?: string): boolean {
    const uiLang = (lang || (browser ? language.ui : 'en')) || 'en';
    const wikiLang = normalizeWikiLang(uiLang);
    const id = safeNormalizeWikiId(wikiId);
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
    const id = safeNormalizeWikiId(wikiId);

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

        // Use REST API summary endpoint for validation - handle accented characters properly
        let pageTitle = id;
        
        // If it contains underscores, it's likely a Wikipedia page title format
        if (pageTitle.includes('_')) {
            // Convert underscores to spaces for better API compatibility
            pageTitle = pageTitle.replace(/_/g, ' ');
        }
        
        // Handle encoding properly for validation
        const titleForUrl = pageTitle.replace(/ /g, '_');
        let encodedTitle: string;
        if (titleForUrl.includes('%')) {
            // Already encoded, use as-is
            encodedTitle = titleForUrl;
        } else {
            // Encode for URL safety
            encodedTitle = encodeURIComponent(titleForUrl);
        }
        
        url = `https://${wikiLang}.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`;
        console.debug('Validating Wikipedia entry:', pageTitle, '-> encoded:', encodedTitle, '-> URL:', url);
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
    const id = safeNormalizeWikiId(wikiId);
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
    // Safely normalize the Wikipedia ID
    const id = safeNormalizeWikiId(wikiId);
    
    // Special debug case for Battle of Crécy
    if (wikiId.includes('Cr%C3%A9cy') || wikiId.includes('Crécy')) {
        console.debug('Battle of Crécy debug - Original:', wikiId, 'Normalized:', id);
        console.debug('URL parts:', {
            hasPercent: wikiId.includes('%'),
            decoded: wikiId.includes('%') ? decodeURIComponent(wikiId) : 'no decoding needed',
            finalId: id
        });
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
            // Regular Wikipedia page ID / title - handle accented characters properly
            // For titles like "Battle of Crécy" or "Battle_of_Crécy", ensure proper encoding
            let pageTitle = id;
            
            // If it contains underscores, it's likely a Wikipedia page title format
            if (pageTitle.includes('_')) {
                // Convert underscores to spaces for better API compatibility
                pageTitle = pageTitle.replace(/_/g, ' ');
            }
            
            // For the REST API, we need to use underscores and proper encoding
            // But preserve the original character encoding (don't double-encode)
            const titleForUrl = pageTitle.replace(/ /g, '_');
            
            // Only encode if it's not already encoded or contains special characters that need encoding
            let encodedTitle: string;
            if (titleForUrl.includes('%')) {
                // Already encoded, use as-is but ensure it's properly formatted
                encodedTitle = titleForUrl;
            } else {
                // Encode for URL safety
                encodedTitle = encodeURIComponent(titleForUrl);
            }
            
            url = `https://${wikiLang}.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`;
            console.debug('Fetching Wikipedia content for regular title:', pageTitle, '-> encoded:', encodedTitle, '-> URL:', url);
        }

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Failed to fetch Wikipedia content');
        }

        data = await response.json();

        // If we have a basic extract but want richer content, try Parse API for HTML
        let htmlExtract = data.extract || 'No summary available.';
        if (data.extract && data.extract.length < 500) {
            try {
                const parseUrl = `https://${summaryLang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(data.title)}&prop=text&section=0&format=json&origin=*`;
                const parseResp = await fetch(parseUrl);
                if (parseResp.ok) {
                    const parseData = await parseResp.json();
                    const htmlContent = parseData.parse?.text?.['*'];
                    if (htmlContent) {
                        // Extract first paragraph from HTML, clean it up
                        const cleanExtract = extractFirstParagraph(htmlContent);
                        if (cleanExtract && cleanExtract.length > data.extract.length) {
                            htmlExtract = cleanExtract;
                        }
                    }
                }
            } catch (e) {
                // Fallback to original extract if Parse API fails
                console.debug('Parse API fallback failed:', e);
            }
        }

        // Always construct the URL using the correct language subdomain
        const finalWikiUrl = data.content_urls?.desktop?.page || `https://${summaryLang}.wikipedia.org/wiki/${encodeURIComponent(data.title || '')}`;

        const result: WikipediaContent = {
            extract: htmlExtract,
            thumbnail: data.thumbnail || null,
            originalImage: data.originalimage || null,
            title: data.title || '',
            wikiUrl: finalWikiUrl
        };



        // Cache the content
        wikipediaCache.set(cacheKey, result);
        return result;
    } catch (error) {
        console.warn('Primary Wikipedia fetch failed, attempting fallbacks:', error);

        // 1) Attempt a search-based fallback in the requested language to find the closest article title
        try {
            // For search, use the original ID (which might contain accents) rather than encoded version
            const searchTerm = id.replace(/_/g, ' '); // Convert underscores to spaces for better search
            const searchUrl = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm)}&srlimit=3&format=json&origin=*`;
            console.debug('Wikipedia search fallback for:', searchTerm, 'in language:', wikiLang);
            const searchResp = await fetch(searchUrl);
            if (searchResp.ok) {
                const searchData = await searchResp.json();
                const results = searchData?.query?.search || [];
                
                // Try to find an exact or close match
                for (const result of results) {
                    const resultTitle = result.title as string;
                    // Check for exact match (case insensitive) or very close match
                    if (resultTitle.toLowerCase() === searchTerm.toLowerCase() || 
                        resultTitle.toLowerCase().replace(/[^a-z0-9]/g, '') === searchTerm.toLowerCase().replace(/[^a-z0-9]/g, '')) {
                        console.debug('Found exact match via search:', resultTitle);
                        return await fetchWikipediaContent(resultTitle, uiLang);
                    }
                }
                
                // If no exact match, try the first result
                if (results.length > 0) {
                    const altTitle = results[0].title;
                    console.debug('Found alternative title via search:', altTitle);
                    return await fetchWikipediaContent(altTitle, uiLang);
                }
            }
        } catch (error) {
            console.debug('Search fallback failed:', error);
        }

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
            // For English fallback, also try with spaces instead of underscores
            const searchTerm = id.replace(/_/g, ' ');
            
            // Handle encoding properly for English fallback
            let titleForUrl = searchTerm.replace(/ /g, '_');
            let encodedTitle: string;
            if (titleForUrl.includes('%')) {
                encodedTitle = titleForUrl;
            } else {
                encodedTitle = encodeURIComponent(titleForUrl);
            }
            
            const enSummaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`;
            console.debug('Trying English fallback for:', searchTerm, '-> encoded:', encodedTitle);
            const enData = await safeJsonFetch(enSummaryUrl);
            const qid = enData?.wikibase_item as string | undefined;

            if (qid && /^Q\d+$/.test(qid)) {
                console.debug('Found Q-ID via English fallback:', qid);
                // Recursively fetch using Q-ID which has full language logic
                return await fetchWikipediaContent(qid, uiLang);
            }
        } catch (error) {
            console.debug('English fallback failed:', error);
        }
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

/**
 * Extract and normalize Wikipedia IDs from OnThisDay HTML content
 * Handles URL-encoded IDs like "Battle_of_Cr%C3%A9cy"
 */
export function extractWikipediaIdsFromContent(htmlContent: string): string[] {
    const wikiIds: string[] = [];
    const linkRegex = /<a[^>]*data-wiki-id="([^"]*)"[^>]*>/g;
    let match;

    while ((match = linkRegex.exec(htmlContent)) !== null) {
        const wikiId = match[1];
        if (wikiId) {
            // Normalize the extracted ID
            const normalizedId = safeNormalizeWikiId(wikiId);
            console.debug('Extracted Wikipedia ID:', wikiId, '-> normalized:', normalizedId);
            wikiIds.push(normalizedId);
        }
    }

    return wikiIds;
}

/**
 * Enhanced search using server-side Knowledge Graph API
 * This calls our secure server endpoint instead of exposing API keys to the client
 */
export async function fetchWikipediaContentWithEnhancedSearch(
    query: string,
    lang?: string
): Promise<WikipediaContent | null> {
    try {
        const response = await fetch(`/api/wikipedia/search?q=${encodeURIComponent(query)}&lang=${lang || 'en'}`);

        if (response.ok) {
            const data = await response.json();
            if (data.error) {
                console.debug('Server-side Wikipedia search error:', data.error);
                return await fetchWikipediaContentBySearch(query, lang);
            }
            return data;
        }
    } catch (e) {
        console.debug('Enhanced Wikipedia search failed, falling back to direct search:', e);
    }

    // Fallback to existing search functionality
    return await fetchWikipediaContentBySearch(query, lang);
}

/**
 * Legacy function - Enhanced search using Google Knowledge Graph API (requires API key)
 * @deprecated Use fetchWikipediaContentWithEnhancedSearch instead for security
 * Falls back to Wikipedia search if not configured
 */
export async function fetchWikipediaContentWithKnowledgeGraph(
    query: string,
    lang?: string,
    googleApiKey?: string
): Promise<WikipediaContent | null> {
    console.warn('fetchWikipediaContentWithKnowledgeGraph is deprecated. Use fetchWikipediaContentWithEnhancedSearch instead.');

    // Redirect to secure server-side implementation
    return await fetchWikipediaContentWithEnhancedSearch(query, lang);
}

/**
 * Lookup entity by MID using server-side API
 */
export async function lookupEntityByMID(
    mid: string,
    lang?: string
): Promise<WikipediaContent | null> {
    try {
        const response = await fetch(`/api/wikipedia/lookup?mid=${encodeURIComponent(mid)}&lang=${lang || 'en'}`);

        if (response.ok) {
            const data = await response.json();
            if (data.error) {
                console.debug('Server-side MID lookup error:', data.error);
                return null;
            }
            return data;
        }
    } catch (e) {
        console.debug('MID lookup failed:', e);
    }

    return null;
}

/**
 * Extract and clean the first meaningful paragraph from Wikipedia HTML content
 */
function extractFirstParagraph(htmlContent: string): string {
    try {
        // Create a temporary DOM element to parse HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;

        // Remove unwanted elements
        const unwantedSelectors = [
            '.mw-editsection',
            '.reference',
            '.mw-ref',
            '.navbox',
            '.infobox',
            '.ambox',
            '.hatnote',
            'sup',
            '.coordinates'
        ];

        unwantedSelectors.forEach(selector => {
            tempDiv.querySelectorAll(selector).forEach(el => el.remove());
        });

        // Find the first substantial paragraph
        const paragraphs = tempDiv.querySelectorAll('p');
        for (const p of paragraphs) {
            const text = p.textContent?.trim() || '';
            // Skip short paragraphs, coordinates, etc.
            if (text.length > 100 && !text.match(/^\d+°\d+′/)) {
                return text;
            }
        }

        // Fallback to first paragraph if no substantial one found
        return paragraphs[0]?.textContent?.trim() || '';
    } catch (e) {
        console.debug('HTML parsing failed:', e);
        return '';
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

// Helper function to safely normalize Wikipedia IDs
function safeNormalizeWikiId(wikiId: string): string {
    if (!wikiId) return '';

    // Handle Q-IDs (Wikidata) - these should not be encoded
    if (/^Q\d+$/.test(wikiId)) {
        return wikiId;
    }

    // Handle URL-encoded content (like "Battle_of_Cr%C3%A9cy" -> "Battle_of_Crécy")
    if (wikiId.includes('%')) {
        try {
            const decoded = decodeURIComponent(wikiId);
            console.debug('Decoded Wikipedia ID:', wikiId, '->', decoded);
            // If decoding was successful and changed the string, use decoded version
            if (decoded !== wikiId) {
                return decoded;
            }
        } catch (error) {
            // If decoding fails, continue with original
            console.debug('Failed to decode Wikipedia ID:', wikiId, error);
        }
    }

    return wikiId;
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