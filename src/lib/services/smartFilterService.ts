import { SmartContentFilter, type ContentScore } from '$lib/algorithms/contentFilter';
import { storyStorage } from '$lib/services/storyStorage';
import type { Story } from '$lib/types';

// Type for stories that have been through the filter
export type FilteredStory = Story & {
    _filterScore?: ContentScore;
};

export interface FilterPreferences {
    filterPolitics: boolean;
    filterNegativeNews: boolean;
    filterLowQuality: boolean;
    filterViolence: boolean;
    filterCelebrity: boolean;
    filterSports: boolean;
    filterFinancial: boolean;
    filterEntertainment: boolean;
    filterTechnology: boolean;
    filterOpinions: boolean;
    filterAnxietyInducing: boolean;
    filterSocialMediaDrama: boolean;
    filterPromotional: boolean;
    filterBreakingNews: boolean;
	filterWeather: boolean;
	filterLocalNews: boolean;
	filterInternationalNews: boolean;
	filterEconomicPessimism: boolean;
	filterRepetitive: boolean;
	filterContentSimilarity: boolean;
	contentSimilarityMode: 'today' | 'historical';
	contentSimilarityExpiry: number; // days
	contentSimilarityThreshold: number; // 0-100, higher = stricter
	contentSimilarityScope: 'within-category' | 'across-categories'; // How similarity detection works
	// Similarity algorithm weightings (must sum to 100)
	similarityTitleWeight: number; // Default: 40
	similarityContentWeight: number; // Default: 25  
	similarityEntityWeight: number; // Default: 35
	// Filter sensitivity setting
	filterSensitivity: 'strict' | 'balanced' | 'loose'; // Default: balanced
	// Optional per-category sensitivity overrides
	categoryOverrides?: {
		politics?: 'strict' | 'balanced' | 'loose' | number;
		celebrity?: 'strict' | 'balanced' | 'loose' | number;
		sports?: 'strict' | 'balanced' | 'loose' | number;
		financial?: 'strict' | 'balanced' | 'loose' | number;
		technology?: 'strict' | 'balanced' | 'loose' | number;
		entertainment?: 'strict' | 'balanced' | 'loose' | number;
		socialMediaDrama?: 'strict' | 'balanced' | 'loose' | number;
	};
	// Global filtering weights (0-100%)
	globalTitleImportance: number; // How much to weight title keyword matches
	globalContentImportance: number; // How much to weight article body content
	globalContextEvidence: number; // How much to weight surrounding context
	// Per-category weight overrides
	categoryWeightOverrides?: {
		[category: string]: {
			titleImportance?: number;
			contentImportance?: number;
			contextEvidence?: number;
		};
	};
    minimumRelevance: number;
    minimumQuality: number;
    minimumSentiment: number;
}

export class SmartFilterService {
    private filter = new SmartContentFilter();

    private readonly defaultPreferences: FilterPreferences = {
        filterPolitics: false,
        filterNegativeNews: false,
        filterLowQuality: false,
        filterViolence: false,
        filterCelebrity: false,
        filterSports: false,
        filterFinancial: false,
        filterEntertainment: false,
        filterTechnology: false,
        filterOpinions: false,
        filterAnxietyInducing: false,
        filterSocialMediaDrama: false,
        filterPromotional: false,
        filterBreakingNews: false,
        filterWeather: false,
        filterLocalNews: false,
        filterInternationalNews: false,
        filterEconomicPessimism: false,
        filterRepetitive: false,
        filterContentSimilarity: false,
        contentSimilarityMode: 'today',
        contentSimilarityExpiry: 3, // 3 days default
        contentSimilarityThreshold: 70, // 70% similarity threshold
        contentSimilarityScope: 'within-category', // Default: within categories only
        similarityTitleWeight: 40, // 40% weight for title similarity
        similarityContentWeight: 25, // 25% weight for content similarity
        similarityEntityWeight: 35, // 35% weight for entity similarity
        filterSensitivity: 'balanced', // Default filter sensitivity
        globalTitleImportance: 60, // 60% weight for title matches
        globalContentImportance: 25, // 25% weight for content body
        globalContextEvidence: 15, // 15% weight for surrounding context
        categoryWeightOverrides: undefined,
        minimumRelevance: 0,
        minimumQuality: 0,
        minimumSentiment: 0
    };

