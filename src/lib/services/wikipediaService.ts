import { browser } from '$app/environment';
import { language } from '$lib/stores/language.svelte.js';

// Wikipedia content cache (key: "<lang>:<wikiId>")
const wikipediaCache = new Map<string, any>();

// Persist cache across reloads using sessionStorage to avoid refetch on first hover
try {
    if (typeof sessionStorage !== 'undefined') {
        const raw = sessionStorage.getItem('wikipediaCache');
        if (raw) {
            const obj = JSON.parse(raw) as Record<string, any>;
            for (const [k, v] of Object.entries(obj)) wikipediaCache.set(k, v);
        }
    }
} catch {}

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
    wikidataQID?: string; // Wikidata Q-ID
}

/**
 * Get the appropriate language for Wikipedia requests
 * Handles "default" language resolution and content language priority
 */
function getWikipediaLanguage(lang?: string): string {
    let targetLang = lang;
    
    // If no language provided, use content language priority: data -> ui -> 'en'
    if (!targetLang) {
        targetLang = (browser ? (language.data || language.ui) : 'en') || 'en';
    }
    
    // Handle "default" language - resolve to browser language or English
    if (targetLang === 'default') {
        if (browser) {
            // Use browser's primary language, fallback to English
            const browserLang = navigator.language.split('-')[0];
            targetLang = browserLang || 'en';
        } else {
            targetLang = 'en';
        }
    }
    
    return targetLang;
}

/**
 * Check if a Wikipedia entry has previously failed to load
 */
