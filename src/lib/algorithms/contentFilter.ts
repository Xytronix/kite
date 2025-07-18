export interface ContentScore {
	relevance: number;
	quality: number;
	sentiment: number;
	category: string;
	shouldFilter: boolean;
	reasons: string[];
}

export class SmartContentFilter {
	private toxicPatterns = [
		/\b(kill|murder|death|suicide|shooting|bomb|terror|attack)\b/i,
		/\b(hate|racist|nazi|genocide|massacre)\b/i
	];

	private lowQualityPatterns = [
		/\b(click here|amazing|shocking|you won't believe|won't believe)\b/i,
		/\b(celebrities?|gossip|scandal|drama)\b/i,
		/\$\d+|\d+%\s*(off|discount)/i, // Promotional content
		/\b(this.*trick|doctors hate|one weird trick)\b/i,
		/\b(blow your mind|will amaze you)\b/i
	];

	private politicalPatterns = [
		/\b(trump|biden|election|democrat|republican|congress|senate)\b/i,
		/\b(minister|government|politician|parliament|policy)\b/i
	];

	/**
	 * Score content using multiple algorithms
	 */
	scoreContent(title: string, content: string, source: string): ContentScore {
		const text = `${title} ${content}`.toLowerCase();
		
		const relevanceScore = this.calculateRelevance(text);
		const qualityScore = this.calculateQuality(text, source);
		const sentimentScore = this.calculateSentiment(text);
		const category = this.categorizeContent(text);
		
		const shouldFilter = this.shouldFilterContent(relevanceScore, qualityScore, sentimentScore);
		const reasons = this.getFilterReasons(text, relevanceScore, qualityScore, sentimentScore);

		return {
			relevance: relevanceScore,
			quality: qualityScore,
			sentiment: sentimentScore,
			category,
			shouldFilter,
			reasons
		};
	}

	/**
	 * Calculate relevance based on information density and uniqueness
	 */
	private calculateRelevance(text: string): number {
		let score = 0.5; // Base score
		
		// Information density (unique words vs total words)
		const words = text.split(/\s+/);
		const uniqueWords = new Set(words);
		const densityRatio = uniqueWords.size / words.length;
		score += densityRatio * 0.3;
		
		// Presence of specific information (numbers, dates, names)
		const hasNumbers = /\d+/.test(text);
		const hasProperNouns = /\b[A-Z][a-z]+/.test(text);
		const hasSpecificTerms = /\b(announced|reported|confirmed|according to)\b/.test(text);
		
		if (hasNumbers) score += 0.1;
		if (hasProperNouns) score += 0.1;
		if (hasSpecificTerms) score += 0.1;
		
		// Penalize clickbait patterns
		if (this.lowQualityPatterns.some(pattern => pattern.test(text))) {
			score -= 0.3;
		}
		
		return Math.max(0, Math.min(1, score));
	}

	/**
	 * Calculate quality based on source credibility and content structure
	 */
	private calculateQuality(text: string, source: string): number {
		let score = 0.5; // Base score
		
		// Source credibility (simple heuristic)
		const trustedDomains = ['reuters.com', 'ap.org', 'bbc.com', 'npr.org'];
		const tabloidDomains = ['dailymail.co.uk', 'tmz.com', 'pagesix.com'];
		
		if (trustedDomains.some(domain => source.includes(domain))) {
			score += 0.3;
		} else if (tabloidDomains.some(domain => source.includes(domain))) {
			score -= 0.3;
		}
		
		// Content structure quality
		const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
		const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
		
		// Optimal sentence length is around 15-25 words
		if (avgSentenceLength > 50 && avgSentenceLength < 200) {
			score += 0.1;
		}
		
		// Check for proper grammar indicators
		const hasProperCapitalization = /^[A-Z]/.test(text.trim());
		const hasProperPunctuation = /[.!?]$/.test(text.trim());
		
		if (hasProperCapitalization) score += 0.05;
		if (hasProperPunctuation) score += 0.05;
		
		return Math.max(0, Math.min(1, score));
	}

