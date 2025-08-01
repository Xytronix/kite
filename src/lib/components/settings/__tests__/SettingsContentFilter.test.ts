import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { smartContentFilter } from '$lib/stores/smartContentFilter.svelte';
import SettingsContentFilter from '../SettingsContentFilter.svelte';

// Mock the store
vi.mock('$lib/stores/smartContentFilter.svelte', () => ({
	smartContentFilter: {
		isEnabled: false,
		preferences: {
			filterLowQuality: false,
			filterViolence: false,
			filterNegativeNews: false,
			filterPolitics: false,
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
			categoryOverrides: undefined,
			minimumRelevance: 0,
			minimumQuality: 0,
			minimumSentiment: 0
		},
		customKeywords: [],
		stats: null,
		toggleEnabled: vi.fn(),
		updatePreference: vi.fn(),
		togglePreference: vi.fn(),
		resetPreferences: vi.fn(),
		updateCategoryOverride: vi.fn(),
		addCustomKeyword: vi.fn(),
		removeCustomKeyword: vi.fn(),
		clearCustomKeywords: vi.fn(),
		setContentSimilarityThreshold: vi.fn(),
		setContentSimilarityMode: vi.fn(),
		setContentSimilarityScope: vi.fn(),
		setSimilarityWeights: vi.fn(),
		setContentSimilarityExpiry: vi.fn(),
		exportConfig: vi.fn(() => '{"test": "config"}'),
		importConfig: vi.fn(() => ({ success: true })),
		reset: vi.fn()
	}
}));

// Mock localization
vi.mock('$lib/client/localization.svelte', () => ({
	s: (key: string) => key
}));

