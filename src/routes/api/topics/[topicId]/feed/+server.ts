import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { TopicFeed, Article, Story } from '$lib/types';

// Helper functions
function calculateMentionFrequency(articles: Article[]): { date: string; count: number }[] {
	const dailyMentions = new Map<string, number>();
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	articles.forEach(article => {
		const articleDate = new Date(article.date);
		if (articleDate >= thirtyDaysAgo) {
			const dateKey = articleDate.toISOString().split('T')[0];
			dailyMentions.set(dateKey, (dailyMentions.get(dateKey) || 0) + 1);
		}
	});

	// Fill in missing dates with 0 counts
	const mentionFrequency = [];
	for (let i = 29; i >= 0; i--) {
		const date = new Date();
		date.setDate(date.getDate() - i);
		const dateKey = date.toISOString().split('T')[0];
		mentionFrequency.push({
			date: dateKey,
			count: dailyMentions.get(dateKey) || 0
		});
	}

	return mentionFrequency;
}

function calculateWeeklyTrend(mentionFrequency: { date: string; count: number }[]): 'up' | 'down' | 'stable' {
	if (mentionFrequency.length < 14) return 'stable';
	
	const lastWeekCount = mentionFrequency.slice(-7).reduce((sum, day) => sum + day.count, 0);
	const previousWeekCount = mentionFrequency.slice(-14, -7).reduce((sum, day) => sum + day.count, 0);
	
	if (lastWeekCount > previousWeekCount * 1.2) {
		return 'up';
	} else if (lastWeekCount < previousWeekCount * 0.8) {
		return 'down';
	}
	return 'stable';
}

export const GET: RequestHandler = async ({ params, url, fetch }) => {
	const { topicId } = params;
	const limit = parseInt(url.searchParams.get('limit') || '50');
	const language = url.searchParams.get('lang') || 'en';

	try {
		// Get topic definition
		const topicsResponse = await fetch(`/api/topics?lang=${language}`);
		const topics = await topicsResponse.json();
		const topic = topics.find((t: any) => t.id === topicId);
		
		if (!topic) {
			return json({ error: 'Topic not found' }, { status: 404 });
		}

		// Get recent batches to scan for topic mentions
		const batchesResponse = await fetch(`/api/batches?lang=${language}`);
		if (!batchesResponse.ok) {
			throw new Error('Failed to load batches');
		}
		const batchesData = await batchesResponse.json();
		
		const matchedArticles: Article[] = [];
		const matchedStories: Story[] = [];
		let earliestDate = new Date().toISOString();
		let latestDate = new Date(0).toISOString();

		// Scan through batches from newest to oldest until we gather enough matches for the requested limit.
		// Removing the previous hard cap of 10 enables multi-date infinite scrolling on the frontend.
		const recentBatches = batchesData.batches;
		
		for (const batch of recentBatches) {
			try {
				// Get categories for this batch
				const categoriesResponse = await fetch(`/api/batches/${batch.id}/categories?lang=${language}`);
				if (!categoriesResponse.ok) continue;
				
				const categoriesData = await categoriesResponse.json();

				// Scan each category for stories
				for (const category of categoriesData.categories) {
					try {
						// Get stories for this category
						const storiesResponse = await fetch(
							`/api/batches/${batch.id}/categories/${category.id}/stories?limit=50&lang=${language}`
						);
						if (!storiesResponse.ok) continue;
						
						const storiesData = await storiesResponse.json();
						const stories = storiesData.stories || [];

						// Check each story for topic matches
						for (const story of stories) {
							if (!story.title || !story.short_summary) continue;
							
							const storyContent = `${story.title} ${story.short_summary}`.toLowerCase();
							const hasTopicMatch = 
								// Check exact name match
								storyContent.includes(topic.name.toLowerCase()) ||
								// Check aliases
								topic.aliases.some((alias: string) => storyContent.includes(alias.toLowerCase())) ||
								// Check keywords (need at least 2 matches for relevance)
								topic.keywords.filter((keyword: string) => 
									storyContent.includes(keyword.toLowerCase())
								).length >= 2;

							if (hasTopicMatch) {
								// Add the story with category info
								matchedStories.push({
									...story,
									category: category.categoryName
								});

								// Add all articles from matching stories
								if (Array.isArray(story.articles)) {
									for (const article of story.articles) {
										matchedArticles.push(article);
										
										// Update date range
										if (article.date < earliestDate) earliestDate = article.date;
										if (article.date > latestDate) latestDate = article.date;
									}
								}
							}
						}
					} catch (error) {
						console.warn(`Failed to load stories for category ${category.categoryId}:`, error);
					}
				}
			} catch (error) {
				console.warn(`Failed to load categories for batch ${batch.id}:`, error);
			}

			// Stop if we have enough articles
			if (matchedArticles.length >= limit) break;
		}

		// Sort by date (newest first) and limit results
		matchedArticles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
		matchedStories.sort((a, b) => {
			const aDate = a.articles?.[0]?.date || '1970-01-01';
			const bDate = b.articles?.[0]?.date || '1970-01-01';
			return new Date(bDate).getTime() - new Date(aDate).getTime();
		});

		// Calculate mention frequency
		const mentionFrequency = calculateMentionFrequency(matchedArticles);
		const weeklyTrend = calculateWeeklyTrend(mentionFrequency);

		// If no matches found, set reasonable defaults
		if (matchedArticles.length === 0) {
			earliestDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
			latestDate = new Date().toISOString();
		}

		const topicFeed: TopicFeed = {
			topic: {
				...topic,
				article_count: matchedArticles.length
			},
			articles: matchedArticles.slice(0, limit),
			stories: matchedStories.slice(0, Math.floor(limit / 3)),
			total_count: matchedArticles.length,
			date_range: {
				earliest: earliestDate,
				latest: latestDate
			},
			related_entities: [], // Could implement topic similarity here
			mention_frequency: {
				daily: mentionFrequency,
				weekly_trend: weeklyTrend
			}
		};

		return json(topicFeed);
	} catch (error) {
		console.error('Error generating topic feed:', error);
		return json({ error: 'Failed to generate topic feed' }, { status: 500 });
	}
};