export function hasWikipediaEntryFailed(wikiId: string, lang?: string): boolean {
    const uiLang = getWikipediaLanguage(lang);
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

    const uiLang = getWikipediaLanguage(lang);
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
        if (pageTitle.includes('_')) pageTitle = pageTitle.replace(/_/g, ' ');
        const titleForUrl = pageTitle.replace(/ /g, '_');
        const encodedTitle = titleForUrl.includes('%') ? titleForUrl : encodeURIComponent(titleForUrl);

        url = `https://${wikiLang}.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`;

        // First a lightweight HEAD to avoid fetching body for 404s
        // Use server-side search for validation to avoid CORS and heavy HEAD usage
        const headResp = await fetch(url, { method: 'HEAD' });
        if (!headResp.ok) {
            // Try server-side search fallback to avoid CORS
            const searchResp = await fetch(`/api/wikipedia/search?q=${encodeURIComponent(id)}&lang=${uiLang}`);
            if (!searchResp.ok) {
                markWikipediaEntryAsFailed(id, uiLang);
                return false;
            }
            const searchData = await searchResp.json();
            if (!searchData || searchData.extract === 'Failed to load Wikipedia content.' || !searchData.title) {
                markWikipediaEntryAsFailed(id, uiLang);
                return false;
            }
            // Update URL to summary of first search result
            const altTitle = searchData.title as string;
            const altEncoded = encodeURIComponent(altTitle.replace(/ /g, '_'));
            url = `https://${wikiLang}.wikipedia.org/api/rest_v1/page/summary/${altEncoded}`;
        }

        // Fetch minimal JSON to detect disambiguation/type without loading parse HTML
        try {
            const jsonResp = await fetch(url);
            if (!jsonResp.ok) {
                markWikipediaEntryAsFailed(id, uiLang);
                return false;
            }
            const data = await jsonResp.json();
            const type = (data?.type || '').toString().toLowerCase();
            const extract = (data?.extract || '').toString().toLowerCase();
            if (type.includes('disambiguation') || extract.includes('may refer to')) {
                markWikipediaEntryAsFailed(id, uiLang);
                return false;
            }
        } catch {
            // If JSON fails, err on the safe side: treat as invalid to avoid bad links
            markWikipediaEntryAsFailed(id, uiLang);
            return false;
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
    const uiLang = getWikipediaLanguage(lang);
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
    if (import.meta.env.DEV && (wikiId.includes('Cr%C3%A9cy') || wikiId.includes('Crécy'))) {
        console.debug('Battle of Crécy debug - Original:', wikiId, 'Normalized:', id);
        console.debug('URL parts:', {
            hasPercent: wikiId.includes('%'),
            decoded: wikiId.includes('%') ? decodeURIComponent(wikiId) : 'no decoding needed',
            finalId: id
        });
    }

    const uiLang = getWikipediaLanguage(lang);
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
            // Resolve Q-ID server-side to avoid CORS in browsers
            const lookupUrl = `/api/wikipedia/lookup?qid=${encodeURIComponent(id)}&lang=${uiLang}`;
            const lookupResp = await fetch(lookupUrl);
            if (!lookupResp.ok) {
                throw new Error('Failed to fetch Wikidata lookup');
            }
            const lookupData = await lookupResp.json();
            if (!lookupData || lookupData.extract === 'Failed to load Wikipedia content.') {
                throw new Error('No Wikipedia page found for this entity');
            }

            // Backend now handles image fallback from English when needed; no client-side merge

            // Use response (possibly enriched with fallback images)
            wikipediaCache.set(cacheKey, lookupData);
            try {
                if (typeof sessionStorage !== 'undefined') {
                    // Store only a bounded size to avoid unbounded growth
                    const entries = Array.from(wikipediaCache.entries()).slice(-300);
                    const obj: Record<string, any> = {};
                    for (const [k, v] of entries) obj[k] = v;
                    sessionStorage.setItem('wikipediaCache', JSON.stringify(obj));
                }
            } catch {}
            return lookupData;
        } else {
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
        }

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Failed to fetch Wikipedia content');
        }

        data = await response.json();
        // Block disambiguation or "may refer to" at source
        const type = (data?.type || '').toString().toLowerCase();
        const extractLower = (data?.extract || '').toString().toLowerCase();
        if (type.includes('disambiguation') || extractLower.includes('may refer to')) {
            return {
                extract: 'Failed to load Wikipedia content.',
                thumbnail: null,
                originalImage: null,
                title: '',
                wikiUrl: ''
            };
        }

        // Capture QID from summary if available
        const summaryQid = (data as any)?.wikibase_item as string | undefined;

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
                if (import.meta.env.DEV) {
                    console.debug('Parse API fallback failed:', e);
                }
            }
        }

        // Always construct the URL using the correct language subdomain
        const finalWikiUrl = data.content_urls?.desktop?.page || `https://${summaryLang}.wikipedia.org/wiki/${encodeURIComponent(data.title || '')}`;

        const result: WikipediaContent = {
            extract: htmlExtract,
            thumbnail: data.thumbnail || null,
            originalImage: data.originalimage || null,
            title: data.title || '',
            wikiUrl: finalWikiUrl,
            wikidataQID: summaryQid
        };

        // If no image on localized page, try English for image only (keep localized wikiUrl)
        try {
            const hasImage = !!(result.thumbnail || result.originalImage);
            if (!hasImage && wikiLang !== 'en') {
                const fallbackId = summaryQid || id || (data?.title as string | undefined) || '';
                if (fallbackId) {
                    const fb = await fetchWikipediaContent(fallbackId, 'en');
                    if (fb) {
                        if (!result.thumbnail && fb.thumbnail) result.thumbnail = fb.thumbnail;
                        if (!result.originalImage && fb.originalImage) result.originalImage = fb.originalImage;
                    }
                }
            }
        } catch {}

        // Cache the content
        wikipediaCache.set(cacheKey, result);
        try {
            if (typeof sessionStorage !== 'undefined') {
                // Store only a bounded size to avoid unbounded growth
                const entries = Array.from(wikipediaCache.entries()).slice(-300);
                const obj: Record<string, any> = {};
                for (const [k, v] of entries) obj[k] = v;
                sessionStorage.setItem('wikipediaCache', JSON.stringify(obj));
            }
        } catch {}
        return result;
    } catch (error) {
        if (import.meta.env.DEV) {
            console.warn('Primary Wikipedia fetch failed, attempting fallbacks:', error);
        }

        // 1) Attempt a search-based fallback in the requested language to find the closest article title
        try {
            // For search, use the original ID (which might contain accents) rather than encoded version
            const searchTerm = id.replace(/_/g, ' '); // Convert underscores to spaces for better search
            const searchUrl = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm)}&srlimit=3&format=json&origin=*`;
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
                        return await fetchWikipediaContent(resultTitle, uiLang);
                    }
                }
                
                // If no exact match, try the first result
                if (results.length > 0) {
                    const altTitle = results[0].title;
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
            const enData = await safeJsonFetch(enSummaryUrl);
            const qid = enData?.wikibase_item as string | undefined;

            if (qid && /^Q\d+$/.test(qid)) {
                // Recursively fetch using Q-ID which has full language logic
                const res = await fetchWikipediaContent(qid, uiLang);
                // Ensure QID propagates on fallback
                if (res) (res as any).wikidataQID = qid;
                return res;
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
const wikipediaDomainCache = new Map<string, WikipediaContent | null>();

/**
 * Attempt to resolve a news source domain (e.g. "cnn.com") to a Wikipedia page
 * and return its summary data.
 *
 * Uses exact domain matching to avoid incorrect matches and "This may refer to" pages.
 * Only returns results when there's a high confidence match for the specific domain.
 *
 * The approach is:
 * 1. Strip protocol / path and keep the hostname
 * 2. Try exact matches for common domain patterns
 * 3. Only return results that specifically mention the domain or are clearly about the organization
 */
export async function fetchWikipediaContentForDomain(domain: string, lang?: string): Promise<WikipediaContent | null> {
    const uiLang = getWikipediaLanguage(lang);
    const wikiLang = normalizeWikiLang(uiLang);
    
    // Normalise domain (remove protocol, path, port)
    let hostname = domain.trim();
    if (hostname.startsWith('http://') || hostname.startsWith('https://')) {
        hostname = hostname.replace(/^https?:\/\//, '');
    }
    // Remove any path after the domain
    hostname = hostname.split('/')[0];
    // Remove port if present
    hostname = hostname.split(':')[0];

    const cacheKey = `${wikiLang}:${hostname}`;
    // If we have already fetched this domain, return cached value
    if (wikipediaDomainCache.has(cacheKey)) {
        return wikipediaDomainCache.get(cacheKey) || null;
    }

    try {
        // Try exact domain-based searches with high specificity
        const searchQueries = generateExactDomainQueries(hostname);

        // Prepare org base variants for scoring
        const orgBase = extractOrganizationName(hostname);
        const spacedBase = deriveReadableBaseName(orgBase);
        const orgBaseNoSpace = orgBase.replace(/\s+/g, '').toLowerCase();

        type Candidate = { title: string; snippet: string; preScore: number };
        const candidates: Candidate[] = [];

        for (const query of searchQueries) {
            const searchUrl = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=8&format=json&origin=*`;
            const searchResp = await fetch(searchUrl);
            if (!searchResp.ok) continue;

            const searchData = await searchResp.json();
            const results = searchData?.query?.search || [];

            for (const result of results) {
                const title = (result.title as string) || '';
                const snippet = (result.snippet as string) || '';
                const preScore = scoreWikipediaSearchHit(hostname, orgBase, spacedBase, title, snippet);
                // Keep plausible candidates only
                if (preScore > 0) candidates.push({ title, snippet, preScore });
            }
        }

        // Sort by preliminary score and fetch summaries for top ones
        candidates.sort((a, b) => b.preScore - a.preScore);
        const top = candidates.slice(0, 6);

        let best: { score: number; summary: WikipediaContent } | null = null;
        for (const c of top) {
            const summary = await fetchWikipediaContent(c.title, uiLang);
            const finalScore = c.preScore + scoreWikipediaSummary(orgBaseNoSpace, spacedBase, hostname, summary);
            // If title exactly matches expected brand form with media keyword, boost heavily
            const t = (summary.title || '').toLowerCase();
            if (t.includes('futurism') && t.includes('website')) {
                // This handles futurism.com → Futurism (website)
                best = { score: (best?.score || 0) + 10 + finalScore, summary };
                break;
            }
            if (!best || finalScore > best.score) {
                best = { score: finalScore, summary };
            }
        }

        if (best && best.score >= 2) {
            wikipediaDomainCache.set(cacheKey, best.summary);
            return best.summary;
        }

        // No strong match found - cache null to avoid repeated lookups
        wikipediaDomainCache.set(cacheKey, null);
        return null;

    } catch (err) {
        console.error('Error fetching Wikipedia content for domain:', domain, err);
        wikipediaDomainCache.set(cacheKey, null);
        return null;
    }
}

