import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Topic } from '$lib/types';
import { TopicExtractor } from '$lib/algorithms/topicExtraction';

// Extract trending topics using advanced algorithms
async function extractTrendingTopics(language: string, baseUrl: string): Promise<Topic[]> {
	try {
		const extractor = new TopicExtractor();
		
		// Get the latest batch data
		const batchResponse = await fetch(`${baseUrl}/api/batches?lang=${language}`);
		if (!batchResponse.ok) {
			throw new Error('Failed to load batch data');
		}
		const batchData = await batchResponse.json();
		
		if (!batchData.batches || batchData.batches.length === 0) {
			return [];
		}

		const latestBatch = batchData.batches[0];
		
		// Get categories for the latest batch
		const categoriesResponse = await fetch(`${baseUrl}/api/batches/${latestBatch.id}/categories`);
		if (!categoriesResponse.ok) {
			throw new Error('Failed to load categories');
		}
		const categoriesData = await categoriesResponse.json();

		// Collect documents and time series data for algorithmic processing
		const documents: string[] = [];
		const timeSeriesData: Array<{text: string, timestamp: Date}> = [];

		// Process each category
		for (const category of categoriesData.categories.slice(0, 15)) {
			try {
				const storiesResponse = await fetch(
					`${baseUrl}/api/batches/${latestBatch.id}/categories/${category.id}/stories?limit=25&lang=${language}`
				);
				if (storiesResponse.ok) {
					const storiesData = await storiesResponse.json();
					
					// Collect documents for TF-IDF analysis
					for (const story of storiesData.stories) {
						const storyText = [
							story.title,
							story.short_summary || '',
							...(story.articles || []).map((a: any) => a.title)
						].filter(Boolean).join(' ');
						
						documents.push(storyText);
						
						// Add to time series for burst detection
						timeSeriesData.push({
							text: storyText,
							timestamp: new Date(story.created_at || Date.now())
						});
					}
				}
			} catch (error) {
				console.warn(`Failed to load stories for category ${category.id}:`, error);
			}
		}

		if (documents.length === 0) {
			return [];
		}

		// Use algorithmic topic extraction
		const topicCandidates = extractor.extractTopics(documents, timeSeriesData);

		// Convert to Topic format
		const topics: Topic[] = topicCandidates.map((candidate, index) => ({
			id: candidate.term.toLowerCase().replace(/\s+/g, '-'),
			name: candidate.term,
			type: mapCandidateTypeToTopicType(candidate.type),
			aliases: [],
			keywords: candidate.term.split(' '),
			description: `Algorithmically detected topic (score: ${candidate.score.toFixed(2)}, confidence: ${(candidate.confidence * 100).toFixed(0)}%)`,
			created_at: new Date().toISOString(),
			article_count: candidate.frequency,
			last_mentioned: new Date().toISOString()
		}));

		return topics;

	} catch (error) {
		console.error('Error extracting trending topics:', error);
		return [];
	}
}

// Helper function to map candidate types to Topic types
function mapCandidateTypeToTopicType(candidateType: string): Topic['type'] {
	switch (candidateType) {
		case 'entity': return 'person';
		case 'location': return 'location';
		case 'organization': return 'organization';
		case 'event': return 'event';
		case 'concept': 
		default: return 'concept';
	}
}

export const GET: RequestHandler = async ({ url }) => {
	const language = url.searchParams.get('lang') || 'en';
	
	try {
		const topics = await extractTrendingTopics(language, url.origin);
		return json(topics);
	} catch (error) {
		console.error('Error loading topics:', error);
		return json({ error: 'Failed to load topics' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const topicData = await request.json();
		
		// Validate required fields
		if (!topicData.name || !topicData.keywords || !Array.isArray(topicData.keywords)) {
			return json({ error: 'Invalid topic data' }, { status: 400 });
		}

		// Create new topic
		const newTopic: Topic = {
			id: topicData.name.toLowerCase().replace(/\s+/g, '-'),
			name: topicData.name,
			type: topicData.type || 'concept',
			aliases: topicData.aliases || [],
			keywords: topicData.keywords,
			description: topicData.description,
			created_at: new Date().toISOString(),
			article_count: 0
		};

		// In a real implementation, save to database
		
		return json(newTopic, { status: 201 });
	} catch (error) {
		console.error('Error creating topic:', error);
		return json({ error: 'Failed to create topic' }, { status: 500 });
	}
};