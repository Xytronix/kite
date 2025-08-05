import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GOOGLE_KNOWLEDGE_GRAPH_API_KEY, GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY } from '$env/static/private';

interface KnowledgeGraphEntity {
	'@id': string;
	name: string;
	description?: string;
	detailedDescription?: {
		articleBody: string;
		url: string;
		license: string;
	};
	image?: {
		contentUrl: string;
		url: string;
	};
	url?: string;
	identifier?: Array<{
		'@type': string;
		propertyID: string;
		value: string;
	}>;
	'@type': string[];
}

interface WikipediaContent {
	extract: string;
	thumbnail: { source: string } | null;
	originalImage: { source: string } | null;
	title: string;
	wikiUrl: string;
	entityType?: string;
	confidence?: number;
	googleKgMID?: string;
	wikidataQID?: string;
}

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	const lang = url.searchParams.get('lang') || 'en';

	if (!query) {
		return json({ error: 'Query parameter is required' }, { status: 400 });
	}

	try {
		// Try Enterprise Knowledge Graph first if configured
		if (GOOGLE_CLOUD_PROJECT_ID && GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY) {
			const enterpriseResult = await searchEnterpriseKnowledgeGraph(query, lang);
			if (enterpriseResult) {
				return json(enterpriseResult);
			}
		}

		// Fallback to public Knowledge Graph API if configured
		if (GOOGLE_KNOWLEDGE_GRAPH_API_KEY) {
			const publicResult = await searchPublicKnowledgeGraph(query, lang);
			if (publicResult) {
				return json(publicResult);
			}
		}

		// Final fallback to Wikipedia search
		const wikipediaResult = await searchWikipediaDirect(query, lang);
		return json(wikipediaResult);

	} catch (error) {
		console.error('Wikipedia search API error:', error);
		return json({ error: 'Failed to search Wikipedia content' }, { status: 500 });
	}
};

async function searchEnterpriseKnowledgeGraph(query: string, lang: string): Promise<WikipediaContent | null> {
	try {
		// Get access token from service account
		const accessToken = await getGoogleCloudAccessToken();
		if (!accessToken) return null;

		const kgUrl = `https://enterpriseknowledgegraph.googleapis.com/v1/projects/${GOOGLE_CLOUD_PROJECT_ID}/locations/global/publicKnowledgeGraphEntities:Search?query=${encodeURIComponent(query)}&limit=1&languages=${lang}`;
		
		const response = await fetch(kgUrl, {
			headers: {
				'Authorization': `Bearer ${accessToken}`,
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) return null;

		const data = await response.json();
		const entity = data.itemListElement?.[0]?.result as KnowledgeGraphEntity;

		if (entity) {
			return transformKnowledgeGraphEntity(entity, query, lang);
		}
	} catch (error) {
		console.debug('Enterprise Knowledge Graph search failed:', error);
	}
	return null;
}

async function searchPublicKnowledgeGraph(query: string, lang: string): Promise<WikipediaContent | null> {
	try {
		const kgUrl = `https://kgsearch.googleapis.com/v1/entities:search?query=${encodeURIComponent(query)}&key=${GOOGLE_KNOWLEDGE_GRAPH_API_KEY}&limit=1&indent=True`;
		
		const response = await fetch(kgUrl);
		if (!response.ok) return null;

		const data = await response.json();
		const entity = data.itemListElement?.[0]?.result as KnowledgeGraphEntity;

		if (entity) {
			return transformKnowledgeGraphEntity(entity, query, lang);
		}
	} catch (error) {
		console.debug('Public Knowledge Graph search failed:', error);
	}
	return null;
}

async function transformKnowledgeGraphEntity(entity: KnowledgeGraphEntity, query: string, lang: string): Promise<WikipediaContent> {
	// Extract identifiers
	const identifiers = entity.identifier || [];
	const googleKgMID = identifiers.find(id => id.propertyID === 'googleKgMID')?.value;
	const wikidataQID = identifiers.find(id => id.propertyID === 'wikidataQID')?.value;

	// Get Wikipedia content if available
	let wikiContent: WikipediaContent;
	const wikiUrl = entity.detailedDescription?.url;

	if (wikiUrl && wikiUrl.includes('wikipedia.org')) {
		// Extract page title from Wikipedia URL
		const titleMatch = wikiUrl.match(/\/wiki\/(.+)$/);
		if (titleMatch) {
			const pageTitle = decodeURIComponent(titleMatch[1]);
			wikiContent = await fetchWikipediaContent(pageTitle, lang);
		} else {
			wikiContent = createFallbackContent(entity);
		}
	} else {
		wikiContent = createFallbackContent(entity);
	}

	// Enhance with Knowledge Graph metadata
	return {
		...wikiContent,
		title: entity.name || wikiContent.title,
		extract: entity.detailedDescription?.articleBody || wikiContent.extract,
		thumbnail: entity.image?.contentUrl ? { source: entity.image.contentUrl } : wikiContent.thumbnail,
		wikiUrl: wikiUrl || wikiContent.wikiUrl,
		entityType: Array.isArray(entity['@type']) ? entity['@type'][0] : entity['@type'],
		googleKgMID,
		wikidataQID
	};
}

function createFallbackContent(entity: KnowledgeGraphEntity): WikipediaContent {
	return {
		extract: entity.description || entity.detailedDescription?.articleBody || 'No summary available.',
		thumbnail: entity.image?.contentUrl ? { source: entity.image.contentUrl } : null,
		originalImage: entity.image?.contentUrl ? { source: entity.image.contentUrl } : null,
		title: entity.name || '',
		wikiUrl: entity.url || entity.detailedDescription?.url || ''
	};
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

async function getGoogleCloudAccessToken(): Promise<string | null> {
	if (!GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY) return null;

	try {
		// Parse service account key
		const serviceAccount = JSON.parse(GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY);
		
		// Create JWT for Google OAuth
		const jwt = await createJWT(serviceAccount);
		
		// Exchange JWT for access token
		const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
				assertion: jwt
			})
		});

		if (!tokenResponse.ok) return null;

		const tokenData = await tokenResponse.json();
		return tokenData.access_token;
	} catch (error) {
		console.error('Failed to get Google Cloud access token:', error);
		return null;
	}
}

async function createJWT(serviceAccount: any): Promise<string> {
	const jwt = await import('jsonwebtoken');
	
	const now = Math.floor(Date.now() / 1000);
	const payload = {
		iss: serviceAccount.client_email,
		scope: 'https://www.googleapis.com/auth/cloud-platform',
		aud: 'https://oauth2.googleapis.com/token',
		exp: now + 3600,
		iat: now
	};

	return jwt.sign(payload, serviceAccount.private_key, { algorithm: 'RS256' });
}