/**
 * Generate specific search queries for exact domain matching
 */
function generateExactDomainQueries(hostname: string): string[] {
    const queries: string[] = [];
    
    // Extract organization name from domain
    const orgName = extractOrganizationName(hostname);
    
    // Add exact domain search
    queries.push(`"${hostname}"`);
    
    // Add organization name with common suffixes that indicate it's a media organization
    queries.push(`"${orgName}" website`);
    queries.push(`"${orgName}" news`);
    queries.push(`"${orgName}" media`);
    queries.push(`"${orgName}" newspaper`);
    queries.push(`"${orgName}" magazine`);
    // Also try a readable spaced variant when the org name is concatenated
    const spaced = deriveReadableBaseName(orgName);
    if (spaced && spaced.toLowerCase() !== orgName.toLowerCase()) {
        queries.push(`"${spaced}" website`);
        queries.push(`"${spaced}" news`);
        queries.push(`"${spaced}" media`);
        queries.push(`"${spaced}" newspaper`);
        queries.push(`"${spaced}" magazine`);
    }
    
    return queries;
}

/**
 * Extract organization name from hostname
 */
function extractOrganizationName(hostname: string): string {
    const parts = hostname.split('.');
    let orgName = parts.length >= 2 ? parts[parts.length - 2] : hostname;
    
    // Handle special cases like co.uk
    if (['co', 'com', 'net', 'org', 'gov'].includes(orgName) && parts.length >= 3) {
        orgName = parts[parts.length - 3];
    }
    
    // Remove common prefixes
    orgName = orgName.replace(/^(www|m|mobile|news)\.?/, '');
    
    return orgName;
}

