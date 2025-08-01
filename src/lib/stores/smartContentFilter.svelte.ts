import { browser } from '$app/environment';
import { SmartFilterService, type FilterPreferences } from '$lib/services/smartFilterService';
import type { Story } from '$lib/types';

interface SmartFilterStats {
	totalProcessed: number;
	filtered: number;
	filterRate: number;
	topFilterReasons: Array<{reason: string, count: number}>;
	categoryBreakdown: Record<string, {total: number, filtered: number}>;
}

class SmartContentFilterStore {
	// Reactive state properties
	preferences = $state<FilterPreferences>({
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
    });
	
	isEnabled = $state<boolean>(false); // Disabled by default - no filters
	filterMode = $state<'hide' | 'blur'>('hide');
	filterScope = $state<'title' | 'summary' | 'all'>('all'); // Added filter scope like contentFilter
	showFilteredCount = $state<boolean>(true);
	customKeywords = $state<string[]>([]); // Added custom keywords like contentFilter
	stats = $state<SmartFilterStats | null>(null);
	isLoading = $state<boolean>(false);
	error = $state<string | null>(null);

	private readonly STORAGE_KEY = 'kite-smart-content-filter';
	private readonly CONFIG_VERSION = 1;
	private filterService = new SmartFilterService();
	private _lastStatsHash = '';
	


	constructor() {
		if (browser) {
			this.loadFromStorage();
		}
	}

	private loadFromStorage() {
		try {
			const stored = localStorage.getItem(this.STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				if (parsed.preferences) {
					this.preferences = { ...this.preferences, ...parsed.preferences };
				}
				if (typeof parsed.isEnabled === 'boolean') {
					this.isEnabled = parsed.isEnabled;
				}
				if (parsed.filterMode === 'hide' || parsed.filterMode === 'blur') {
					this.filterMode = parsed.filterMode;
				}
				if (parsed.filterScope === 'title' || parsed.filterScope === 'summary' || parsed.filterScope === 'all') {
					this.filterScope = parsed.filterScope;
				}
				if (typeof parsed.showFilteredCount === 'boolean') {
					this.showFilteredCount = parsed.showFilteredCount;
				}
				if (Array.isArray(parsed.customKeywords)) {
					this.customKeywords = parsed.customKeywords;
				}
				if (parsed.preferences?.filterSensitivity === 'strict' || parsed.preferences?.filterSensitivity === 'balanced' || parsed.preferences?.filterSensitivity === 'loose') {
					this.preferences.filterSensitivity = parsed.preferences.filterSensitivity;
				}
			}
		} catch (error) {
			console.error('Failed to load smart filter settings:', error);
			this.error = 'Failed to load settings';
		}
	}

	private saveToStorage() {
		if (!browser) return;
		try {
			const config = {
				preferences: this.preferences,
				isEnabled: this.isEnabled,
				filterMode: this.filterMode,
				filterScope: this.filterScope,
				showFilteredCount: this.showFilteredCount,
				customKeywords: this.customKeywords,
				version: this.CONFIG_VERSION
			};
			localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
		} catch (error) {
			console.error('Failed to save smart filter settings:', error);
			this.error = 'Failed to save settings';
		}
	}

	// Toggle the smart filter system on/off
	toggleEnabled() {
		this.isEnabled = !this.isEnabled;
		this.saveToStorage();
	}

	// Set filter mode
	setFilterMode(mode: 'hide' | 'blur') {
		this.filterMode = mode;
		this.saveToStorage();
	}

	// Set show filtered count
	setShowFilteredCount(show: boolean) {
		this.showFilteredCount = show;
		this.saveToStorage();
	}

	// Set filter scope
	setFilterScope(scope: 'title' | 'summary' | 'all') {
		this.filterScope = scope;
		this.saveToStorage();
	}

	// Set filter sensitivity
	setFilterSensitivity(sensitivity: 'strict' | 'balanced' | 'loose') {
		this.preferences.filterSensitivity = sensitivity;
		this.saveToStorage();
	}
	
