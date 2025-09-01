import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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
	const qid = url.searchParams.get('qid');
	const lang = url.searchParams.get('lang') || 'en';

	if (!qid) {
		return json({ error: 'QID parameter is required' }, { status: 400 });
	}

	// Validate QID format
	if (!/^Q\d+$/.test(qid)) {
		return json({ error: 'Invalid QID format' }, { status: 400 });
	}

	try {
		const result = await lookupEntityByQID(qid, lang);
		if (result) {
			return json(result);
		} else {
			return json({ error: 'Entity not found' }, { status: 404 });
		}
	} catch (error) {
		if (process.env.NODE_ENV === 'development') {
			console.error('QID lookup API error:', error);
		}
		return json({ error: 'Failed to lookup entity' }, { status: 500 });
	}
};

async function lookupEntityByQID(qid: string, lang: string): Promise<WikipediaContent | null> {
	try {
		// Get Wikidata entity details
		const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&languages=${lang}|en&format=json&origin=*`;
		
		const response = await fetch(entityUrl);
		if (!response.ok) return null;

		const data = await response.json();
		const entityData = data.entities?.[qid];
		
		if (!entityData || entityData.missing) return null;

		// Extract basic entity information
		const label = entityData.labels?.[lang]?.value || entityData.labels?.en?.value || '';
		const description = entityData.descriptions?.[lang]?.value || entityData.descriptions?.en?.value;
		const sitelinks = entityData.sitelinks || {};

		// Get Wikipedia page from sitelinks
		const wikiLang = normalizeWikiLang(lang);
		const sitelink = sitelinks[`${wikiLang}wiki`] || sitelinks.enwiki;
		
		if (sitelink) {
			// Fetch Wikipedia content
			const actualLang = sitelink.site.replace('wiki', '');
			const wikiContent = await fetchWikipediaContent(sitelink.title, actualLang);
			
			return {
				...wikiContent,
				wikidataQID: qid
			};
		} else {
			// No Wikipedia page available, return Wikidata info
			return {
				extract: description || 'No summary available.',
				thumbnail: null,
				originalImage: null,
				title: label,
				wikiUrl: `https://www.wikidata.org/wiki/${qid}`,
				wikidataQID: qid
			};
		}
	} catch (error) {
		if (process.env.NODE_ENV === 'development') {
			console.debug('Wikidata QID lookup failed:', error);
		}
	}
	
	return null;
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

