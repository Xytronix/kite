import { browser } from '$app/environment';
import { language } from '$lib/stores/language.svelte.js';
import { searchAndValidateEntity, getWikipediaUrlFromQid } from '$lib/services/wikidataService.js';

// Simple in-memory cache : key -> WikiResolveResult JSON string ( '' means not found )
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

	try {
		// Use enhanced Wikidata search and validation
		const validation = await searchAndValidateEntity(cleanPhrase, kind, uiLang);
		
		if (!validation || !validation.isValid || validation.confidence < 0.6) {
			RESOLVE_CACHE.set(cacheKey, '');
			return null;
		}

		// Get Wikipedia title from Wikidata
		const wikipediaTitle = validation.wikipediaTitle || validation.label;
		if (!wikipediaTitle) {
			RESOLVE_CACHE.set(cacheKey, '');
			return null;
		}

		const result: WikiResolveResult = { 
			title: wikipediaTitle, 
			qid: validation.qid || '' 
		};
		
		// Only log validation for debugging specific entities
		if (import.meta.env.DEV && cleanPhrase.includes('debug-this-phrase')) {
			console.debug('WikiResolver validation for:', cleanPhrase, 'kind:', kind, 'qid:', validation.qid, 'confidence:', validation.confidence, 'entityType:', validation.entityType);
		}
		
		RESOLVE_CACHE.set(cacheKey, JSON.stringify(result));
		return result;
	} catch (error) {
		console.debug('WikiResolver error for:', cleanPhrase, error);
		RESOLVE_CACHE.set(cacheKey, '');
		return null;
	}
} 