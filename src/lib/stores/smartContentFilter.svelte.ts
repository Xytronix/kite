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
		minimumRelevance: 0,
		minimumQuality: 0.2,
		minimumSentiment: 0.2
	});
	
	isEnabled = $state<boolean>(true); // Enable smart filtering by default
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

	// Reset all preferences to defaults
	reset() {
		this.preferences = {
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
			minimumRelevance: 0,
			minimumQuality: 0.2,
			minimumSentiment: 0.2
		};
		this.isEnabled = false;
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
}

export const smartContentFilter = new SmartContentFilterStore();