/**
 * Convert a concatenated org base into a readable spaced form when possible.
 * E.g., "washingtonpost" -> "Washington Post".
 */
function deriveReadableBaseName(orgBase: string): string {
    const lower = orgBase.toLowerCase();
    const known: Record<string, string> = {
        'washingtonpost': 'Washington Post',
        'newyorktimes': 'New York Times',
        'losangelestimes': 'Los Angeles Times',
        'wallstreetjournal': 'Wall Street Journal',
        'financialtimes': 'Financial Times',
        'theguardian': 'The Guardian',
        'thetelegraph': 'The Telegraph',
        'thehindu': 'The Hindu',
        'straitstimes': 'The Straits Times',
        'globaltimes': 'Global Times'
    };
    if (known[lower]) return known[lower];
    // Heuristic: split on transitions between letters where next word is common media term
    const mediaWords = ['post','times','news','media','press','journal','tribune','herald','gazette','chronicle','standard','independent','report','monitor'];
    for (const w of mediaWords) {
        if (lower.endsWith(w) && lower.length > w.length + 2) {
            const head = lower.slice(0, lower.length - w.length);
            return `${capitalize(head)} ${capitalize(w)}`;
        }
    }
    return capitalize(orgBase);
}

function capitalize(s: string): string {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Score a Wikipedia search hit using domain and org cues to prefer the true outlet page
 */
function scoreWikipediaSearchHit(hostname: string, orgBase: string, spacedBase: string, title: string, snippet: string): number {
    const t = title.toLowerCase();
    const s = (snippet || '').toLowerCase();
    const host = hostname.toLowerCase();
    const base = orgBase.toLowerCase();
    const baseNoSpace = base.replace(/\s+/g, '');
    const spaced = spacedBase.toLowerCase();

    let score = 0;
    // Direct name matches
    if (t.includes(base)) score += 1;
    if (t.replace(/\s+/g, '').includes(baseNoSpace)) score += 1;
    if (spaced && (t.includes(spaced) || t.replace(/\s+/g, '').includes(spaced.replace(/\s+/g, '')))) score += 1;

    // Media context boosts
    const mediaTerms = ['news','newspaper','media','press','journal','times','post','herald','tribune','gazette','chronicle','magazine','website'];
    if (mediaTerms.some(k => t.includes(k))) score += 1;
    if (mediaTerms.some(k => s.includes(k))) score += 0.5;

    // Penalize unrelated verticals under the same brand (e.g., Washingtonpost.Newsweek_Interactive)
    const penalize = ['interactive','newsweek','labs','company','holding','foundation','disambiguation'];
    if (penalize.some(k => t.includes(k))) score -= 1.5;

    // If snippet mentions the hostname, big boost
    if (s.includes(host)) score += 2;

    return score;
}

/**
 * Score fetched summary to confirm we picked the outlet page
 */
function scoreWikipediaSummary(baseNoSpace: string, spacedBase: string, hostname: string, summary: WikipediaContent): number {
    if (!summary) return 0;
    const title = (summary.title || '').toLowerCase();
    const extract = (summary.extract || '').toLowerCase();
    const host = hostname.toLowerCase();
    let score = 0;

    if (title.replace(/\s+/g, '').includes(baseNoSpace)) score += 1.5;
    if (spacedBase && title.includes(spacedBase.toLowerCase())) score += 1.5;
    const mediaTerms = ['newspaper','news','media','press','daily','broadsheet','online newspaper'];
    if (mediaTerms.some(k => extract.includes(k))) score += 1;
    if (extract.includes(host)) score += 2;
    return score;
}

/**
 * Check if a search result is an exact match for the domain
 */
function isExactDomainMatch(hostname: string, title: string, snippet: string): boolean {
    const lowerTitle = title.toLowerCase();
    const lowerTitleNoSpace = lowerTitle.replace(/\s+/g, '');
    const lowerSnippet = snippet.toLowerCase();
    const lowerHostname = hostname.toLowerCase();
    const orgName = extractOrganizationName(hostname).toLowerCase();
    
    // Reject disambiguation pages and "may refer to" pages
    if (lowerTitle.includes('disambiguation') || 
        lowerTitle.includes('may refer to') ||
        lowerSnippet.includes('may refer to') ||
        lowerSnippet.includes('disambiguation')) {
        return false;
    }
    
    // Check for exact domain mention
    if (lowerTitle.includes(lowerHostname) || lowerSnippet.includes(lowerHostname)) {
        return true;
    }
    
    // Check for organization name with media-related context
    if (lowerTitle.includes(orgName) || lowerTitle === orgName || lowerTitleNoSpace.includes(orgName.replace(/\s+/g, ''))) {
        // Must have media/news context to avoid false positives
        const mediaKeywords = ['news', 'media', 'newspaper', 'magazine', 'broadcasting', 'television', 'radio', 'journal', 'press', 'times', 'post', 'herald', 'tribune', 'gazette', 'chronicle', 'channel', 'website'];
        return mediaKeywords.some(keyword => 
            lowerTitle.includes(keyword) || lowerSnippet.includes(keyword)
        );
    }
    
    return false;
}

// Generic cache for arbitrary search queries (e.g. person names, concepts)
const wikipediaSearchCache = new Map<string, WikipediaContent>();

/**
 * Fetch Wikipedia summary for an arbitrary query string (e.g. person name, concept).
 * Uses the search API to resolve to the most relevant article then returns its summary.
 * Returns `null` when nothing relevant is found.
 */
export async function fetchWikipediaContentBySearch(query: string, lang?: string): Promise<WikipediaContent | null> {
    const uiLang = getWikipediaLanguage(lang);
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
            wikiIds.push(normalizedId);
        }
    }

    return wikiIds;
}