	/**
	 * Calculate sentiment to filter overly negative content
	 */
	private calculateSentiment(text: string): number {
		const positiveWords = ['good', 'great', 'excellent', 'positive', 'success', 'win', 'improve', 'growth'];
		const negativeWords = ['bad', 'terrible', 'awful', 'negative', 'fail', 'lose', 'decline', 'crisis'];
		const veryNegativeWords = ['death', 'kill', 'murder', 'disaster', 'catastrophe', 'tragedy'];
		
		let score = 0.5; // Neutral
		
		const words = text.toLowerCase().split(/\s+/);
		
		words.forEach(word => {
			if (positiveWords.includes(word)) score += 0.02;
			if (negativeWords.includes(word)) score -= 0.02;
			if (veryNegativeWords.includes(word)) score -= 0.05;
		});
		
		// Check for toxic patterns
		if (this.toxicPatterns.some(pattern => pattern.test(text))) {
			score -= 0.3;
		}
		
		return Math.max(0, Math.min(1, score));
	}

	/**
	 * Categorize content automatically
	 */
	private categorizeContent(text: string): string {
		const categories = {
			politics: this.politicalPatterns,
			technology: [/\b(ai|tech|digital|cyber|software|app|internet)\b/i],
			business: [/\b(company|business|market|stock|economy|finance)\b/i],
			health: [/\b(health|medical|doctor|hospital|disease|vaccine)\b/i],
			sports: [/\b(sport|game|team|player|match|championship)\b/i],
			science: [/\b(research|study|scientist|discovery|experiment)\b/i]
		};
		
		for (const [category, patterns] of Object.entries(categories)) {
			if (patterns.some(pattern => pattern.test(text))) {
				return category;
			}
		}
		
		return 'general';
	}

	/**
	 * Determine if content should be filtered
	 */
	private shouldFilterContent(relevance: number, quality: number, sentiment: number): boolean {
		// Filter if any score is too low
		if (relevance < 0.4 || quality < 0.3 || sentiment < 0.3) {
			return true;
		}
		
		// Filter if overall score is too low
		const overallScore = (relevance + quality + sentiment) / 3;
		return overallScore < 0.5;
	}

	/**
	 * Get reasons for filtering
	 */
	private getFilterReasons(text: string, relevance: number, quality: number, sentiment: number): string[] {
		const reasons: string[] = [];
		
		if (relevance < 0.3) reasons.push('Low information value');
		if (quality < 0.2) reasons.push('Poor content quality');
		if (sentiment < 0.2) reasons.push('Overly negative content');
		
		if (this.lowQualityPatterns.some(pattern => pattern.test(text))) {
			reasons.push('Clickbait detected');
		}
		
		if (this.toxicPatterns.some(pattern => pattern.test(text))) {
			reasons.push('Toxic content detected');
		}
		
		return reasons;
	}

	/**
	 * Get user preferences for filtering
	 */
	applyUserPreferences(score: ContentScore, userPreferences: {
		filterPolitics?: boolean;
		filterNegativeNews?: boolean;
		filterLowQuality?: boolean;
		minimumRelevance?: number;
	}): ContentScore {
		const newScore = { ...score };
		
		if (userPreferences.filterPolitics && score.category === 'politics') {
			newScore.shouldFilter = true;
			newScore.reasons.push('Politics filtered by user preference');
		}
		
		if (userPreferences.filterNegativeNews && score.sentiment < 0.4) {
			newScore.shouldFilter = true;
			newScore.reasons.push('Negative news filtered by user preference');
		}
		
		if (userPreferences.filterLowQuality && score.quality < 0.5) {
			newScore.shouldFilter = true;
			newScore.reasons.push('Low quality filtered by user preference');
		}
		
		if (userPreferences.minimumRelevance && score.relevance < userPreferences.minimumRelevance) {
			newScore.shouldFilter = true;
			newScore.reasons.push('Below minimum relevance threshold');
		}
		
		return newScore;
	}
}