    /**
     * Filter stories using algorithmic approach instead of keyword lists
     */
    filterStories(stories: Story[], preferences: Partial<FilterPreferences> = {}): {
        filtered: FilteredStory[];
        removed: Array<{ story: Story, reasons: string[] }>;
        stats: {
            total: number;
            kept: number;
            removed: number;
            categories: Record<string, number>;
        };
    } {
        const finalPreferences = { ...this.defaultPreferences, ...preferences };
        const filtered: FilteredStory[] = [];
        const removed: Array<{ story: Story, reasons: string[] }> = [];
        const categoryStats: Record<string, number> = {};

        for (const story of stories) {
            // Use the correct Story properties
            const sourceUrl = story.articles?.[0]?.link || '';
            const title = story.title || '';
            const content = story.short_summary || '';
            
            // Get AI-based score
            const score = this.filter.scoreContent(title, content, sourceUrl);

            // Apply user preferences for content filtering
            const finalScore = this.filter.applyUserPreferences(score, finalPreferences);
            
            // Check pattern-based filters
            const patternCheck = this.filter.checkContentFilters(title, content, finalPreferences);
            
            // Check content similarity if enabled, threshold > 0, and at least one weight > 0
            let similarityCheck = { isSimilar: false, similarity: 0, reason: undefined as string | undefined };
            const hasValidWeights = finalPreferences.similarityTitleWeight > 0 || 
                                  finalPreferences.similarityContentWeight > 0 || 
                                  finalPreferences.similarityEntityWeight > 0;
            
            if (finalPreferences.filterContentSimilarity && 
                finalPreferences.contentSimilarityThreshold > 0 && 
                hasValidWeights) {
                try {
                    const result = storyStorage.checkSimilarity(
                        story,
                        finalPreferences.contentSimilarityMode,
                        finalPreferences.contentSimilarityExpiry,
                        finalPreferences.contentSimilarityThreshold,
                        finalPreferences.contentSimilarityScope,
                        finalPreferences.similarityTitleWeight,
                        finalPreferences.similarityContentWeight,
                        finalPreferences.similarityEntityWeight
                    );
                    similarityCheck = {
                        isSimilar: result.isSimilar,
                        similarity: result.similarity,
                        reason: result.reason
                    };
                } catch (error) {
                    console.warn('Similarity check failed, skipping:', error);
                    // If similarity check fails, don't filter the story
                    similarityCheck = { isSimilar: false, similarity: 0, reason: undefined };
                }
            }
            
            // Combine reasons from AI, pattern-based, and similarity filtering
            const allReasons = [...finalScore.reasons, ...patternCheck.reasons];
            if (similarityCheck.isSimilar && similarityCheck.reason) {
                allReasons.push(`Similar content: ${similarityCheck.reason}`);
            }
            
            // Story should be filtered if any method says so
            const shouldFilterStory = finalScore.shouldFilter || 
                patternCheck.shouldFilter || 
                similarityCheck.isSimilar ||
                this.shouldFilterStory(finalScore, finalPreferences);

            if (shouldFilterStory) {
                removed.push({
                    story,
                    reasons: allReasons
                });
            } else {
                filtered.push({
                    ...story,
                    _filterScore: finalScore // Add score for debugging/analytics
                });
                
                // Store story for future similarity checking (only if it passed filtering and similarity is fully enabled)
                if (finalPreferences.filterContentSimilarity && 
                    finalPreferences.contentSimilarityThreshold > 0 && 
                    hasValidWeights) {
                    storyStorage.storeStory(story);
                }
            }

            // Track category stats
            categoryStats[finalScore.category] = (categoryStats[finalScore.category] || 0) + 1;
        }

        // Periodically cleanup expired stories (every ~10th call) - only if content similarity is fully enabled
        const hasValidWeights = finalPreferences.similarityTitleWeight > 0 || 
                              finalPreferences.similarityContentWeight > 0 || 
                              finalPreferences.similarityEntityWeight > 0;
        if (finalPreferences.filterContentSimilarity && 
            finalPreferences.contentSimilarityThreshold > 0 && 
            hasValidWeights && 
            Math.random() < 0.1) {
            storyStorage.cleanupExpiredStories(30); // Clean up stories older than 30 days
        }

        return {
            filtered,
            removed,
            stats: {
                total: stories.length,
                kept: filtered.length,
                removed: removed.length,
                categories: categoryStats
            }
        };
    }

    /**
     * Get content quality insights
     */
    analyzeContent(stories: Story[]): {
        averageQuality: number;
        averageRelevance: number;
        averageSentiment: number;
        totalStories: number;
        categoryDistribution: Record<string, number>;
    } {
        if (stories.length === 0) {
            return {
                averageQuality: 0,
                averageRelevance: 0,
                averageSentiment: 0,
                totalStories: 0,
                categoryDistribution: {}
            };
        }

        let totalQuality = 0;
        let totalRelevance = 0;
        let totalSentiment = 0;
        const categoryDistribution: Record<string, number> = {};

        for (const story of stories) {
            const sourceUrl = story.articles?.[0]?.link || '';
            const score = this.filter.scoreContent(
                story.title || '',
                story.short_summary || '',
                sourceUrl
            );

            totalQuality += score.quality;
            totalRelevance += score.relevance;
            totalSentiment += score.sentiment;

            categoryDistribution[score.category] = (categoryDistribution[score.category] || 0) + 1;
        }

        return {
            averageQuality: totalQuality / stories.length,
            averageRelevance: totalRelevance / stories.length,
            averageSentiment: totalSentiment / stories.length,
            totalStories: stories.length,
            categoryDistribution
        };
    }

