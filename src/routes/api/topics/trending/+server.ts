import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch }) => {
	const limit = parseInt(url.searchParams.get('limit') || '10');
	const language = url.searchParams.get('lang') || 'en';

	try {
		// Get all topics (which are now dynamically extracted)
		const topicsResponse = await fetch(`/api/topics?lang=${language}`);
		const topics = await topicsResponse.json();

		// Topics are already sorted by frequency (article_count) from the main API
		// Just return the top trending ones
		const trendingTopics = topics.slice(0, limit);

		return json(trendingTopics);
	} catch (error) {
		console.error('Error loading trending topics:', error);
		return json({ error: 'Failed to load trending topics' }, { status: 500 });
	}
};