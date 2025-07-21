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
	if (kind === 'place') return d.includes('city') || d.includes('town') || d.includes('country') || d.includes('village') || d.includes('province') || d.includes('state');
	if (kind === 'organisation') return d.includes('company') || d.includes('organisation') || d.includes('organization') || d.includes('university') || d.includes('agency') || d.includes('bank');
	return false;
}

export interface WikiResolveResult {
  title: string;
  qid: string;
}

export async function resolveWikiTitleWithContext(phrase: string, kind: EntityKind = 'generic'): Promise<WikiResolveResult | null> {
	const uiLang = browser ? language.current : 'en';
	const wikiLang = normalizeWikiLang(uiLang);
	const cacheKey = `${wikiLang}:${kind}:${phrase}`;
	if (RESOLVE_CACHE.has(cacheKey)) {
    const cached = RESOLVE_CACHE.get(cacheKey)!;
    return cached ? JSON.parse(cached) as WikiResolveResult : null;
  }

	// 1. Wikipedia search in user language
	async function searchWikipedia(lang: string): Promise<string | ''> {
		try {
			const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(phrase)}&srlimit=1&format=json&origin=*`;
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