describe('SettingsContentFilter', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should render the component without errors', () => {
		expect(() => {
			render(SettingsContentFilter);
		}).not.toThrow();
	});

	it('should display the main toggle section', () => {
		render(SettingsContentFilter);
		expect(screen.getByText('settings.contentFilter.enableTitle')).toBeInTheDocument();
	});

	it('should display the quick setup section with presets', () => {
		render(SettingsContentFilter);
		expect(screen.getByText('settings.contentFilter.quickSetup')).toBeInTheDocument();
		expect(screen.getByText('Basic Presets')).toBeInTheDocument();
		expect(screen.getByText('Specialized Presets')).toBeInTheDocument();
	});

	it('should display preset buttons', () => {
		render(SettingsContentFilter);
		
		// Check for basic presets
		expect(screen.getByText('settings.contentFilter.preset.balanced')).toBeInTheDocument();
		expect(screen.getByText('settings.smartFilter.preset.politicsFree')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.preset.strict')).toBeInTheDocument();
		
		// Check for specialized presets
		expect(screen.getByText('settings.contentFilter.preset.professional')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.preset.essentials')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.preset.global')).toBeInTheDocument();
	});

	it('should display collapsible sections', () => {
		render(SettingsContentFilter);
		
		// Check for section headers
		expect(screen.getByText('settings.contentFilter.contentQuality')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.topicsSubjects')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.newsTypes')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.geographicScope')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.wellnessMental')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.advancedSimilarity')).toBeInTheDocument();
	});

	it('should display content quality filters when section is expanded', async () => {
		// Mock store with content quality filters active to auto-expand section
		const mockStore = {
			...smartContentFilter,
			preferences: {
				...smartContentFilter.preferences,
				filterLowQuality: true
			}
		};
		
		vi.mocked(smartContentFilter).preferences = mockStore.preferences;
		
		render(SettingsContentFilter);
		
		// Content quality section should be expanded due to active filter
		expect(screen.getByText('settings.contentFilter.lowQuality')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.promotional')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.opinions')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.repetitive')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.socialMediaDrama')).toBeInTheDocument();
	});

	it('should display content quality filter descriptions', async () => {
		// Mock store with content quality filters active to auto-expand section
		const mockStore = {
			...smartContentFilter,
			preferences: {
				...smartContentFilter.preferences,
				filterLowQuality: true
			}
		};
		
		vi.mocked(smartContentFilter).preferences = mockStore.preferences;
		
		render(SettingsContentFilter);
		
		// Check for filter descriptions
		expect(screen.getByText('settings.contentFilter.lowQuality.description')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.promotional.description')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.opinions.description')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.repetitive.description')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.socialMediaDrama.description')).toBeInTheDocument();
	});

	it('should display news types filters when section is expanded', async () => {
		// Mock store with news types filters active to auto-expand section
		const mockStore = {
			...smartContentFilter,
			preferences: {
				...smartContentFilter.preferences,
				filterBreakingNews: true
			}
		};
		
		vi.mocked(smartContentFilter).preferences = mockStore.preferences;
		
		render(SettingsContentFilter);
		
		// News types section should be expanded due to active filter
		expect(screen.getByText('settings.contentFilter.breakingNews')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.breakingNews.description')).toBeInTheDocument();
	});

	it('should display geographic scope filters when section is expanded', async () => {
		// Mock store with geographic filters active to auto-expand section
		const mockStore = {
			...smartContentFilter,
			preferences: {
				...smartContentFilter.preferences,
				filterLocalNews: true
			}
		};
		
		vi.mocked(smartContentFilter).preferences = mockStore.preferences;
		
		render(SettingsContentFilter);
		
		// Geographic scope section should be expanded due to active filter
		expect(screen.getByText('settings.contentFilter.localNews')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.localNews.description')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.internationalNews')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.internationalNews.description')).toBeInTheDocument();
	});

	it('should display wellness & mental health filters when section is expanded', async () => {
		// Mock store with wellness filters active to auto-expand section
		const mockStore = {
			...smartContentFilter,
			preferences: {
				...smartContentFilter.preferences,
				filterNegativeNews: true
			}
		};
		
		vi.mocked(smartContentFilter).preferences = mockStore.preferences;
		
		render(SettingsContentFilter);
		
		// Wellness section should be expanded due to active filter
		expect(screen.getByText('settings.contentFilter.negativeNews')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.negativeNews.description')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.violence')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.violence.description')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.anxietyInducing')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.anxietyInducing.description')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.economicPessimism')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.economicPessimism.description')).toBeInTheDocument();
	});

	it('should display wellness section description', async () => {
		// Mock store with wellness filters active to auto-expand section
		const mockStore = {
			...smartContentFilter,
			preferences: {
				...smartContentFilter.preferences,
				filterViolence: true
			}
		};
		
		vi.mocked(smartContentFilter).preferences = mockStore.preferences;
		
		render(SettingsContentFilter);
		
		// Check for wellness section description
		expect(screen.getByText('settings.contentFilter.wellnessMental.description')).toBeInTheDocument();
	});

	it('should display active filters management section when filters are active', () => {
		// Mock store with active filters and enabled state
		const mockStore = {
			...smartContentFilter,
			isEnabled: true,
			preferences: {
				...smartContentFilter.preferences,
				filterPolitics: true,
				filterLowQuality: true
			},
			customKeywords: ['test', 'keyword']
		};
		
		vi.mocked(smartContentFilter).isEnabled = mockStore.isEnabled;
		vi.mocked(smartContentFilter).preferences = mockStore.preferences;
		vi.mocked(smartContentFilter).customKeywords = mockStore.customKeywords;
		
		render(SettingsContentFilter);
		
		// Check for active filters section
		expect(screen.getByText('settings.contentFilter.activeFilters')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.activeFilters.description')).toBeInTheDocument();
	});

	it('should display active filter tags', () => {
		// Mock store with active filters and enabled state
		const mockStore = {
			...smartContentFilter,
			isEnabled: true,
			preferences: {
				...smartContentFilter.preferences,
				filterPolitics: true,
				filterLowQuality: true
			},
			customKeywords: ['test']
		};
		
		vi.mocked(smartContentFilter).isEnabled = mockStore.isEnabled;
		vi.mocked(smartContentFilter).preferences = mockStore.preferences;
		vi.mocked(smartContentFilter).customKeywords = mockStore.customKeywords;
		
		render(SettingsContentFilter);
		
		// Check for filter tags
		expect(screen.getByText('Politics')).toBeInTheDocument();
		expect(screen.getByText('Low Quality')).toBeInTheDocument();
		expect(screen.getByText('"test"')).toBeInTheDocument();
	});

	it('should display clear all filters button when filters are active', () => {
		// Mock store with active filters and enabled state
		const mockStore = {
			...smartContentFilter,
			isEnabled: true,
			preferences: {
				...smartContentFilter.preferences,
				filterPolitics: true
			}
		};
		
		vi.mocked(smartContentFilter).isEnabled = mockStore.isEnabled;
		vi.mocked(smartContentFilter).preferences = mockStore.preferences;
		
		render(SettingsContentFilter);
		
		// Check for clear all button
		expect(screen.getByText('settings.contentFilter.clearAll')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.clearAll.description')).toBeInTheDocument();
	});

	it('should not display active filters section when filtering is disabled', () => {
		// Mock store with filtering disabled
		const mockStore = {
			...smartContentFilter,
			isEnabled: false,
			preferences: {
				...smartContentFilter.preferences
			},
			customKeywords: []
		};
		
		vi.mocked(smartContentFilter).isEnabled = mockStore.isEnabled;
		vi.mocked(smartContentFilter).preferences = mockStore.preferences;
		vi.mocked(smartContentFilter).customKeywords = mockStore.customKeywords;
		
		render(SettingsContentFilter);
		
		// Active filters section should not be visible when filtering is disabled
		expect(screen.queryByText('settings.contentFilter.activeFilters')).not.toBeInTheDocument();
	});

	it('should display statistics section when stats are available and filters are active', () => {
		// Mock store with active filters, enabled state, and statistics
		const mockStats = {
			totalProcessed: 1000,
			filtered: 250,
			filterRate: 0.25,
			topFilterReasons: [
				{ reason: 'Low Quality Content', count: 100 },
				{ reason: 'Political Content', count: 75 },
				{ reason: 'Celebrity News', count: 50 }
			],
			categoryBreakdown: {
				politics: { total: 200, filtered: 75 },
				entertainment: { total: 150, filtered: 50 },
				technology: { total: 100, filtered: 25 }
			}
		};

		const mockStore = {
			...smartContentFilter,
			isEnabled: true,
			preferences: {
				...smartContentFilter.preferences,
				filterPolitics: true,
				filterLowQuality: true
			},
			stats: mockStats
		};
		
		vi.mocked(smartContentFilter).isEnabled = mockStore.isEnabled;
		vi.mocked(smartContentFilter).preferences = mockStore.preferences;
		vi.mocked(smartContentFilter).stats = mockStore.stats;
		
		render(SettingsContentFilter);
		
		// Check for statistics section header (should be visible when stats are available)
		expect(screen.getByText('settings.contentFilter.statistics')).toBeInTheDocument();
		
		// Check for overview statistics labels (these should always be present)
		expect(screen.getByText('settings.contentFilter.stats.totalProcessed')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.stats.filtered')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.stats.filterRate')).toBeInTheDocument();
		
		// Check for top filter reasons section
		expect(screen.getByText('settings.contentFilter.stats.topReasons')).toBeInTheDocument();
		expect(screen.getByText('Low Quality Content')).toBeInTheDocument();
		expect(screen.getByText('Political Content')).toBeInTheDocument();
		expect(screen.getByText('Celebrity News')).toBeInTheDocument();
		
		// Check for category breakdown section
		expect(screen.getByText('settings.contentFilter.stats.categoryBreakdown')).toBeInTheDocument();
		expect(screen.getByText('politics')).toBeInTheDocument();
		expect(screen.getByText('entertainment')).toBeInTheDocument();
		expect(screen.getByText('technology')).toBeInTheDocument();
	});

	it('should not display statistics section when no stats are available', () => {
		// Mock store with active filters but no statistics
		const mockStore = {
			...smartContentFilter,
			isEnabled: true,
			preferences: {
				...smartContentFilter.preferences,
				filterPolitics: true
			},
			stats: null
		};
		
		vi.mocked(smartContentFilter).isEnabled = mockStore.isEnabled;
		vi.mocked(smartContentFilter).preferences = mockStore.preferences;
		vi.mocked(smartContentFilter).stats = mockStore.stats;
		
		render(SettingsContentFilter);
		
		// Statistics section should not be visible when no stats are available
		expect(screen.queryByText('settings.contentFilter.statistics')).not.toBeInTheDocument();
	});

	it('should display no data message when statistics show zero processed stories', () => {
		// Mock store with empty statistics
		const mockStats = {
			totalProcessed: 0,
			filtered: 0,
			filterRate: 0,
			topFilterReasons: [],
			categoryBreakdown: {}
		};

		const mockStore = {
			...smartContentFilter,
			isEnabled: true,
			preferences: {
				...smartContentFilter.preferences,
				filterPolitics: true
			},
			stats: mockStats
		};
		
		vi.mocked(smartContentFilter).isEnabled = mockStore.isEnabled;
		vi.mocked(smartContentFilter).preferences = mockStore.preferences;
		vi.mocked(smartContentFilter).stats = mockStore.stats;
		
		render(SettingsContentFilter);
		
		// Check for no data message
		expect(screen.getByText('settings.contentFilter.stats.noData')).toBeInTheDocument();
	});

	it('should display system controls section', () => {
		render(SettingsContentFilter);
		
		// Check for system controls section header
		expect(screen.getByText('settings.contentFilter.systemControls')).toBeInTheDocument();
	});

	it('should display export configuration option', async () => {
		render(SettingsContentFilter);
		
		// Click to expand system controls section
		const systemControlsButton = screen.getByText('settings.contentFilter.systemControls').closest('button');
		if (systemControlsButton) {
			await fireEvent.click(systemControlsButton);
		}
		
		// Check for export configuration elements
		expect(screen.getByText('settings.contentFilter.export.title')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.export.description')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.export.button')).toBeInTheDocument();
	});

	it('should display import configuration option', async () => {
		render(SettingsContentFilter);
		
		// Click to expand system controls section
		const systemControlsButton = screen.getByText('settings.contentFilter.systemControls').closest('button');
		if (systemControlsButton) {
			await fireEvent.click(systemControlsButton);
		}
		
		// Check for import configuration elements
		expect(screen.getByText('settings.contentFilter.import.title')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.import.description')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.import.button')).toBeInTheDocument();
	});

	it('should display reset to defaults option', async () => {
		render(SettingsContentFilter);
		
		// Click to expand system controls section
		const systemControlsButton = screen.getByText('settings.contentFilter.systemControls').closest('button');
		if (systemControlsButton) {
			await fireEvent.click(systemControlsButton);
		}
		
		// Check for reset configuration elements
		expect(screen.getByText('settings.contentFilter.reset.title')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.reset.description')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.reset.button')).toBeInTheDocument();
	});

	it('should display version information', async () => {
		render(SettingsContentFilter);
		
		// Click to expand system controls section
		const systemControlsButton = screen.getByText('settings.contentFilter.systemControls').closest('button');
		if (systemControlsButton) {
			await fireEvent.click(systemControlsButton);
		}
		
		// Check for version information
		expect(screen.getByText('settings.contentFilter.version.title')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.version.description')).toBeInTheDocument();
	});

	it('should display custom keywords section', () => {
		render(SettingsContentFilter);
		
		// Check for custom keywords section header
		expect(screen.getByText('settings.contentFilter.customKeywords')).toBeInTheDocument();
	});

	it('should display custom keywords section when keywords are present', () => {
		// Mock store with custom keywords to auto-expand section
		const mockStore = {
			...smartContentFilter,
			customKeywords: ['test', 'keyword', 'filter']
		};
		
		vi.mocked(smartContentFilter).customKeywords = mockStore.customKeywords;
		
		render(SettingsContentFilter);
		
		// Custom keywords section should be expanded due to active keywords
		expect(screen.getByText('settings.contentFilter.customKeywords.description')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.customKeywords.addSingle')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.customKeywords.addBulk')).toBeInTheDocument();
		expect(screen.getByText(/settings\.contentFilter\.customKeywords\.current/)).toBeInTheDocument();
	});

	it('should display custom keyword input fields', () => {
		// Mock store with custom keywords to auto-expand section
		const mockStore = {
			...smartContentFilter,
			customKeywords: ['test']
		};
		
		vi.mocked(smartContentFilter).customKeywords = mockStore.customKeywords;
		
		render(SettingsContentFilter);
		
		// Check for input fields
		expect(screen.getByPlaceholderText('settings.contentFilter.customKeywords.placeholder')).toBeInTheDocument();
		expect(screen.getByPlaceholderText('settings.contentFilter.customKeywords.bulkPlaceholder')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.customKeywords.add')).toBeInTheDocument();
		expect(screen.getByText('settings.contentFilter.customKeywords.addBulk.button')).toBeInTheDocument();
	});

	it('should display current custom keywords as removable tags', () => {
		// Mock store with custom keywords
		const mockStore = {
			...smartContentFilter,
			customKeywords: ['politics', 'sports', 'celebrity']
		};
		
		vi.mocked(smartContentFilter).customKeywords = mockStore.customKeywords;
		
		render(SettingsContentFilter);
		
		// Check for keyword tags
		expect(screen.getByText('politics')).toBeInTheDocument();
		expect(screen.getByText('sports')).toBeInTheDocument();
		expect(screen.getByText('celebrity')).toBeInTheDocument();
		
		// Check for clear all button
		expect(screen.getByText('settings.contentFilter.customKeywords.clearAll')).toBeInTheDocument();
	});

	it('should display custom keywords section collapsed when no keywords are present', () => {
		// Mock store with no custom keywords
		const mockStore = {
			...smartContentFilter,
			customKeywords: []
		};
		
		vi.mocked(smartContentFilter).customKeywords = mockStore.customKeywords;
		
		render(SettingsContentFilter);
		
		// Custom keywords section should be present but collapsed
		expect(screen.getByText('settings.contentFilter.customKeywords')).toBeInTheDocument();
		
		// The section content should not be visible when collapsed
		expect(screen.queryByText('settings.contentFilter.customKeywords.description')).not.toBeInTheDocument();
	});

	it('should display keyword count in section header when keywords are present', () => {
		// Mock store with custom keywords
		const mockStore = {
			...smartContentFilter,
			customKeywords: ['test', 'keyword']
		};
		
		vi.mocked(smartContentFilter).customKeywords = mockStore.customKeywords;
		
		render(SettingsContentFilter);
		
		// Check for keyword count in header
		expect(screen.getByText('2 keywords active')).toBeInTheDocument();
	});

	it('should display singular keyword count when only one keyword is present', () => {
		// Mock store with single custom keyword
		const mockStore = {
			...smartContentFilter,
			customKeywords: ['test']
		};
		
		vi.mocked(smartContentFilter).customKeywords = mockStore.customKeywords;
		
		render(SettingsContentFilter);
		
		// Check for singular keyword count in header
		expect(screen.getByText('1 keyword active')).toBeInTheDocument();
	});

	it('should display bulk keywords help text', () => {
		// Mock store with custom keywords to auto-expand section
		const mockStore = {
			...smartContentFilter,
			customKeywords: ['test']
		};
		
		vi.mocked(smartContentFilter).customKeywords = mockStore.customKeywords;
		
		render(SettingsContentFilter);
		
		// Check for bulk keywords help text
		expect(screen.getByText('settings.contentFilter.customKeywords.bulkHelp')).toBeInTheDocument();
	});


});