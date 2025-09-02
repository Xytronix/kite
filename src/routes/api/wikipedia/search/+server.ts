import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface WikidataEntity {
	id: string;
	label: string;
	description?: string;
	aliases?: string[];
	claims?: Record<string, any[]>;
	sitelinks?: Record<string, { site: string; title: string; url?: string }>;
}

interface WikipediaContent {
	extract: string;
	thumbnail: { source: string } | null;
	originalImage: { source: string } | null;
	title: string;
	wikiUrl: string;
	entityType?: string;
	confidence?: number;
	wikidataQID?: string;
}

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	const lang = url.searchParams.get('lang') || 'en';

	if (!query) {
		return json({ error: 'Query parameter is required' }, { status: 400 });
	}

	try {
		// Use Wikidata-enhanced search
		const wikidataResult = await searchWikidataEnhanced(query, lang);
		if (wikidataResult) {
			return json(wikidataResult);
		}

		// Fallback to direct Wikipedia search
		const wikipediaResult = await searchWikipediaDirect(query, lang);
		return json(wikipediaResult);

	} catch (error) {
		if (process.env.NODE_ENV === 'development') {
			console.error('Wikipedia search API error:', error);
		}
		return json({ error: 'Failed to search Wikipedia content' }, { status: 500 });
	}
};

async function searchWikidataEnhanced(query: string, lang: string): Promise<WikipediaContent | null> {
	try {
		// Search Wikidata for entities
		const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=${lang}&limit=3&format=json&origin=*`;
		
		const response = await fetch(searchUrl);
		if (!response.ok) return null;

		const data = await response.json();
		const entities = data.search || [];

		if (entities.length === 0) return null;

		// Try to find the best entity match
		for (const entity of entities) {
			const qid = entity.id;
			const entityData = await getWikidataEntityDetails(qid, lang);
			
			if (entityData) {
				const wikiContent = await transformWikidataEntity(entityData, lang);
				if (wikiContent) {
					return wikiContent;
				}
			}
		}
	} catch (error) {
		if (process.env.NODE_ENV === 'development') {
			console.debug('Wikidata search failed:', error);
		}
	}
	return null;
}

async function getWikidataEntityDetails(qid: string, lang: string): Promise<WikidataEntity | null> {
	try {
		const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&languages=${lang}|en&format=json&origin=*`;
		
		const response = await fetch(entityUrl);
		if (!response.ok) return null;

		const data = await response.json();
		const entityData = data.entities?.[qid];
		
		if (!entityData || entityData.missing) return null;

		return {
			id: qid,
			label: entityData.labels?.[lang]?.value || entityData.labels?.en?.value || '',
			description: entityData.descriptions?.[lang]?.value || entityData.descriptions?.en?.value,
			aliases: entityData.aliases?.[lang]?.map((alias: any) => alias.value) || 
					 entityData.aliases?.en?.map((alias: any) => alias.value) || [],
			claims: entityData.claims || {},
			sitelinks: entityData.sitelinks || {}
		};
	} catch (error) {
		console.debug('Wikidata entity fetch failed:', error);
		return null;
	}
}

async function transformWikidataEntity(entity: WikidataEntity, lang: string): Promise<WikipediaContent | null> {
	// Get Wikipedia page from sitelinks
	const wikiLang = normalizeWikiLang(lang);
	const sitelink = entity.sitelinks?.[`${wikiLang}wiki`] || entity.sitelinks?.enwiki;
	
	if (!sitelink) {
		// No Wikipedia page available
		return {
			extract: entity.description || 'No summary available.',
			thumbnail: null,
			originalImage: null,
			title: entity.label || '',
			wikiUrl: `https://www.wikidata.org/wiki/${entity.id}`,
			wikidataQID: entity.id
		};
	}

	// Fetch Wikipedia content
	const actualLang = sitelink.site.replace('wiki', '');
	const wikiContent = await fetchWikipediaContent(sitelink.title, actualLang);
	
	return {
		...wikiContent,
		wikidataQID: entity.id
	};
}

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

async function searchWikipediaDirect(query: string, lang: string): Promise<WikipediaContent> {
	// Direct Wikipedia search as final fallback
	const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`;
	
	const searchResp = await fetch(searchUrl);
	const searchData = await searchResp.json();
	const title = searchData?.query?.search?.[0]?.title;

	if (title) {
		return await fetchWikipediaContent(title, lang);
	}

	return {
		extract: 'No Wikipedia content found.',
		thumbnail: null,
		originalImage: null,
		title: query,
		wikiUrl: ''
	};
}

async function fetchWikipediaContent(title: string, lang: string): Promise<WikipediaContent> {
	const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
	
	try {
		const response = await fetch(url);
		if (!response.ok) throw new Error('Wikipedia fetch failed');
		
		const data = await response.json();
		
		return {
			extract: data.extract || 'No summary available.',
			thumbnail: data.thumbnail || null,
			originalImage: data.originalimage || null,
			title: data.title || title,
			wikiUrl: data.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`
		};
	} catch (error) {
		return {
			extract: 'Failed to load Wikipedia content.',
			thumbnail: null,
			originalImage: null,
			title: title,
			wikiUrl: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`
		};
	}
}

