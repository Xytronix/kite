import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY } from '$env/static/private';

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
	const mid = url.searchParams.get('mid');
	const lang = url.searchParams.get('lang') || 'en';

	if (!mid) {
		return json({ error: 'MID parameter is required' }, { status: 400 });
	}

	if (!GOOGLE_CLOUD_PROJECT_ID || !GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY) {
		return json({ error: 'Google Cloud Enterprise Knowledge Graph not configured' }, { status: 503 });
	}

	try {
		const result = await lookupEntityByMID(mid, lang);
		if (result) {
			return json(result);
		} else {
			return json({ error: 'Entity not found' }, { status: 404 });
		}
	} catch (error) {
		console.error('MID lookup API error:', error);
		return json({ error: 'Failed to lookup entity' }, { status: 500 });
	}
};

async function lookupEntityByMID(mid: string, lang: string): Promise<WikipediaContent | null> {
	try {
		// Get access token from service account
		const accessToken = await getGoogleCloudAccessToken();
		if (!accessToken) return null;

		const kgUrl = `https://enterpriseknowledgegraph.googleapis.com/v1/projects/${GOOGLE_CLOUD_PROJECT_ID}/locations/global/publicKnowledgeGraphEntities:Lookup?ids=${encodeURIComponent(mid)}&languages=${lang}`;
		
		const response = await fetch(kgUrl, {
			headers: {
				'Authorization': `Bearer ${accessToken}`,
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) return null;

		const data = await response.json();
		const entity = data.itemListElement?.[0]?.result;

		if (entity) {
			// Extract identifiers
			const identifiers = entity.identifier || [];
			const googleKgMID = identifiers.find((id: any) => id.propertyID === 'googleKgMID')?.value;
			const wikidataQID = identifiers.find((id: any) => id.propertyID === 'wikidataQID')?.value;

			// Get Wikipedia content if available
			const wikiUrl = entity.detailedDescription?.url;
			let wikiContent: WikipediaContent;

			if (wikiUrl && wikiUrl.includes('wikipedia.org')) {
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
	} catch (error) {
		console.debug('Enterprise Knowledge Graph MID lookup failed:', error);
	}
	
	return null;
}

function createFallbackContent(entity: any): WikipediaContent {
	return {
		extract: entity.description || entity.detailedDescription?.articleBody || 'No summary available.',
		thumbnail: entity.image?.contentUrl ? { source: entity.image.contentUrl } : null,
		originalImage: entity.image?.contentUrl ? { source: entity.image.contentUrl } : null,
		title: entity.name || '',
		wikiUrl: entity.url || entity.detailedDescription?.url || ''
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