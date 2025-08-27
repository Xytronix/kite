import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { LOGO_DEV_API_TOKEN } from '$env/static/private';

export const GET: RequestHandler = async ({ url }) => {
	const domain = url.searchParams.get('domain');
	const size = url.searchParams.get('size') || '64';

	if (!domain) {
		return json({ error: 'Domain parameter is required' }, { status: 400 });
	}

	if (!LOGO_DEV_API_TOKEN) {
		return json({ error: 'Logo API not configured' }, { status: 503 });
	}

	try {
		// Example logo API call (adjust based on your actual logo service)
		const logoResponse = await fetch(
			`https://api.logo-service.com/v1/logo?domain=${encodeURIComponent(domain)}&size=${size}`,
			{
				headers: {
					'Authorization': `Bearer ${LOGO_DEV_API_TOKEN}`,
					'Content-Type': 'application/json'
				}
			}
		);

		if (!logoResponse.ok) {
			return json({ error: 'Failed to fetch logo' }, { status: logoResponse.status });
		}

		const logoData = await logoResponse.json();
		return json(logoData);

	} catch (error) {
		if (process.env.NODE_ENV === 'development') {
			console.error('Logo API error:', error);
		}
		return json({ error: 'Failed to fetch logo' }, { status: 500 });
	}
};