	// Update category override (simplified without personality detection)
	updateCategoryOverride(category: string, value: 'strict' | 'balanced' | 'loose' | number | undefined) {
		if (!this.preferences.categoryOverrides) {
			this.preferences.categoryOverrides = {};
		}
		
		if (value === undefined) {
			delete this.preferences.categoryOverrides[category];
			if (Object.keys(this.preferences.categoryOverrides).length === 0) {
				this.preferences.categoryOverrides = undefined;
			}
		} else {
			this.preferences.categoryOverrides[category] = value;
		}
		
		this.saveToStorage();
	}

	// Add custom keyword
	addCustomKeyword(keyword: string) {
		const normalized = keyword.toLowerCase().trim();
		if (normalized && !this.customKeywords.includes(normalized)) {
			this.customKeywords = [...this.customKeywords, normalized];
			this.saveToStorage();
		}
	}

	// Remove custom keyword
	removeCustomKeyword(keyword: string) {
		this.customKeywords = this.customKeywords.filter(k => k !== keyword.toLowerCase());
		this.saveToStorage();
	}

	// Set content similarity mode
	setContentSimilarityMode(mode: 'today' | 'historical') {
		this.preferences.contentSimilarityMode = mode;
		this.saveToStorage();
	}

	// Set content similarity expiry
	setContentSimilarityExpiry(days: number) {
		this.preferences.contentSimilarityExpiry = Math.max(1, Math.min(30, days)); // 1-30 days
		this.saveToStorage();
	}

	// Set content similarity threshold
	setContentSimilarityThreshold(threshold: number) {
		this.preferences.contentSimilarityThreshold = Math.max(0, Math.min(100, threshold)); // 0-100%
		this.saveToStorage();
	}

	// Set content similarity scope
	setContentSimilarityScope(scope: 'within-category' | 'across-categories') {
		this.preferences.contentSimilarityScope = scope;
		this.saveToStorage();
	}

	// Set similarity weights (no normalization needed - algorithm handles it automatically)
	setSimilarityWeights(titleWeight: number, contentWeight: number, entityWeight: number) {
		// Ensure no negative values
		this.preferences.similarityTitleWeight = Math.max(0, titleWeight);
		this.preferences.similarityContentWeight = Math.max(0, contentWeight);
		this.preferences.similarityEntityWeight = Math.max(0, entityWeight);
		
		// If all weights are zero, reset to defaults
		if (titleWeight === 0 && contentWeight === 0 && entityWeight === 0) {
			this.preferences.similarityTitleWeight = 40;
			this.preferences.similarityContentWeight = 25;
			this.preferences.similarityEntityWeight = 35;
		}
		
		this.saveToStorage();
	}

	// Clear custom keywords
	clearCustomKeywords() {
		this.customKeywords = [];
		this.saveToStorage();
	}

	// Update a specific preference
	updatePreference<K extends keyof FilterPreferences>(key: K, value: FilterPreferences[K]) {
		this.preferences = {
			...this.preferences,
			[key]: value
		};
		this.saveToStorage();
	}

	// Toggle boolean preferences
	togglePreference(key: keyof FilterPreferences) {
		const currentValue = this.preferences[key];
		if (typeof currentValue === 'boolean') {
			this.updatePreference(key, !currentValue as boolean);
		}
	}

	// Filter stories using the smart algorithm
	filterStories(stories: Story[]) {
		if (!this.isEnabled) {
			return {
				filtered: stories,
				removed: [],
				stats: {
					total: stories.length,
					kept: stories.length,
					removed: 0,
					categories: {}
				}
			};
		}

		// Avoid mutating reactive state inside this synchronous method to prevent potential
		// update-loops when called from within reactive effects. `isLoading` can still be
		// managed by the consumer if needed.
		this.error = null;

		try {
			const result = this.filterService.filterStories(stories, this.preferences);
			
			// Update statistics
			this.updateStats(result);
			
			return result;
		} catch (error) {
			console.error('Error filtering stories:', error);
			this.error = error instanceof Error ? error.message : 'Unknown error occurred';
			
			// Return unfiltered stories on error
			return {
				filtered: stories,
				removed: [],
				stats: {
					total: stories.length,
					kept: stories.length,
					removed: 0,
					categories: {}
				}
			};
		} finally {
			/* no-op */
		}
	}

