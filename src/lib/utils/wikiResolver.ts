import { browser } from '$app/environment';
import { language } from '$lib/stores/language.svelte.js';

// Simple in-memory cache : key -> wikiTitle ( '' means not found )
const RESOLVE_CACHE = new Map<string, string>();

type EntityKind = 'human' | 'place' | 'organisation' | 'generic';

// Normalize language code for Wikipedia/Wikidata endpoints
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
	return lower.split('-')[0] || 'en';
}

// Very conservative matching keywords for entity descriptions
function matchesKind(description: string | undefined, kind: EntityKind): boolean {
	if (!description) return false;
	const d = description.toLowerCase();
	if (kind === 'generic') return true;
	if (kind === 'human') return d.includes('human') || d.includes('person') || d.includes('politician') || d.includes('actor') || d.includes('athlete');
	if (kind === 'place') {
		// Prefer more specific place types over generic ones
		const specificPlaces = [
			'city', 'town', 'village', 'municipality', 'district', 'neighborhood', 'neighbourhood',
			'province', 'state', 'region', 'county', 'prefecture', 'territory',
			'island', 'peninsula', 'mountain', 'river', 'lake', 'valley', 'desert', 'forest',
			'landmark', 'monument', 'building', 'structure', 'bridge', 'park', 'square',
			'airport', 'station', 'port', 'harbor', 'harbour', 'university', 'school', 'hospital',
			'capital', 'metropolitan', 'urban', 'suburban', 'rural'
		];
		
		// Avoid very generic place descriptions that don't provide useful context
		const genericPlaces = [
			'place', 'location', 'area', 'site', 'spot', 'point', 'position'
		];
		
		// Check if it matches specific place types
		const hasSpecificPlace = specificPlaces.some(term => d.includes(term));
		
		// Check if it only matches generic place terms
		const onlyGenericPlace = genericPlaces.some(term => d.includes(term)) && !hasSpecificPlace;
		
		// Also include countries explicitly
		const isCountry = d.includes('country') || d.includes('nation') || d.includes('republic') || d.includes('kingdom') || d.includes('federation');
		
		return (hasSpecificPlace || isCountry) && !onlyGenericPlace;
	}
	if (kind === 'organisation') return d.includes('company') || d.includes('organisation') || d.includes('organization') || d.includes('university') || d.includes('agency') || d.includes('bank');
	return false;
}

export interface WikiResolveResult {
  title: string;
  qid: string;
}

export async function resolveWikiTitleWithContext(phrase: string, kind: EntityKind = 'generic'): Promise<WikiResolveResult | null> {
	const uiLang = browser ? language.ui : 'en';
	const wikiLang = normalizeWikiLang(uiLang);
	
	// Properly decode URL-encoded phrases
	let cleanPhrase = phrase;
	if (phrase.includes('%')) {
		try {
			cleanPhrase = decodeURIComponent(phrase);
		} catch (error) {
			console.debug('Failed to decode phrase:', phrase, error);
		}
	}
	
	const cacheKey = `${wikiLang}:${kind}:${cleanPhrase}`;
	if (RESOLVE_CACHE.has(cacheKey)) {
    const cached = RESOLVE_CACHE.get(cacheKey)!;
    return cached ? JSON.parse(cached) as WikiResolveResult : null;
  }

	// 1. Wikipedia search in user language
	async function searchWikipedia(lang: string): Promise<string | ''> {
		try {
			const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanPhrase)}&srlimit=1&format=json&origin=*`;
			const resp = await fetch(searchUrl);
			if (!resp.ok) return '';
			const data: any = await resp.json();
			return data?.query?.search?.[0]?.title || '';
		} catch { return ''; }
	}

	let title = await searchWikipedia(wikiLang);
	if (!title) {
		// English fallback
		title = await searchWikipedia('en');
		if (!title) {
			RESOLVE_CACHE.set(cacheKey, '');
			return null;
		}
	}

	// 2. Validate via Wikidata
	try {
		const wdUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(title)}&language=${wikiLang}&limit=1&format=json&origin=*`;
		const wdResp = await fetch(wdUrl);
		if (!wdResp.ok) {
			RESOLVE_CACHE.set(cacheKey, '');
			return null;
		}
		const wdData: any = await wdResp.json();
		const desc = wdData?.search?.[0]?.description as string | undefined;
		const qid = wdData?.search?.[0]?.id as string | undefined;
		console.debug('WikiResolver validation for:', cleanPhrase, 'kind:', kind, 'description:', desc, 'matches:', matchesKind(desc, kind));
		if (matchesKind(desc, kind)) {
			const result: WikiResolveResult = { title, qid: qid || '' };
			RESOLVE_CACHE.set(cacheKey, JSON.stringify(result));
			return result;
		}
	} catch {
		/* ignore */
	}

	RESOLVE_CACHE.set(cacheKey, '');
	return null;
} 