<script lang="ts">
	import { s } from '$lib/client/localization.svelte';
	import { smartContentFilter } from '$lib/stores/smartContentFilter.svelte';
	import Icon from '@iconify/svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import Select from '$lib/components/Select.svelte';

	// UI control state variables
	let showClearAllConfirmation = $state(false);
	let showResetConfirmation = $state(false);
	let showImportConfirmation = $state(false);
	let fileInput: HTMLInputElement;
	let selectedFileName = $state<string | null>(null);
	let pendingImportData = $state<string | null>(null);
	let systemMessage = $state<{
		type: 'success' | 'warning' | 'error';
		title: string;
		description?: string;
	} | null>(null);

	// Performance optimizations - Memoized computations with reduced re-calculations
	let memoizedFilterCounts = $state(new Map<string, number>());
	let lastPreferencesUpdate = $state(0);

	// Derived reactive state for detecting active filters
	const hasActiveFilters = $derived(
		smartContentFilter.isEnabled && (
			smartContentFilter.preferences.filterLowQuality ||
			smartContentFilter.preferences.filterPromotional ||
			smartContentFilter.preferences.filterOpinions ||
			smartContentFilter.preferences.filterRepetitive ||
			smartContentFilter.preferences.filterSocialMediaDrama ||
			smartContentFilter.preferences.filterPolitics ||
			smartContentFilter.preferences.filterSports ||
			smartContentFilter.preferences.filterFinancial ||
			smartContentFilter.preferences.filterTechnology ||
			smartContentFilter.preferences.filterEntertainment ||
			smartContentFilter.preferences.filterCelebrity ||
			smartContentFilter.preferences.filterWeather ||
			smartContentFilter.preferences.filterBreakingNews ||
			smartContentFilter.preferences.filterLocalNews ||
			smartContentFilter.preferences.filterInternationalNews ||
			smartContentFilter.preferences.filterNegativeNews ||
			smartContentFilter.preferences.filterViolence ||
			smartContentFilter.preferences.filterAnxietyInducing ||
			smartContentFilter.preferences.filterEconomicPessimism ||
			(smartContentFilter.preferences.filterContentSimilarity &&
			 smartContentFilter.preferences.contentSimilarityThreshold > 0) ||
			smartContentFilter.customKeywords.length > 0
		)
	);

	// Performance optimization: Update memoization timestamp when preferences change
	$effect(() => {
		// Watch for changes in smartContentFilter to invalidate memoization
		smartContentFilter.preferences;
		lastPreferencesUpdate = Date.now();
	});

	// Lazy loading state for sections to avoid rendering heavy sections when collapsed
	let loadedSections = $state(new Set<string>(['main-toggle', 'quick-setup', 'active-filters']));

	// Function to lazily load section content
	function ensureSectionLoaded(sectionId: string) {
		if (!loadedSections.has(sectionId)) {
			loadedSections = new Set([...loadedSections, sectionId]);
		}
	}



	// Define content filter presets - separated into basic and specialized
	const basicPresets = [
		{
			id: 'balanced',
			label: 'Quality Focus',
			tooltip: 'Moderate filtering focusing on content quality and readability',
			icon: 'tabler:award',
			preferences: {
				filterLowQuality: true,
				filterViolence: true,
				filterSocialMediaDrama: true,
				filterPromotional: true,
				minimumQuality: 0.3,
				minimumSentiment: 0.3
			}
		},
		{
			id: 'politics-free',
			label: 'Politics-Free',
			tooltip: 'Remove political content and partisan discussions',
			icon: 'tabler:ban',
			preferences: {
				filterPolitics: true,
				filterBreakingNews: true,
				filterOpinions: true,
				minimumSentiment: 0.3
			}
		},
		{
			id: 'strict',
			label: 'High Standards',
			tooltip: 'Aggressive filtering for premium-quality content only',
			icon: 'tabler:shield-check',
			preferences: {
				filterLowQuality: true,
				filterViolence: true,
				filterNegativeNews: true,
				filterSocialMediaDrama: true,
				filterPromotional: true,
				filterOpinions: true,
				minimumQuality: 0.5,
				minimumSentiment: 0.4,
				minimumRelevance: 0.3
			}
		}
	];

	const specializedPresets = [
		{
			id: 'professional',
			label: 'Professional Focus',
			tooltip: 'Filter entertainment and non-work content, focus on business news',
			icon: 'tabler:briefcase',
			preferences: {
				filterCelebrity: true,
				filterEntertainment: true,
				filterSports: true,
				filterSocialMediaDrama: true,
				filterWeather: true,
				filterLocalNews: true,
				filterPromotional: true,
				minimumQuality: 0.4,
				// Add category-based sensitivity overrides
				categoryOverrides: {
					politics: 70,
					celebrity: 85,
					entertainment: 30,
					sports: 50,
					technology: 25,
					socialMediaDrama: 80
				}
			}
		},
		{
			id: 'essentials',
			label: 'News Essentials',
			tooltip: 'Only essential news, filter noise and information overload',
			icon: 'tabler:bolt',
			preferences: {
				filterBreakingNews: true,
				filterRepetitive: true,
				filterSocialMediaDrama: true,
				filterPromotional: true,
				minimumQuality: 0.4
			}
		},
		{
			id: 'global',
			label: 'Global Focus',
			tooltip: 'International perspective, filter local and trivial content',
			icon: 'tabler:world',
			preferences: {
				filterLocalNews: true,
				filterWeather: true,
				filterSports: true,
				filterCelebrity: true,
				minimumRelevance: 0.3
			}
		},
		{
			id: 'news-purist',
			label: 'News Purist',
			tooltip: 'Focus on substantive journalism only',
			icon: 'tabler:news',
			preferences: {
				filterCelebrity: true,
				filterEntertainment: true,
				filterSports: true,
				filterSocialMediaDrama: true,
				// Add category-based sensitivity overrides
				categoryOverrides: {
					celebrity: 80,
					entertainment: 75,
					politics: 45,
					sports: 70,
					technology: 50,
					socialMediaDrama: 85
				}
			}
		},
		{
			id: 'wellness-focused',
			label: 'Wellness Focus',
			tooltip: 'Protect mental health, reduce anxiety',
			icon: 'tabler:brain',
			preferences: {
				filterViolence: true,
				filterNegativeNews: true,
				filterAnxietyInducing: true,
				filterEconomicPessimism: true,
				filterSocialMediaDrama: true,
				minimumSentiment: 0.5,
				// Add category-based sensitivity overrides
				categoryOverrides: {
					politics: 55,
					celebrity: 35,
					sports: 25,
					technology: 50,
					socialMediaDrama: 75
				}
			}
		}
	];

	// Track which presets are active (including category overrides)
	const isPresetActive = (presetId: string): boolean => {
		const allPresets = [...basicPresets, ...specializedPresets];
		const preset = allPresets.find(p => p.id === presetId);
		if (!preset) return false;
		
		// Check if current preferences match this preset
		const preferencesMatch = Object.entries(preset.preferences).every(([key, value]) => {
			if (key === 'categoryOverrides') {
				// Special handling for category overrides
				const currentOverrides = smartContentFilter.preferences.categoryOverrides;
				const presetOverrides = value as Record<string, number>;
				
				if (!currentOverrides && !presetOverrides) return true;
				if (!currentOverrides || !presetOverrides) return false;
				
				// Check if all preset overrides match current ones
				return Object.entries(presetOverrides).every(([category, sensitivity]) => {
					return currentOverrides[category] === sensitivity;
				});
			} else {
				const currentValue = smartContentFilter.preferences[key as keyof typeof smartContentFilter.preferences];
				return currentValue === value;
			}
		});
		
		return preferencesMatch;
	};

	// Apply a preset (allow multiple presets to be combined)
	function togglePreset(presetId: string) {
		const allPresets = [...basicPresets, ...specializedPresets];
		const preset = allPresets.find(p => p.id === presetId);
		if (!preset) return;

		if (isPresetActive(presetId)) {
			// Deactivate this preset only, keep others active
			deactivatePreset(presetId);
		} else {
			// Apply new preset without resetting (allow combination)
			Object.entries(preset.preferences).forEach(([key, value]) => {
				if (key === 'categoryOverrides') {
					// Special handling for category overrides
					const overrides = value as Record<string, number>;
					Object.entries(overrides).forEach(([category, sensitivity]) => {
						smartContentFilter.updateCategoryOverride(category, sensitivity);
					});
				} else {
					smartContentFilter.updatePreference(key as keyof typeof smartContentFilter.preferences, value);
				}
			});
		}
	}

	// Get reason why preset cannot be activated
	function getDeactivationReason(presetId: string): string {
		const conflicts = getPresetConflicts(presetId);
		if (conflicts.length > 0) {
			return `Conflicts with active preset${conflicts.length > 1 ? 's' : ''}: ${conflicts.join(', ')}. Deactivate conflicting presets first.`;
		}
		return '';
	}

	// Deactivate a specific preset without resetting everything
	function deactivatePreset(presetId: string) {
		const allPresets = [...basicPresets, ...specializedPresets];
		const preset = allPresets.find(p => p.id === presetId);
		if (!preset) return;
		
		// Simplified approach: Reset everything and reapply other active presets
		// Store currently active presets (excluding the one we're deactivating)
		const otherActivePresets = allPresets.filter(p => 
			p.id !== presetId && isPresetActive(p.id)
		);
		
		// Reset all preferences
		smartContentFilter.resetPreferences();
		
		// Reapply other active presets
		otherActivePresets.forEach(otherPreset => {
			Object.entries(otherPreset.preferences).forEach(([key, value]) => {
				if (key === 'categoryOverrides') {
					const overrides = value as Record<string, number>;
					Object.entries(overrides).forEach(([category, sensitivity]) => {
						smartContentFilter.updateCategoryOverride(category, sensitivity);
					});
				} else {
					smartContentFilter.updatePreference(key as keyof typeof smartContentFilter.preferences, value);
				}
			});
		});
	}
	
	// Detect conflicts between presets
	function getPresetConflicts(presetId: string): string[] {
		const allPresets = [...basicPresets, ...specializedPresets];
		const preset = allPresets.find(p => p.id === presetId);
		if (!preset) return [];
		
		const conflicts: string[] = [];
		
		for (const otherPreset of allPresets) {
			if (otherPreset.id === presetId || !isPresetActive(otherPreset.id)) continue;
			
			// Check for overlapping settings
			const hasConflict = Object.keys(preset.preferences).some(key => {
				if (key === 'categoryOverrides') {
					const presetOverrides = (preset.preferences as any).categoryOverrides || {};
					const otherOverrides = (otherPreset.preferences as any).categoryOverrides || {};
					
					return Object.keys(presetOverrides).some(category => 
						otherOverrides[category] !== undefined && 
						otherOverrides[category] !== presetOverrides[category]
					);
				}
				
				return (otherPreset.preferences as any)[key] !== undefined && 
					   (otherPreset.preferences as any)[key] !== (preset.preferences as any)[key];
			});
			
			if (hasConflict) {
				conflicts.push(otherPreset.label);
			}
		}
		
		return conflicts;
	}
	
	// Check if a preset can be activated (no conflicts)
	function canActivatePreset(presetId: string): boolean {
		return getPresetConflicts(presetId).length === 0;
	}
	
	// Track active preset and detect modifications
	const activePreset = $derived.by(() => {
		const allPresets = [...basicPresets, ...specializedPresets];
		return allPresets.find(preset => isPresetActive(preset.id));
	});
	
	// Check if current settings have been modified from the active preset
	const isPresetModified = $derived.by(() => {
		if (!activePreset) return false;
		
		// Check if any settings differ from the preset
		for (const [key, value] of Object.entries(activePreset.preferences)) {
			if (key === 'categoryOverrides') {
				const currentOverrides = smartContentFilter.preferences.categoryOverrides || {};
				const presetOverrides = value as Record<string, number> || {};
				
				// Check if there are additional overrides not in preset
				for (const category in currentOverrides) {
					if (!(category in presetOverrides) && currentOverrides[category] !== undefined) {
						return true;
					}
				}
				
				// Check if preset overrides have been changed
				for (const [category, sensitivity] of Object.entries(presetOverrides)) {
					if (currentOverrides[category] !== sensitivity) {
						return true;
					}
				}
			} else {
				const currentValue = smartContentFilter.preferences[key as keyof typeof smartContentFilter.preferences];
				if (currentValue !== value) {
					return true;
				}
			}
		}
		
		return false;
	});
	
	// Reset to original preset
	function resetToActivePreset() {
		if (activePreset) {
			togglePreset(activePreset.id);
		}
	}

	// Helper functions for active filters management
	function getActiveFilterCount(): number {
		let count = 0;
		
		// Count boolean filter preferences
		const booleanFilters = [
			'filterPolitics', 'filterNegativeNews', 'filterLowQuality', 'filterViolence',
			'filterCelebrity', 'filterSports', 'filterFinancial', 'filterEntertainment',
			'filterTechnology', 'filterOpinions', 'filterAnxietyInducing', 'filterSocialMediaDrama',
			'filterPromotional', 'filterBreakingNews', 'filterWeather', 'filterLocalNews',
			'filterInternationalNews', 'filterEconomicPessimism', 'filterRepetitive'
		];
		
		for (const filter of booleanFilters) {
			if (smartContentFilter.preferences[filter as keyof typeof smartContentFilter.preferences]) {
				count++;
			}
		}
		
		// Count content similarity if enabled
		if (smartContentFilter.preferences.filterContentSimilarity && 
			smartContentFilter.preferences.contentSimilarityThreshold > 0) {
			count++;
		}
		
		// Count custom keywords
		count += smartContentFilter.customKeywords.length;
		
		return count;
	}

	interface FilterTag {
		key: string;
		value: boolean | string;
		label: string;
		icon: string;
	}

	function getActiveFilterTags(): FilterTag[] {
		const tags: FilterTag[] = [];
		
		// Define filter mappings with icons and labels
		const filterMappings = [
			{ key: 'filterPolitics', label: 'Politics', icon: 'tabler:vote' },
			{ key: 'filterNegativeNews', label: 'Negative News', icon: 'tabler:mood-sad' },
			{ key: 'filterLowQuality', label: 'Low Quality', icon: 'tabler:thumb-down' },
			{ key: 'filterViolence', label: 'Violence', icon: 'tabler:shield-x' },
			{ key: 'filterCelebrity', label: 'Celebrity', icon: 'tabler:star' },
			{ key: 'filterSports', label: 'Sports', icon: 'tabler:ball-football' },
			{ key: 'filterFinancial', label: 'Financial', icon: 'tabler:currency-dollar' },
			{ key: 'filterEntertainment', label: 'Entertainment', icon: 'tabler:movie' },
			{ key: 'filterTechnology', label: 'Technology', icon: 'tabler:device-laptop' },
			{ key: 'filterOpinions', label: 'Opinions', icon: 'tabler:message-circle' },
			{ key: 'filterAnxietyInducing', label: 'Anxiety-Inducing', icon: 'tabler:mood-nervous' },
			{ key: 'filterSocialMediaDrama', label: 'Social Media Drama', icon: 'tabler:messages' },
			{ key: 'filterPromotional', label: 'Promotional', icon: 'tabler:ad' },
			{ key: 'filterBreakingNews', label: 'Breaking News', icon: 'tabler:urgent' },
			{ key: 'filterWeather', label: 'Weather', icon: 'tabler:cloud' },
			{ key: 'filterLocalNews', label: 'Local News', icon: 'tabler:map-pin' },
			{ key: 'filterInternationalNews', label: 'International News', icon: 'tabler:world' },
			{ key: 'filterEconomicPessimism', label: 'Economic Pessimism', icon: 'tabler:trending-down' },
			{ key: 'filterRepetitive', label: 'Repetitive Coverage', icon: 'tabler:repeat' }
		];
		
		// Add active boolean filters
		for (const mapping of filterMappings) {
			if (smartContentFilter.preferences[mapping.key as keyof typeof smartContentFilter.preferences]) {
				tags.push({
					key: mapping.key,
					value: true,
					label: mapping.label,
					icon: mapping.icon
				});
			}
		}
		
		// Add content similarity filter if active
		if (smartContentFilter.preferences.filterContentSimilarity && 
			smartContentFilter.preferences.contentSimilarityThreshold > 0) {
			tags.push({
				key: 'filterContentSimilarity',
				value: true,
				label: `Content Similarity (${smartContentFilter.preferences.contentSimilarityThreshold}%)`,
				icon: 'tabler:copy'
			});
		}
		
		return tags;
	}

	function removeFilter(key: string, value: boolean | string) {
		if (key === 'filterContentSimilarity') {
			smartContentFilter.updatePreference('filterContentSimilarity', false);
		} else {
			smartContentFilter.updatePreference(key as keyof typeof smartContentFilter.preferences, false);
		}
	}

	function clearAllFilters() {
		// Reset all preferences to defaults
		smartContentFilter.resetPreferences();
		// Clear custom keywords
		smartContentFilter.clearCustomKeywords();
		// Close confirmation dialog
		showClearAllConfirmation = false;
	}

	// System Controls Functions
	function exportConfiguration() {
		try {
			const configJson = smartContentFilter.exportConfig();
			const blob = new Blob([configJson], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			
			const link = document.createElement('a');
			link.href = url;
			link.download = `kite-content-filter-settings-${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
			
			systemMessage = {
				type: 'success',
				title: s('settings.contentFilter.export.success') || 'Configuration exported successfully',
				description: s('settings.contentFilter.export.success.description') || 'Your filter settings have been saved to a JSON file'
			};
			
			// Clear message after 5 seconds
			setTimeout(() => {
				if (systemMessage?.type === 'success') systemMessage = null;
			}, 5000);
		} catch (error) {
			console.error('Export failed:', error);
			systemMessage = {
				type: 'error',
				title: s('settings.contentFilter.export.error') || 'Export failed',
				description: s('settings.contentFilter.export.error.description') || 'Unable to export configuration. Please try again.'
			};
		}
	}

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		
		if (!file) {
			selectedFileName = null;
			return;
		}
		
		if (!file.name.endsWith('.json')) {
			systemMessage = {
				type: 'error',
				title: s('settings.contentFilter.import.error.invalidFile') || 'Invalid file type',
				description: s('settings.contentFilter.import.error.invalidFile.description') || 'Please select a JSON file'
			};
			selectedFileName = null;
			return;
		}
		
		selectedFileName = file.name;
		
		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;
			if (content) {
				pendingImportData = content;
				showImportConfirmation = true;
			}
		};
		
		reader.onerror = () => {
			systemMessage = {
				type: 'error',
				title: s('settings.contentFilter.import.error.readFailed') || 'Failed to read file',
				description: s('settings.contentFilter.import.error.readFailed.description') || 'Unable to read the selected file. Please try again.'
			};
			selectedFileName = null;
		};
		
		reader.readAsText(file);
	}

	function confirmImport() {
		if (!pendingImportData) return;
		
		try {
			const result = smartContentFilter.importConfig(pendingImportData);
			
			if (result.success) {
				systemMessage = {
					type: 'success',
					title: s('settings.contentFilter.import.success') || 'Configuration imported successfully',
					description: s('settings.contentFilter.import.success.description') || 'Your filter settings have been restored from the file'
				};
				
				// Clear message after 5 seconds
				setTimeout(() => {
					if (systemMessage?.type === 'success') systemMessage = null;
				}, 5000);
			} else {
				systemMessage = {
					type: 'error',
					title: s('settings.contentFilter.import.error') || 'Import failed',
					description: result.errorKey || 'Unable to import configuration. Please check the file format.'
				};
			}
		} catch (error) {
			console.error('Import failed:', error);
			systemMessage = {
				type: 'error',
				title: s('settings.contentFilter.import.error') || 'Import failed',
				description: s('settings.contentFilter.import.error.description') || 'An unexpected error occurred during import'
			};
		} finally {
			showImportConfirmation = false;
			pendingImportData = null;
			selectedFileName = null;
			// Reset file input
			if (fileInput) fileInput.value = '';
		}
	}

	function cancelImport() {
		showImportConfirmation = false;
		pendingImportData = null;
		selectedFileName = null;
		// Reset file input
		if (fileInput) fileInput.value = '';
	}

	function confirmReset() {
		try {
			smartContentFilter.reset();
			systemMessage = {
				type: 'success',
				title: s('settings.contentFilter.reset.success') || 'Settings reset successfully',
				description: s('settings.contentFilter.reset.success.description') || 'All filter settings have been restored to their default values'
			};
			
			// Clear message after 5 seconds
			setTimeout(() => {
				if (systemMessage?.type === 'success') systemMessage = null;
			}, 5000);
		} catch (error) {
			console.error('Reset failed:', error);
			systemMessage = {
				type: 'error',
				title: s('settings.contentFilter.reset.error') || 'Reset failed',
				description: s('settings.contentFilter.reset.error.description') || 'Unable to reset settings. Please try again.'
			};
		} finally {
			showResetConfirmation = false;
		}
	}

	// Custom Keywords Functions
	let newKeywordInput = $state('');
	let bulkKeywordsInput = $state('');

	function addCustomKeyword() {
		const keyword = newKeywordInput.trim();
		if (keyword) {
			smartContentFilter.addCustomKeyword(keyword);
			newKeywordInput = '';
		}
	}

	function addBulkKeywords() {
		const keywords = bulkKeywordsInput
			.split(',')
			.map(k => k.trim())
			.filter(k => k.length > 0);
		
		keywords.forEach(keyword => {
			smartContentFilter.addCustomKeyword(keyword);
		});
		
		bulkKeywordsInput = '';
	}

	function removeCustomKeyword(keyword: string) {
		smartContentFilter.removeCustomKeyword(keyword);
	}

	function clearAllCustomKeywords() {
		smartContentFilter.clearCustomKeywords();
	}

	function normalizeKeyword(keyword: string): string {
		return keyword.toLowerCase().trim();
	}

	function validateKeyword(keyword: string): boolean {
		const normalized = normalizeKeyword(keyword);
		return normalized.length > 0 && normalized.length <= 50 && !smartContentFilter.customKeywords.includes(normalized);
	}

	// Accessibility state and functions
	let announcements = $state<string[]>([]);
	let lastAnnouncementId = $state(0);

	// Screen reader announcement function
	function announceToScreenReader(message: string) {
		announcements.push(message);
		lastAnnouncementId++;
		
		// Clean up old announcements after 3 seconds
		setTimeout(() => {
			announcements = announcements.slice(1);
		}, 3000);
	}

	// Enhanced keyboard navigation for section toggles
	function handleSectionKeyDown(event: KeyboardEvent, toggleFunction: () => void) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleFunction();
		}
	}

	// Enhanced keyboard navigation for filter toggles
	function handleFilterKeyDown(event: KeyboardEvent, filterKey: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			const newValue = !smartContentFilter.preferences[filterKey as keyof typeof smartContentFilter.preferences];
			smartContentFilter.togglePreference(filterKey as any);
			
			// Announce the change
			const filterName = filterKey.replace('filter', '').replace(/([A-Z])/g, ' $1').toLowerCase();
			announceToScreenReader(`${filterName} filter ${newValue ? 'enabled' : 'disabled'}`);
		}
	}

	// Enhanced keyboard navigation for preset buttons
	function handlePresetKeyDown(event: KeyboardEvent, presetId: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			const wasActive = isPresetActive(presetId);
			togglePreset(presetId);
			
			// Find preset name for announcement
			const preset = [...basicPresets, ...specializedPresets].find(p => p.id === presetId);
			const presetName = preset?.label || presetId;
			announceToScreenReader(`${presetName} preset ${wasActive ? 'deactivated' : 'activated'}`);
		}
	}

	// Skip link navigation
	function skipToSection(sectionId: string) {
		const element = document.getElementById(sectionId);
		if (element) {
			element.focus();
			element.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	// Enhanced focus management for form inputs
	function handleInputKeyDown(event: KeyboardEvent, submitFunction: () => void) {
		if (event.key === 'Enter') {
			event.preventDefault();
			submitFunction();
		}
	}

	// Focus management for modal dialogs
	function manageFocusForModal(isOpen: boolean, modalId: string) {
		if (isOpen) {
			// Focus the first focusable element in the modal
			setTimeout(() => {
				const modal = document.getElementById(modalId);
				if (modal) {
					const focusableElements = modal.querySelectorAll(
						'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
					);
					if (focusableElements.length > 0) {
						(focusableElements[0] as HTMLElement).focus();
					}
				}
			}, 0);
		}
	}

	// Watch for modal state changes to manage focus
	$effect(() => {
		manageFocusForModal(showImportConfirmation, 'import-confirmation-modal');
	});

	$effect(() => {
		manageFocusForModal(showResetConfirmation, 'reset-confirmation-modal');
	});

	$effect(() => {
		manageFocusForModal(showClearAllConfirmation, 'clear-all-confirmation-modal');
	});

	// Integration Testing & Production Helpers
	let testMode = $state(false);
	let testResults = $state<Array<{test: string, passed: boolean, message?: string}>>([]);

	// Test all component functionality (for development/QA)
	async function runIntegrationTests() {
		if (!testMode) return;
		
		testResults = [];
		const addTestResult = (test: string, passed: boolean, message?: string) => {
			testResults.push({ test, passed, message });
		};

		// Test 1: Main toggle functionality
		try {
			const initialState = smartContentFilter.isEnabled;
			smartContentFilter.toggleEnabled();
			const newState = smartContentFilter.isEnabled;
			addTestResult('Main Toggle', initialState !== newState, 'Toggle state changed correctly');
			smartContentFilter.toggleEnabled(); // Reset
		} catch (error) {
			addTestResult('Main Toggle', false, `Error: ${error}`);
		}

		// Test 2: Filter preferences
		try {
			const testFilters = ['filterPolitics', 'filterSports', 'filterLowQuality'];
			let allPassed = true;
			
			for (const filter of testFilters) {
				const initial = smartContentFilter.preferences[filter as keyof typeof smartContentFilter.preferences];
				smartContentFilter.togglePreference(filter as any);
				const updated = smartContentFilter.preferences[filter as keyof typeof smartContentFilter.preferences];
				if (initial === updated) {
					allPassed = false;
					break;
				}
				smartContentFilter.togglePreference(filter as any); // Reset
			}
			
			addTestResult('Filter Toggles', allPassed, 'All filter toggles working');
		} catch (error) {
			addTestResult('Filter Toggles', false, `Error: ${error}`);
		}

		// Test 3: Custom keywords
		try {
			const testKeyword = 'test-keyword-' + Date.now();
			const initialCount = smartContentFilter.customKeywords.length;
			smartContentFilter.addCustomKeyword(testKeyword);
			const afterAdd = smartContentFilter.customKeywords.length;
			smartContentFilter.removeCustomKeyword(testKeyword);
			const afterRemove = smartContentFilter.customKeywords.length;
			
			addTestResult('Custom Keywords', 
				afterAdd === initialCount + 1 && afterRemove === initialCount,
				'Add/remove keywords working');
		} catch (error) {
			addTestResult('Custom Keywords', false, `Error: ${error}`);
		}

		// Test 4: Section visibility and lazy loading
		try {
			ensureSectionLoaded('content-quality');
			ensureSectionLoaded('topics-subjects');
			const isLoaded = loadedSections.has('content-quality') && loadedSections.has('topics-subjects');
			addTestResult('Lazy Loading', isLoaded, 'Sections load on demand');
		} catch (error) {
			addTestResult('Lazy Loading', false, `Error: ${error}`);
		}

		// Test 5: Accessibility features
		try {
			announceToScreenReader('Test announcement');
			const hasAnnouncements = announcements.length > 0;
			addTestResult('Accessibility', hasAnnouncements, 'Screen reader announcements working');
		} catch (error) {
			addTestResult('Accessibility', false, `Error: ${error}`);
		}

		console.log('Integration test results:', testResults);
	}

	// Production polish: Responsive design utilities
	const responsiveBreakpoints = {
		sm: 640,
		md: 768,
		lg: 1024,
		xl: 1280
	};

	let screenSize = $state('lg');
	
	// Update screen size for responsive behavior
	function updateScreenSize() {
		if (typeof window !== 'undefined') {
			const width = window.innerWidth;
			if (width < responsiveBreakpoints.sm) screenSize = 'xs';
			else if (width < responsiveBreakpoints.md) screenSize = 'sm';
			else if (width < responsiveBreakpoints.lg) screenSize = 'md';
			else if (width < responsiveBreakpoints.xl) screenSize = 'lg';
			else screenSize = 'xl';
		}
	}

	// Monitor window resize for responsive behavior
	$effect(() => {
		if (typeof window !== 'undefined') {
			updateScreenSize();
			window.addEventListener('resize', updateScreenSize);
			return () => window.removeEventListener('resize', updateScreenSize);
		}
	});

	// Enhanced responsive grid classes based on screen size
	const getResponsiveGridClasses = () => {
		switch (screenSize) {
			case 'xs':
				return 'grid-cols-1';
			case 'sm':
				return 'grid-cols-1 sm:grid-cols-2';
			case 'md':
				return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2';
			default:
				return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
		}
	};

	// Final polish: Enhanced animations and transitions
	const enhancedTransitionClasses = "transition-all duration-300 ease-in-out transform";
	const enhancedHoverClasses = "hover:scale-[1.02] hover:shadow-md";






</script>

<!-- Skip Links for Keyboard Navigation -->
<div class="sr-only">
	<a
		href="#main-toggle"
		class="absolute top-4 left-4 z-50 px-4 py-2 bg-blue-600 text-white rounded focus:not-sr-only focus:relative focus:z-auto"
		onclick={(e) => { e.preventDefault(); skipToSection('main-toggle'); }}
	>
		Skip to main toggle
	</a>
	<a
		href="#filter-sections"
		class="absolute top-4 left-4 z-50 px-4 py-2 bg-blue-600 text-white rounded focus:not-sr-only focus:relative focus:z-auto"
		onclick={(e) => { e.preventDefault(); skipToSection('filter-sections'); }}
	>
		Skip to filter sections
	</a>
	<a
		href="#system-controls"
		class="absolute top-4 left-4 z-50 px-4 py-2 bg-blue-600 text-white rounded focus:not-sr-only focus:relative focus:z-auto"
		onclick={(e) => { e.preventDefault(); skipToSection('system-controls'); }}
	>
		Skip to system controls
	</a>
</div>

<!-- Live Region for Screen Reader Announcements -->
<div 
	aria-live="polite" 
	aria-atomic="true" 
	class="sr-only"
	role="status"
	aria-label="Filter setting changes"
>
	{#each announcements as announcement, index (lastAnnouncementId - announcements.length + index + 1)}
		<div>{announcement}</div>
	{/each}
</div>

<!-- Main Content Area with Landmark Role -->
<main class="space-y-6 p-4" aria-label="Content Filter Settings">
	<!-- Main Toggle Section -->
	<section id="main-toggle" class="mb-6" aria-labelledby="main-toggle-heading">
		<div class="flex items-center justify-between">
			<div>
				<div class="flex items-center gap-2 mb-1">
					<Icon icon="tabler:filter" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
					<h4 id="main-toggle-heading" class="text-sm font-medium text-gray-700 dark:text-gray-300">
						{s('settings.contentFilter.enableTitle') || 'Content Filtering'}
					</h4>
				</div>
				<p class="text-xs text-gray-500 dark:text-gray-400">
					{s('settings.contentFilter.enableDescription') || 'Automatically filter low-quality, irrelevant, or unwanted content using smart analysis'}
				</p>
			</div>

			<!-- Main Toggle Switch -->
			<button
				type="button"
				onclick={() => {
					smartContentFilter.toggleEnabled();
				}}
				class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 {smartContentFilter.isEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'}"
				role="switch"
				aria-checked={smartContentFilter.isEnabled}
				aria-label={smartContentFilter.isEnabled ? 'Disable content filtering' : 'Enable content filtering'}
			>
				<span
					class="inline-block h-4 w-4 transform rounded-full bg-white transition {smartContentFilter.isEnabled ? 'translate-x-6' : 'translate-x-1'}"
				></span>
			</button>
		</div>
	</section>

	<!-- Quick Setup Section with improved spacing -->
	<div class="flex flex-col space-y-2">
		<div class="flex items-center gap-2 mb-1">
			<Icon icon="tabler:settings" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.contentFilter.basicPresets.label') || 'Quick Setup'}
			</span>
		</div>
		<p class="text-xs text-gray-500 dark:text-gray-400">
			{s('settings.contentFilter.basicPresets.description') || 'Choose from preset configurations to quickly set up your content filters'}
		</p>

		<!-- Active Preset Indicator -->
		{#if activePreset}
			<div class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
				<div class="flex items-center justify-between">
					<div class="flex items-center space-x-3">
						<Icon icon={activePreset.icon} class="h-5 w-5 text-blue-600 dark:text-blue-400" />
						<div>
							<p class="text-sm font-medium text-blue-900 dark:text-blue-100">
								Active: {activePreset.label}
							</p>
							<p class="text-xs text-blue-700 dark:text-blue-300">
								{activePreset.tooltip}
							</p>
						</div>
					</div>
					<Tooltip text="Reset to custom configuration">
						<button
							type="button"
							class="px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 border border-blue-300 dark:border-blue-600 rounded hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors"
							onclick={resetToActivePreset}
						>
							Reset
						</button>
					</Tooltip>
				</div>
			</div>
		{/if}

		<!-- Basic Presets -->
		<div class="mb-6">
			<h5 class="mb-3 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
				{s('settings.contentFilter.basicPresets.title') || 'Basic Presets'}
			</h5>
			<div class="flex w-full">
				{#each basicPresets as preset, index}
					{@const isActive = isPresetActive(preset.id)}
					{@const conflicts = getPresetConflicts(preset.id)}
					{@const canActivate = canActivatePreset(preset.id)}
					
					<div class="flex-1">
						<Tooltip text={!canActivate && !isActive ? getDeactivationReason(preset.id) : preset.tooltip}>
							<button
								type="button"
								class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {isActive 
									? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
									: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
								} {!canActivate && !isActive ? 'opacity-60' : ''}"
								onclick={() => togglePreset(preset.id)}
								disabled={!canActivate && !isActive}
							>
								<div class="flex flex-col items-center gap-2">
									<Icon 
										icon={preset.icon} 
										class="h-8 w-8 {isActive 
											? 'text-blue-600 dark:text-blue-400' 
											: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
										}" 
									/>
									<span class="text-sm font-medium text-center leading-tight px-2">{preset.label}</span>
								</div>
								
								{#if conflicts.length > 0 && !isActive}
									<div class="absolute top-2 right-2">
										<Icon icon="tabler:alert-circle" class="h-4 w-4 text-orange-500" />
									</div>
								{/if}
								
								{#if isActive}
									<div class="absolute top-2 right-2">
										<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
									</div>
								{/if}
							</button>
						</Tooltip>
					</div>
					
					{#if index < basicPresets.length - 1}
						<div class="w-1"></div>
					{/if}
				{/each}
			</div>
		</div>

		<!-- Specialized Presets -->
		<div>
			<h5 class="mb-3 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
				{s('settings.contentFilter.presets.label') || 'Specialized Presets'}
			</h5>
			<div class="flex flex-wrap w-full gap-1">
				{#each specializedPresets as preset, index}
					{@const isActive = isPresetActive(preset.id)}
					{@const conflicts = getPresetConflicts(preset.id)}
					{@const canActivate = canActivatePreset(preset.id)}
					{@const isLastInRow = (index + 1) % 3 === 0 || index === specializedPresets.length - 1}
					
					<div class="flex-1 min-w-0" style="flex-basis: calc(33.333% - {isLastInRow ? '0px' : '0.33rem'});">
						<Tooltip text={!canActivate && !isActive ? getDeactivationReason(preset.id) : preset.tooltip}>
							<button
								type="button"
								class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {isActive 
									? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
									: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
								} {!canActivate && !isActive ? 'opacity-60' : ''}"
								onclick={() => togglePreset(preset.id)}
								disabled={!canActivate && !isActive}
							>
								<div class="flex flex-col items-center gap-2">
									<Icon 
										icon={preset.icon} 
										class="h-8 w-8 {isActive 
											? 'text-blue-600 dark:text-blue-400' 
											: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
										}" 
									/>
									<span class="text-sm font-medium text-center leading-tight px-2">{preset.label}</span>
								</div>
								
								{#if conflicts.length > 0 && !isActive}
									<div class="absolute top-2 right-2">
										<Icon icon="tabler:alert-circle" class="h-4 w-4 text-orange-500" />
									</div>
								{/if}
								
								{#if isActive}
									<div class="absolute top-2 right-2">
										<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
									</div>
								{/if}
							</button>
						</Tooltip>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Content Quality Section -->
	<div class="flex flex-col space-y-2">
		<div class="flex items-center gap-2 mb-1">
			<Icon icon="tabler:shield-check" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.contentFilter.contentQuality.label') || 'Content Quality'}
			</span>
		</div>
		<p class="text-xs text-gray-500 dark:text-gray-400">
			{s('settings.contentFilter.contentQuality.description') || 'Filter content based on quality indicators and editorial standards'}
		</p>

		<div class="flex flex-wrap w-full gap-1">
			<!-- Low Quality Content Filter -->
			<div class="flex-1 min-w-0" style="flex-basis: calc(33.333% - 0.33rem);">
				<Tooltip text="Filter content with poor writing quality, clickbait, or unreliable sources">
					<button
						type="button"
						class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {smartContentFilter.preferences.filterLowQuality
							? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
							: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
						}"
						onclick={() => smartContentFilter.togglePreference('filterLowQuality')}
					>
						<div class="flex flex-col items-center gap-2">
							<Icon icon="tabler:thumb-down" class="h-8 w-8 {smartContentFilter.preferences.filterLowQuality
								? 'text-blue-600 dark:text-blue-400' 
								: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
							}" />
							<span class="text-sm font-medium text-center leading-tight px-2">
								Low Quality
							</span>
						</div>
						
						{#if smartContentFilter.preferences.filterLowQuality}
							<div class="absolute top-2 right-2">
								<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
							</div>
						{/if}
					</button>
				</Tooltip>
			</div>

			<!-- Promotional Content Filter -->
			<div class="flex-1 min-w-0" style="flex-basis: calc(33.333% - 0.33rem);">
				<Tooltip text="Filter sponsored content, advertisements, and promotional articles">
					<button
						type="button"
						class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {smartContentFilter.preferences.filterPromotional
							? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
							: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
						}"
						onclick={() => smartContentFilter.togglePreference('filterPromotional')}
					>
						<div class="flex flex-col items-center gap-2">
							<Icon icon="tabler:ad" class="h-8 w-8 {smartContentFilter.preferences.filterPromotional
								? 'text-blue-600 dark:text-blue-400' 
								: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
							}" />
							<span class="text-sm font-medium text-center leading-tight px-2">
								Promotional
							</span>
						</div>
						
						{#if smartContentFilter.preferences.filterPromotional}
							<div class="absolute top-2 right-2">
								<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
							</div>
						{/if}
					</button>
				</Tooltip>
			</div>

			<!-- Opinion Pieces Filter -->
			<div class="flex-1 min-w-0" style="flex-basis: calc(33.333% - 0.33rem);">
				<Tooltip text="Filter opinion pieces, editorials, and subjective commentary">
					<button
						type="button"
						class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {smartContentFilter.preferences.filterOpinions
							? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
							: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
						}"
						onclick={() => smartContentFilter.togglePreference('filterOpinions')}
					>
						<div class="flex flex-col items-center gap-2">
							<Icon icon="tabler:message-circle" class="h-8 w-8 {smartContentFilter.preferences.filterOpinions
								? 'text-blue-600 dark:text-blue-400' 
								: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
							}" />
							<span class="text-sm font-medium text-center leading-tight px-2">
								Opinions
							</span>
						</div>
						
						{#if smartContentFilter.preferences.filterOpinions}
							<div class="absolute top-2 right-2">
								<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
							</div>
						{/if}
					</button>
				</Tooltip>
			</div>

			<!-- Repetitive Content Filter -->
			<div class="flex-1 min-w-0" style="flex-basis: calc(33.333% - 0.33rem);">
				<Tooltip text="Filter duplicate stories and repetitive coverage of the same events">
					<button
						type="button"
						class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {smartContentFilter.preferences.filterRepetitive
							? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
							: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
						}"
						onclick={() => smartContentFilter.togglePreference('filterRepetitive')}
					>
						<div class="flex flex-col items-center gap-2">
							<Icon icon="tabler:repeat" class="h-8 w-8 {smartContentFilter.preferences.filterRepetitive
								? 'text-blue-600 dark:text-blue-400' 
								: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
							}" />
							<span class="text-sm font-medium text-center leading-tight px-2">
								Repetitive
							</span>
						</div>
						
						{#if smartContentFilter.preferences.filterRepetitive}
							<div class="absolute top-2 right-2">
								<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
							</div>
						{/if}
					</button>
				</Tooltip>
			</div>

			<!-- Social Media Drama Filter -->
			<div class="flex-1 min-w-0" style="flex-basis: calc(33.333% - 0.33rem);">
				<Tooltip text="Filter social media controversies, online drama, and viral disputes">
					<button
						type="button"
						class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {smartContentFilter.preferences.filterSocialMediaDrama
							? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
							: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
						}"
						onclick={() => smartContentFilter.togglePreference('filterSocialMediaDrama')}
					>
						<div class="flex flex-col items-center gap-2">
							<Icon icon="tabler:brand-twitter" class="h-8 w-8 {smartContentFilter.preferences.filterSocialMediaDrama
								? 'text-blue-600 dark:text-blue-400' 
								: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
							}" />
							<span class="text-sm font-medium text-center leading-tight px-2">
								Social Media Drama
							</span>
						</div>
						
						{#if smartContentFilter.preferences.filterSocialMediaDrama}
							<div class="absolute top-2 right-2">
								<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
							</div>
						{/if}
					</button>
				</Tooltip>
			</div>
		</div>
	</div>

	<!-- Topics & Subjects Section -->
	<div class="flex flex-col space-y-2">
		<div class="flex items-center gap-2 mb-1">
			<Icon icon="tabler:tags" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.contentFilter.topicsSubjects.label') || 'Topics & Subjects'}
			</span>
		</div>
		<p class="text-xs text-gray-500 dark:text-gray-400">
			{s('settings.contentFilter.topicsSubjects.description') || 'Filter content based on specific topics and subject areas'}
		</p>
				
				<div class="flex flex-wrap w-full gap-1">
					<!-- Politics Filter -->
					<div class="flex-1 min-w-0" style="flex-basis: calc(33.333% - 0.33rem);">
						<Tooltip text="Political news, elections, government affairs">
							<button
								type="button"
								class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {smartContentFilter.preferences.filterPolitics
									? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
									: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
								}"
								onclick={() => smartContentFilter.togglePreference('filterPolitics')}
							>
								<div class="flex flex-col items-center gap-2">
									<Icon icon="tabler:building-government" class="h-8 w-8 {smartContentFilter.preferences.filterPolitics
										? 'text-blue-600 dark:text-blue-400' 
										: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
									}" />
									<span class="text-sm font-medium text-center leading-tight px-2">
										Politics
									</span>
								</div>
								
								{#if smartContentFilter.preferences.filterPolitics}
									<div class="absolute top-2 right-2">
										<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
									</div>
								{/if}
							</button>
						</Tooltip>
					</div>

					<!-- Sports Filter -->
					<div class="flex-1 min-w-0" style="flex-basis: calc(33.333% - 0.33rem);">
						<Tooltip text="Sports news, games, athlete updates">
							<button
								type="button"
								class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {smartContentFilter.preferences.filterSports
									? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
									: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
								}"
								onclick={() => smartContentFilter.togglePreference('filterSports')}
							>
								<div class="flex flex-col items-center gap-2">
									<Icon icon="tabler:ball-football" class="h-8 w-8 {smartContentFilter.preferences.filterSports
										? 'text-blue-600 dark:text-blue-400' 
										: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
									}" />
									<span class="text-sm font-medium text-center leading-tight px-2">
										Sports
									</span>
								</div>
								
								{#if smartContentFilter.preferences.filterSports}
									<div class="absolute top-2 right-2">
										<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
									</div>
								{/if}
							</button>
						</Tooltip>
					</div>

					<!-- Financial Filter -->
					<div class="flex-1 min-w-0" style="flex-basis: calc(33.333% - 0.33rem);">
						<Tooltip text="Market news, business updates, economic reports">
							<button
								type="button"
								class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {smartContentFilter.preferences.filterFinancial
									? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
									: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
								}"
								onclick={() => smartContentFilter.togglePreference('filterFinancial')}
							>
								<div class="flex flex-col items-center gap-2">
									<Icon icon="tabler:chart-line" class="h-8 w-8 {smartContentFilter.preferences.filterFinancial
										? 'text-blue-600 dark:text-blue-400' 
										: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
									}" />
									<span class="text-sm font-medium text-center leading-tight px-2">
										Financial
									</span>
								</div>
								
								{#if smartContentFilter.preferences.filterFinancial}
									<div class="absolute top-2 right-2">
										<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
									</div>
								{/if}
							</button>
						</Tooltip>
					</div>

					<!-- Technology Filter -->
					<div class="flex-1 min-w-0" style="flex-basis: calc(33.333% - 0.33rem);">
						<Tooltip text="Tech news, gadgets, software updates">
							<button
								type="button"
								class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {smartContentFilter.preferences.filterTechnology
									? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
									: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
								}"
								onclick={() => smartContentFilter.togglePreference('filterTechnology')}
							>
								<div class="flex flex-col items-center gap-2">
									<Icon icon="tabler:device-laptop" class="h-8 w-8 {smartContentFilter.preferences.filterTechnology
										? 'text-blue-600 dark:text-blue-400' 
										: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
									}" />
									<span class="text-sm font-medium text-center leading-tight px-2">
										Technology
									</span>
								</div>
								
								{#if smartContentFilter.preferences.filterTechnology}
									<div class="absolute top-2 right-2">
										<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
									</div>
								{/if}
							</button>
						</Tooltip>
					</div>

					<!-- Entertainment Filter -->
					<div class="flex-1 min-w-0" style="flex-basis: calc(33.333% - 0.33rem);">
						<Tooltip text="Movies, TV shows, music, pop culture">
							<button
								type="button"
								class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {smartContentFilter.preferences.filterEntertainment
									? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
									: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
								}"
								onclick={() => smartContentFilter.togglePreference('filterEntertainment')}
							>
								<div class="flex flex-col items-center gap-2">
									<Icon icon="tabler:movie" class="h-8 w-8 {smartContentFilter.preferences.filterEntertainment
										? 'text-blue-600 dark:text-blue-400' 
										: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
									}" />
									<span class="text-sm font-medium text-center leading-tight px-2">
										Entertainment
									</span>
								</div>
								
								{#if smartContentFilter.preferences.filterEntertainment}
									<div class="absolute top-2 right-2">
										<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
									</div>
								{/if}
							</button>
						</Tooltip>
					</div>

					<!-- Celebrity Filter -->
					<div class="flex-1 min-w-0" style="flex-basis: calc(33.333% - 0.33rem);">
						<Tooltip text="Celebrity news, gossip, personal lives">
							<button
								type="button"
								class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {smartContentFilter.preferences.filterCelebrity
									? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
									: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
								}"
								onclick={() => smartContentFilter.togglePreference('filterCelebrity')}
							>
								<div class="flex flex-col items-center gap-2">
									<Icon icon="tabler:star" class="h-8 w-8 {smartContentFilter.preferences.filterCelebrity
										? 'text-blue-600 dark:text-blue-400' 
										: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
									}" />
									<span class="text-sm font-medium text-center leading-tight px-2">
										Celebrity
									</span>
								</div>
								
								{#if smartContentFilter.preferences.filterCelebrity}
									<div class="absolute top-2 right-2">
										<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
									</div>
								{/if}
							</button>
						</Tooltip>
					</div>

					<!-- Weather Filter -->
					<div class="flex-1 min-w-0" style="flex-basis: calc(33.333% - 0.33rem);">
						<Tooltip text="Weather reports, forecasts, climate updates">
							<button
								type="button"
								class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {smartContentFilter.preferences.filterWeather
									? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
									: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
								}"
								onclick={() => smartContentFilter.togglePreference('filterWeather')}
							>
								<div class="flex flex-col items-center gap-2">
									<Icon icon="tabler:cloud" class="h-8 w-8 {smartContentFilter.preferences.filterWeather
										? 'text-blue-600 dark:text-blue-400' 
										: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
									}" />
									<span class="text-sm font-medium text-center leading-tight px-2">
										Weather
									</span>
								</div>
								
								{#if smartContentFilter.preferences.filterWeather}
									<div class="absolute top-2 right-2">
										<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
									</div>
								{/if}
							</button>
						</Tooltip>
					</div>
				</div>
		</div>

	<!-- News Types Section -->
	<div class="flex flex-col space-y-2">
		<div class="flex items-center gap-2 mb-1">
			<Icon icon="tabler:news" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.contentFilter.newsTypes.label') || 'News Types'}
			</span>
		</div>
		<p class="text-xs text-gray-500 dark:text-gray-400">
			{s('settings.contentFilter.newsTypes.description') || 'Filter content based on news format and delivery style'}
		</p>

		<div class="flex flex-wrap w-full gap-1">
			<!-- Breaking News Filter -->
			<div class="flex-1 min-w-0" style="flex-basis: calc(33.333% - 0.33rem);">
				<Tooltip text="Urgent alerts, breaking news notifications, live updates">
					<button
						type="button"
						class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {smartContentFilter.preferences.filterBreakingNews
							? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
							: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
						}"
						onclick={() => smartContentFilter.togglePreference('filterBreakingNews')}
					>
						<div class="flex flex-col items-center gap-2">
							<Icon icon="tabler:urgent" class="h-8 w-8 {smartContentFilter.preferences.filterBreakingNews
								? 'text-blue-600 dark:text-blue-400' 
								: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
							}" />
							<span class="text-sm font-medium text-center leading-tight px-2">
								Breaking News
							</span>
						</div>
						
						{#if smartContentFilter.preferences.filterBreakingNews}
							<div class="absolute top-2 right-2">
								<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
							</div>
						{/if}
					</button>
				</Tooltip>
			</div>

			<!-- Local News Filter -->
			<div class="flex-1 min-w-0" style="flex-basis: calc(33.333% - 0.33rem);">
				<Tooltip text="Hyper-local stories, community events, regional coverage">
					<button
						type="button"
						class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {smartContentFilter.preferences.filterLocalNews
							? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
							: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
						}"
						onclick={() => smartContentFilter.togglePreference('filterLocalNews')}
					>
						<div class="flex flex-col items-center gap-2">
							<Icon icon="tabler:map-pin" class="h-8 w-8 {smartContentFilter.preferences.filterLocalNews
								? 'text-blue-600 dark:text-blue-400' 
								: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
							}" />
							<span class="text-sm font-medium text-center leading-tight px-2">
								Local News
							</span>
						</div>
						
						{#if smartContentFilter.preferences.filterLocalNews}
							<div class="absolute top-2 right-2">
								<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
							</div>
						{/if}
					</button>
				</Tooltip>
			</div>

			<!-- International News Filter -->
			<div class="flex-1 min-w-0" style="flex-basis: calc(33.333% - 0.33rem);">
				<Tooltip text="Global events, foreign affairs, international coverage">
					<button
						type="button"
						class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {smartContentFilter.preferences.filterInternationalNews
							? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
							: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
						}"
						onclick={() => smartContentFilter.togglePreference('filterInternationalNews')}
					>
						<div class="flex flex-col items-center gap-2">
							<Icon icon="tabler:globe" class="h-8 w-8 {smartContentFilter.preferences.filterInternationalNews
								? 'text-blue-600 dark:text-blue-400' 
								: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
							}" />
							<span class="text-sm font-medium text-center leading-tight px-2">
								International News
							</span>
						</div>
						
						{#if smartContentFilter.preferences.filterInternationalNews}
							<div class="absolute top-2 right-2">
								<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
							</div>
						{/if}
					</button>
				</Tooltip>
			</div>
		</div>
	</div>



	<!-- Wellness & Mental Health Section -->
	<div class="flex flex-col space-y-2">
		<div class="flex items-center gap-2 mb-1">
			<Icon icon="tabler:brain" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.contentFilter.wellnessMental.label') || 'Wellness & Mental Health'}
			</span>
		</div>
		<p class="text-xs text-gray-500 dark:text-gray-400">
			{s('settings.contentFilter.wellnessMental.description') || 'Filter content that may negatively impact mental health and well-being'}
		</p>
		
		<div class="flex flex-wrap w-full gap-1">
			<!-- Negative News Filter -->
			<div class="flex-1 min-w-0" style="flex-basis: calc(33.333% - 0.33rem);">
				<Tooltip text="Stories with predominantly negative sentiment and pessimistic outlook">
					<button
						type="button"
						class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {smartContentFilter.preferences.filterNegativeNews
							? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
							: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
						}"
						onclick={() => smartContentFilter.togglePreference('filterNegativeNews')}
					>
						<div class="flex flex-col items-center gap-2">
							<Icon icon="tabler:mood-sad" class="h-8 w-8 {smartContentFilter.preferences.filterNegativeNews
								? 'text-blue-600 dark:text-blue-400' 
								: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
							}" />
							<span class="text-sm font-medium text-center leading-tight px-2">
								Negative News
							</span>
						</div>
						
						{#if smartContentFilter.preferences.filterNegativeNews}
							<div class="absolute top-2 right-2">
								<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
							</div>
						{/if}
					</button>
				</Tooltip>
			</div>

			<!-- Violence Filter -->
			<div class="flex-1 min-w-0" style="flex-basis: calc(33.333% - 0.33rem);">
				<Tooltip text="Content involving physical harm, conflict, and disturbing imagery">
					<button
						type="button"
						class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {smartContentFilter.preferences.filterViolence
							? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
							: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
						}"
						onclick={() => smartContentFilter.togglePreference('filterViolence')}
					>
						<div class="flex flex-col items-center gap-2">
							<Icon icon="tabler:shield-x" class="h-8 w-8 {smartContentFilter.preferences.filterViolence
								? 'text-blue-600 dark:text-blue-400' 
								: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
							}" />
							<span class="text-sm font-medium text-center leading-tight px-2">
								Violence
							</span>
						</div>
						
						{#if smartContentFilter.preferences.filterViolence}
							<div class="absolute top-2 right-2">
								<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
							</div>
						{/if}
					</button>
				</Tooltip>
			</div>

			<!-- Anxiety-Inducing Content Filter -->
			<div class="flex-1 min-w-0" style="flex-basis: calc(33.333% - 0.33rem);">
				<Tooltip text="Content that may trigger stress, worry, or anxiety responses">
					<button
						type="button"
						class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {smartContentFilter.preferences.filterAnxietyInducing
							? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
							: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
						}"
						onclick={() => smartContentFilter.togglePreference('filterAnxietyInducing')}
					>
						<div class="flex flex-col items-center gap-2">
							<Icon icon="tabler:heart-rate-monitor" class="h-8 w-8 {smartContentFilter.preferences.filterAnxietyInducing
								? 'text-blue-600 dark:text-blue-400' 
								: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
							}" />
							<span class="text-sm font-medium text-center leading-tight px-2">
								Anxiety-Inducing
							</span>
						</div>
						
						{#if smartContentFilter.preferences.filterAnxietyInducing}
							<div class="absolute top-2 right-2">
								<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
							</div>
						{/if}
					</button>
				</Tooltip>
			</div>

			<!-- Economic Pessimism Filter -->
			<div class="flex-1 min-w-0" style="flex-basis: calc(33.333% - 0.33rem);">
				<Tooltip text="Doom-and-gloom economic forecasts and financial fear-mongering">
					<button
						type="button"
						class="group relative flex flex-col items-center justify-center p-6 text-center transition-all duration-200 h-32 w-full rounded-lg {smartContentFilter.preferences.filterEconomicPessimism
							? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 ring-2 ring-blue-500 dark:ring-blue-400' 
							: 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 hover:scale-[1.01]'
						}"
						onclick={() => smartContentFilter.togglePreference('filterEconomicPessimism')}
					>
						<div class="flex flex-col items-center gap-2">
							<Icon icon="tabler:trending-down" class="h-8 w-8 {smartContentFilter.preferences.filterEconomicPessimism
								? 'text-blue-600 dark:text-blue-400' 
								: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
							}" />
							<span class="text-sm font-medium text-center leading-tight px-2">
								Economic Pessimism
							</span>
						</div>
						
						{#if smartContentFilter.preferences.filterEconomicPessimism}
							<div class="absolute top-2 right-2">
								<Icon icon="tabler:check-circle" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
							</div>
						{/if}
					</button>
				</Tooltip>
			</div>
		</div>
	</div>

	<!-- Custom Keywords Section -->
	<div class="flex flex-col space-y-2">
		<div class="flex items-center gap-2 mb-1">
			<Icon icon="tabler:key" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.contentFilter.customKeywords') || 'Custom Keywords'}
			</span>
			{#if smartContentFilter.customKeywords.length > 0}
				<span class="text-xs text-blue-600 dark:text-blue-400 font-medium">
					({smartContentFilter.customKeywords.length} active)
				</span>
			{/if}
		</div>
		<p class="text-xs text-gray-500 dark:text-gray-400">
			{s('settings.contentFilter.customKeywords.description') || 'Add custom keywords to filter content containing specific terms or phrases'}
		</p>
		
		<div class="mt-4">
			<!-- Add Single Keyword -->
				<div class="mb-4">
					<label for="new-keyword-input" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
						{s('settings.contentFilter.customKeywords.addSingle') || 'Add Keyword'}
					</label>
					<div class="flex space-x-2">
						<input
							id="new-keyword-input"
							type="text"
							bind:value={newKeywordInput}
							placeholder={s('settings.contentFilter.customKeywords.placeholder') || 'Enter keyword...'}
							class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-blue-400 dark:focus:ring-blue-400"
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									addCustomKeyword();
								}
							}}
						/>
						<button
							type="button"
							class="inline-flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-700 dark:hover:bg-blue-800"
							onclick={addCustomKeyword}
							disabled={!validateKeyword(newKeywordInput)}
						>
							<Icon icon="tabler:plus" class="h-4 w-4" />
							<span>{s('settings.contentFilter.customKeywords.add') || 'Add'}</span>
						</button>
					</div>
					{#if newKeywordInput.trim() && !validateKeyword(newKeywordInput)}
						<p class="mt-1 text-xs text-red-600 dark:text-red-400">
							{smartContentFilter.customKeywords.includes(normalizeKeyword(newKeywordInput)) 
								? (s('settings.contentFilter.customKeywords.duplicate') || 'Keyword already exists')
								: (s('settings.contentFilter.customKeywords.invalid') || 'Invalid keyword (must be 1-50 characters)')
							}
						</p>
					{/if}
				</div>

				<!-- Add Bulk Keywords -->
				<div class="mb-6">
					<label for="bulk-keywords-input" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
						{s('settings.contentFilter.customKeywords.addBulk') || 'Add Multiple Keywords'}
					</label>
					<div class="space-y-2">
						<textarea
							id="bulk-keywords-input"
							bind:value={bulkKeywordsInput}
							placeholder={s('settings.contentFilter.customKeywords.bulkPlaceholder') || 'Enter keywords separated by commas...'}
							rows="3"
							class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-blue-400 dark:focus:ring-blue-400"
						></textarea>
						<button
							type="button"
							class="inline-flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-700 dark:hover:bg-blue-800"
							onclick={addBulkKeywords}
							disabled={!bulkKeywordsInput.trim()}
						>
							<Icon icon="tabler:plus" class="h-4 w-4" />
							<span>{s('settings.contentFilter.customKeywords.addBulk.button') || 'Add Keywords'}</span>
						</button>
					</div>
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						{s('settings.contentFilter.customKeywords.bulkHelp') || 'Separate multiple keywords with commas. Duplicates will be ignored.'}
					</p>
				</div>

				<!-- Current Keywords Display -->
				{#if smartContentFilter.customKeywords.length > 0}
					<div class="mb-4">
						<div class="mb-3 flex items-center justify-between">
							<div class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{s('settings.contentFilter.customKeywords.current') || 'Current Keywords'} ({smartContentFilter.customKeywords.length})
							</div>
							<button
								type="button"
								class="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
								onclick={clearAllCustomKeywords}
							>
								{s('settings.contentFilter.customKeywords.clearAll') || 'Clear All'}
							</button>
						</div>
						<div class="flex flex-wrap gap-2">
							{#each smartContentFilter.customKeywords as keyword}
								<div class="group flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm dark:bg-gray-700/50">
									<Icon icon="tabler:tag" class="mr-2 h-4 w-4 text-gray-600 dark:text-gray-400 opacity-80" />
									<span class="text-gray-800 dark:text-gray-200">{keyword}</span>
									<button
										type="button"
										class="ml-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 opacity-75 hover:opacity-100"
										onclick={() => removeCustomKeyword(keyword)}
										aria-label={`Remove keyword: ${keyword}`}
									>
										<Icon icon="tabler:x" class="h-3 w-3" />
									</button>
								</div>
							{/each}
						</div>
					</div>
				{:else}
					<div class="rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-700/50">
						<Icon icon="tabler:tag-off" class="mx-auto mb-2 h-8 w-8 text-gray-400" />
						<p class="text-sm text-gray-600 dark:text-gray-400">
							{s('settings.contentFilter.customKeywords.empty') || 'No custom keywords added yet'}
						</p>
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						{s('settings.contentFilter.customKeywords.emptyHelp') || 'Add keywords above to filter content containing specific terms'}
					</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Filter Scope and Mode Controls Section -->
	<div class="flex flex-col space-y-2">
		<div class="flex items-center gap-2 mb-1">
			<Icon icon="tabler:adjustments" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.contentFilter.filterScope') || 'Filter Scope & Mode'}
			</span>
			{#if smartContentFilter.preferences.minimumQuality > 0 || smartContentFilter.preferences.minimumSentiment !== 0 || smartContentFilter.preferences.minimumRelevance > 0}
				<span class="text-xs text-blue-600 dark:text-blue-400 font-medium">
					(Custom settings active)
				</span>
			{/if}
		</div>
		<p class="text-xs text-gray-500 dark:text-gray-400">
			{s('settings.contentFilter.filterScope.description') || 'Configure how and where filters are applied'}
		</p>

		<div class="mt-4">
				<div class="space-y-6">
					<!-- Filter Scope Selection -->
					<div>
						<div class="flex items-center space-x-2 mb-3">
							<Icon icon="tabler:target" class="h-4 w-4 text-gray-500 dark:text-gray-400" />
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{s('settings.contentFilter.filterScope.scope') || 'Filter Scope'}
							</span>
							<Tooltip 
								text={s('settings.contentFilter.filterScope.scope.tooltip') || 'Choose which parts of content to analyze when applying filters'}
								position="top"
							>
								<Icon icon="tabler:info-circle" class="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
							</Tooltip>
						</div>
						<p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
							{s('settings.contentFilter.filterScope.scope.description') || 'Determines which content areas are analyzed for filtering decisions'}
						</p>
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
							<button
								type="button"
								class="flex items-center justify-center space-x-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors {smartContentFilter.filterScope === 'title' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
								onclick={() => smartContentFilter.setFilterScope('title')}
							>
								<Icon icon="tabler:heading" class="h-4 w-4" />
								<span>{s('settings.contentFilter.filterScope.title') || 'Title Only'}</span>
							</button>
							<button
								type="button"
								class="flex items-center justify-center space-x-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors {smartContentFilter.filterScope === 'summary' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
								onclick={() => smartContentFilter.setFilterScope('summary')}
							>
								<Icon icon="tabler:file-text" class="h-4 w-4" />
								<span>{s('settings.contentFilter.filterScope.summary') || 'Summary'}</span>
							</button>
							<button
								type="button"
								class="flex items-center justify-center space-x-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors {smartContentFilter.filterScope === 'all' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
								onclick={() => smartContentFilter.setFilterScope('all')}
							>
								<Icon icon="tabler:file-description" class="h-4 w-4" />
								<span>{s('settings.contentFilter.filterScope.all') || 'All Content'}</span>
							</button>
						</div>
						<div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
							{#if smartContentFilter.filterScope === 'title'}
								{s('settings.contentFilter.filterScope.title.help') || 'Only analyze article titles for filtering decisions. Fastest but least comprehensive.'}
							{:else if smartContentFilter.filterScope === 'summary'}
								{s('settings.contentFilter.filterScope.summary.help') || 'Analyze titles and summaries. Good balance of speed and accuracy.'}
							{:else}
								{s('settings.contentFilter.filterScope.all.help') || 'Analyze all available content including full articles. Most comprehensive but slower.'}
							{/if}
						</div>
					</div>

					<!-- Filter Mode Selection -->
					<div>
						<div class="flex items-center space-x-2 mb-3">
							<Icon icon="tabler:eye" class="h-4 w-4 text-gray-500 dark:text-gray-400" />
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{s('settings.contentFilter.filterMode') || 'Filter Mode'}
							</span>
							<Tooltip 
								text={s('settings.contentFilter.filterMode.tooltip') || 'Choose how filtered content is handled in the interface'}
								position="top"
							>
								<Icon icon="tabler:info-circle" class="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
							</Tooltip>
						</div>
						<p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
							{s('settings.contentFilter.filterMode.description') || 'Controls how filtered content appears in your feed'}
						</p>
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<button
								type="button"
								class="flex items-center justify-center space-x-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors {smartContentFilter.filterMode === 'hide' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
								onclick={() => smartContentFilter.setFilterMode('hide')}
							>
								<Icon icon="tabler:eye-off" class="h-4 w-4" />
								<span>{s('settings.contentFilter.filterMode.hide') || 'Hide'}</span>
							</button>
							<button
								type="button"
								class="flex items-center justify-center space-x-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors {smartContentFilter.filterMode === 'blur' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
								onclick={() => smartContentFilter.setFilterMode('blur')}
							>
								<Icon icon="tabler:blur" class="h-4 w-4" />
								<span>{s('settings.contentFilter.filterMode.blur') || 'Blur'}</span>
							</button>
						</div>
						<div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
							{#if smartContentFilter.filterMode === 'hide'}
								{s('settings.contentFilter.filterMode.hide.help') || 'Completely remove filtered content from your feed. Clean but you won\'t see what was filtered.'}
							{:else}
								{s('settings.contentFilter.filterMode.blur.help') || 'Show filtered content with a blur effect. You can still access it if needed.'}
							{/if}
						</div>
					</div>

					<!-- Show Filtered Count Toggle -->
					<div>
						<div class="flex items-center justify-between">
							<div class="flex items-center space-x-2">
								<Icon icon="tabler:numbers" class="h-4 w-4 text-gray-500 dark:text-gray-400" />
								<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
									{s('settings.contentFilter.showFilteredCount') || 'Show Filtered Count'}
								</span>
								<Tooltip 
									text={s('settings.contentFilter.showFilteredCount.tooltip') || 'Display the number of stories that have been filtered out'}
									position="top"
								>
									<Icon icon="tabler:info-circle" class="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
								</Tooltip>
							</div>
							<button
								type="button"
								class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 {smartContentFilter.showFilteredCount ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'}"
								onclick={() => smartContentFilter.setShowFilteredCount(!smartContentFilter.showFilteredCount)}
								aria-checked={smartContentFilter.showFilteredCount}
								role="switch"
							>
								<span class="sr-only">Show filtered count</span>
								<span
									class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out {smartContentFilter.showFilteredCount ? 'translate-x-6' : 'translate-x-1'}"
								></span>
							</button>
						</div>
						<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
							{s('settings.contentFilter.showFilteredCount.description') || 'When enabled, displays how many stories were filtered from each category'}
						</p>
					</div>

					<!-- Global Filter Sensitivity -->
					<div>
						<div class="flex items-center space-x-2 mb-3">
							<Icon icon="tabler:adjustments" class="h-4 w-4 text-gray-500 dark:text-gray-400" />
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{s('settings.contentFilter.globalSensitivity') || 'Global Filter Sensitivity'}
							</span>
							<Tooltip 
								text={s('settings.contentFilter.globalSensitivity.tooltip') || 'Controls how aggressively filters are applied across all categories'}
								position="top"
							>
								<Icon icon="tabler:info-circle" class="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
							</Tooltip>
						</div>
						<p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
							{s('settings.contentFilter.globalSensitivity.description') || 'Adjusts the default sensitivity level for all content filters'}
						</p>
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
							<button
								type="button"
								class="flex items-center justify-center space-x-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors {smartContentFilter.preferences.filterSensitivity === 'loose' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
								onclick={() => smartContentFilter.setFilterSensitivity('loose')}
							>
								<Icon icon="tabler:feather" class="h-4 w-4" />
								<span>{s('settings.contentFilter.sensitivity.loose') || 'Loose'}</span>
							</button>
							<button
								type="button"
								class="flex items-center justify-center space-x-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors {smartContentFilter.preferences.filterSensitivity === 'balanced' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
								onclick={() => smartContentFilter.setFilterSensitivity('balanced')}
							>
								<Icon icon="tabler:balance" class="h-4 w-4" />
								<span>{s('settings.contentFilter.sensitivity.balanced') || 'Balanced'}</span>
							</button>
							<button
								type="button"
								class="flex items-center justify-center space-x-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors {smartContentFilter.preferences.filterSensitivity === 'strict' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
								onclick={() => smartContentFilter.setFilterSensitivity('strict')}
							>
								<Icon icon="tabler:shield" class="h-4 w-4" />
								<span>{s('settings.contentFilter.sensitivity.strict') || 'Strict'}</span>
							</button>
						</div>
						<div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
							{#if smartContentFilter.preferences.filterSensitivity === 'loose'}
								{s('settings.contentFilter.sensitivity.loose.help') || 'More permissive filtering. Only removes clearly unwanted content.'}
							{:else if smartContentFilter.preferences.filterSensitivity === 'balanced'}
								{s('settings.contentFilter.sensitivity.balanced.help') || 'Moderate filtering that balances content variety with quality.'}
						{:else}
							{s('settings.contentFilter.sensitivity.strict.help') || 'Aggressive filtering for maximum content quality and relevance.'}
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Advanced Similarity Section -->
	<div class="flex flex-col space-y-2">
		<div class="flex items-center gap-2 mb-1">
			<Icon icon="tabler:copy" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.contentFilter.advancedSimilarity') || 'Advanced Content Similarity'}
			</span>
			{#if smartContentFilter.preferences.filterContentSimilarity && smartContentFilter.preferences.contentSimilarityThreshold > 0}
				<span class="text-xs text-blue-600 dark:text-blue-400 font-medium">
					(Similarity detection active)
				</span>
			{/if}
		</div>
		<p class="text-xs text-gray-500 dark:text-gray-400">
			{s('settings.contentFilter.advancedSimilarity.description') || 'Detect and filter duplicate or highly similar content using advanced algorithms'}
		</p>

		<div class="mt-4">
				<p class="mb-6 text-sm text-gray-600 dark:text-gray-400">
					{s('settings.contentFilter.advancedSimilarity.description') || 'Detect and filter duplicate or highly similar content using advanced algorithms. Fine-tune how similarity is calculated and when content should be considered duplicates.'}
				</p>

				<!-- Main Content Similarity Toggle -->
				<div class="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/50">
					<div class="flex items-center justify-between">
						<div class="flex items-center space-x-3">
							<Icon icon="tabler:copy" class="h-5 w-5 text-gray-500 dark:text-gray-400" />
							<div>
								<div class="text-sm font-medium text-gray-900 dark:text-gray-100">
									{s('settings.contentFilter.contentSimilarity') || 'Content Similarity Detection'}
								</div>
								<div class="text-xs text-gray-500 dark:text-gray-400">
									{s('settings.contentFilter.contentSimilarity.description') || 'Enable intelligent detection of duplicate and similar stories'}
								</div>
							</div>
						</div>
						<button
							type="button"
							class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 {smartContentFilter.preferences.filterContentSimilarity ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'}"
							onclick={() => smartContentFilter.togglePreference('filterContentSimilarity')}
							aria-checked={smartContentFilter.preferences.filterContentSimilarity}
							role="switch"
						>
							<span class="sr-only">Toggle content similarity detection</span>
							<span
								class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out {smartContentFilter.preferences.filterContentSimilarity ? 'translate-x-6' : 'translate-x-1'}"
							></span>
						</button>
					</div>
				</div>

				{#if smartContentFilter.preferences.filterContentSimilarity}
					<!-- Similarity Threshold Slider -->
					<div class="mb-6">
						<div class="mb-3 flex items-center justify-between">
							<span class="text-sm font-medium text-gray-900 dark:text-gray-100">
								{s('settings.contentFilter.similarityThreshold') || 'Similarity Threshold'}
							</span>
							<span class="text-sm text-gray-600 dark:text-gray-400">
								{smartContentFilter.preferences.contentSimilarityThreshold}%
							</span>
						</div>
						<div class="relative">
							<input
								type="range"
								min="10"
								max="95"
								step="5"
								bind:value={smartContentFilter.preferences.contentSimilarityThreshold}
								oninput={(e) => smartContentFilter.setContentSimilarityThreshold(parseInt((e.target as HTMLInputElement).value))}
								class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 slider"
							/>
							<div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
								<span>10% (Very Loose)</span>
								<span>50% (Balanced)</span>
								<span>95% (Very Strict)</span>
							</div>
						</div>
						<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
							{s('settings.contentFilter.similarityThreshold.help') || 'Higher values require more similarity to filter content. Lower values catch more duplicates but may filter unique stories.'}
						</p>
					</div>

					<!-- Detection Mode Selection -->
					<div class="mb-6">
						<span class="mb-3 block text-sm font-medium text-gray-900 dark:text-gray-100">
							{s('settings.contentFilter.detectionMode') || 'Detection Mode'}
						</span>
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<button
								type="button"
								class="flex items-center justify-between rounded-lg border p-4 text-left transition-all duration-200 {smartContentFilter.preferences.contentSimilarityMode === 'today' 
									? 'border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-100' 
									: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-600'
								}"
								onclick={() => smartContentFilter.setContentSimilarityMode('today')}
							>
								<div class="flex items-center space-x-3">
									<Icon icon="tabler:calendar-today" class="h-5 w-5 {smartContentFilter.preferences.contentSimilarityMode === 'today' ? 'text-gray-700 dark:text-gray-300 opacity-100' : 'text-gray-500 dark:text-gray-400 opacity-75'}" />
									<div>
										<div class="text-sm font-medium">
											{s('settings.contentFilter.detectionMode.today') || 'Today Only'}
										</div>
										<div class="text-xs {smartContentFilter.preferences.contentSimilarityMode === 'today' ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'}">
											{s('settings.contentFilter.detectionMode.today.description') || 'Compare only with stories from today'}
										</div>
									</div>
								</div>
								{#if smartContentFilter.preferences.contentSimilarityMode === 'today'}
									<Icon icon="tabler:check-circle" class="h-5 w-5 text-gray-700 dark:text-gray-300 opacity-90" />
								{/if}
							</button>

							<button
								type="button"
								class="flex items-center justify-between rounded-lg border p-4 text-left transition-all duration-200 {smartContentFilter.preferences.contentSimilarityMode === 'historical' 
									? 'border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-100' 
									: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-600'
								}"
								onclick={() => smartContentFilter.setContentSimilarityMode('historical')}
							>
								<div class="flex items-center space-x-3">
									<Icon icon="tabler:history" class="h-5 w-5 {smartContentFilter.preferences.contentSimilarityMode === 'historical' ? 'text-gray-700 dark:text-gray-300 opacity-100' : 'text-gray-500 dark:text-gray-400 opacity-75'}" />
									<div>
										<div class="text-sm font-medium">
											{s('settings.contentFilter.detectionMode.historical') || 'Historical'}
										</div>
										<div class="text-xs {smartContentFilter.preferences.contentSimilarityMode === 'historical' ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'}">
											{s('settings.contentFilter.detectionMode.historical.description') || 'Compare with stories from previous days'}
										</div>
									</div>
								</div>
								{#if smartContentFilter.preferences.contentSimilarityMode === 'historical'}
									<Icon icon="tabler:check-circle" class="h-5 w-5 text-gray-700 dark:text-gray-300 opacity-90" />
								{/if}
							</button>
						</div>
					</div>

					<!-- Memory Duration Controls (only show for historical mode) -->
					{#if smartContentFilter.preferences.contentSimilarityMode === 'historical'}
						<div class="mb-6">
							<div class="mb-3 flex items-center justify-between">
								<span class="text-sm font-medium text-gray-900 dark:text-gray-100">
									{s('settings.contentFilter.memoryDuration') || 'Memory Duration'}
								</span>
								<span class="text-sm text-gray-600 dark:text-gray-400">
									{smartContentFilter.preferences.contentSimilarityExpiry} {smartContentFilter.preferences.contentSimilarityExpiry === 1 ? 'day' : 'days'}
								</span>
							</div>
							<div class="relative">
								<input
									type="range"
									min="1"
									max="30"
									step="1"
									bind:value={smartContentFilter.preferences.contentSimilarityExpiry}
									oninput={(e) => smartContentFilter.setContentSimilarityExpiry(parseInt((e.target as HTMLInputElement).value))}
									class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 slider"
								/>
								<div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
									<span>1 day</span>
									<span>7 days</span>
									<span>30 days</span>
								</div>
							</div>
							<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
								{s('settings.contentFilter.memoryDuration.help') || 'How many days back to compare stories for similarity detection. Longer periods catch more duplicates but use more memory.'}
							</p>
						</div>
					{/if}

					<!-- Detection Scope Controls -->
					<div class="mb-6">
						<span class="mb-3 block text-sm font-medium text-gray-900 dark:text-gray-100">
							{s('settings.contentFilter.detectionScope') || 'Detection Scope'}
						</span>
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<button
								type="button"
								class="flex items-center justify-between rounded-lg border p-4 text-left transition-all duration-200 {smartContentFilter.preferences.contentSimilarityScope === 'within-category' 
									? 'border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-100' 
									: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-600'
								}"
								onclick={() => smartContentFilter.setContentSimilarityScope('within-category')}
							>
								<div class="flex items-center space-x-3">
									<Icon icon="tabler:folder" class="h-5 w-5 {smartContentFilter.preferences.contentSimilarityScope === 'within-category' ? 'text-gray-700 dark:text-gray-300 opacity-100' : 'text-gray-500 dark:text-gray-400 opacity-75'}" />
									<div>
										<div class="text-sm font-medium">
											{s('settings.contentFilter.detectionScope.withinCategory') || 'Within Categories'}
										</div>
										<div class="text-xs {smartContentFilter.preferences.contentSimilarityScope === 'within-category' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}">
											{s('settings.contentFilter.detectionScope.withinCategory.description') || 'Compare only stories in the same category'}
										</div>
									</div>
								</div>
								{#if smartContentFilter.preferences.contentSimilarityScope === 'within-category'}
									<Icon icon="tabler:check-circle" class="h-5 w-5 text-gray-700 dark:text-gray-300 opacity-90" />
								{/if}
							</button>

							<button
								type="button"
								class="flex items-center justify-between rounded-lg border p-4 text-left transition-all duration-200 {smartContentFilter.preferences.contentSimilarityScope === 'across-categories' 
									? 'border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-100' 
									: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-600'
								}"
								onclick={() => smartContentFilter.setContentSimilarityScope('across-categories')}
							>
								<div class="flex items-center space-x-3">
									<Icon icon="tabler:folders" class="h-5 w-5 {smartContentFilter.preferences.contentSimilarityScope === 'across-categories' ? 'text-gray-700 dark:text-gray-300 opacity-100' : 'text-gray-500 dark:text-gray-400 opacity-75'}" />
									<div>
										<div class="text-sm font-medium">
											{s('settings.contentFilter.detectionScope.acrossCategories') || 'Across Categories'}
										</div>
										<div class="text-xs {smartContentFilter.preferences.contentSimilarityScope === 'across-categories' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}">
											{s('settings.contentFilter.detectionScope.acrossCategories.description') || 'Compare stories across all categories'}
										</div>
									</div>
								</div>
								{#if smartContentFilter.preferences.contentSimilarityScope === 'across-categories'}
									<Icon icon="tabler:check-circle" class="h-5 w-5 text-gray-700 dark:text-gray-300 opacity-90" />
								{/if}
							</button>
						</div>
					</div>

					<!-- Algorithm Weight Controls -->
					<div class="mb-6">
						<h5 class="mb-4 text-sm font-medium text-gray-900 dark:text-gray-100">
							{s('settings.contentFilter.algorithmWeights') || 'Algorithm Weight Controls'}
						</h5>
						<p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
							{s('settings.contentFilter.algorithmWeights.description') || 'Adjust how different aspects of content are weighted when calculating similarity. The algorithm automatically normalizes these weights.'}
						</p>

						<!-- Title Similarity Weight -->
						<div class="mb-4">
							<div class="mb-2 flex items-center justify-between">
								<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
									{s('settings.contentFilter.titleWeight') || 'Title Similarity Weight'}
								</span>
								<span class="text-sm text-gray-600 dark:text-gray-400">
									{smartContentFilter.preferences.similarityTitleWeight}%
								</span>
							</div>
							<input
								type="range"
								min="0"
								max="100"
								step="5"
								bind:value={smartContentFilter.preferences.similarityTitleWeight}
								oninput={(e) => {
									const titleWeight = parseInt((e.target as HTMLInputElement).value);
									smartContentFilter.setSimilarityWeights(
										titleWeight,
										smartContentFilter.preferences.similarityContentWeight,
										smartContentFilter.preferences.similarityEntityWeight
									);
								}}
								class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 slider"
							/>
							<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
								{s('settings.contentFilter.titleWeight.help') || 'How much weight to give to title similarity when comparing stories'}
							</p>
						</div>

						<!-- Content Similarity Weight -->
						<div class="mb-4">
							<div class="mb-2 flex items-center justify-between">
								<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
									{s('settings.contentFilter.contentWeight') || 'Content Similarity Weight'}
								</span>
								<span class="text-sm text-gray-600 dark:text-gray-400">
									{smartContentFilter.preferences.similarityContentWeight}%
								</span>
							</div>
							<input
								type="range"
								min="0"
								max="100"
								step="5"
								bind:value={smartContentFilter.preferences.similarityContentWeight}
								oninput={(e) => {
									const contentWeight = parseInt((e.target as HTMLInputElement).value);
									smartContentFilter.setSimilarityWeights(
										smartContentFilter.preferences.similarityTitleWeight,
										contentWeight,
										smartContentFilter.preferences.similarityEntityWeight
									);
								}}
								class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 slider"
							/>
							<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
								{s('settings.contentFilter.contentWeight.help') || 'How much weight to give to content body similarity when comparing stories'}
							</p>
						</div>

						<!-- Entity Similarity Weight -->
						<div class="mb-4">
							<div class="mb-2 flex items-center justify-between">
								<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
									{s('settings.contentFilter.entityWeight') || 'Entity Similarity Weight'}
								</span>
								<span class="text-sm text-gray-600 dark:text-gray-400">
									{smartContentFilter.preferences.similarityEntityWeight}%
								</span>
							</div>
							<input
								type="range"
								min="0"
								max="100"
								step="5"
								bind:value={smartContentFilter.preferences.similarityEntityWeight}
								oninput={(e) => {
									const entityWeight = parseInt((e.target as HTMLInputElement).value);
									smartContentFilter.setSimilarityWeights(
										smartContentFilter.preferences.similarityTitleWeight,
										smartContentFilter.preferences.similarityContentWeight,
										entityWeight
									);
								}}
								class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 slider"
							/>
							<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
								{s('settings.contentFilter.entityWeight.help') || 'How much weight to give to shared entities (people, places, organizations) when comparing stories'}
							</p>
						</div>

						<!-- Real-time Weight Feedback -->
						<div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
							<div class="text-xs text-gray-600 dark:text-gray-400">
								<div class="mb-1">
									<strong>Current Algorithm Focus:</strong>
									{#if smartContentFilter.preferences.similarityTitleWeight >= smartContentFilter.preferences.similarityContentWeight && smartContentFilter.preferences.similarityTitleWeight >= smartContentFilter.preferences.similarityEntityWeight}
										Title-focused detection (good for catching headline duplicates)
									{:else if smartContentFilter.preferences.similarityContentWeight >= smartContentFilter.preferences.similarityTitleWeight && smartContentFilter.preferences.similarityContentWeight >= smartContentFilter.preferences.similarityEntityWeight}
										Content-focused detection (good for catching story rewrites)
									{:else if smartContentFilter.preferences.similarityEntityWeight >= smartContentFilter.preferences.similarityTitleWeight && smartContentFilter.preferences.similarityEntityWeight >= smartContentFilter.preferences.similarityContentWeight}
										Entity-focused detection (good for catching stories about same events)
									{:else}
										Balanced detection (good general-purpose similarity detection)
									{/if}
								</div>
								<div class="text-xs">
									Normalized weights: Title {Math.round(smartContentFilter.preferences.similarityTitleWeight / (smartContentFilter.preferences.similarityTitleWeight + smartContentFilter.preferences.similarityContentWeight + smartContentFilter.preferences.similarityEntityWeight) * 100)}%, 
									Content {Math.round(smartContentFilter.preferences.similarityContentWeight / (smartContentFilter.preferences.similarityTitleWeight + smartContentFilter.preferences.similarityContentWeight + smartContentFilter.preferences.similarityEntityWeight) * 100)}%, 
									Entity {Math.round(smartContentFilter.preferences.similarityEntityWeight / (smartContentFilter.preferences.similarityTitleWeight + smartContentFilter.preferences.similarityContentWeight + smartContentFilter.preferences.similarityEntityWeight) * 100)}%
								</div>
							</div>
						</div>
					</div>

					<!-- Preset Buttons for Common Similarity Scenarios -->
					<div class="mb-6">
						<h5 class="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
							{s('settings.contentFilter.similarityPresets') || 'Quick Similarity Presets'}
						</h5>
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
							<Tooltip text="Focus on local and regional news, reduce international duplicates">
								<button
									type="button"
									class="flex flex-col items-center rounded-lg border border-gray-200 p-4 text-center transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-600"
									onclick={() => {
										smartContentFilter.setContentSimilarityThreshold(60);
										smartContentFilter.setContentSimilarityMode('today');
										smartContentFilter.setContentSimilarityScope('within-category');
										smartContentFilter.setSimilarityWeights(50, 30, 20);
									}}
								>
									<Icon icon="tabler:map-pin" class="mb-2 h-5 w-5 text-gray-500 dark:text-gray-400" />
									<span class="text-sm font-medium">Local Focus</span>
									<span class="text-xs text-gray-500 dark:text-gray-400">60% threshold, today only, within categories</span>
								</button>
							</Tooltip>

							<Tooltip text="Catch global story duplicates across all categories">
								<button
									type="button"
									class="flex flex-col items-center rounded-lg border border-gray-200 p-4 text-center transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-600"
									onclick={() => {
										smartContentFilter.setContentSimilarityThreshold(70);
										smartContentFilter.setContentSimilarityMode('historical');
										smartContentFilter.setContentSimilarityExpiry(7);
										smartContentFilter.setContentSimilarityScope('across-categories');
										smartContentFilter.setSimilarityWeights(30, 40, 30);
									}}
								>
									<Icon icon="tabler:world" class="mb-2 h-5 w-5 text-gray-500 dark:text-gray-400" />
									<span class="text-sm font-medium">Global Focus</span>
									<span class="text-xs text-gray-500 dark:text-gray-400">70% threshold, 7-day history, across categories</span>
								</button>
							</Tooltip>

							<Tooltip text="Balanced similarity detection for general use">
								<button
									type="button"
									class="flex flex-col items-center rounded-lg border border-gray-200 p-4 text-center transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-600"
									onclick={() => {
										smartContentFilter.setContentSimilarityThreshold(70);
										smartContentFilter.setContentSimilarityMode('today');
										smartContentFilter.setContentSimilarityScope('within-category');
										smartContentFilter.setSimilarityWeights(40, 25, 35);
									}}
								>
									<Icon icon="tabler:balance" class="mb-2 h-5 w-5 text-gray-500 dark:text-gray-400" />
									<span class="text-sm font-medium">Balanced</span>
									<span class="text-xs text-gray-500 dark:text-gray-400">70% threshold, today only, balanced weights</span>
							</button>
						</Tooltip>
					</div>
				</div>
			{/if}
		</div>
	</div>
	<div class="flex flex-col space-y-2">
		<div class="flex items-center gap-2 mb-1">
			<Icon icon="tabler:filter" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.contentFilter.activeFilters') || 'Active Filters'}
			</span>
			<span class="text-xs text-gray-500 dark:text-gray-400">
				({getActiveFilterCount()} active)
			</span>
		</div>
		<p class="text-xs text-gray-500 dark:text-gray-400">
			{s('settings.contentFilter.activeFilters.description') || 'Currently active content filters. Click on any filter tag to remove it individually.'}
		</p>

			<!-- Active Filter Tags -->
			<div class="mb-4 flex flex-wrap gap-2">
				{#each getActiveFilterTags() as filter}
					<div class="group flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm dark:bg-gray-700/50">
						<Icon icon={filter.icon} class="mr-2 h-4 w-4 text-gray-600 dark:text-gray-400 opacity-80" />
						<span class="text-gray-800 dark:text-gray-200">{filter.label}</span>
						<button
							type="button"
							class="ml-2 rounded-full p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-200 opacity-75 hover:opacity-100"
							onclick={() => removeFilter(filter.key, filter.value)}
							aria-label={`Remove ${filter.label} filter`}
						>
							<Icon icon="tabler:x" class="h-3 w-3" />
						</button>
					</div>
				{/each}

				<!-- Custom Keywords Tags -->
				{#each smartContentFilter.customKeywords as keyword}
					<div class="group flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm dark:bg-gray-700/50">
						<Icon icon="tabler:tag" class="mr-2 h-4 w-4 text-gray-600 dark:text-gray-400 opacity-80" />
						<span class="text-gray-800 dark:text-gray-200">"{keyword}"</span>
						<button
							type="button"
							class="ml-2 rounded-full p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-200 opacity-75 hover:opacity-100"
							onclick={() => smartContentFilter.removeCustomKeyword(keyword)}
							aria-label={`Remove keyword "${keyword}"`}
						>
							<Icon icon="tabler:x" class="h-3 w-3" />
						</button>
					</div>
				{/each}

				<!-- No active filters message -->
				{#if getActiveFilterCount() === 0}
					<div class="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
						<Icon icon="tabler:info-circle" class="h-4 w-4" />
						<span>No filters are currently active</span>
					</div>
				{/if}
			</div>

		<!-- Clear All Filters Button -->
		{#if getActiveFilterCount() > 0}
			<div class="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
				<span class="text-xs text-gray-500 dark:text-gray-400">
					{s('settings.contentFilter.clearAll.description') || 'Remove all active filters and reset to defaults'}
				</span>
				<button
					type="button"
					class="text-xs px-2 py-1 rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:border-red-700"
					onclick={() => showClearAllConfirmation = true}
				>
					{s('settings.contentFilter.clearAll') || 'Clear All Filters'}
				</button>
			</div>
		{/if}
	</div>

	<!-- Statistics Section -->
	{#if smartContentFilter.stats}
		<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
			<div class="mb-6 flex items-center justify-between">
				<h4 class="text-base font-medium text-gray-900 dark:text-gray-100">
					{s('settings.contentFilter.statistics') || 'Filter Statistics'}
				</h4>
				<Icon icon="tabler:chart-bar" class="h-5 w-5 text-gray-500 dark:text-gray-400" />
			</div>
			
			<!-- Overview Statistics -->
			<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
				<!-- Total Processed -->
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/50">
					<div class="flex items-center space-x-3">
						<Icon icon="tabler:file-text" class="h-5 w-5 text-gray-500 dark:text-gray-400" />
						<div>
							<div class="text-lg font-semibold text-gray-900 dark:text-gray-100">
								{smartContentFilter.stats.totalProcessed.toLocaleString()}
							</div>
							<div class="text-sm text-gray-600 dark:text-gray-400">
								{s('settings.contentFilter.stats.totalProcessed') || 'Total Processed'}
							</div>
						</div>
					</div>
				</div>

				<!-- Filtered Count -->
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/50">
					<div class="flex items-center space-x-3">
						<Icon icon="tabler:filter" class="h-5 w-5 text-gray-500 dark:text-gray-400" />
						<div>
							<div class="text-lg font-semibold text-gray-900 dark:text-gray-100">
								{smartContentFilter.stats.filtered.toLocaleString()}
							</div>
							<div class="text-sm text-gray-600 dark:text-gray-400">
								{s('settings.contentFilter.stats.filtered') || 'Stories Filtered'}
							</div>
						</div>
					</div>
				</div>

				<!-- Filter Rate -->
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/50">
					<div class="flex items-center space-x-3">
						<Icon icon="tabler:percentage" class="h-5 w-5 text-gray-500 dark:text-gray-400" />
						<div>
							<div class="text-lg font-semibold text-gray-900 dark:text-gray-100">
								{(smartContentFilter.stats.filterRate * 100).toFixed(1)}%
							</div>
							<div class="text-sm text-gray-600 dark:text-gray-400">
								{s('settings.contentFilter.stats.filterRate') || 'Filter Rate'}
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Filter Rate Progress Bar -->
			<div class="mb-6">
				<div class="mb-2 flex items-center justify-between">
					<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
						{s('settings.contentFilter.stats.filterEffectiveness') || 'Filter Effectiveness'}
					</span>
					<span class="text-sm text-gray-600 dark:text-gray-400">
						{(smartContentFilter.stats.filterRate * 100).toFixed(1)}%
					</span>
				</div>
				<div class="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
					<div 
						class="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out" 
						style="width: {Math.min(smartContentFilter.stats.filterRate * 100, 100)}%"
					></div>
				</div>
				<div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					{#if smartContentFilter.stats.filterRate < 0.1}
						Low filtering activity - most content passes through
					{:else if smartContentFilter.stats.filterRate < 0.3}
						Moderate filtering - balanced content curation
					{:else if smartContentFilter.stats.filterRate < 0.6}
						High filtering - aggressive content filtering
					{:else}
						Very high filtering - strict content standards
					{/if}
				</div>
			</div>

			<!-- Top Filter Reasons -->
			{#if smartContentFilter.stats.topFilterReasons.length > 0}
				<div class="mb-6">
					<h5 class="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
						{s('settings.contentFilter.stats.topReasons') || 'Top Filter Reasons'}
					</h5>
					<div class="space-y-2">
						{#each smartContentFilter.stats.topFilterReasons.slice(0, 5) as reason}
							{@const percentage = smartContentFilter.stats.totalProcessed > 0 ? (reason.count / smartContentFilter.stats.totalProcessed * 100) : 0}
							<div class="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-600">
								<div class="flex items-center space-x-3">
									<div class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
										<span class="text-xs font-medium text-gray-600 dark:text-gray-400">
											{reason.count}
										</span>
									</div>
									<div>
										<div class="text-sm font-medium text-gray-900 dark:text-gray-100">
											{reason.reason}
										</div>
										<div class="text-xs text-gray-500 dark:text-gray-400">
											{percentage.toFixed(1)}% of total stories
										</div>
									</div>
								</div>
								<div class="flex items-center space-x-2">
									<div class="w-16 bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
										<div 
											class="bg-blue-600 h-1.5 rounded-full" 
											style="width: {Math.min(percentage, 100)}%"
										></div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Category Breakdown -->
			{#if Object.keys(smartContentFilter.stats.categoryBreakdown).length > 0}
				<div>
					<h5 class="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
						{s('settings.contentFilter.stats.categoryBreakdown') || 'Category Breakdown'}
					</h5>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#each Object.entries(smartContentFilter.stats.categoryBreakdown) as [category, stats]}
							{@const filterRate = stats.total > 0 ? (stats.filtered / stats.total) : 0}
							<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-600">
								<div class="mb-2 flex items-center justify-between">
									<div class="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
										{category}
									</div>
									<div class="text-xs text-gray-500 dark:text-gray-400">
										{(filterRate * 100).toFixed(0)}%
									</div>
								</div>
								<div class="mb-2 w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
									<div 
										class="bg-blue-600 h-1.5 rounded-full transition-all duration-300 ease-in-out" 
										style="width: {Math.min(filterRate * 100, 100)}%"
									></div>
								</div>
								<div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
									<span>{stats.filtered} filtered</span>
									<span>{stats.total} total</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- No Statistics Available -->
			{#if smartContentFilter.stats.totalProcessed === 0}
				<div class="text-center py-8">
					<Icon icon="tabler:chart-bar" class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
					<div class="text-sm text-gray-500 dark:text-gray-400">
						{s('settings.contentFilter.stats.noData') || 'No filtering statistics available yet. Statistics will appear once content has been processed through your filters.'}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Advanced Category Weight Overrides Section -->
	<div class="flex flex-col space-y-2">
		<div class="flex items-center gap-2 mb-1">
			<Icon icon="tabler:scale" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.contentFilter.advancedWeights') || 'Advanced Category Weight Overrides'}
			</span>
			{#if smartContentFilter.preferences.categoryOverrides && Object.keys(smartContentFilter.preferences.categoryOverrides).length > 0}
				<span class="text-xs text-blue-600 dark:text-blue-400 font-medium">
					(Custom weight settings active)
				</span>
			{/if}
		</div>
		<p class="text-xs text-gray-500 dark:text-gray-400">
			{s('settings.contentFilter.advancedWeights.description') || 'Fine-tune filtering sensitivity for each category'}
		</p>

		<div class="mt-4">
				<p class="mb-6 text-sm text-gray-600 dark:text-gray-400">
					{s('settings.contentFilter.advancedWeights.description') || 'Fine-tune how different aspects of content are weighted when detecting similarity and relevance. Global settings apply to all categories unless overridden.'}
				</p>

				<!-- Global Weight Settings -->
				<div class="mb-8">
					<div class="mb-4 flex items-center space-x-3">
						<Icon icon="tabler:world" class="h-5 w-5 text-gray-500 dark:text-gray-400" />
						<h5 class="text-sm font-medium text-gray-900 dark:text-gray-100">
							{s('settings.contentFilter.globalWeights') || 'Global Weight Settings'}
						</h5>
					</div>
					<p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
						{s('settings.contentFilter.globalWeights.description') || 'These weights determine how much importance is given to different parts of content when analyzing relevance and quality.'}
					</p>

					<div class="space-y-4">
						<!-- Title Importance -->
						<div>
							<div class="mb-2 flex items-center justify-between">
								<div class="flex items-center space-x-2">
									<Icon icon="tabler:heading" class="h-4 w-4 text-gray-500 dark:text-gray-400" />
									<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
										{s('settings.contentFilter.titleImportance') || 'Title Importance'}
									</span>
									<Tooltip text="How much weight to give to keywords and patterns found in article titles">
										<Icon icon="tabler:info-circle" class="h-4 w-4 text-gray-400" />
									</Tooltip>
								</div>
								<span class="text-sm text-gray-600 dark:text-gray-400">
									{smartContentFilter.preferences.globalTitleImportance}%
								</span>
							</div>
							<input
								type="range"
								min="0"
								max="100"
								step="5"
								value={smartContentFilter.preferences.globalTitleImportance}
																	oninput={(e) => smartContentFilter.updatePreference('globalTitleImportance', parseInt((e.target as HTMLInputElement).value))}
								class="slider w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
							/>
							<div class="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
								<span>Less Important</span>
								<span>More Important</span>
							</div>
						</div>

						<!-- Content Importance -->
						<div>
							<div class="mb-2 flex items-center justify-between">
								<div class="flex items-center space-x-2">
									<Icon icon="tabler:file-text" class="h-4 w-4 text-gray-500 dark:text-gray-400" />
									<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
										{s('settings.contentFilter.contentImportance') || 'Content Importance'}
									</span>
									<Tooltip text="How much weight to give to keywords and patterns found in article body content">
										<Icon icon="tabler:info-circle" class="h-4 w-4 text-gray-400" />
									</Tooltip>
								</div>
								<span class="text-sm text-gray-600 dark:text-gray-400">
									{smartContentFilter.preferences.globalContentImportance}%
								</span>
							</div>
							<input
								type="range"
								min="0"
								max="100"
								step="5"
								value={smartContentFilter.preferences.globalContentImportance}
								oninput={(e) => smartContentFilter.updatePreference('globalContentImportance', parseInt((e.target as HTMLInputElement).value))}
								class="slider w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
							/>
							<div class="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
								<span>Less Important</span>
								<span>More Important</span>
							</div>
						</div>

						<!-- Context Evidence -->
						<div>
							<div class="mb-2 flex items-center justify-between">
								<div class="flex items-center space-x-2">
									<Icon icon="tabler:puzzle" class="h-4 w-4 text-gray-500 dark:text-gray-400" />
									<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
										{s('settings.contentFilter.contextEvidence') || 'Context Evidence'}
									</span>
									<Tooltip text="How much weight to give to surrounding context, metadata, and source information">
										<Icon icon="tabler:info-circle" class="h-4 w-4 text-gray-400" />
									</Tooltip>
								</div>
								<span class="text-sm text-gray-600 dark:text-gray-400">
									{smartContentFilter.preferences.globalContextEvidence}%
								</span>
							</div>
							<input
								type="range"
								min="0"
								max="100"
								step="5"
								value={smartContentFilter.preferences.globalContextEvidence}
																	oninput={(e) => smartContentFilter.updatePreference('globalContextEvidence', parseInt((e.target as HTMLInputElement).value))}
								class="slider w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
							/>
							<div class="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
								<span>Less Important</span>
								<span>More Important</span>
							</div>
						</div>
					</div>

					<!-- Weight Distribution Display -->
					<div class="mt-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
						<div class="text-xs text-gray-600 dark:text-gray-400">
							<div class="mb-2 font-medium">Current Weight Distribution:</div>
							<div class="space-y-1">
								<div class="flex justify-between">
									<span>Title: {smartContentFilter.preferences.globalTitleImportance}%</span>
									<span>Content: {smartContentFilter.preferences.globalContentImportance}%</span>
									<span>Context: {smartContentFilter.preferences.globalContextEvidence}%</span>
								</div>
								<div class="text-xs text-gray-500 dark:text-gray-500">
									Total: {smartContentFilter.preferences.globalTitleImportance + smartContentFilter.preferences.globalContentImportance + smartContentFilter.preferences.globalContextEvidence}%
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Per-Category Weight Overrides -->
				<div class="mb-8">
					<div class="mb-4 flex items-center justify-between">
						<div class="flex items-center space-x-3">
							<Icon icon="tabler:category" class="h-5 w-5 text-gray-500 dark:text-gray-400" />
							<h5 class="text-sm font-medium text-gray-900 dark:text-gray-100">
								{s('settings.contentFilter.categoryOverrides') || 'Per-Category Weight Overrides'}
							</h5>
						</div>
						{#if smartContentFilter.preferences.categoryWeightOverrides && Object.keys(smartContentFilter.preferences.categoryWeightOverrides).length > 0}
							<button
								type="button"
								class="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
								onclick={() => {
									smartContentFilter.updatePreference('categoryWeightOverrides', undefined);
								}}
							>
								Clear All Overrides
							</button>
						{/if}
					</div>
					<p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
						{s('settings.contentFilter.categoryOverrides.description') || 'Override global weight settings for specific content categories. Only categories with active filters can be customized.'}
					</p>

					<!-- Category Override Controls -->
					{#snippet categoryOverrideControls()}
						{@const availableCategories = [
							{ key: 'politics', label: 'Politics', icon: 'tabler:building-government', active: smartContentFilter.preferences.filterPolitics },
							{ key: 'sports', label: 'Sports', icon: 'tabler:ball-football', active: smartContentFilter.preferences.filterSports },
							{ key: 'financial', label: 'Financial', icon: 'tabler:chart-line', active: smartContentFilter.preferences.filterFinancial },
							{ key: 'technology', label: 'Technology', icon: 'tabler:device-laptop', active: smartContentFilter.preferences.filterTechnology },
							{ key: 'entertainment', label: 'Entertainment', icon: 'tabler:movie', active: smartContentFilter.preferences.filterEntertainment },
							{ key: 'celebrity', label: 'Celebrity', icon: 'tabler:star', active: smartContentFilter.preferences.filterCelebrity },
							{ key: 'weather', label: 'Weather', icon: 'tabler:cloud', active: smartContentFilter.preferences.filterWeather }
						]}

						{@const activeCategories = availableCategories.filter(cat => cat.active)}

					{#if activeCategories.length === 0}
						<div class="rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-700/50">
							<Icon icon="tabler:info-circle" class="mx-auto h-8 w-8 text-gray-400 mb-2" />
							<p class="text-sm text-gray-600 dark:text-gray-400">
								{s('settings.contentFilter.categoryOverrides.noActive') || 'No category filters are currently active. Enable category filters above to customize their weight settings.'}
							</p>
						</div>
					{:else}
						<div class="space-y-6">
							{#each activeCategories as category}
								{@const hasOverride = smartContentFilter.preferences.categoryWeightOverrides?.[category.key]}
								{@const override = hasOverride || {}}
								
								<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-600">
									<div class="mb-3 flex items-center justify-between">
										<div class="flex items-center space-x-2">
											<Icon icon={category.icon} class="h-4 w-4 text-gray-500 dark:text-gray-400" />
											<span class="text-sm font-medium text-gray-900 dark:text-gray-100">
												{category.label}
											</span>
											{#if hasOverride}
												<span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
													Custom
												</span>
											{/if}
										</div>
										<div class="flex items-center space-x-2">
											{#if hasOverride}
												<button
													type="button"
													class="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
													onclick={() => smartContentFilter.setCategoryWeightOverride(category.key, undefined)}
												>
													Reset
												</button>
											{/if}
											<button
												type="button"
												class="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
												onclick={() => {
													if (!hasOverride) {
														smartContentFilter.setCategoryWeightOverride(category.key, {
															titleImportance: smartContentFilter.preferences.globalTitleImportance,
															contentImportance: smartContentFilter.preferences.globalContentImportance,
															contextEvidence: smartContentFilter.preferences.globalContextEvidence
														});
													}
												}}
											>
												{hasOverride ? 'Customize' : 'Override'}
											</button>
										</div>
									</div>

									{#if hasOverride}
										<div class="space-y-3">
											<!-- Title Importance Override -->
											<div>
												<div class="mb-1 flex items-center justify-between">
													<span class="text-xs font-medium text-gray-700 dark:text-gray-300">
														Title Importance
													</span>
													<span class="text-xs text-gray-600 dark:text-gray-400">
														{override.titleImportance ?? smartContentFilter.preferences.globalTitleImportance}%
													</span>
												</div>
												<input
													type="range"
													min="0"
													max="100"
													step="5"
													value={override.titleImportance ?? smartContentFilter.preferences.globalTitleImportance}
													oninput={(e) => {
														const currentOverride = smartContentFilter.preferences.categoryWeightOverrides?.[category.key] || {};
														smartContentFilter.setCategoryWeightOverride(category.key, {
															...currentOverride,
															titleImportance: parseInt((e.target as HTMLInputElement).value)
														});
													}}
													class="slider w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
												/>
											</div>

											<!-- Content Importance Override -->
											<div>
												<div class="mb-1 flex items-center justify-between">
													<span class="text-xs font-medium text-gray-700 dark:text-gray-300">
														Content Importance
													</span>
													<span class="text-xs text-gray-600 dark:text-gray-400">
														{override.contentImportance ?? smartContentFilter.preferences.globalContentImportance}%
													</span>
												</div>
												<input
													type="range"
													min="0"
													max="100"
													step="5"
													value={override.contentImportance ?? smartContentFilter.preferences.globalContentImportance}
													oninput={(e) => {
														const currentOverride = smartContentFilter.preferences.categoryWeightOverrides?.[category.key] || {};
														smartContentFilter.setCategoryWeightOverride(category.key, {
															...currentOverride,
															contentImportance: parseInt((e.target as HTMLInputElement).value)
														});
													}}
													class="slider w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
												/>
											</div>

											<!-- Context Evidence Override -->
											<div>
												<div class="mb-1 flex items-center justify-between">
													<span class="text-xs font-medium text-gray-700 dark:text-gray-300">
														Context Evidence
													</span>
													<span class="text-xs text-gray-600 dark:text-gray-400">
														{override.contextEvidence ?? smartContentFilter.preferences.globalContextEvidence}%
													</span>
												</div>
												<input
													type="range"
													min="0"
													max="100"
													step="5"
													value={override.contextEvidence ?? smartContentFilter.preferences.globalContextEvidence}
													oninput={(e) => {
														const currentOverride = smartContentFilter.preferences.categoryWeightOverrides?.[category.key] || {};
														smartContentFilter.setCategoryWeightOverride(category.key, {
															...currentOverride,
															contextEvidence: parseInt((e.target as HTMLInputElement).value)
														});
													}}
													class="slider w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
												/>
											</div>

											<!-- Override Summary -->
											<div class="mt-2 rounded bg-gray-50 p-2 dark:bg-gray-700/50">
												<div class="text-xs text-gray-600 dark:text-gray-400">
													<div class="font-medium mb-1">Override Distribution:</div>
													<div class="flex justify-between">
														<span>T: {override.titleImportance ?? smartContentFilter.preferences.globalTitleImportance}%</span>
														<span>C: {override.contentImportance ?? smartContentFilter.preferences.globalContentImportance}%</span>
														<span>E: {override.contextEvidence ?? smartContentFilter.preferences.globalContextEvidence}%</span>
													</div>
												</div>
											</div>
										</div>
									{:else}
										<div class="text-xs text-gray-500 dark:text-gray-400">
											Using global weights: Title {smartContentFilter.preferences.globalTitleImportance}%, Content {smartContentFilter.preferences.globalContentImportance}%, Context {smartContentFilter.preferences.globalContextEvidence}%
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
					{/snippet}

					{@render categoryOverrideControls()}
				</div>

				<!-- Sensitivity Override Controls -->
				<div class="mb-8">
					<div class="mb-4 flex items-center space-x-3">
						<Icon icon="tabler:adjustments" class="h-5 w-5 text-gray-500 dark:text-gray-400" />
						<h5 class="text-sm font-medium text-gray-900 dark:text-gray-100">
							{s('settings.contentFilter.sensitivityOverrides') || 'Sensitivity Override Controls'}
						</h5>
					</div>
					<p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
						{s('settings.contentFilter.sensitivityOverrides.description') || 'Override the global filter sensitivity for specific categories. Higher values mean stricter filtering.'}
					</p>

					<!-- Global Sensitivity Setting -->
					<div class="mb-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
						<div class="mb-2 flex items-center justify-between">
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{s('settings.contentFilter.globalSensitivity') || 'Global Filter Sensitivity'}
							</span>
							<Select
								value={smartContentFilter.preferences.filterSensitivity}
								onChange={(value) => smartContentFilter.updatePreference('filterSensitivity', value)}
								options={[
									{ value: 'loose', label: 'Loose' },
									{ value: 'balanced', label: 'Balanced' },
									{ value: 'strict', label: 'Strict' }
								]}
								className="text-sm"
							/>
						</div>
						<div class="text-xs text-gray-500 dark:text-gray-400">
							{#if smartContentFilter.preferences.filterSensitivity === 'loose'}
								Permissive filtering - only removes clearly unwanted content
							{:else if smartContentFilter.preferences.filterSensitivity === 'balanced'}
								Moderate filtering - balanced approach to content removal
							{:else}
								Strict filtering - aggressive removal of potentially unwanted content
							{/if}
						</div>
					</div>

					<!-- Category Sensitivity Overrides -->
					{#snippet sensitivityOverrideControls()}
						{@const availableCategories = [
							{ key: 'politics', label: 'Politics', icon: 'tabler:building-government', active: smartContentFilter.preferences.filterPolitics },
							{ key: 'sports', label: 'Sports', icon: 'tabler:ball-football', active: smartContentFilter.preferences.filterSports },
							{ key: 'financial', label: 'Financial', icon: 'tabler:chart-line', active: smartContentFilter.preferences.filterFinancial },
							{ key: 'technology', label: 'Technology', icon: 'tabler:device-laptop', active: smartContentFilter.preferences.filterTechnology },
							{ key: 'entertainment', label: 'Entertainment', icon: 'tabler:movie', active: smartContentFilter.preferences.filterEntertainment },
							{ key: 'celebrity', label: 'Celebrity', icon: 'tabler:star', active: smartContentFilter.preferences.filterCelebrity },
							{ key: 'weather', label: 'Weather', icon: 'tabler:cloud', active: smartContentFilter.preferences.filterWeather }
						]}

						{@const activeCategories = availableCategories.filter(cat => cat.active)}

					{#if activeCategories.length > 0}
						<div class="space-y-3">
							{#each activeCategories as category}
								{@const currentOverride = smartContentFilter.preferences.categoryOverrides?.[category.key]}
								{@const hasNumericOverride = typeof currentOverride === 'number'}
								{@const hasPresetOverride = typeof currentOverride === 'string'}
								
								<div class="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-600">
									<div class="flex items-center space-x-2">
										<Icon icon={category.icon} class="h-4 w-4 text-gray-500 dark:text-gray-400" />
										<span class="text-sm text-gray-900 dark:text-gray-100">
											{category.label}
										</span>
										{#if currentOverride}
											<span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
												{hasNumericOverride ? `${currentOverride}%` : currentOverride}
											</span>
										{/if}
									</div>
									<div class="flex items-center space-x-2">
										<!-- Preset Sensitivity -->
										<Select
											value={hasPresetOverride ? currentOverride : 'global'}
																			onChange={(value) => {
									if (value === 'global') {
										smartContentFilter.updateCategoryOverride(category.key, undefined);
									} else {
										smartContentFilter.updateCategoryOverride(category.key, value);
									}
								}}
											options={[
												{ value: 'global', label: 'Global' },
												{ value: 'loose', label: 'Loose' },
												{ value: 'balanced', label: 'Balanced' },
												{ value: 'strict', label: 'Strict' },
												{ value: 'custom', label: 'Custom' }
											]}
											className="text-xs"
										/>
										
										<!-- Custom Numeric Input -->
										{#if hasNumericOverride || (hasPresetOverride && currentOverride === 'custom')}
											<input
												type="number"
												min="0"
												max="100"
												step="5"
												value={hasNumericOverride ? currentOverride : 50}
												oninput={(e) => {
													const value = parseInt((e.target as HTMLInputElement).value);
													if (!isNaN(value)) {
														smartContentFilter.updateCategoryOverride(category.key, Math.max(0, Math.min(100, value)));
													}
												}}
												class="w-16 rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700"
												placeholder="0-100"
											/>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-700/50">
							<Icon icon="tabler:info-circle" class="mx-auto h-8 w-8 text-gray-400 mb-2" />
							<p class="text-sm text-gray-600 dark:text-gray-400">
								{s('settings.contentFilter.sensitivityOverrides.noActive') || 'No category filters are currently active. Enable category filters above to customize their sensitivity settings.'}
							</p>
						</div>
					{/if}
					{/snippet}

					{@render sensitivityOverrideControls()}
				</div>

				<!-- Advanced Parameter Controls -->
				<div>
					<div class="mb-4 flex items-center space-x-3">
						<Icon icon="tabler:settings-2" class="h-5 w-5 text-gray-500 dark:text-gray-400" />
						<h5 class="text-sm font-medium text-gray-900 dark:text-gray-100">
							{s('settings.contentFilter.advancedParameters') || 'Advanced Parameter Controls'}
						</h5>
					</div>
					<p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
						{s('settings.contentFilter.advancedParameters.description') || 'Fine-tune the filtering algorithm with detailed parameter controls. These settings affect how content quality, relevance, and sentiment are evaluated.'}
					</p>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<!-- Minimum Quality Threshold -->
						<div class="rounded-lg border border-gray-200 p-3 dark:border-gray-600">
							<div class="mb-2 flex items-center justify-between">
								<div class="flex items-center space-x-1">
									<Icon icon="tabler:award" class="h-4 w-4 text-gray-500 dark:text-gray-400" />
									<span class="text-xs font-medium text-gray-700 dark:text-gray-300">
										Quality Threshold
									</span>
									<Tooltip text="Minimum content quality score (0-1). Higher values filter more aggressively based on content quality.">
										<Icon icon="tabler:info-circle" class="h-3 w-3 text-gray-400" />
									</Tooltip>
								</div>
								<span class="text-xs text-gray-600 dark:text-gray-400">
									{smartContentFilter.preferences.minimumQuality.toFixed(2)}
								</span>
							</div>
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={smartContentFilter.preferences.minimumQuality}
																	oninput={(e) => smartContentFilter.updatePreference('minimumQuality', parseFloat((e.target as HTMLInputElement).value))}
								class="slider w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
							/>
							<div class="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
								<span>Permissive</span>
								<span>Strict</span>
							</div>
						</div>

						<!-- Minimum Relevance Threshold -->
						<div class="rounded-lg border border-gray-200 p-3 dark:border-gray-600">
							<div class="mb-2 flex items-center justify-between">
								<div class="flex items-center space-x-1">
									<Icon icon="tabler:target" class="h-4 w-4 text-gray-500 dark:text-gray-400" />
									<span class="text-xs font-medium text-gray-700 dark:text-gray-300">
										Relevance Threshold
									</span>
									<Tooltip text="Minimum content relevance score (0-1). Higher values filter content that may be less relevant to your interests.">
										<Icon icon="tabler:info-circle" class="h-3 w-3 text-gray-400" />
									</Tooltip>
								</div>
								<span class="text-xs text-gray-600 dark:text-gray-400">
									{smartContentFilter.preferences.minimumRelevance.toFixed(2)}
								</span>
							</div>
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={smartContentFilter.preferences.minimumRelevance}
																	oninput={(e) => smartContentFilter.updatePreference('minimumRelevance', parseFloat((e.target as HTMLInputElement).value))}
								class="slider w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
							/>
							<div class="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
								<span>Broad</span>
								<span>Focused</span>
							</div>
						</div>

						<!-- Minimum Sentiment Threshold -->
						<div class="rounded-lg border border-gray-200 p-3 dark:border-gray-600">
							<div class="mb-2 flex items-center justify-between">
								<div class="flex items-center space-x-1">
									<Icon icon="tabler:mood-happy" class="h-4 w-4 text-gray-500 dark:text-gray-400" />
									<span class="text-xs font-medium text-gray-700 dark:text-gray-300">
										Sentiment Threshold
									</span>
									<Tooltip text="Minimum content sentiment score (0-1). Higher values filter more negative or pessimistic content.">
										<Icon icon="tabler:info-circle" class="h-3 w-3 text-gray-400" />
									</Tooltip>
								</div>
								<span class="text-xs text-gray-600 dark:text-gray-400">
									{smartContentFilter.preferences.minimumSentiment.toFixed(2)}
								</span>
							</div>
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={smartContentFilter.preferences.minimumSentiment}
								oninput={(e) => smartContentFilter.updatePreference('minimumSentiment', parseFloat((e.target as HTMLInputElement).value))}
								class="slider w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
							/>
							<div class="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
								<span>All Sentiment</span>
								<span>Positive Only</span>
							</div>
						</div>
					</div>

					<!-- Parameter Explanations -->
					<div class="mt-4 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
						<div class="flex items-start space-x-2">
							<Icon icon="tabler:lightbulb" class="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400" />
							<div class="text-xs text-blue-700 dark:text-blue-300">
								<p class="font-medium mb-1">Parameter Guidelines:</p>
								<ul class="space-y-1">
									<li>• <strong>Quality:</strong> 0.0-0.3 = Permissive, 0.3-0.6 = Balanced, 0.6+ = Strict</li>
									<li>• <strong>Relevance:</strong> 0.0 = Disabled, 0.1-0.3 = Broad interests, 0.3+ = Focused</li>
									<li>• <strong>Sentiment:</strong> 0.0 = All content, 0.3+ = Reduce negativity, 0.5+ = Positive focus</li>
								</ul>
							</div>
					</div>
				</div>
			</div>
		</div>
	</div>

<!-- System Controls Section -->
	<div class="flex flex-col space-y-2">
		<div class="flex items-center gap-2 mb-1">
			<Icon icon="tabler:settings" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.contentFilter.systemControls') || 'System Controls'}
			</span>
		</div>
		<p class="text-xs text-gray-500 dark:text-gray-400">
			{s('settings.contentFilter.systemControls.description') || 'Import, export, and reset filter configurations'}
		</p>
		
		<div class="mt-4 space-y-4">
			<!-- Export Configuration -->
			<div class="flex flex-col space-y-2">
				<button
					type="button"
					onclick={exportConfiguration}
					class="flex w-full items-center justify-center space-x-2 rounded-lg bg-blue-100 px-4 py-2 text-sm font-medium text-blue-800 transition-colors duration-200 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
				>
					<Icon icon="tabler:download" class="h-4 w-4" />
					<span>{s('settings.contentFilter.export.title') || 'Export Settings'}</span>
				</button>
				<p class="text-xs text-gray-500 dark:text-gray-400 text-center">
					{s('settings.contentFilter.export.description') || 'Download your current filter settings as a JSON file'}
				</p>
			</div>

			<!-- Import Configuration -->
			<div class="flex flex-col space-y-2">
				<div class="flex items-center space-x-3">
					<input
						type="file"
						accept=".json"
						class="hidden"
						bind:this={fileInput}
						onchange={handleFileSelect}
					/>
					<button
						type="button"
						class="flex w-full items-center justify-center space-x-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 transition-colors duration-200 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
						onclick={() => fileInput?.click()}
					>
						<Icon icon="tabler:upload" class="h-4 w-4" />
						<span>{s('settings.contentFilter.import.title') || 'Import Settings'}</span>
					</button>
				</div>
				{#if selectedFileName}
					<p class="text-xs text-gray-600 dark:text-gray-400 text-center">
						Selected: {selectedFileName}
					</p>
				{:else}
					<p class="text-xs text-gray-500 dark:text-gray-400 text-center">
						{s('settings.contentFilter.import.description') || 'Restore filter settings from a previously exported JSON file'}
					</p>
				{/if}
			</div>

			<!-- Reset to Defaults -->
			<div class="flex flex-col space-y-2">
				<button
					type="button"
					onclick={() => showResetConfirmation = true}
					class="flex w-full items-center justify-center space-x-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-800 transition-colors duration-200 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
				>
					<Icon icon="tabler:refresh" class="h-4 w-4" />
					<span>{s('settings.contentFilter.reset.title') || 'Reset Settings'}</span>
				</button>
				<p class="text-xs text-gray-500 dark:text-gray-400 text-center">
					{s('settings.contentFilter.reset.description') || 'Reset all filter settings to their default values'}
				</p>
			</div>

			<!-- Version Information -->
			<div class="flex flex-col space-y-2">
				<div class="flex items-center gap-2">
					<Icon icon="tabler:info-circle" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
					<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
						{s('settings.contentFilter.version.title') || 'Version Information'}
					</span>
				</div>
				<p class="text-xs text-gray-500 dark:text-gray-400">
					{s('settings.contentFilter.version.description') || 'Configuration format version: 1.0'}
				</p>
			</div>

			<!-- System Messages -->
			{#if systemMessage}
				<div class="rounded-lg p-4 {systemMessage.type === 'success' 
							? 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800' 
							: systemMessage.type === 'warning'
							? 'bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
							: 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800'
						}">
							<div class="flex items-start space-x-3">
								<Icon 
									icon={systemMessage.type === 'success' ? 'tabler:check-circle' : 
										  systemMessage.type === 'warning' ? 'tabler:alert-triangle' : 'tabler:x-circle'} 
									class="h-5 w-5 mt-0.5 {systemMessage.type === 'success' 
										? 'text-green-600 dark:text-green-400' 
										: systemMessage.type === 'warning'
										? 'text-amber-600 dark:text-amber-400'
										: 'text-red-600 dark:text-red-400'
									}" 
								/>
								<div class="flex-1">
									<p class="text-sm font-medium {systemMessage.type === 'success' 
										? 'text-green-900 dark:text-green-100' 
										: systemMessage.type === 'warning'
										? 'text-amber-900 dark:text-amber-100'
										: 'text-red-900 dark:text-red-100'
									}">
										{systemMessage.title}
									</p>
									{#if systemMessage.description}
										<p class="mt-1 text-xs {systemMessage.type === 'success' 
											? 'text-green-700 dark:text-green-300' 
											: systemMessage.type === 'warning'
											? 'text-amber-700 dark:text-amber-300'
											: 'text-red-700 dark:text-red-300'
										}">
											{systemMessage.description}
										</p>
									{/if}
								</div>
								<button
									type="button"
									class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
									onclick={() => systemMessage = null}
								>
									<Icon icon="tabler:x" class="h-4 w-4" />
								</button>
							</div>
						</div>
					{/if}
		</div>
	</div>
</main>

	<!-- Import Confirmation Dialog -->
	{#if showImportConfirmation}
		<div 
			class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" 
			role="dialog"
			aria-modal="true"
			aria-labelledby="import-dialog-title"
			aria-describedby="import-dialog-description"
			onclick={(e) => {
				if (e.target === e.currentTarget) cancelImport();
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					e.preventDefault();
					cancelImport();
				}
			}}
			tabindex="-1"
		>
			<div id="import-confirmation-modal" class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
				<div class="mb-4 flex items-center space-x-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
						<Icon icon="tabler:upload" class="h-6 w-6 text-amber-600 dark:text-amber-400" />
					</div>
					<div>
						<h3 id="import-dialog-title" class="text-lg font-medium text-gray-900 dark:text-gray-100">
							{s('settings.contentFilter.import.confirm.title') || 'Import Configuration'}
						</h3>
						<p class="text-sm text-gray-500 dark:text-gray-400">
							{s('settings.contentFilter.import.confirm.subtitle') || 'This will replace your current settings'}
						</p>
					</div>
				</div>
				
				<div id="import-dialog-description" class="mb-6">
					<p class="text-sm text-gray-600 dark:text-gray-400">
						{s('settings.contentFilter.import.confirm.description') || 'Importing this configuration will replace all your current filter settings. This action cannot be undone.'}
					</p>
					<div class="mt-3 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
						<div class="flex items-start space-x-2">
							<Icon icon="tabler:alert-triangle" class="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400" />
							<div class="text-xs text-amber-700 dark:text-amber-300">
								<p class="font-medium">
									{s('settings.contentFilter.import.confirm.warning') || 'Warning: Current settings will be lost'}
								</p>
								<p class="mt-1">
									{s('settings.contentFilter.import.confirm.warning.description') || 'Consider exporting your current settings first if you want to keep them as a backup.'}
								</p>
							</div>
						</div>
					</div>
				</div>
				
				<div class="flex space-x-3">
					<button
						type="button"
						class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
						onclick={cancelImport}
					>
						{s('settings.contentFilter.import.confirm.cancel') || 'Cancel'}
					</button>
					<button
						type="button"
						class="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800"
						onclick={confirmImport}
					>
						{s('settings.contentFilter.import.confirm.confirm') || 'Import Settings'}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Reset Confirmation Dialog -->
	{#if showResetConfirmation}
		<div 
			class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" 
			role="dialog"
			aria-modal="true"
			aria-labelledby="reset-dialog-title"
			aria-describedby="reset-dialog-description"
			onclick={(e) => {
				if (e.target === e.currentTarget) showResetConfirmation = false;
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					e.preventDefault();
					showResetConfirmation = false;
				}
			}}
			tabindex="-1"
		>
			<div id="reset-confirmation-modal" class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
				<div class="mb-4 flex items-center space-x-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
						<Icon icon="tabler:refresh" class="h-6 w-6 text-red-600 dark:text-red-400" />
					</div>
					<div>
						<h3 id="reset-dialog-title" class="text-lg font-medium text-gray-900 dark:text-gray-100">
							{s('settings.contentFilter.reset.confirm.title') || 'Reset to Defaults'}
						</h3>
						<p class="text-sm text-gray-500 dark:text-gray-400">
							{s('settings.contentFilter.reset.confirm.subtitle') || 'This action cannot be undone'}
						</p>
					</div>
				</div>
				
				<div id="reset-dialog-description" class="mb-6">
					<p class="text-sm text-gray-600 dark:text-gray-400">
						{s('settings.contentFilter.reset.confirm.description') || 'Are you sure you want to reset all filter settings to their default values? This will:'}
					</p>
					<ul class="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
						<li class="flex items-center space-x-2">
							<Icon icon="tabler:check" class="h-4 w-4 text-gray-400" />
							<span>Disable content filtering</span>
						</li>
						<li class="flex items-center space-x-2">
							<Icon icon="tabler:check" class="h-4 w-4 text-gray-400" />
							<span>Reset all filter preferences to defaults</span>
						</li>
						<li class="flex items-center space-x-2">
							<Icon icon="tabler:check" class="h-4 w-4 text-gray-400" />
							<span>Clear all custom keywords</span>
						</li>
						<li class="flex items-center space-x-2">
							<Icon icon="tabler:check" class="h-4 w-4 text-gray-400" />
							<span>Reset all thresholds and weights</span>
						</li>
						<li class="flex items-center space-x-2">
							<Icon icon="tabler:check" class="h-4 w-4 text-gray-400" />
							<span>Clear statistics and active filter data</span>
						</li>
					</ul>
				</div>
				
				<div class="flex space-x-3">
					<button
						type="button"
						class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
						onclick={() => showResetConfirmation = false}
					>
						{s('settings.contentFilter.reset.confirm.cancel') || 'Cancel'}
					</button>
					<button
						type="button"
						class="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
						onclick={confirmReset}
					>
						{s('settings.contentFilter.reset.confirm.confirm') || 'Reset Settings'}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Clear All Filters Confirmation Dialog -->
	{#if showClearAllConfirmation}
		<div 
			class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" 
			role="dialog"
			aria-modal="true"
			aria-labelledby="clear-all-dialog-title"
			aria-describedby="clear-all-dialog-description"
			onclick={(e) => {
				if (e.target === e.currentTarget) showClearAllConfirmation = false;
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					e.preventDefault();
					showClearAllConfirmation = false;
				}
			}}
			tabindex="-1"
		>
			<div id="clear-all-confirmation-modal" class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
				<div class="mb-4 flex items-center space-x-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
						<Icon icon="tabler:alert-triangle" class="h-6 w-6 text-red-600 dark:text-red-400" />
					</div>
					<div>
						<h3 id="clear-all-dialog-title" class="text-lg font-medium text-gray-900 dark:text-gray-100">
							{s('settings.contentFilter.clearAll.confirm.title') || 'Clear All Filters'}
						</h3>
						<p class="text-sm text-gray-500 dark:text-gray-400">
							{s('settings.contentFilter.clearAll.confirm.subtitle') || 'This action cannot be undone'}
						</p>
					</div>
				</div>
				
				<div id="clear-all-dialog-description" class="mb-6">
					<p class="text-sm text-gray-600 dark:text-gray-400">
						{s('settings.contentFilter.clearAll.confirm.description') || 'Are you sure you want to remove all active filters and reset all settings to their defaults? This will:'}
					</p>
					<ul class="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
						<li class="flex items-center space-x-2">
							<Icon icon="tabler:check" class="h-4 w-4 text-gray-400" />
							<span>Disable all content filters</span>
						</li>
						<li class="flex items-center space-x-2">
							<Icon icon="tabler:check" class="h-4 w-4 text-gray-400" />
							<span>Remove all custom keywords</span>
						</li>
						<li class="flex items-center space-x-2">
							<Icon icon="tabler:check" class="h-4 w-4 text-gray-400" />
							<span>Reset all thresholds and weights to defaults</span>
						</li>
						<li class="flex items-center space-x-2">
							<Icon icon="tabler:check" class="h-4 w-4 text-gray-400" />
							<span>Deactivate any active presets</span>
						</li>
					</ul>
				</div>
				
				<div class="flex space-x-3">
					<button
						type="button"
						class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
						onclick={() => showClearAllConfirmation = false}
					>
						{s('settings.contentFilter.clearAll.confirm.cancel') || 'Cancel'}
					</button>
					<button
						type="button"
						class="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
						onclick={clearAllFilters}
					>
						{s('settings.contentFilter.clearAll.confirm.confirm') || 'Clear All Filters'}
					</button>
				</div>
			</div>
		</div>
	{/if}

<style>
	/* Range slider styling */
	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		height: 20px;
		width: 20px;
		border-radius: 50%;
		background: #3b82f6;
		cursor: pointer;
		border: 2px solid #ffffff;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.slider::-webkit-slider-thumb:hover {
		background: #2563eb;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
	}

	.slider::-moz-range-thumb {
		height: 20px;
		width: 20px;
		border-radius: 50%;
		background: #3b82f6;
		cursor: pointer;
		border: 2px solid #ffffff;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.slider::-moz-range-thumb:hover {
		background: #2563eb;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
	}

	/* Dark mode slider styling */
	:global(.dark) .slider::-webkit-slider-thumb {
		background: #60a5fa;
		border-color: #374151;
	}

	:global(.dark) .slider::-webkit-slider-thumb:hover {
		background: #3b82f6;
	}

	:global(.dark) .slider::-moz-range-thumb {
		background: #60a5fa;
		border-color: #374151;
	}

	:global(.dark) .slider::-moz-range-thumb:hover {
		background: #3b82f6;
	}

	/* Range track styling */
	.slider::-webkit-slider-track {
		height: 8px;
		border-radius: 4px;
		background: #e5e7eb;
	}

	.slider::-moz-range-track {
		height: 8px;
		border-radius: 4px;
		background: #e5e7eb;
		border: none;
	}

	:global(.dark) .slider::-webkit-slider-track {
		background: #374151;
	}

	:global(.dark) .slider::-moz-range-track {
		background: #374151;
	}

	/* Skip link focus styling */
	.focus\:not-sr-only:focus {
		position: static !important;
		width: auto !important;
		height: auto !important;
		padding: 0.5rem 1rem !important;
		margin: 0 !important;
		overflow: visible !important;
		clip: auto !important;
		white-space: normal !important;
	}
</style>