	// Analyze content quality and provide insights
	analyzeContent(stories: Story[]) {
		return this.filterService.analyzeContent(stories);
	}

	// Get personalized filter recommendations
	getRecommendations(stories: Story[]) {
		return this.filterService.generateFilterRecommendations(stories);
	}

	// Check if a single piece of content should be filtered
	shouldFilterContent(title: string, content: string, sourceUrl = ''): boolean {
		if (!this.isEnabled) return false;
		
		const result = this.filterService.filterStories([
			{
				cluster_number: 0,
				category: 'misc',
				title,
				short_summary: content,
				articles: [
					{
						title: '',
						link: sourceUrl,
						domain: '',
						date: new Date().toISOString()
					}
				]
			}
		], this.preferences);
		
		return result.removed.length > 0;
	}

	// Get detailed filter stats for analytics
	getDetailedStats(stories: Story[]) {
		return this.filterService.getFilterStats(stories, this.preferences);
	}

	    // Reset just preferences to defaults (for preset deactivation)
    resetPreferences() {
        this.preferences = {
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
            contentSimilarityExpiry: 3,
            contentSimilarityThreshold: 70,
            contentSimilarityScope: 'within-category',
            similarityTitleWeight: 40,
            similarityContentWeight: 25,
            similarityEntityWeight: 35,
            filterSensitivity: 'balanced',
            globalTitleImportance: 60,
            globalContentImportance: 25,
            globalContextEvidence: 15,
            categoryWeightOverrides: undefined,
            minimumRelevance: 0,
            minimumQuality: 0,
            minimumSentiment: 0
        };
        this.saveToStorage();
    }

	    // Reset all settings to defaults (full reset)
    reset() {
        this.preferences = {
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
            contentSimilarityExpiry: 3,
            contentSimilarityThreshold: 70,
            contentSimilarityScope: 'within-category',
            similarityTitleWeight: 40,
            similarityContentWeight: 25,
            similarityEntityWeight: 35,
            filterSensitivity: 'balanced',
            globalTitleImportance: 60,
            globalContentImportance: 25,
            globalContextEvidence: 15,
            categoryWeightOverrides: undefined,
            minimumRelevance: 0,
            minimumQuality: 0,
            minimumSentiment: 0
        };
        this.isEnabled = false;
        this.filterMode = 'hide';
        this.filterScope = 'all';
        this.showFilteredCount = true;
        this.customKeywords = [];
        this.stats = null;
        this.error = null;
        this.saveToStorage();
    }

	// Export configuration
	exportConfig(): string {
		const config = {
			_comment: "Kite News Smart Content Filter Settings",
			_description: "AI-powered content filtering preferences",
			preferences: this.preferences,
			isEnabled: this.isEnabled,
			filterMode: this.filterMode,
			filterScope: this.filterScope,
			showFilteredCount: this.showFilteredCount,
			customKeywords: this.customKeywords,
			filterSensitivity: this.preferences.filterSensitivity,
			version: this.CONFIG_VERSION,
			exportDate: new Date().toISOString()
		};
		return JSON.stringify(config, null, 2);
	}

	// Import configuration
	importConfig(jsonString: string): { success: boolean; warningKey?: string; errorKey?: string } {
		try {
			const config = JSON.parse(jsonString);
			
			if (!config || typeof config !== 'object') {
				return { success: false, errorKey: 'Invalid configuration format' };
			}

			// Import preferences
			if (config.preferences && typeof config.preferences === 'object') {
				this.preferences = { ...this.preferences, ...config.preferences };
			}
			
			if (typeof config.isEnabled === 'boolean') {
				this.isEnabled = config.isEnabled;
			}

			if (config.filterMode === 'hide' || config.filterMode === 'blur') {
				this.filterMode = config.filterMode;
			}

			if (config.filterScope === 'title' || config.filterScope === 'summary' || config.filterScope === 'all') {
				this.filterScope = config.filterScope;
			}

			if (typeof config.showFilteredCount === 'boolean') {
				this.showFilteredCount = config.showFilteredCount;
			}

			if (Array.isArray(config.customKeywords)) {
				this.customKeywords = config.customKeywords;
			}

			if (config.filterSensitivity === 'strict' || config.filterSensitivity === 'balanced' || config.filterSensitivity === 'loose') {
				this.preferences.filterSensitivity = config.filterSensitivity;
			}

			this.saveToStorage();
			return { success: true };

		} catch (error) {
			return { success: false, errorKey: 'Failed to parse configuration' };
		}
	}