    /**
     * Generate filter recommendations based on content analysis
     */
    generateFilterRecommendations(stories: Story[]): {
        recommendations: Array<{
            setting: keyof FilterPreferences;
            currentValue: boolean | number;
            recommendedValue: boolean | number;
            reason: string;
        }>;
        insights: string[];
    } {
        const analysis = this.analyzeContent(stories);
        const recommendations: Array<{
            setting: keyof FilterPreferences;
            currentValue: boolean | number;
            recommendedValue: boolean | number;
            reason: string;
        }> = [];
        const insights: string[] = [];

        // Analyze quality distribution - use averageQuality instead
        if (analysis.averageQuality < 0.5) {
            recommendations.push({
                setting: 'minimumQuality',
                currentValue: this.defaultPreferences.minimumQuality,
                recommendedValue: 0.4,
                reason: 'Low average quality content detected'
            });
        }

        // Analyze sentiment
        if (analysis.averageSentiment < 0.3) {
            recommendations.push({
                setting: 'filterNegativeNews',
                currentValue: this.defaultPreferences.filterNegativeNews,
                recommendedValue: true,
                reason: 'Content appears to be predominantly negative'
            });
            insights.push('Content feed is quite negative - consider filtering negative news for better experience');
        }

        // Analyze category distribution
        const politicsRatio = (analysis.categoryDistribution.politics || 0) / stories.length;
        if (politicsRatio > 0.4) {
            recommendations.push({
                setting: 'filterPolitics',
                currentValue: this.defaultPreferences.filterPolitics,
                recommendedValue: true,
                reason: 'High concentration of political content'
            });
            insights.push('Political content dominates your feed - consider filtering if you prefer diverse topics');
        }

        return { recommendations, insights };
    }

    private shouldFilterStory(score: ContentScore, preferences: FilterPreferences): boolean {
        // Check if already marked for filtering
        if (score.shouldFilter) return true;

        // Apply additional preference-based filtering
        if (preferences.filterViolence && score.sentiment < 0.2) return true;
        if (preferences.filterCelebrity && score.category === 'celebrity') return true;

        // Threshold checks are only active when the related preference is enabled
        if (preferences.filterLowQuality && score.quality < preferences.minimumQuality) return true;
        if (preferences.filterNegativeNews && score.sentiment < preferences.minimumSentiment) return true;

        // Relevance filtering is considered an advanced threshold – it only runs if the user explicitly sets it above 0.
        if (preferences.minimumRelevance > 0 && score.relevance < preferences.minimumRelevance) return true;

        return false;
    }

    /**
     * Get filter statistics for analytics
     */
    getFilterStats(stories: Story[], preferences: Partial<FilterPreferences> = {}): {
        totalProcessed: number;
        filtered: number;
        filterRate: number;
        topFilterReasons: Array<{ reason: string, count: number }>;
        categoryBreakdown: Record<string, { total: number, filtered: number }>;
    } {
        const result = this.filterStories(stories, preferences);
        const reasonCounts = new Map<string, number>();
        const categoryBreakdown: Record<string, { total: number, filtered: number }> = {};

        // Count filter reasons
        for (const item of result.removed) {
            for (const reason of item.reasons) {
                reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
            }
        }

        // Category breakdown
        for (const story of stories) {
            const sourceUrl = story.articles?.[0]?.link || '';
            const score = this.filter.scoreContent(
                story.title || '',
                story.short_summary || '',
                sourceUrl
            );

            if (!categoryBreakdown[score.category]) {
                categoryBreakdown[score.category] = { total: 0, filtered: 0 };
            }
            categoryBreakdown[score.category].total++;
        }

        for (const item of result.removed) {
            const sourceUrl = item.story.articles?.[0]?.link || '';
            const score = this.filter.scoreContent(
                item.story.title || '',
                item.story.short_summary || '',
                sourceUrl
            );
            if (categoryBreakdown[score.category]) {
                categoryBreakdown[score.category].filtered++;
            }
        }

        const topFilterReasons = Array.from(reasonCounts.entries())
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return {
            totalProcessed: stories.length,
            filtered: result.removed.length,
            filterRate: stories.length > 0 ? result.removed.length / stories.length : 0,
            topFilterReasons,
            categoryBreakdown
        };
    }
}