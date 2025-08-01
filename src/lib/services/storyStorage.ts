import { browser } from '$app/environment';
import type { Story } from '$lib/types';

export interface StoredStory {
	id: string;
	title: string;
	content: string;
	url: string;
	publishedAt: string;
	storedAt: number; // timestamp
	titleWords: string[];
	contentWords: string[];
	fingerprint: string; // hash for quick comparison
}

export interface SimilarityResult {
	isSimilar: boolean;
	similarity: number; // 0-100%
	matchingStory?: StoredStory;
	reason?: string;
}

export class StoryStorageService {
	private readonly STORAGE_KEY = 'kite-story-similarity-cache';
	private readonly MAX_STORIES = 1000; // Limit storage size
	
	/**
	 * Check if a story is similar to previously stored stories
	 */
	checkSimilarity(
		story: Story, 
		mode: 'today' | 'historical',
		expiryDays: number,
		threshold: number,
		scope: 'within-category' | 'across-categories' = 'within-category',
		titleWeight: number = 40,
		contentWeight: number = 25,
		entityWeight: number = 35
	): SimilarityResult {
		if (!browser) {
			return { isSimilar: false, similarity: 0 };
		}

		const storedStories = this.getStoredStories();
		const currentTime = Date.now();
		
		// Filter stories based on mode, expiry, and scope
		const relevantStories = storedStories.filter(stored => {
			// Time-based filtering
			let withinTimeRange = false;
			if (mode === 'today') {
				const today = new Date();
				const storyDate = new Date(stored.publishedAt);
				withinTimeRange = storyDate.toDateString() === today.toDateString();
			} else {
				const expiryTime = expiryDays * 24 * 60 * 60 * 1000;
				withinTimeRange = (currentTime - stored.storedAt) <= expiryTime;
			}
			
			if (!withinTimeRange) return false;
			
			// Category scope filtering
			if (scope === 'within-category') {
				// Only compare within the same category
				// For now, we'll use a simple heuristic based on story properties
				// In a more sophisticated implementation, we'd analyze the content to determine category
				const storyCategory = this.inferCategory(story);
				const storedCategory = this.inferCategory({ 
					title: stored.title, 
					short_summary: stored.content,
					category: stored.title // We don't store category, so we infer it
				} as Story);
				return storyCategory === storedCategory;
			}
			
			// across-categories: compare with all stories
			return true;
		});

		// Check similarity against relevant stories
		let maxSimilarity = 0;
		let mostSimilarStory: StoredStory | undefined;

		for (const storedStory of relevantStories) {
			const similarity = this.calculateSimilarity(story, storedStory, titleWeight, contentWeight, entityWeight);
			if (similarity > maxSimilarity) {
				maxSimilarity = similarity;
				mostSimilarStory = storedStory;
			}
		}

		const isSimilar = maxSimilarity >= threshold;
		
		return {
			isSimilar,
			similarity: maxSimilarity,
			matchingStory: mostSimilarStory,
			reason: isSimilar ? `${maxSimilarity.toFixed(1)}% similar to "${mostSimilarStory?.title}"` : undefined
		};
	}

