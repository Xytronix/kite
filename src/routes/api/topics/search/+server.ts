import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch }) => {
	const query = url.searchParams.get('q') || '';
	const language = url.searchParams.get('lang') || 'en';

	if (!query.trim()) {
		return json([]);
	}

	try {
		// Get all topics
		const topicsResponse = await fetch(`/api/topics?lang=${language}`);
		const topics = await topicsResponse.json();

		// Filter topics by query
		const searchQuery = query.toLowerCase();
		const matchedTopics = topics.filter((topic: any) => 
			topic.name.toLowerCase().includes(searchQuery) ||
			topic.description?.toLowerCase().includes(searchQuery) ||
			topic.keywords.some((keyword: string) => keyword.toLowerCase().includes(searchQuery))
		);

		return json(matchedTopics);
	} catch (error) {
		console.error('Error searching topics:', error);
		return json({ error: 'Failed to search topics' }, { status: 500 });
	}
};