import { SmartContentFilter, type ContentScore } from '$lib/algorithms/contentFilter';

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
    minimumRelevance: number;
    minimumQuality: number;
    minimumSentiment: number;
}

export class SmartFilterService {
    private filter = new SmartContentFilter();
    private defaultPreferences: FilterPreferences = {
        filterPolitics: false,
        filterNegativeNews: false,
        filterLowQuality: true,
        filterViolence: true,
        filterCelebrity: false,
        filterSports: false,
        filterFinancial: false,
        filterEntertainment: false,
        filterTechnology: false,
        filterOpinions: false,
        filterAnxietyInducing: false,
        filterSocialMediaDrama: true,
        filterPromotional: true,
        minimumRelevance: 0.3,
        minimumQuality: 0.2,
        minimumSentiment: 0.2
    };

    /**
     * Filter stories using algorithmic approach instead of keyword lists
     */
    filterStories(stories: any[], preferences: Partial<FilterPreferences> = {}): {
        filtered: any[];
        removed: Array<{ story: any, reasons: string[] }>;
        stats: {
            total: number;
            kept: number;
            removed: number;
            categories: Record<string, number>;
        };
    } {
        const finalPreferences = { ...this.defaultPreferences, ...preferences };
        const filtered: any[] = [];
        const removed: Array<{ story: any, reasons: string[] }> = [];
        const categoryStats: Record<string, number> = {};

        for (const story of stories) {
            const score = this.filter.scoreContent(
                story.title || '',
                story.short_summary || story.description || '',
                story.source_url || ''
            );

            // Apply user preferences
            const finalScore = this.filter.applyUserPreferences(score, {
                filterPolitics: finalPreferences.filterPolitics,
                filterNegativeNews: finalPreferences.filterNegativeNews,
                filterLowQuality: finalPreferences.filterLowQuality,
                minimumRelevance: finalPreferences.minimumRelevance
            });

            // Additional filtering logic
            if (this.shouldFilterStory(finalScore, finalPreferences)) {
                removed.push({
                    story,
                    reasons: finalScore.reasons
                });
            } else {
                filtered.push({
                    ...story,
                    _filterScore: finalScore // Add score for debugging/analytics
                });
            }

            // Track category stats
            categoryStats[finalScore.category] = (categoryStats[finalScore.category] || 0) + 1;
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
    analyzeContent(stories: any[]): {
        averageQuality: number;
        averageRelevance: number;
        averageSentiment: number;
        categoryDistribution: Record<string, number>;
        qualityDistribution: {
            high: number;
            medium: number;
            low: number;
        };
    } {
        if (stories.length === 0) {
            return {
                averageQuality: 0,
                averageRelevance: 0,
                averageSentiment: 0,
                categoryDistribution: {},
                qualityDistribution: { high: 0, medium: 0, low: 0 }
            };
        }

        let totalQuality = 0;
        let totalRelevance = 0;
        let totalSentiment = 0;
        const categoryDistribution: Record<string, number> = {};
        const qualityDistribution = { high: 0, medium: 0, low: 0 };

        for (const story of stories) {
            const score = this.filter.scoreContent(
                story.title || '',
                story.short_summary || story.description || '',
                story.source_url || ''
            );

            totalQuality += score.quality;
            totalRelevance += score.relevance;
            totalSentiment += score.sentiment;

            categoryDistribution[score.category] = (categoryDistribution[score.category] || 0) + 1;

            if (score.quality >= 0.7) qualityDistribution.high++;
            else if (score.quality >= 0.4) qualityDistribution.medium++;
            else qualityDistribution.low++;
        }

        return {
            averageQuality: totalQuality / stories.length,
            averageRelevance: totalRelevance / stories.length,
            averageSentiment: totalSentiment / stories.length,
            categoryDistribution,
            qualityDistribution
        };
    }

    /**
     * Generate filter recommendations based on content analysis
     */
    generateFilterRecommendations(stories: any[]): {
        recommendations: Array<{
            setting: keyof FilterPreferences;
            currentValue: any;
            recommendedValue: any;
            reason: string;
        }>;
        insights: string[];
    } {
        const analysis = this.analyzeContent(stories);
        const recommendations: Array<{
            setting: keyof FilterPreferences;
            currentValue: any;
            recommendedValue: any;
            reason: string;
        }> = [];
        const insights: string[] = [];

        // Analyze quality distribution
        if (analysis.qualityDistribution.low > analysis.qualityDistribution.high) {
            recommendations.push({
                setting: 'minimumQuality',
                currentValue: this.defaultPreferences.minimumQuality,
                recommendedValue: 0.4,
                reason: 'High amount of low-quality content detected'
            });
            insights.push('Consider raising quality standards to filter out low-quality content');
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

        // Check minimum thresholds
        if (score.quality < preferences.minimumQuality) return true;
        if (score.relevance < preferences.minimumRelevance) return true;
        if (score.sentiment < preferences.minimumSentiment) return true;

        return false;
    }

    /**
     * Get filter statistics for analytics
     */
    getFilterStats(stories: any[], preferences: Partial<FilterPreferences> = {}): {
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
        result.removed.forEach(item => {
            item.reasons.forEach(reason => {
                reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
            });
        });

        // Category breakdown
        stories.forEach(story => {
            const score = this.filter.scoreContent(
                story.title || '',
                story.short_summary || '',
                story.source_url || ''
            );

            if (!categoryBreakdown[score.category]) {
                categoryBreakdown[score.category] = { total: 0, filtered: 0 };
            }
            categoryBreakdown[score.category].total++;
        });

        result.removed.forEach(item => {
            const score = this.filter.scoreContent(
                item.story.title || '',
                item.story.short_summary || '',
                item.story.source_url || ''
            );
            if (categoryBreakdown[score.category]) {
                categoryBreakdown[score.category].filtered++;
            }
        });

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