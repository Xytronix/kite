import type { Topic, TopicFeed, Article, Story } from '$lib/types';

/**
 * Service for managing entity-based topic feeds
 * This is different from RSS feed categories - it finds all mentions of specific entities
 */
class TopicService {
	private baseUrl = '/api';

	/**
	 * Extract entity mentions from article content using exact name matching and aliases
	 */
	private extractEntityMentions(article: Article, availableTopics: Topic[]): string[] {
		const content = `${article.title} ${article.domain}`.toLowerCase();
		const matchedTopics: string[] = [];

		for (const topic of availableTopics) {
			// Check exact name match (case insensitive)
			const nameMatch = content.includes(topic.name.toLowerCase());
			
			// Check aliases (alternative names/spellings)
			const aliasMatch = topic.aliases.some(alias => 
				content.includes(alias.toLowerCase())
			);
			
			// Check related keywords (but with higher threshold)
			const keywordMatches = topic.keywords.filter(keyword => 
				content.includes(keyword.toLowerCase())
			).length;
			
			// Entity is mentioned if:
			// 1. Exact name match, OR
			// 2. Alias match, OR  
			// 3. Multiple keyword matches (indicates strong relevance)
			if (nameMatch || aliasMatch || keywordMatches >= 2) {
				matchedTopics.push(topic.id);
			}
		}

		return matchedTopics;
	}

	/**
	 * Calculate mention frequency for trending analysis
	 */
	private calculateMentionFrequency(articles: Article[]): { date: string; count: number }[] {
		const dailyCounts = new Map<string, number>();
		
		articles.forEach(article => {
			const date = article.date.split('T')[0]; // Get just the date part
			dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
		});

		return Array.from(dailyCounts.entries())
			.map(([date, count]) => ({ date, count }))
			.sort((a, b) => a.date.localeCompare(b.date));
	}

	/**
	 * Get all available topics
	 */
	async getTopics(language: string = "en"): Promise<Topic[]> {
		try {
			const response = await fetch(`${this.baseUrl}/topics?lang=${language}`);
			if (!response.ok) {
				throw new Error(`Failed to load topics: ${response.statusText}`);
			}
			return await response.json();
		} catch (error) {
			console.error("Error loading topics:", error);
			throw error;
		}
	}

	/**
	 * Get topic feed with historical articles
	 */
	async getTopicFeed(
		topicId: string, 
		limit: number = 50,
		language: string = "en"
	): Promise<TopicFeed> {
		try {
			const response = await fetch(
				`${this.baseUrl}/topics/${topicId}/feed?limit=${limit}&lang=${language}`
			);
			if (!response.ok) {
				throw new Error(`Failed to load topic feed: ${response.statusText}`);
			}
			return await response.json();
		} catch (error) {
			console.error("Error loading topic feed:", error);
			throw error;
		}
	}

	/**
	 * Search topics by keyword
	 */
	async searchTopics(query: string, language: string = "en"): Promise<Topic[]> {
		try {
			const response = await fetch(
				`${this.baseUrl}/topics/search?q=${encodeURIComponent(query)}&lang=${language}`
			);
			if (!response.ok) {
				throw new Error(`Failed to search topics: ${response.statusText}`);
			}
			return await response.json();
		} catch (error) {
			console.error("Error searching topics:", error);
			throw error;
		}
	}

	/**
	 * Get trending topics based on recent article volume
	 */
	async getTrendingTopics(limit: number = 10, language: string = "en"): Promise<Topic[]> {
		try {
			const response = await fetch(
				`${this.baseUrl}/topics/trending?limit=${limit}&lang=${language}`
			);
			if (!response.ok) {
				throw new Error(`Failed to load trending topics: ${response.statusText}`);
			}
			return await response.json();
		} catch (error) {
			console.error("Error loading trending topics:", error);
			throw error;
		}
	}

	/**
	 * Create a new topic (for admin/power users)
	 */
	async createTopic(topic: Omit<Topic, 'id' | 'created_at' | 'article_count'>): Promise<Topic> {
		try {
			const response = await fetch(`${this.baseUrl}/topics`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(topic),
			});
			if (!response.ok) {
				throw new Error(`Failed to create topic: ${response.statusText}`);
			}
			return await response.json();
		} catch (error) {
			console.error("Error creating topic:", error);
			throw error;
		}
	}
}

// Export singleton instance
export const topicService = new TopicService();