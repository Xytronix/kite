<script lang="ts">
	import { s } from '$lib/client/localization.svelte';
	import { smartContentFilter } from '$lib/stores/smartContentFilter.svelte';
	import Icon from '@iconify/svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import Select from '$lib/components/Select.svelte';

	// Smart section collapsing: show sections that have active filters, collapse others
	const hasContentQualityFilters = $derived(
		smartContentFilter.preferences.filterLowQuality ||
			smartContentFilter.preferences.filterPromotional ||
			smartContentFilter.preferences.filterOpinions ||
			smartContentFilter.preferences.filterRepetitive ||
			smartContentFilter.preferences.filterSocialMediaDrama
	);

	const hasTopicsSubjectsFilters = $derived(
		smartContentFilter.preferences.filterPolitics ||
			smartContentFilter.preferences.filterSports ||
			smartContentFilter.preferences.filterFinancial ||
			smartContentFilter.preferences.filterTechnology ||
			smartContentFilter.preferences.filterEntertainment ||
			smartContentFilter.preferences.filterCelebrity ||
			smartContentFilter.preferences.filterWeather
	);

	const hasNewsTypesFilters = $derived(smartContentFilter.preferences.filterBreakingNews);

	const hasGeographicFilters = $derived(
		smartContentFilter.preferences.filterLocalNews ||
			smartContentFilter.preferences.filterInternationalNews
	);

	const hasWellnessFilters = $derived(
		smartContentFilter.preferences.filterNegativeNews ||
			smartContentFilter.preferences.filterViolence ||
			smartContentFilter.preferences.filterAnxietyInducing ||
			smartContentFilter.preferences.filterEconomicPessimism
	);

	// State - show sections with active filters, collapse empty ones
	let showAdvanced = $state(false);
	let showBasicPresets = $state(true);
	let showSpecializedPresets = $state(true);
	let showContentQuality = $state(false);
	let showTopicsSubjects = $state(false);
	let showNewsTypes = $state(false);
	let showGeographicScope = $state(false);
	let showWellnessMental = $state(false);
	let showActiveFilters = $state(true);
	let showAdvancedSensitivity = $state(false);

	// Auto-expand/collapse sections based on active filters
	$effect(() => {
		// Auto-expand when filters are active
		if (hasContentQualityFilters && !showContentQuality) showContentQuality = true;
		if (hasTopicsSubjectsFilters && !showTopicsSubjects) showTopicsSubjects = true;
		if (hasNewsTypesFilters && !showNewsTypes) showNewsTypes = true;
		if (hasGeographicFilters && !showGeographicScope) showGeographicScope = true;
		if (hasWellnessFilters && !showWellnessMental) showWellnessMental = true;

		// Auto-collapse when no filters are active
		if (!hasContentQualityFilters && showContentQuality) showContentQuality = false;
		if (!hasTopicsSubjectsFilters && showTopicsSubjects) showTopicsSubjects = false;
		if (!hasNewsTypesFilters && showNewsTypes) showNewsTypes = false;
		if (!hasGeographicFilters && showGeographicScope) showGeographicScope = false;
		if (!hasWellnessFilters && showWellnessMental) showWellnessMental = false;
	});
	let showResetConfirm = $state(false);
	let showImportConfirm = $state(false);
	let resetButtonElement = $state<HTMLButtonElement>();
	let importButtonElement = $state<HTMLButtonElement>();
	let fileInputElement = $state<HTMLInputElement>();
	let importWarning = $state<string | undefined>();
	let pendingImportData = $state<string | undefined>();

	// Custom keywords functionality
	let newKeyword = $state('');
	let inputElement = $state<HTMLInputElement>();

	// Define content filter presets - separated into basic and specialized
	const basicPresets = [
		{
			id: 'balanced',
			label: s('settings.contentFilter.preset.balanced') || 'Quality Focus',
			tooltip:
				s('settings.contentFilter.preset.balanced.tooltip') ||
				'Moderate filtering focusing on content quality and readability',
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
			label: s('settings.smartFilter.preset.politicsFree') || 'Politics-Free',
			tooltip:
				s('settings.smartFilter.preset.politicsFree.tooltip') ||
				'Remove political content and partisan discussions',
			icon: 'arcticons:debatekeeper',
			preferences: {
				filterPolitics: true,
				filterBreakingNews: true,
				filterOpinions: true,
				minimumSentiment: 0.3
			}
		},
		{
			id: 'strict',
			label: s('settings.contentFilter.preset.strict') || 'High Standards',
			tooltip:
				s('settings.contentFilter.preset.strict.tooltip') ||
				'Aggressive filtering for premium-quality content only',
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
			label: s('settings.contentFilter.preset.professional') || 'Professional Focus',
			tooltip:
				s('settings.contentFilter.preset.professional.tooltip') ||
				'Filter entertainment and non-work content, focus on business news',
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
				// Add personality-based sensitivity overrides
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
			label: s('settings.contentFilter.preset.essentials') || 'News Essentials',
			tooltip:
				s('settings.contentFilter.preset.essentials.tooltip') ||
				'Only essential news, filter noise and information overload',
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
			label: s('settings.contentFilter.preset.global') || 'Global Focus',
			tooltip:
				s('settings.contentFilter.preset.global.tooltip') ||
				'International perspective, filter local and trivial content',
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
			label: s('settings.contentFilter.filterPersonality.purist') || 'News Purist',
			tooltip:
				s('settings.contentFilter.filterPersonality.puristDescription') ||
				'Focus on substantive journalism only',
			icon: 'tabler:news',
			preferences: {
				filterCelebrity: true,
				filterEntertainment: true,
				filterSports: true,
				filterSocialMediaDrama: true,
				// Add personality-based sensitivity overrides
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
			label: s('settings.contentFilter.filterPersonality.wellness') || 'Wellness Focus',
			tooltip:
				s('settings.contentFilter.filterPersonality.wellnessDescription') ||
				'Protect mental health, reduce anxiety',
			icon: 'tabler:brain',
			preferences: {
				filterViolence: true,
				filterNegativeNews: true,
				filterAnxietyInducing: true,
				filterEconomicPessimism: true,
				filterSocialMediaDrama: true,
				minimumSentiment: 0.5,
				// Add personality-based sensitivity overrides
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
		const preset = allPresets.find((p) => p.id === presetId);
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
				const currentValue =
					smartContentFilter.preferences[key as keyof typeof smartContentFilter.preferences];
				return currentValue === value;
			}
		});

		return preferencesMatch;
	};

	// Apply a preset (including category overrides)
	function togglePreset(presetId: string) {
		const allPresets = [...basicPresets, ...specializedPresets];
		const preset = allPresets.find((p) => p.id === presetId);
		if (!preset) return;

		if (isPresetActive(presetId)) {
			// Deactivate current preset by resetting preferences
			smartContentFilter.resetPreferences();
		} else {
			// Before activating new preset, deactivate conflicting presets
			const conflicts = getPresetConflicts(presetId);
			if (conflicts.length > 0) {
				// Find and deactivate conflicting presets
				for (const otherPreset of allPresets) {
					if (otherPreset.id !== presetId && isPresetActive(otherPreset.id)) {
						const hasConflict = Object.keys(preset.preferences).some((key) => {
							if (key === 'categoryOverrides') {
								const presetOverrides = (preset.preferences as any).categoryOverrides || {};
								const otherOverrides = (otherPreset.preferences as any).categoryOverrides || {};

								return Object.keys(presetOverrides).some(
									(category) =>
										otherOverrides[category] !== undefined &&
										otherOverrides[category] !== presetOverrides[category]
								);
							}

							return (
								(otherPreset.preferences as any)[key] !== undefined &&
								(otherPreset.preferences as any)[key] !== (preset.preferences as any)[key]
							);
						});

						if (hasConflict) {
							// Deactivate the conflicting preset by removing its specific settings
							deactivatePreset(otherPreset.id);
						}
					}
				}
			}

			// Apply new preset preferences
			Object.entries(preset.preferences).forEach(([key, value]) => {
				if (key === 'categoryOverrides') {
					// Special handling for category overrides
					const overrides = value as Record<string, number>;
					Object.entries(overrides).forEach(([category, sensitivity]) => {
						smartContentFilter.updateCategoryOverride(category, sensitivity);
					});
				} else {
					smartContentFilter.updatePreference(
						key as keyof typeof smartContentFilter.preferences,
						value
					);
				}
			});
		}
	}

	// Deactivate a specific preset without resetting everything
	function deactivatePreset(presetId: string) {
		const allPresets = [...basicPresets, ...specializedPresets];
		const preset = allPresets.find((p) => p.id === presetId);
		if (!preset) return;

		// Simplified approach: Reset everything and reapply other active presets
		// Store currently active presets (excluding the one we're deactivating)
		const otherActivePresets = allPresets.filter(
			(p) => p.id !== presetId && isPresetActive(p.id)
		);

		// Reset all preferences
		smartContentFilter.resetPreferences();

		// Reapply other active presets
		otherActivePresets.forEach((otherPreset) => {
			Object.entries(otherPreset.preferences).forEach(([key, value]) => {
				if (key === 'categoryOverrides') {
					const overrides = value as Record<string, number>;
					Object.entries(overrides).forEach(([category, sensitivity]) => {
						smartContentFilter.updateCategoryOverride(category, sensitivity);
					});
				} else {
					smartContentFilter.updatePreference(
						key as keyof typeof smartContentFilter.preferences,
						value
					);
				}
			});
		});
	}

	// Detect conflicts between presets
	function getPresetConflicts(presetId: string): string[] {
		const allPresets = [...basicPresets, ...specializedPresets];
		const preset = allPresets.find((p) => p.id === presetId);
		if (!preset) return [];

		const conflicts: string[] = [];

		for (const otherPreset of allPresets) {
			if (otherPreset.id === presetId || !isPresetActive(otherPreset.id)) continue;

			// Check for overlapping settings
			const hasConflict = Object.keys(preset.preferences).some((key) => {
				if (key === 'categoryOverrides') {
					const presetOverrides = (preset.preferences as any).categoryOverrides || {};
					const otherOverrides = (otherPreset.preferences as any).categoryOverrides || {};

					return Object.keys(presetOverrides).some(
						(category) =>
							otherOverrides[category] !== undefined &&
							otherOverrides[category] !== presetOverrides[category]
					);
				}

				return (
					(otherPreset.preferences as any)[key] !== undefined &&
					(otherPreset.preferences as any)[key] !== (preset.preferences as any)[key]
				);
			});

			if (hasConflict) {
				conflicts.push((otherPreset as any).label || (otherPreset as any).name);
			}
		}

		return conflicts;
	}

	// Check if a preset can be activated (no conflicts)
	function canActivatePreset(presetId: string): boolean {
		return getPresetConflicts(presetId).length === 0;
	}

	// Check if any advanced category sections should be shown
	const shouldShowAdvancedCategories = $derived(() => {
		const prefs = smartContentFilter.preferences;
		return (
			prefs.filterPolitics ||
			prefs.filterCelebrity ||
			prefs.filterSports ||
			prefs.filterTechnology ||
			prefs.filterSocialMediaDrama
		);
	});

	// Get list of configurable categories for empty state
	const configurableCategories = $derived.by(() => {
		const prefs = smartContentFilter.preferences;
		const categories = [];
		if (prefs.filterPolitics) categories.push('Politics');
		if (prefs.filterCelebrity) categories.push('Celebrity');
		if (prefs.filterSports) categories.push('Sports');
		if (prefs.filterTechnology) categories.push('Technology');
		if (prefs.filterSocialMediaDrama) categories.push('Social Media');
		return categories;
	});

	// Get formatted string of configurable categories
	const configurableCategoriesText = $derived.by(() => {
		return configurableCategories.join(', ');
	});

	// Get list of available but disabled categories
	const availableCategories = $derived.by(() => {
		const prefs = smartContentFilter.preferences;
		const available = [];
		if (!prefs.filterPolitics) available.push('Politics');
		if (!prefs.filterCelebrity) available.push('Celebrity');
		if (!prefs.filterSports) available.push('Sports');
		if (!prefs.filterTechnology) available.push('Technology');
		if (!prefs.filterSocialMediaDrama) available.push('Social Media');
		return available;
	});

	// Get formatted string of available categories
	const availableCategoriesText = $derived.by(() => {
		return availableCategories.join(', ');
	});

	// Track active preset and detect modifications
	const activePreset = $derived.by(() => {
		const allPresets = [...basicPresets, ...specializedPresets];
		return allPresets.find((preset) => isPresetActive(preset.id));
	});

	// Check if current settings have been modified from the active preset
	const isPresetModified = $derived.by(() => {
		if (!activePreset) return false;

		// Check if any settings differ from the preset
		for (const [key, value] of Object.entries(activePreset.preferences)) {
			if (key === 'categoryOverrides') {
				const currentOverrides = smartContentFilter.preferences.categoryOverrides || {};
				const presetOverrides = (value as Record<string, number>) || {};

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
				const currentValue =
					smartContentFilter.preferences[key as keyof typeof smartContentFilter.preferences];
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

	// Custom keywords functions
	function addKeyword() {
		if (!newKeyword.trim()) return;

		// Split by commas and add all keywords
		const keywords = newKeyword
			.split(',')
			.map((k) => k.trim())
			.filter((k) => k);
		keywords.forEach((k) => {
			smartContentFilter.addCustomKeyword(k);
		});
		newKeyword = '';

		// Focus back on input
		inputElement?.focus();
	}

	// Handle enter key for keywords
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addKeyword();
		}
	}

	// Remove keyword
	function removeKeyword(keyword: string) {
		smartContentFilter.removeCustomKeyword(keyword);
	}

	// Clear all custom keywords
	function clearCustomKeywords() {
		smartContentFilter.clearCustomKeywords();
	}

	// Function to remove an individual filter
	function removeFilter(filterKey: string) {
		if (filterKey === 'filterLowQuality')
			smartContentFilter.updatePreference('filterLowQuality', false);
		else if (filterKey === 'filterViolence')
			smartContentFilter.updatePreference('filterViolence', false);
		else if (filterKey === 'filterNegativeNews')
			smartContentFilter.updatePreference('filterNegativeNews', false);
		else if (filterKey === 'filterPolitics')
			smartContentFilter.updatePreference('filterPolitics', false);
		else if (filterKey === 'filterCelebrity')
			smartContentFilter.updatePreference('filterCelebrity', false);
		else if (filterKey === 'filterSports')
			smartContentFilter.updatePreference('filterSports', false);
		else if (filterKey === 'filterTechnology')
			smartContentFilter.updatePreference('filterTechnology', false);
		else if (filterKey === 'filterFinancial')
			smartContentFilter.updatePreference('filterFinancial', false);
		else if (filterKey === 'filterEntertainment')
			smartContentFilter.updatePreference('filterEntertainment', false);
		else if (filterKey === 'filterOpinions')
			smartContentFilter.updatePreference('filterOpinions', false);
		else if (filterKey === 'filterAnxietyInducing')
			smartContentFilter.updatePreference('filterAnxietyInducing', false);
		else if (filterKey === 'filterSocialMediaDrama')
			smartContentFilter.updatePreference('filterSocialMediaDrama', false);
		else if (filterKey === 'filterPromotional')
			smartContentFilter.updatePreference('filterPromotional', false);
		else if (filterKey === 'filterBreakingNews')
			smartContentFilter.updatePreference('filterBreakingNews', false);
		else if (filterKey === 'filterWeather')
			smartContentFilter.updatePreference('filterWeather', false);
		else if (filterKey === 'filterLocalNews')
			smartContentFilter.updatePreference('filterLocalNews', false);
		else if (filterKey === 'filterInternationalNews')
			smartContentFilter.updatePreference('filterInternationalNews', false);
		else if (filterKey === 'filterEconomicPessimism')
			smartContentFilter.updatePreference('filterEconomicPessimism', false);
		else if (filterKey === 'filterRepetitive')
			smartContentFilter.updatePreference('filterRepetitive', false);
		else if (filterKey === 'filterContentSimilarity') {
			smartContentFilter.updatePreference('filterContentSimilarity', false);
			// Also reset threshold to prevent issues
			smartContentFilter.setContentSimilarityThreshold(0);
		} else {
			// Assume it's a custom keyword
			smartContentFilter.removeCustomKeyword(filterKey);
		}
	}

	// Get active filter names
	const activeFilterNames = $derived.by(() => {
		const filters: Array<{ name: string; key: string; isKeyword: boolean }> = [];

		if (smartContentFilter.preferences.filterLowQuality)
			filters.push({
				name: s('settings.contentFilter.filterLowQuality') || 'Low Quality',
				key: 'filterLowQuality',
				isKeyword: false
			});
		if (smartContentFilter.preferences.filterViolence)
			filters.push({
				name: s('settings.contentFilter.filterViolence') || 'Violence',
				key: 'filterViolence',
				isKeyword: false
			});
		if (smartContentFilter.preferences.filterNegativeNews)
			filters.push({
				name: s('settings.contentFilter.filterNegative') || 'Negative News',
				key: 'filterNegativeNews',
				isKeyword: false
			});
		if (smartContentFilter.preferences.filterPolitics)
			filters.push({
				name: s('settings.contentFilter.filterPolitics') || 'Politics',
				key: 'filterPolitics',
				isKeyword: false
			});
		if (smartContentFilter.preferences.filterCelebrity)
			filters.push({
				name: s('settings.contentFilter.filterCelebrity') || 'Celebrity',
				key: 'filterCelebrity',
				isKeyword: false
			});
		if (smartContentFilter.preferences.filterSports)
			filters.push({
				name: s('settings.contentFilter.filterSports') || 'Sports',
				key: 'filterSports',
				isKeyword: false
			});
		if (smartContentFilter.preferences.filterTechnology)
			filters.push({
				name: s('settings.contentFilter.filterTechnology') || 'Technology',
				key: 'filterTechnology',
				isKeyword: false
			});
		if (smartContentFilter.preferences.filterFinancial)
			filters.push({
				name: s('settings.contentFilter.filterFinancial') || 'Financial',
				key: 'filterFinancial',
				isKeyword: false
			});
		if (smartContentFilter.preferences.filterEntertainment)
			filters.push({
				name: s('settings.contentFilter.filterEntertainment') || 'Entertainment',
				key: 'filterEntertainment',
				isKeyword: false
			});
		if (smartContentFilter.preferences.filterOpinions)
			filters.push({
				name: s('settings.contentFilter.filterOpinions') || 'Opinions',
				key: 'filterOpinions',
				isKeyword: false
			});
		if (smartContentFilter.preferences.filterAnxietyInducing)
			filters.push({
				name: s('settings.contentFilter.filterAnxietyInducing') || 'Anxiety-Inducing',
				key: 'filterAnxietyInducing',
				isKeyword: false
			});
		if (smartContentFilter.preferences.filterSocialMediaDrama)
			filters.push({
				name: s('settings.contentFilter.filterSocialMediaDrama') || 'Social Media Drama',
				key: 'filterSocialMediaDrama',
				isKeyword: false
			});
		if (smartContentFilter.preferences.filterPromotional)
			filters.push({
				name: s('settings.contentFilter.filterPromotional') || 'Promotional',
				key: 'filterPromotional',
				isKeyword: false
			});
		if (smartContentFilter.preferences.filterBreakingNews)
			filters.push({
				name: s('settings.contentFilter.filterBreakingNews') || 'Breaking News Alerts',
				key: 'filterBreakingNews',
				isKeyword: false
			});
		if (smartContentFilter.preferences.filterWeather)
			filters.push({
				name: s('settings.contentFilter.filterWeather') || 'Weather Coverage',
				key: 'filterWeather',
				isKeyword: false
			});
		if (smartContentFilter.preferences.filterLocalNews)
			filters.push({
				name: s('settings.contentFilter.filterLocalNews') || 'Hyper-Local News',
				key: 'filterLocalNews',
				isKeyword: false
			});
		if (smartContentFilter.preferences.filterInternationalNews)
			filters.push({
				name: s('settings.contentFilter.filterInternationalNews') || 'International News',
				key: 'filterInternationalNews',
				isKeyword: false
			});
		if (smartContentFilter.preferences.filterEconomicPessimism)
			filters.push({
				name: s('settings.contentFilter.filterEconomicPessimism') || 'Economic Pessimism',
				key: 'filterEconomicPessimism',
				isKeyword: false
			});
		if (smartContentFilter.preferences.filterRepetitive)
			filters.push({
				name: s('settings.contentFilter.filterRepetitive') || 'Repetitive Coverage',
				key: 'filterRepetitive',
				isKeyword: false
			});
		if (
			smartContentFilter.preferences.filterContentSimilarity &&
			smartContentFilter.preferences.contentSimilarityThreshold > 0
		) {
			filters.push({
				name: s('settings.contentFilter.filterContentSimilarity') || 'Content Similarity',
				key: 'filterContentSimilarity',
				isKeyword: false
			});
		}

		// Add custom keywords
		smartContentFilter.customKeywords.forEach((keyword) =>
			filters.push({ name: keyword, key: keyword, isKeyword: true })
		);

		return filters;
	});

	// Handle contentSimilarityScope changes (to avoid bind:group + onchange conflicts)
	$effect(() => {
		if (smartContentFilter.preferences.contentSimilarityScope) {
			smartContentFilter.setContentSimilarityScope(
				smartContentFilter.preferences.contentSimilarityScope
			);
		}
	});

	// Check if any filters are active
	const hasActiveFilters = $derived(
		smartContentFilter.isEnabled && activeFilterNames.length > 0
	);

	// Handle clear all filters
	function clearAllFilters() {
		smartContentFilter.reset();
	}

	// Export configuration
	function exportConfig() {
		const config = smartContentFilter.exportConfig();
		const blob = new Blob([config], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `kite-content-filters-${new Date().toISOString().split('T')[0]}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	// Handle file selection
	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;
			// Pre-validate the import
			const result = smartContentFilter.importConfig(content);
			if (result.errorKey) {
				alert(s(result.errorKey) || result.errorKey);
				return;
			}

			// Store the data and show confirmation
			pendingImportData = content;
			importWarning = result.warningKey ? s(result.warningKey) || result.warningKey : undefined;
			showImportConfirm = true;
		};
		reader.readAsText(file);
	}

	// Confirm import
	function confirmImport() {
		if (pendingImportData) {
			smartContentFilter.importConfig(pendingImportData);
			showImportConfirm = false;
			pendingImportData = undefined;
			importWarning = undefined;
			// Reset file input
			if (fileInputElement) fileInputElement.value = '';
		}
	}

	// Reset to defaults
	function resetToDefaults() {
		smartContentFilter.reset();
		showResetConfirm = false;
	}

	// Handle clicks outside reset confirm
	function handleOutsideClick(event: MouseEvent) {
		if (showResetConfirm && resetButtonElement && !resetButtonElement.contains(event.target as Node)) {
			const confirmEl = document.getElementById('reset-confirm-popup');
			if (confirmEl && !confirmEl.contains(event.target as Node)) {
				showResetConfirm = false;
			}
		}
	}

	// Handle clicks outside import confirm
	function handleImportOutsideClick(event: MouseEvent) {
		if (
			showImportConfirm &&
			importButtonElement &&
			!importButtonElement.contains(event.target as Node)
		) {
			const confirmEl = document.getElementById('import-confirm-popup');
			if (confirmEl && !confirmEl.contains(event.target as Node)) {
				showImportConfirm = false;
				pendingImportData = undefined;
				importWarning = undefined;
				if (fileInputElement) fileInputElement.value = '';
			}
		}
	}

	// Listen for outside clicks
	$effect(() => {
		if (showResetConfirm) {
			document.addEventListener('click', handleOutsideClick);
			return () => document.removeEventListener('click', handleOutsideClick);
		}
	});

	// Listen for import outside clicks
	$effect(() => {
		if (showImportConfirm) {
			document.addEventListener('click', handleImportOutsideClick);
			return () => document.removeEventListener('click', handleImportOutsideClick);
		}
	});

	// Set category-specific sensitivity override (delegates to store method)
	function setCategoryOverride(
		category:
			| 'politics'
			| 'celebrity'
			| 'sports'
			| 'financial'
			| 'technology'
			| 'entertainment'
			| 'socialMediaDrama',
		sensitivity: 'strict' | 'balanced' | 'loose' | number | undefined
	) {
		smartContentFilter.updateCategoryOverride(category, sensitivity);
	}

	// Check if a category is using custom sensitivity
	function isCustomSensitivity(
		category:
			| 'politics'
			| 'celebrity'
			| 'sports'
			| 'financial'
			| 'technology'
			| 'entertainment'
			| 'socialMediaDrama'
	): boolean {
		const override = smartContentFilter.preferences.categoryOverrides?.[category];
		return typeof override === 'number';
	}

	// Get custom sensitivity value for a category
	function getCustomSensitivity(
		category:
			| 'politics'
			| 'celebrity'
			| 'sports'
			| 'financial'
			| 'technology'
			| 'entertainment'
			| 'socialMediaDrama'
	): number {
		const override = smartContentFilter.preferences.categoryOverrides?.[category];
		return typeof override === 'number' ? override : 50; // Default to 50 for new custom values
	}

	// Get detailed sensitivity display name for custom values
	function getSensitivityDisplayName(value: number): string {
		if (value === 0) return `${value}% (Disabled)`;
		if (value <= 20) return `${value}% (Very Loose)`;
		if (value <= 40) return `${value}% (Loose)`;
		if (value <= 60) return `${value}% (Balanced)`;
		if (value <= 80) return `${value}% (Strict)`;
		return `${value}% (Very Strict)`;
	}

	// Get detailed explanation of what sensitivity level does
	function getSensitivityExplanation(value: number): string {
		if (value === 0) return 'No filtering';
		if (value <= 20) return 'Title match or 1 weak indicator';
		if (value <= 40) return 'Title match or 1-2 indicators';
		if (value <= 60) return '2-3 indicators or strong context';
		if (value <= 80) return '3-4 indicators with context';
		return '4+ indicators with strong evidence';
	}
</script>

<div class="space-y-8">
	<!-- Main Toggle -->
	<div class="flex items-center justify-between rounded-lg border bg-gray-50 p-4 dark:bg-gray-800">
		<div>
			<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
				{s('settings.contentFilter.enableTitle') || 'Smart Content Filter'}
			</h3>
			<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
				{s('settings.contentFilter.enableDescription') ||
					'AI-powered filtering for better content quality and personalization'}
			</p>
		</div>
		<button
			onclick={() => smartContentFilter.toggleEnabled()}
			type="button"
			class="focus-visible-ring relative inline-flex h-6 w-11 items-center rounded-full transition"
			class:bg-blue-600={smartContentFilter.isEnabled}
			class:bg-gray-200={!smartContentFilter.isEnabled}
			class:dark:bg-gray-600={!smartContentFilter.isEnabled}
			role="switch"
			aria-checked={smartContentFilter.isEnabled}
		>
			<span class="sr-only">Toggle content filter</span>
			<span
				class="inline-block h-4 w-4 transform rounded-full bg-white transition"
				class:translate-x-6={smartContentFilter.isEnabled}
				class:translate-x-1={!smartContentFilter.isEnabled}
			></span>
		</button>
	</div>

	{#if smartContentFilter.isEnabled}
		<!-- ===================== QUICK SETTINGS ===================== -->
		<div class="space-y-6">
			<div class="border-b border-gray-200 pb-4 dark:border-gray-700">
				<h2 class="flex items-center gap-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
					<Icon icon="tabler:zap" class="h-6 w-6 text-blue-600 dark:text-blue-400" />
					Quick Settings
				</h2>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					Fast setup with presets and essential controls
				</p>
			</div>

			<!-- Quick Presets -->
			<div>
				<h3 class="mb-3 text-lg font-medium text-gray-900 dark:text-gray-100">
					{s('settings.contentFilter.basicPresets.label') || 'Filter Presets'}
				</h3>
				<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
					{s('settings.contentFilter.basicPresets.description') ||
						'Choose a filtering mode that matches your preferences'}
				</p>
				{#if showBasicPresets}
					<div class="animate-in fade-in slide-in-from-top-2 duration-200">
						<div class="grid grid-cols-1 gap-2 md:grid-cols-3">
							{#each basicPresets as preset}
								<div class="relative">
									<button
										onclick={() => togglePreset(preset.id)}
										disabled={!isPresetActive(preset.id) && !canActivatePreset(preset.id)}
										class="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors {isPresetActive(
											preset.id
										)
											? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
											: !canActivatePreset(preset.id)
												? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500'
												: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}"
									>
										<div class="flex flex-1 items-center gap-2 text-left">
											<Icon
												icon={preset.icon}
												class="h-4 w-4 text-gray-600 dark:text-gray-400"
											/>
											<span>{preset.label}</span>
										</div>
										<div class="flex items-center gap-1">
											{#if preset.tooltip}
												<Tooltip text={preset.tooltip} position="top">
													<Icon
														icon="tabler:info-circle"
														class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500"
													/>
												</Tooltip>
											{/if}
											{#if !canActivatePreset(preset.id) && !isPresetActive(preset.id)}
												<Tooltip
													text={`Conflicts with: ${getPresetConflicts(preset.id).join(', ')}`}
													position="top"
												>
													<Icon icon="tabler:alert-triangle" class="h-4 w-4 text-orange-500" />
												</Tooltip>
											{/if}
											{#if isPresetActive(preset.id)}
												<Icon icon="tabler:check" class="h-4 w-4" />
											{/if}
										</div>
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>