	// Get current filter summary for UI display
	get filterSummary() {
		const activeFilters: string[] = [];
		
		if (this.preferences.filterPolitics) activeFilters.push('Politics');
		if (this.preferences.filterNegativeNews) activeFilters.push('Negative News');
		if (this.preferences.filterLowQuality) activeFilters.push('Low Quality');
		if (this.preferences.filterViolence) activeFilters.push('Violence');
		if (this.preferences.filterCelebrity) activeFilters.push('Celebrity');
		
		return {
			isActive: this.isEnabled && activeFilters.length > 0,
			activeFilters,
			thresholds: {
				relevance: this.preferences.minimumRelevance,
				quality: this.preferences.minimumQuality,
				sentiment: this.preferences.minimumSentiment
			}
		};
	}

	// Get quality insights for a set of stories
	getQualityInsights(stories: Story[]) {
		if (stories.length === 0) {
			return null;
		}

		try {
			const analysis = this.filterService.analyzeContent(stories);
			const recommendations = this.filterService.generateFilterRecommendations(stories);
			
			return {
				analysis,
				recommendations,
				summary: `Analyzed ${analysis.totalStories} stories with average quality of ${(analysis.averageQuality * 100).toFixed(1)}%`
			};
		} catch (error) {
			console.error('Error analyzing content quality:', error);
			return null;
		}
	}

	// Test filter with sample content
	testFilter() {
		const sampleStories: Story[] = [{
			cluster_number: 1,
			category: 'test',
			title: 'Test Story',
			short_summary: 'This is a test story for filter validation',
			articles: []
		}];

		const result = this.filterService.filterStories(sampleStories, this.preferences);
		
		console.log('Filter test result:', {
			input: sampleStories,
			output: result,
			preferences: this.preferences
		});
		
		return result;
	}

	private updateStats(result: ReturnType<SmartFilterService['filterStories']>) {
		const reasonCounts = new Map<string, number>();
		
		for (const item of result.removed) {
			for (const reason of item.reasons) {
				reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
			}
		}

		const newStats: SmartFilterStats = {
			totalProcessed: result.stats.total,
			filtered: result.stats.removed,
			filterRate: result.stats.total > 0 ? result.stats.removed / result.stats.total : 0,
			topFilterReasons: Array.from(reasonCounts.entries())
				.map(([reason, count]) => ({ reason, count }))
				.sort((a, b) => b.count - a.count)
				.slice(0, 10),
			categoryBreakdown: Object.entries(result.stats.categories).reduce((acc, [category, total]) => {
				acc[category] = {
					total,
					filtered: result.removed.filter(item => {
						const score = this.filterService.analyzeContent([item.story]);
						return Object.keys(score.categoryDistribution)[0] === category;
					}).length
				};
				return acc;
			}, {} as Record<string, { total: number; filtered: number }>)
		};

		// Compare against cached hash to avoid reading reactive state directly
		const newHash = JSON.stringify(newStats);
		if (newHash !== this._lastStatsHash) {
			this.stats = newStats;
			this._lastStatsHash = newHash;
		}
	}

    setCategoryWeightOverride(category: string, weights: { titleImportance?: number; contentImportance?: number; contextEvidence?: number } | undefined) {
        const current = this.preferences.categoryWeightOverrides || {};
        if (weights === undefined) {
            // Remove override
            delete current[category];
        } else {
            current[category] = {
                ...current[category],
                ...weights
            };
        }
        // Clean up if empty
        if (Object.keys(current).length === 0) {
            this.preferences.categoryWeightOverrides = undefined;
        } else {
            this.preferences.categoryWeightOverrides = current;
        }
        this.saveToStorage();
    }
}

export const smartContentFilter = new SmartContentFilterStore();