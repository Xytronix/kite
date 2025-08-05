// Cache for Q-ID to Wikipedia URL resolution
const qidUrlCache = new Map<string, string>();

/**
 * Resolve a Wikidata Q-ID to a proper Wikipedia URL
 */
export async function resolveQIdToWikipediaUrl(qid: string, lang: string = 'en'): Promise<string> {
  const cacheKey = `${qid}:${lang}`;
  
  // Check cache first
  if (qidUrlCache.has(cacheKey)) {
    return qidUrlCache.get(cacheKey)!;
  }

  try {
    // Normalize language code for Wikipedia
    const wikiLang = normalizeWikiLang(lang);
    const siteFilter = `${wikiLang}wiki`;
    
    // Use Wikidata API to resolve Q-ID to Wikipedia page title
    const wikidataUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=sitelinks&sitefilter=${siteFilter}&format=json&origin=*`;
    const response = await fetch(wikidataUrl);
    
    if (response.ok) {
      const data = await response.json();
      const entity = data.entities?.[qid];
      const pageTitle = entity?.sitelinks?.[siteFilter]?.title;
      
      if (pageTitle) {
        const wikiUrl = `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;
        qidUrlCache.set(cacheKey, wikiUrl);
        return wikiUrl;
      }
    }
    
    // If no page in requested language, try English as fallback
    if (wikiLang !== 'en') {
      const enResponse = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=sitelinks&sitefilter=enwiki&format=json&origin=*`);
      if (enResponse.ok) {
        const enData = await enResponse.json();
        const enEntity = enData.entities?.[qid];
        const enPageTitle = enEntity?.sitelinks?.enwiki?.title;
        
        if (enPageTitle) {
          const enWikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(enPageTitle)}`;
          qidUrlCache.set(cacheKey, enWikiUrl);
          return enWikiUrl;
        }
      }
    }
  } catch (error) {
    console.debug('Failed to resolve Q-ID to Wikipedia URL:', qid, error);
  }

  // Fallback: use Q-ID directly (will be handled by WikipediaTooltip)
  const fallbackUrl = `https://en.wikipedia.org/wiki/${qid}`;
  qidUrlCache.set(cacheKey, fallbackUrl);
  return fallbackUrl;
}

/**
 * Clear the Q-ID URL cache
 */
export function clearQIdUrlCache() {
  qidUrlCache.clear();
}

/**
 * Get the size of the Q-ID URL cache
 */
export function getQIdUrlCacheSize(): number {
  return qidUrlCache.size;
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