	/**
	 * Store a story for future similarity checking
	 */
	storeStory(story: Story): void {
		if (!browser) return;

		try {
			const storedStories = this.getStoredStories();
			
			// Create stored story object
			const storedStory: StoredStory = {
				id: story.cluster_number.toString() || this.generateId(story),
				title: story.title || '',
				content: story.short_summary || '',
				url: story.articles?.[0]?.link || '',
				publishedAt: story.articles?.[0]?.date || new Date().toISOString(),
				storedAt: Date.now(),
				titleWords: this.extractKeywords(story.title || ''),
				contentWords: this.extractKeywords(story.short_summary || ''),
				fingerprint: this.generateFingerprint(story)
			};

			// Check if story already exists (avoid duplicates)
			const existingIndex = storedStories.findIndex(s => 
				s.fingerprint === storedStory.fingerprint || s.url === storedStory.url
			);

			if (existingIndex >= 0) {
				// Update existing story
				storedStories[existingIndex] = storedStory;
			} else {
				// Add new story
				storedStories.push(storedStory);
			}

			// Limit storage size (keep most recent)
			if (storedStories.length > this.MAX_STORIES) {
				storedStories.sort((a, b) => b.storedAt - a.storedAt);
				storedStories.splice(this.MAX_STORIES);
			}

			localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storedStories));
		} catch (error) {
			console.error('Failed to store story for similarity tracking:', error);
		}
	}

	/**
	 * Clean up expired stories
	 */
	cleanupExpiredStories(maxAgeDays: number = 30): void {
		if (!browser) return;

		try {
			const storedStories = this.getStoredStories();
			const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
			
			const validStories = storedStories.filter(story => story.storedAt > cutoffTime);
			
			if (validStories.length !== storedStories.length) {
				localStorage.setItem(this.STORAGE_KEY, JSON.stringify(validStories));
			}
		} catch (error) {
			console.error('Failed to cleanup expired stories:', error);
		}
	}

	/**
	 * Get statistics about stored stories
	 */
	getStorageStats(): { totalStories: number; oldestStory: string | null; storageSize: number } {
		if (!browser) {
			return { totalStories: 0, oldestStory: null, storageSize: 0 };
		}

		const storedStories = this.getStoredStories();
		const storageData = localStorage.getItem(this.STORAGE_KEY) || '';
		
		let oldestStory: string | null = null;
		if (storedStories.length > 0) {
			const oldest = storedStories.reduce((prev, current) => 
				prev.storedAt < current.storedAt ? prev : current
			);
			oldestStory = new Date(oldest.storedAt).toLocaleDateString();
		}

		return {
			totalStories: storedStories.length,
			oldestStory,
			storageSize: new Blob([storageData]).size
		};
	}

	/**
	 * Clear all stored stories
	 */
	clearStoredStories(): void {
		if (!browser) return;
		localStorage.removeItem(this.STORAGE_KEY);
	}

	// Private helper methods

	private getStoredStories(): StoredStory[] {
		try {
			const stored = localStorage.getItem(this.STORAGE_KEY);
			return stored ? JSON.parse(stored) : [];
		} catch {
			return [];
		}
	}

	private calculateSimilarity(story: Story, storedStory: StoredStory, titleWeight: number = 40, contentWeight: number = 25, entityWeight: number = 35): number {
		const storyTitle = story.title || '';
		const storyContent = story.short_summary || '';
		
		// URL exact match = very high similarity (likely same story)
		if (story.articles?.[0]?.link === storedStory.url) {
			return 95;
		}
		
		// Extract meaningful content for comparison
		const storyEntities = this.extractEntities(storyTitle + ' ' + storyContent);
		const storedEntities = this.extractEntities(storedStory.title + ' ' + storedStory.content);
		
		// Title similarity (weighted higher for news)
		const titleSimilarity = this.calculateAdvancedTextSimilarity(
			storyTitle, 
			storedStory.title
		);

		// Content similarity
		const contentSimilarity = this.calculateAdvancedTextSimilarity(
			storyContent, 
			storedStory.content
		);
		
		// Entity overlap (people, places, organizations)
		const entitySimilarity = this.calculateEntitySimilarity(storyEntities, storedEntities);
		
		// Weighted combination for news content (less strict for localized coverage)
		// Use user-configurable weights, normalized to sum to 1.0
		const totalWeight = titleWeight + contentWeight + entityWeight;
		const combinedSimilarity = (
			titleSimilarity * (titleWeight / totalWeight) +
			contentSimilarity * (contentWeight / totalWeight) +
			entitySimilarity * (entityWeight / totalWeight)
		);

		// Be more permissive - same story can be covered differently across regions/languages
		return Math.min(100, combinedSimilarity);
	}

	private calculateAdvancedTextSimilarity(text1: string, text2: string): number {
		if (!text1 || !text2) return 0;
		
		const normalizedText1 = this.normalizeText(text1);
		const normalizedText2 = this.normalizeText(text2);
		
		// Exact match after normalization
		if (normalizedText1 === normalizedText2) return 100;
		
		// Get significant words (excluding stop words, short words)
		const words1 = this.extractSignificantWords(text1);
		const words2 = this.extractSignificantWords(text2);

		if (words1.length === 0 || words2.length === 0) return 0;

		// Calculate weighted word similarity
		const set1 = new Set(words1);
		const set2 = new Set(words2);
		
		const intersection = new Set([...set1].filter(x => set2.has(x)));
		const union = new Set([...set1, ...set2]);

		// Jaccard similarity as base
		const jaccardSimilarity = intersection.size / union.size;
		
		// Check for important phrase overlaps
		const phraseBonus = this.calculatePhraseOverlap(text1, text2);
		
		// Check for similar word patterns (for paraphrasing)
		const patternBonus = this.calculatePatternSimilarity(words1, words2);
		
		// Combine scores more permissively for international/localized coverage
		let totalSimilarity = jaccardSimilarity * 50; // Reduced base similarity requirement
		totalSimilarity += phraseBonus * 0.35;       // Increased phrase overlap importance  
		totalSimilarity += patternBonus * 0.15;      // Pattern similarity bonus
		
		return Math.min(100, totalSimilarity);
	}



	private extractKeywords(text: string): string[] {
		return this.extractSignificantWords(text);
	}
	
	private extractSignificantWords(text: string): string[] {
		if (!text) return [];
		
		// Expanded stop words for news content
		const stopWords = new Set([
			'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
			'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 
			'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
			'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
			'said', 'says', 'according', 'report', 'reports', 'new', 'news', 'story',
			'article', 'today', 'yesterday', 'now', 'here', 'there', 'when', 'where',
			'how', 'what', 'who', 'why', 'which', 'can', 'may', 'might', 'must',
			'just', 'only', 'also', 'even', 'still', 'more', 'most', 'very', 'much',
			'many', 'some', 'any', 'all', 'both', 'each', 'every', 'about', 'after',
			'before', 'during', 'while', 'until', 'since', 'from', 'into', 'onto',
			'upon', 'over', 'under', 'above', 'below', 'between', 'among', 'through'
		]);

		const words = text
			.toLowerCase()
			.replace(/[^\w\s]/g, ' ') // Remove punctuation
			.split(/\s+/)
			.filter(word => 
				word.length >= 3 &&          // At least 3 characters
				!stopWords.has(word) &&      // Not a stop word
				!/^\d+$/.test(word) &&       // Not just numbers
				!/^(mr|ms|mrs|dr|st|nd|rd|th)$/.test(word) // Not titles/ordinals
			);

		// Prioritize capitalized words (likely proper nouns/names)
		const capitalizedWords = text
			.split(/\s+/)
			.filter(word => /^[A-Z][a-z]+/.test(word) && word.length >= 3)
			.map(word => word.toLowerCase());

		// Combine and deduplicate, prioritizing proper nouns
		const significantWords = [...new Set([...capitalizedWords, ...words])];
		
		return significantWords.slice(0, 30); // Limit to 30 most significant words
	}
	
	private normalizeText(text: string): string {
		return text
			.toLowerCase()
			.replace(/[^\w\s]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}
	
	private extractEntities(text: string): string[] {
		// Simple entity extraction (proper nouns and capitalized words)
		const entityPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
		const entities = text.match(entityPattern) || [];
		
		// Filter out common non-entities
		const commonNonEntities = new Set([
			'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
			'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 
			'September', 'October', 'November', 'December',
			'News', 'Report', 'Story', 'Article', 'Today', 'Yesterday', 'Tomorrow'
		]);
		
		return entities
			.filter(entity => !commonNonEntities.has(entity) && entity.length >= 3)
			.map(entity => entity.toLowerCase())
			.slice(0, 10); // Limit to 10 entities
	}
	
	private calculateEntitySimilarity(entities1: string[], entities2: string[]): number {
		if (entities1.length === 0 || entities2.length === 0) return 0;
		
		const set1 = new Set(entities1);
		const set2 = new Set(entities2);
		
		const intersection = new Set([...set1].filter(x => set2.has(x)));
		const union = new Set([...set1, ...set2]);
		
		return (intersection.size / union.size) * 100;
	}
	
	private calculatePhraseOverlap(text1: string, text2: string): number {
		const phrases1 = this.extractSignificantPhrases(text1);
		const phrases2 = this.extractSignificantPhrases(text2);
		
		if (phrases1.length === 0 || phrases2.length === 0) return 0;
		
		let matchCount = 0;
		for (const phrase1 of phrases1) {
			for (const phrase2 of phrases2) {
				if (phrase1 === phrase2 || this.phrasesAreSimilar(phrase1, phrase2)) {
					matchCount++;
					break;
				}
			}
		}
		
		return (matchCount / Math.max(phrases1.length, phrases2.length)) * 100;
	}
	
	private calculatePatternSimilarity(words1: string[], words2: string[]): number {
		// Check for similar word patterns even if exact words differ
		const getWordPattern = (words: string[]) => words.map(w => w.length).join(',');
		
		const pattern1 = getWordPattern(words1.slice(0, 10));
		const pattern2 = getWordPattern(words2.slice(0, 10));
		
		return pattern1 === pattern2 ? 20 : 0;
	}
	
	private extractSignificantPhrases(text: string): string[] {
		const words = text.toLowerCase().split(/\s+/);
		const phrases: string[] = [];
		
		// Extract 2-4 word phrases that might be significant
		for (let i = 0; i < words.length - 1; i++) {
			for (let len = 2; len <= Math.min(4, words.length - i); len++) {
				const phrase = words.slice(i, i + len).join(' ');
				if (phrase.length >= 8 && this.isSignificantPhrase(phrase)) {
					phrases.push(phrase);
				}
			}
		}
		
		return phrases.slice(0, 10);
	}
	
	private isSignificantPhrase(phrase: string): boolean {
		// Filter out common meaningless phrases
		const meaninglessPhrases = [
			'according to', 'in the', 'of the', 'to the', 'for the', 'at the',
			'on the', 'by the', 'with the', 'from the', 'said that', 'reports that'
		];
		
		return !meaninglessPhrases.some(mp => phrase.includes(mp)) && 
			   phrase.split(' ').some(word => word.length >= 4);
	}
	
	private phrasesAreSimilar(phrase1: string, phrase2: string): boolean {
		const words1 = phrase1.split(' ');
		const words2 = phrase2.split(' ');
		
		if (Math.abs(words1.length - words2.length) > 1) return false;
		
		const commonWords = words1.filter(w => words2.includes(w));
		return commonWords.length >= Math.min(words1.length, words2.length) * 0.7;
	}



	private generateFingerprint(story: Story): string {
		const content = `${story.title || ''}|${story.articles?.[0]?.link || ''}`;
		return this.simpleHash(content);
	}

	private generateId(story: Story): string {
		return story.articles?.[0]?.link || this.simpleHash(`${story.title}${story.articles?.[0]?.date || ''}`);
	}

	private simpleHash(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash).toString(36);
	}
	
	/**
	 * Infer the category of a story based on its content
	 */
	private inferCategory(story: Story | { title: string; short_summary: string; category: string }): string {
		// Use the category if available (most reliable)
		if ('category' in story && story.category) {
			return story.category;
		}
		
		const text = `${story.title} ${story.short_summary || ''}`.toLowerCase();
		
		// Expanded category detection with more keywords for better international coverage
		if (text.includes('politic') || text.includes('election') || text.includes('government') || 
		    text.includes('congress') || text.includes('senate') || text.includes('president') ||
		    text.includes('minister') || text.includes('parliament') || text.includes('party') ||
		    text.includes('vote') || text.includes('campaign') || text.includes('diplomat')) {
			return 'politics';
		}
		if (text.includes('sport') || text.includes('football') || text.includes('basketball') || 
		    text.includes('soccer') || text.includes('baseball') || text.includes('game') ||
		    text.includes('match') || text.includes('championship') || text.includes('team') ||
		    text.includes('player') || text.includes('league') || text.includes('tournament')) {
			return 'sports';
		}
		if (text.includes('technolog') || text.includes('software') || text.includes('tech') || 
		    text.includes('internet') || text.includes('digital') || text.includes('ai') ||
		    text.includes('computer') || text.includes('cyber') || text.includes('data') ||
		    text.includes('startup') || text.includes('app') || text.includes('platform')) {
			return 'technology';
		}
		if (text.includes('business') || text.includes('economy') || text.includes('market') || 
		    text.includes('finance') || text.includes('stock') || text.includes('company') ||
		    text.includes('trade') || text.includes('bank') || text.includes('investment') ||
		    text.includes('corporate') || text.includes('industry') || text.includes('economic')) {
			return 'business';
		}
		if (text.includes('health') || text.includes('medical') || text.includes('doctor') || 
		    text.includes('hospital') || text.includes('disease') || text.includes('medicine') ||
		    text.includes('patient') || text.includes('treatment') || text.includes('vaccine') ||
		    text.includes('virus') || text.includes('pandemic') || text.includes('outbreak')) {
			return 'health';
		}
		if (text.includes('entertainment') || text.includes('movie') || text.includes('music') || 
		    text.includes('celebrity') || text.includes('actor') || text.includes('film') ||
		    text.includes('show') || text.includes('concert') || text.includes('artist') ||
		    text.includes('award') || text.includes('premiere') || text.includes('festival')) {
			return 'entertainment';
		}
		
		return 'general';
	}
}

export const storyStorage = new StoryStorageService(); 