/**
 * Enhanced search using server-side Wikidata API
 * This calls our secure server endpoint that uses Wikidata for entity resolution
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

    // Redirect to secure server-side Wikidata implementation
    return await fetchWikipediaContentWithEnhancedSearch(query, lang);
}

/**
 * Lookup entity by Wikidata QID using server-side API
 */
export async function lookupEntityByQID(
    qid: string,
    lang?: string
): Promise<WikipediaContent | null> {
    try {
        const uiLang = getWikipediaLanguage(lang);
        const response = await fetch(`/api/wikipedia/lookup?qid=${encodeURIComponent(qid)}&lang=${uiLang}`);

        if (response.ok) {
            const data = await response.json();
            if (data?.error) {
                console.debug('Server-side QID lookup error:', data.error);
                return null;
            }
            // Rely on backend to provide any English fallback images
            return data as WikipediaContent;
        }
    } catch (e) {
        console.debug('QID lookup failed:', e);
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

        // Remove any embedded styles/scripts (TemplateStyles etc.) that can leak CSS text
        tempDiv.querySelectorAll('style, script, link[rel="stylesheet"], style[data-mw-deduplicate]').forEach(el => el.remove());

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
            '.coordinates',
            // Additional hardening
            'style',
            'script'
        ];

        unwantedSelectors.forEach(selector => {
            tempDiv.querySelectorAll(selector).forEach(el => el.remove());
        });

        // Strip residual .mw-parser-output class wrappers that may prefix text nodes
        tempDiv.querySelectorAll('.mw-parser-output').forEach(wrapper => {
            // unwrap children into parent
            const parent = wrapper.parentNode;
            if (!parent) return;
            while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
            wrapper.remove();
        });

        // Remove inline IPA spans and audio helpers that sometimes leak as text
        tempDiv.querySelectorAll('.IPA, .unicode, .audiolink, .IPAchar').forEach(el => el.remove());

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
            // If decoding was successful and changed the string, use decoded version
            if (decoded !== wikiId) {
                return decoded;
            }
        } catch (error) {
            // If decoding fails, continue with original - no logging needed
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