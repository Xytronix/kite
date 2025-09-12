<script lang="ts">
	import { s } from '$lib/client/localization.svelte';
	import { smartContentFilter } from '$lib/stores/smartContentFilter.svelte';
	import Icon from '$lib/components/Icon.svelte';
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
	
	const hasNewsTypesFilters = $derived(
		smartContentFilter.preferences.filterBreakingNews
	);
	
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
			tooltip: s('settings.contentFilter.preset.balanced.tooltip') || 'Moderate filtering focusing on content quality and readability',
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
			tooltip: s('settings.smartFilter.preset.politicsFree.tooltip') || 'Remove political content and partisan discussions',
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
			tooltip: s('settings.contentFilter.preset.strict.tooltip') || 'Aggressive filtering for premium-quality content only',
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
			tooltip: s('settings.contentFilter.preset.professional.tooltip') || 'Filter entertainment and non-work content, focus on business news',
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
			tooltip: s('settings.contentFilter.preset.essentials.tooltip') || 'Only essential news, filter noise and information overload',
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
			tooltip: s('settings.contentFilter.preset.global.tooltip') || 'International perspective, filter local and trivial content',
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
			tooltip: s('settings.contentFilter.filterPersonality.puristDescription') || 'Focus on substantive journalism only',
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
			tooltip: s('settings.contentFilter.filterPersonality.wellnessDescription') || 'Protect mental health, reduce anxiety',
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

	// Apply a preset (including category overrides)
	function togglePreset(presetId: string) {
		const allPresets = [...basicPresets, ...specializedPresets];
		const preset = allPresets.find(p => p.id === presetId);
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
					smartContentFilter.updatePreference(key as keyof typeof smartContentFilter.preferences, value);
				}
			});
		}
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
		return prefs.filterPolitics || 
			   prefs.filterCelebrity || 
			   prefs.filterSports || 
			   prefs.filterTechnology || 
			   prefs.filterSocialMediaDrama;
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
	
	// Custom keywords functions
	function addKeyword() {
		if (!newKeyword.trim()) return;
		
		// Split by commas and add all keywords
		const keywords = newKeyword.split(',').map(k => k.trim()).filter(k => k);
		keywords.forEach(k => {
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
		if (filterKey === 'filterLowQuality') smartContentFilter.updatePreference('filterLowQuality', false);
		else if (filterKey === 'filterViolence') smartContentFilter.updatePreference('filterViolence', false);
		else if (filterKey === 'filterNegativeNews') smartContentFilter.updatePreference('filterNegativeNews', false);
		else if (filterKey === 'filterPolitics') smartContentFilter.updatePreference('filterPolitics', false);
		else if (filterKey === 'filterCelebrity') smartContentFilter.updatePreference('filterCelebrity', false);
		else if (filterKey === 'filterSports') smartContentFilter.updatePreference('filterSports', false);
		else if (filterKey === 'filterTechnology') smartContentFilter.updatePreference('filterTechnology', false);
		else if (filterKey === 'filterFinancial') smartContentFilter.updatePreference('filterFinancial', false);
		else if (filterKey === 'filterEntertainment') smartContentFilter.updatePreference('filterEntertainment', false);
		else if (filterKey === 'filterOpinions') smartContentFilter.updatePreference('filterOpinions', false);
		else if (filterKey === 'filterAnxietyInducing') smartContentFilter.updatePreference('filterAnxietyInducing', false);
		else if (filterKey === 'filterSocialMediaDrama') smartContentFilter.updatePreference('filterSocialMediaDrama', false);
		else if (filterKey === 'filterPromotional') smartContentFilter.updatePreference('filterPromotional', false);
		else if (filterKey === 'filterBreakingNews') smartContentFilter.updatePreference('filterBreakingNews', false);
		else if (filterKey === 'filterWeather') smartContentFilter.updatePreference('filterWeather', false);
		else if (filterKey === 'filterLocalNews') smartContentFilter.updatePreference('filterLocalNews', false);
		else if (filterKey === 'filterInternationalNews') smartContentFilter.updatePreference('filterInternationalNews', false);
		else if (filterKey === 'filterEconomicPessimism') smartContentFilter.updatePreference('filterEconomicPessimism', false);
		else if (filterKey === 'filterRepetitive') smartContentFilter.updatePreference('filterRepetitive', false);
		else if (filterKey === 'filterContentSimilarity') {
			smartContentFilter.updatePreference('filterContentSimilarity', false);
			// Also reset threshold to prevent issues
			smartContentFilter.setContentSimilarityThreshold(0);
		}
		else {
			// Assume it's a custom keyword
			smartContentFilter.removeCustomKeyword(filterKey);
		}
	}

	// Get active filter names
	const activeFilterNames = $derived.by(() => {
		const filters: Array<{ name: string; key: string; isKeyword: boolean }> = [];
		
		if (smartContentFilter.preferences.filterLowQuality) filters.push({ name: s('settings.contentFilter.filterLowQuality') || 'Low Quality', key: 'filterLowQuality', isKeyword: false });
		if (smartContentFilter.preferences.filterViolence) filters.push({ name: s('settings.contentFilter.filterViolence') || 'Violence', key: 'filterViolence', isKeyword: false });
		if (smartContentFilter.preferences.filterNegativeNews) filters.push({ name: s('settings.contentFilter.filterNegative') || 'Negative News', key: 'filterNegativeNews', isKeyword: false });
		if (smartContentFilter.preferences.filterPolitics) filters.push({ name: s('settings.contentFilter.filterPolitics') || 'Politics', key: 'filterPolitics', isKeyword: false });
		if (smartContentFilter.preferences.filterCelebrity) filters.push({ name: s('settings.contentFilter.filterCelebrity') || 'Celebrity', key: 'filterCelebrity', isKeyword: false });
		if (smartContentFilter.preferences.filterSports) filters.push({ name: s('settings.contentFilter.filterSports') || 'Sports', key: 'filterSports', isKeyword: false });
		if (smartContentFilter.preferences.filterTechnology) filters.push({ name: s('settings.contentFilter.filterTechnology') || 'Technology', key: 'filterTechnology', isKeyword: false });
		if (smartContentFilter.preferences.filterFinancial) filters.push({ name: s('settings.contentFilter.filterFinancial') || 'Financial', key: 'filterFinancial', isKeyword: false });
		if (smartContentFilter.preferences.filterEntertainment) filters.push({ name: s('settings.contentFilter.filterEntertainment') || 'Entertainment', key: 'filterEntertainment', isKeyword: false });
		if (smartContentFilter.preferences.filterOpinions) filters.push({ name: s('settings.contentFilter.filterOpinions') || 'Opinions', key: 'filterOpinions', isKeyword: false });
		if (smartContentFilter.preferences.filterAnxietyInducing) filters.push({ name: s('settings.contentFilter.filterAnxietyInducing') || 'Anxiety-Inducing', key: 'filterAnxietyInducing', isKeyword: false });
		if (smartContentFilter.preferences.filterSocialMediaDrama) filters.push({ name: s('settings.contentFilter.filterSocialMediaDrama') || 'Social Media Drama', key: 'filterSocialMediaDrama', isKeyword: false });
		if (smartContentFilter.preferences.filterPromotional) filters.push({ name: s('settings.contentFilter.filterPromotional') || 'Promotional', key: 'filterPromotional', isKeyword: false });
		if (smartContentFilter.preferences.filterBreakingNews) filters.push({ name: s('settings.contentFilter.filterBreakingNews') || 'Breaking News Alerts', key: 'filterBreakingNews', isKeyword: false });
		if (smartContentFilter.preferences.filterWeather) filters.push({ name: s('settings.contentFilter.filterWeather') || 'Weather Coverage', key: 'filterWeather', isKeyword: false });
		if (smartContentFilter.preferences.filterLocalNews) filters.push({ name: s('settings.contentFilter.filterLocalNews') || 'Hyper-Local News', key: 'filterLocalNews', isKeyword: false });
		if (smartContentFilter.preferences.filterInternationalNews) filters.push({ name: s('settings.contentFilter.filterInternationalNews') || 'International News', key: 'filterInternationalNews', isKeyword: false });
		if (smartContentFilter.preferences.filterEconomicPessimism) filters.push({ name: s('settings.contentFilter.filterEconomicPessimism') || 'Economic Pessimism', key: 'filterEconomicPessimism', isKeyword: false });
		if (smartContentFilter.preferences.filterRepetitive) filters.push({ name: s('settings.contentFilter.filterRepetitive') || 'Repetitive Coverage', key: 'filterRepetitive', isKeyword: false });
		if (smartContentFilter.preferences.filterContentSimilarity && smartContentFilter.preferences.contentSimilarityThreshold > 0) {
			filters.push({ name: s('settings.contentFilter.filterContentSimilarity') || 'Content Similarity', key: 'filterContentSimilarity', isKeyword: false });
		}
		
		// Add custom keywords
		smartContentFilter.customKeywords.forEach(keyword => filters.push({ name: keyword, key: keyword, isKeyword: true }));
		
		return filters;
	});

	// Handle contentSimilarityScope changes (to avoid bind:group + onchange conflicts)
	$effect(() => {
		if (smartContentFilter.preferences.contentSimilarityScope) {
			smartContentFilter.setContentSimilarityScope(smartContentFilter.preferences.contentSimilarityScope);
		}
	});

	// Check if any filters are active
	const hasActiveFilters = $derived(smartContentFilter.isEnabled && activeFilterNames.length > 0);

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
			importWarning = result.warningKey ? (s(result.warningKey) || result.warningKey) : undefined;
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
		if (showImportConfirm && importButtonElement && !importButtonElement.contains(event.target as Node)) {
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
	function setCategoryOverride(category: 'politics' | 'celebrity' | 'sports' | 'financial' | 'technology' | 'entertainment' | 'socialMediaDrama', sensitivity: 'strict' | 'balanced' | 'loose' | number | undefined) {
		smartContentFilter.updateCategoryOverride(category, sensitivity);
	}
	
	// Check if a category is using custom sensitivity
	function isCustomSensitivity(category: 'politics' | 'celebrity' | 'sports' | 'financial' | 'technology' | 'entertainment' | 'socialMediaDrama'): boolean {
		const override = smartContentFilter.preferences.categoryOverrides?.[category];
		return typeof override === 'number';
	}
	
	// Get custom sensitivity value for a category
	function getCustomSensitivity(category: 'politics' | 'celebrity' | 'sports' | 'financial' | 'technology' | 'entertainment' | 'socialMediaDrama'): number {
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



<div class="space-y-6">
	<!-- Simple Description -->
	<div class="text-sm text-gray-600 dark:text-gray-400 mb-4">
		Smart content filtering uses AI-powered analysis to automatically filter stories based on content patterns and quality metrics.
	</div>

	<!-- Content Filter Toggle -->
			<div>
		<div class="flex items-center justify-between mb-3">
			<div>
				<h3 class="text-base font-medium text-gray-900 dark:text-gray-100">
					{s('settings.contentFilter.enableTitle') || 'Enable Content Filtering'}
				</h3>
				<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
					{s('settings.contentFilter.enableDescription') || 'Automatically filter low-quality, irrelevant, or unwanted content using smart analysis'}
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
	</div>

	<!-- Basic Presets -->
		<div>
			<button
				class="flex items-center justify-between w-full text-left mb-1"
				onclick={() => showBasicPresets = !showBasicPresets}
			>
				<h3 class="text-base font-medium text-gray-900 dark:text-gray-100">
					{s('settings.contentFilter.basicPresets.label') || 'Quick Presets'}
			</h3>
				<span class="text-gray-400 text-lg transition-transform duration-200 {showBasicPresets ? 'rotate-90' : ''}">
					▶
				</span>
			</button>
			{#if showBasicPresets}
				<div class="animate-in fade-in slide-in-from-top-2 duration-200">
					<p class="mt-0.5 mb-3 text-sm text-gray-500 dark:text-gray-400">
						{s('settings.contentFilter.basicPresets.description') || 'Choose a filtering mode that matches your preferences'}
					</p>
					<div class="grid grid-cols-1 md:grid-cols-3 gap-2">
						{#each basicPresets as preset}
							<div class="relative">
								<button
									onclick={() => togglePreset(preset.id)}
									disabled={!isPresetActive(preset.id) && !canActivatePreset(preset.id)}
									class="flex items-center justify-between w-full px-3 py-2 text-sm rounded-md border transition-colors
										{isPresetActive(preset.id) 
											? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
											: !canActivatePreset(preset.id)
												? 'bg-gray-100 border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500 cursor-not-allowed opacity-60'
												: 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600'}"
								>
									<div class="flex items-center gap-2 flex-1 text-left">
										<Icon icon={preset.icon} class="w-4 h-4 text-gray-600 dark:text-gray-400" />
										<span>{preset.label}</span>
									</div>
									<div class="flex items-center gap-1">
										{#if preset.tooltip}
											<Tooltip text={preset.tooltip} position="top">
												<Icon icon="tabler:info-circle" class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
											</Tooltip>
										{/if}
										{#if !canActivatePreset(preset.id) && !isPresetActive(preset.id)}
											<Tooltip text={`Conflicts with: ${getPresetConflicts(preset.id).join(', ')}`} position="top">
												<Icon icon="tabler:alert-triangle" class="w-4 h-4 text-orange-500" />
											</Tooltip>
										{/if}
										{#if isPresetActive(preset.id)}
											<Icon icon="tabler:check" class="w-4 h-4" />
										{/if}
									</div>
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Specialized Presets -->
		<div>
			<button
				class="flex items-center justify-between w-full text-left mb-1"
				onclick={() => showSpecializedPresets = !showSpecializedPresets}
			>
				<h3 class="text-base font-medium text-gray-900 dark:text-gray-100">
					{s('settings.contentFilter.presets.label') || 'Specialized Presets'}
				</h3>
				<span class="text-gray-400 text-lg transition-transform duration-200 {showSpecializedPresets ? 'rotate-90' : ''}">
					▶
				</span>
			</button>
			{#if showSpecializedPresets}
				<div class="animate-in fade-in slide-in-from-top-2 duration-200">
					<p class="mt-0.5 mb-3 text-sm text-gray-500 dark:text-gray-400">
						{s('settings.contentFilter.presets.description') || 'Specialized filtering modes for specific use cases'}
					</p>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
						{#each specializedPresets as preset}
							<div class="relative">
								<button
									onclick={() => togglePreset(preset.id)}
									disabled={!isPresetActive(preset.id) && !canActivatePreset(preset.id)}
									class="flex items-center justify-between w-full px-3 py-2 text-sm rounded-md border transition-colors
										{isPresetActive(preset.id) 
											? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
											: !canActivatePreset(preset.id)
												? 'bg-gray-100 border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500 cursor-not-allowed opacity-60'
												: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600'}"
								>
									<div class="flex items-center gap-2 flex-1 text-left">
										<Icon icon={preset.icon} class="w-4 h-4 text-gray-600 dark:text-gray-400" />
										<span>{preset.label}</span>
									</div>
									<div class="flex items-center gap-1">
										{#if preset.tooltip}
											<Tooltip text={preset.tooltip} position="top">
												<Icon icon="tabler:info-circle" class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
											</Tooltip>
										{/if}
										{#if !canActivatePreset(preset.id) && !isPresetActive(preset.id)}
											<Tooltip text={`Conflicts with: ${getPresetConflicts(preset.id).join(', ')}`} position="top">
												<Icon icon="tabler:alert-triangle" class="w-4 h-4 text-orange-500" />
											</Tooltip>
										{/if}
										{#if isPresetActive(preset.id)}
											<Icon icon="tabler:check" class="w-4 h-4" />
										{/if}
									</div>
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
		
		<!-- Preset Modification Indicator -->
		{#if activePreset && isPresetModified}
			<div class="p-3 bg-orange-50 border border-orange-200 rounded-lg dark:bg-orange-900/20 dark:border-orange-700">
				<div class="flex items-start gap-3">
					<Icon icon="tabler:alert-triangle" class="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
					<div class="flex-1">
						<h4 class="text-sm font-medium text-orange-800 dark:text-orange-200">
							Preset Modified
						</h4>
						<p class="text-sm text-orange-700 dark:text-orange-300 mt-1">
							You've made changes to the "{activePreset.label}" preset. These changes are temporary and will be lost if you switch presets.
						</p>
						<div class="flex gap-2 mt-3">
							<button
								onclick={resetToActivePreset}
								class="px-3 py-1.5 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
							>
								Reset to "{activePreset.label}"
							</button>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Custom Keywords Input -->
		<div>
			<label for="keyword-input" class="text-base font-medium text-gray-900 dark:text-gray-100">
				{s('settings.contentFilter.keywords.label') || 'Custom Keywords'}
			</label>
			<p class="mt-0.5 mb-2 text-sm text-gray-500 dark:text-gray-400">
				{s('settings.contentFilter.keywords.description') || 'Add your own keywords to filter, separated by commas'}
			</p>
			<div class="flex gap-2">
				<input
					bind:this={inputElement}
					id="keyword-input"
					type="text"
					bind:value={newKeyword}
					onkeydown={handleKeydown}
					placeholder={s('settings.contentFilter.keywords.placeholder') || 'e.g., celebrity name, topic'}
					class="flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:bg-gray-700"
				/>
				<button
					onclick={addKeyword}
					disabled={!newKeyword.trim()}
					class="rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-gray-600"
				>
					<Icon icon="tabler:plus" class="w-4 h-4" />
				</button>
			</div>
		</div>

		<!-- Content Filters - Grid Style -->
		<div>
			<button
				class="flex items-center justify-between w-full text-left mb-1"
				onclick={() => showContentQuality = !showContentQuality}
			>
				<h3 class="text-base font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
					<Icon icon="tabler:news" class="w-5 h-5 text-gray-600 dark:text-gray-400" />
					Content & Quality
				</h3>
				<span class="text-gray-400 text-lg transition-transform duration-200 {showContentQuality ? 'rotate-90' : ''}">
					▶
				</span>
			</button>
			{#if showContentQuality}
				<div class="animate-in fade-in slide-in-from-top-2 duration-200">
					<p class="mt-0.5 mb-3 text-sm text-gray-500 dark:text-gray-400">
						Fine-tune which types of content to filter automatically
					</p>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
						<button 
							onclick={() => smartContentFilter.togglePreference('filterLowQuality')}
							class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left w-full
								{smartContentFilter.preferences.filterLowQuality 
									? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
									: 'bg-white border border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}"
						>
							<Icon icon="tabler:trash" class="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium block">
									{s('settings.contentFilter.filterLowQuality') || 'Low Quality Content'}
								</span>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									{s('settings.contentFilter.filterLowQualityDesc') || 'Filter clickbait, spam, and poor journalism'}
								</p>
							</div>
							{#if smartContentFilter.preferences.filterLowQuality}
								<Icon icon="tabler:check" class="w-4 h-4 flex-shrink-0 mt-0.5" />
							{/if}
						</button>

						<button 
							onclick={() => smartContentFilter.togglePreference('filterPromotional')}
							class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left w-full
								{smartContentFilter.preferences.filterPromotional 
									? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
									: 'bg-white border border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}"
						>
							<Icon icon="tabler:ad" class="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium block">
									{s('settings.contentFilter.filterPromotional') || 'Promotional Content'}
								</span>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									{s('settings.contentFilter.filterPromotionalDesc') || 'Filter press releases and marketing disguised as news'}
								</p>
							</div>
							{#if smartContentFilter.preferences.filterPromotional}
								<Icon icon="tabler:check" class="w-4 h-4 flex-shrink-0 mt-0.5" />
							{/if}
						</button>

						<button 
							onclick={() => smartContentFilter.togglePreference('filterOpinions')}
							class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left w-full
								{smartContentFilter.preferences.filterOpinions 
									? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
									: 'bg-white border border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}"
						>
							<Icon icon="tabler:message-circle" class="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium block">
									{s('settings.contentFilter.filterOpinions') || 'Opinion Pieces'}
								</span>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									{s('settings.contentFilter.filterOpinionsDesc') || 'Filter editorials and commentary, keep factual reporting'}
								</p>
							</div>
							{#if smartContentFilter.preferences.filterOpinions}
								<Icon icon="tabler:check" class="w-4 h-4 flex-shrink-0 mt-0.5" />
							{/if}
						</button>

						<button 
							onclick={() => smartContentFilter.togglePreference('filterRepetitive')}
							class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left w-full
								{smartContentFilter.preferences.filterRepetitive 
									? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
									: 'bg-white border border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}"
						>
							<Icon icon="tabler:repeat" class="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium block">
									{s('settings.contentFilter.filterRepetitive') || 'Repetitive Coverage'}
								</span>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									{s('settings.contentFilter.filterRepetitiveDesc') || 'Filter articles with repetitive language patterns (basic pattern matching)'}
								</p>
							</div>
							{#if smartContentFilter.preferences.filterRepetitive}
								<Icon icon="tabler:check" class="w-4 h-4 flex-shrink-0 mt-0.5" />
							{/if}
						</button>



						<button 
							onclick={() => smartContentFilter.togglePreference('filterSocialMediaDrama')}
							class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left w-full
								{smartContentFilter.preferences.filterSocialMediaDrama 
									? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
									: 'bg-white border border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}"
						>
							<Icon icon="tabler:brand-x" class="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium block">
									{s('settings.contentFilter.filterSocialMediaDrama') || 'Social Media Drama'}
								</span>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									{s('settings.contentFilter.filterSocialMediaDramaDesc') || 'Filter Twitter feuds and online controversies'}
								</p>
							</div>
							{#if smartContentFilter.preferences.filterSocialMediaDrama}
								<Icon icon="tabler:check" class="w-4 h-4 flex-shrink-0 mt-0.5" />
							{/if}
						</button>
				</div>
				</div>
			{/if}
			</div>

		<!-- Topics & Subjects -->
		<div>
			<button
				class="flex items-center justify-between w-full text-left mb-1"
				onclick={() => showTopicsSubjects = !showTopicsSubjects}
			>
				<h3 class="text-base font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
					<Icon icon="tabler:tags" class="w-5 h-5 text-gray-600 dark:text-gray-400" />
					Topics & Subjects
				</h3>
				<span class="text-gray-400 text-lg transition-transform duration-200 {showTopicsSubjects ? 'rotate-90' : ''}">
					▶
				</span>
			</button>
			{#if showTopicsSubjects}
				<div class="animate-in fade-in slide-in-from-top-2 duration-200">
					<p class="mt-0.5 mb-3 text-sm text-gray-500 dark:text-gray-400">
						Filter content by subject matter and topic categories
					</p>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
						<button 
							onclick={() => smartContentFilter.togglePreference('filterPolitics')}
							class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left w-full
								{smartContentFilter.preferences.filterPolitics 
									? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
									: 'bg-white border border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}"
						>
							<Icon icon="game-icons:capitol" class="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium block">
									{s('settings.contentFilter.filterPolitics') || 'Political Content'}
								</span>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									{s('settings.contentFilter.filterPoliticsDesc') || 'Filter political news and partisan content'}
								</p>
							</div>
							{#if smartContentFilter.preferences.filterPolitics}
								<Icon icon="tabler:check" class="w-4 h-4 flex-shrink-0 mt-0.5" />
							{/if}
						</button>

						<button 
							onclick={() => smartContentFilter.togglePreference('filterSports')}
							class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left w-full
								{smartContentFilter.preferences.filterSports 
									? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
									: 'bg-white border border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}"
						>
							<Icon icon="tabler:ball-american-football" class="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium block">
									{s('settings.contentFilter.filterSports') || 'Sports Coverage'}
								</span>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									{s('settings.contentFilter.filterSportsDesc') || 'Filter all sports news, scores, and coverage'}
								</p>
							</div>
							{#if smartContentFilter.preferences.filterSports}
								<Icon icon="tabler:check" class="w-4 h-4 flex-shrink-0 mt-0.5" />
							{/if}
						</button>

						<button 
							onclick={() => smartContentFilter.togglePreference('filterFinancial')}
							class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left w-full
								{smartContentFilter.preferences.filterFinancial 
									? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
									: 'bg-white border border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}"
						>
							<Icon icon="tabler:trending-up" class="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium block">
									{s('settings.contentFilter.filterFinancial') || 'Financial News'}
								</span>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									{s('settings.contentFilter.filterFinancialDesc') || 'Filter stock market, earnings, and corporate financial news'}
								</p>
							</div>
							{#if smartContentFilter.preferences.filterFinancial}
								<Icon icon="tabler:check" class="w-4 h-4 flex-shrink-0 mt-0.5" />
							{/if}
						</button>

						<button 
							onclick={() => smartContentFilter.togglePreference('filterTechnology')}
							class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left w-full
								{smartContentFilter.preferences.filterTechnology 
									? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
									: 'bg-white border border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}"
						>
							<Icon icon="tabler:device-laptop" class="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium block">
									{s('settings.contentFilter.filterTechnology') || 'Technology News'}
								</span>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									{s('settings.contentFilter.filterTechnologyDesc') || 'Filter tech company news and product launches'}
								</p>
							</div>
							{#if smartContentFilter.preferences.filterTechnology}
								<Icon icon="tabler:check" class="w-4 h-4 flex-shrink-0 mt-0.5" />
							{/if}
						</button>

						<button 
							onclick={() => smartContentFilter.togglePreference('filterEntertainment')}
							class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left w-full
								{smartContentFilter.preferences.filterEntertainment 
									? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
									: 'bg-white border border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}"
						>
							<Icon icon="tabler:movie" class="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium block">
									{s('settings.contentFilter.filterEntertainment') || 'Entertainment Industry'}
								</span>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									{s('settings.contentFilter.filterEntertainmentDesc') || 'Filter movie, TV, and music industry news'}
								</p>
							</div>
							{#if smartContentFilter.preferences.filterEntertainment}
								<Icon icon="tabler:check" class="w-4 h-4 flex-shrink-0 mt-0.5" />
							{/if}
						</button>

						<button 
							onclick={() => smartContentFilter.togglePreference('filterCelebrity')}
							class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left w-full
								{smartContentFilter.preferences.filterCelebrity 
									? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
									: 'bg-white border border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}"
						>
							<Icon icon="tabler:star" class="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium block">
									{s('settings.contentFilter.filterCelebrity') || 'Celebrity News'}
								</span>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									{s('settings.contentFilter.filterCelebrityDesc') || 'Filter celebrity gossip and entertainment news'}
								</p>
							</div>
							{#if smartContentFilter.preferences.filterCelebrity}
								<Icon icon="tabler:check" class="w-4 h-4 flex-shrink-0 mt-0.5" />
							{/if}
						</button>

						<button 
							onclick={() => smartContentFilter.togglePreference('filterWeather')}
							class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left w-full
								{smartContentFilter.preferences.filterWeather 
									? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
									: 'bg-white border border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}"
						>
							<Icon icon="tabler:cloud" class="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium block">
									{s('settings.contentFilter.filterWeather') || 'Weather Coverage'}
								</span>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									{s('settings.contentFilter.filterWeatherDesc') || 'Filter routine weather reports (keep major weather events)'}
								</p>
				</div>
							{#if smartContentFilter.preferences.filterWeather}
								<Icon icon="tabler:check" class="w-4 h-4 flex-shrink-0 mt-0.5" />
							{/if}
						</button>
					</div>
				</div>
			{/if}
			</div>

		<!-- News Types -->
		<div>
			<button
				class="flex items-center justify-between w-full text-left mb-1"
				onclick={() => showNewsTypes = !showNewsTypes}
			>
				<h3 class="text-base font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
					<Icon icon="heroicons:newspaper" class="w-5 h-5 text-gray-600 dark:text-gray-400" />
					News Types
				</h3>
				<span class="text-gray-400 text-lg transition-transform duration-200 {showNewsTypes ? 'rotate-90' : ''}">
					▶
				</span>
			</button>
			{#if showNewsTypes}
				<div class="animate-in fade-in slide-in-from-top-2 duration-200">
					<p class="mt-0.5 mb-3 text-sm text-gray-500 dark:text-gray-400">
						Filter by news format and presentation style
					</p>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
						<button 
							onclick={() => smartContentFilter.togglePreference('filterBreakingNews')}
							class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left w-full
								{smartContentFilter.preferences.filterBreakingNews 
									? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
									: 'bg-white border border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}"
						>
							<Icon icon="tabler:urgent" class="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium block">
									{s('settings.contentFilter.filterBreakingNews') || 'Breaking News Alerts'}
								</span>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									{s('settings.contentFilter.filterBreakingNewsDesc') || 'Filter rapid-fire breaking news updates'}
								</p>
							</div>
							{#if smartContentFilter.preferences.filterBreakingNews}
								<Icon icon="tabler:check" class="w-4 h-4 flex-shrink-0 mt-0.5" />
							{/if}
						</button>


					</div>
				</div>
			{/if}
		</div>

		<!-- Geographic Scope -->
		<div>
			<button
				class="flex items-center justify-between w-full text-left mb-1"
				onclick={() => showGeographicScope = !showGeographicScope}
			>
				<h3 class="text-base font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
					<Icon icon="tabler:world" class="w-5 h-5 text-gray-600 dark:text-gray-400" />
					Geographic Scope
				</h3>
				<span class="text-gray-400 text-lg transition-transform duration-200 {showGeographicScope ? 'rotate-90' : ''}">
					▶
				</span>
			</button>
			{#if showGeographicScope}
				<div class="animate-in fade-in slide-in-from-top-2 duration-200">
					<p class="mt-0.5 mb-3 text-sm text-gray-500 dark:text-gray-400">
						Filter content by geographic relevance and coverage area
					</p>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
						<button 
							onclick={() => smartContentFilter.togglePreference('filterLocalNews')}
							class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left w-full
								{smartContentFilter.preferences.filterLocalNews 
									? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
									: 'bg-white border border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}"
						>
							<Icon icon="tabler:map-pin" class="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium block">
									{s('settings.contentFilter.filterLocalNews') || 'Hyper-Local News'}
								</span>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									{s('settings.contentFilter.filterLocalNewsDesc') || 'Filter very localized news (city council, local crime, traffic)'}
								</p>
							</div>
							{#if smartContentFilter.preferences.filterLocalNews}
								<Icon icon="tabler:check" class="w-4 h-4 flex-shrink-0 mt-0.5" />
							{/if}
						</button>

						<button 
							onclick={() => smartContentFilter.togglePreference('filterInternationalNews')}
							class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left w-full
								{smartContentFilter.preferences.filterInternationalNews 
									? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
									: 'bg-white border border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}"
						>
							<Icon icon="tabler:world" class="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium block">
									{s('settings.contentFilter.filterInternationalNews') || 'International News'}
								</span>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									{s('settings.contentFilter.filterInternationalNewsDesc') || 'Filter international news to focus on domestic content'}
								</p>
							</div>
							{#if smartContentFilter.preferences.filterInternationalNews}
								<Icon icon="tabler:check" class="w-4 h-4 flex-shrink-0 mt-0.5" />
							{/if}
						</button>
				</div>
			</div>
			{/if}
		</div>

		<!-- Wellness & Mental Health -->
		<div>
			<button
				class="flex items-center justify-between w-full text-left mb-1"
				onclick={() => showWellnessMental = !showWellnessMental}
			>
				<h3 class="text-base font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
					<Icon icon="tabler:brain" class="w-5 h-5 text-gray-600 dark:text-gray-400" />
					Wellness & Mental Health
				</h3>
				<span class="text-gray-400 text-lg transition-transform duration-200 {showWellnessMental ? 'rotate-90' : ''}">
					▶
				</span>
			</button>
			{#if showWellnessMental}
				<div class="animate-in fade-in slide-in-from-top-2 duration-200">
					<p class="mt-0.5 mb-3 text-sm text-gray-500 dark:text-gray-400">
						Filter content that may impact mental health and wellbeing
					</p>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
						<button 
							onclick={() => smartContentFilter.togglePreference('filterNegativeNews')}
							class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left w-full
								{smartContentFilter.preferences.filterNegativeNews 
									? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
									: 'bg-white border border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}"
						>
							<Icon icon="tabler:mood-sad" class="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium block">
									{s('settings.contentFilter.filterNegative') || 'Negative News'}
								</span>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									{s('settings.contentFilter.filterNegativeDesc') || 'Filter depressing or distressing content'}
								</p>
							</div>
							{#if smartContentFilter.preferences.filterNegativeNews}
								<Icon icon="tabler:check" class="w-4 h-4 flex-shrink-0 mt-0.5" />
							{/if}
						</button>

						<button 
							onclick={() => smartContentFilter.togglePreference('filterViolence')}
							class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left w-full
								{smartContentFilter.preferences.filterViolence 
									? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
									: 'bg-white border border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}"
						>
							<Icon icon="mdi:handcuffs" class="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium block">
									{s('settings.contentFilter.filterViolence') || 'Violent Content'}
								</span>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									{s('settings.contentFilter.filterViolenceDesc') || 'Filter violence, crime, and disturbing content'}
								</p>
							</div>
							{#if smartContentFilter.preferences.filterViolence}
								<Icon icon="tabler:check" class="w-4 h-4 flex-shrink-0 mt-0.5" />
							{/if}
						</button>

						<button 
							onclick={() => smartContentFilter.togglePreference('filterAnxietyInducing')}
							class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left w-full
								{smartContentFilter.preferences.filterAnxietyInducing 
									? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
									: 'bg-white border border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}"
						>
							<Icon icon="tabler:tank" class="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium block">
									{s('settings.contentFilter.filterAnxietyInducing') || 'Anxiety-Inducing Content'}
								</span>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									{s('settings.contentFilter.filterAnxietyInducingDesc') || 'Filter disaster coverage and doomsday scenarios'}
								</p>
							</div>
							{#if smartContentFilter.preferences.filterAnxietyInducing}
								<Icon icon="tabler:check" class="w-4 h-4 flex-shrink-0 mt-0.5" />
							{/if}
						</button>

						<button 
							onclick={() => smartContentFilter.togglePreference('filterEconomicPessimism')}
							class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left w-full
								{smartContentFilter.preferences.filterEconomicPessimism 
									? 'bg-blue-50 border border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300' 
									: 'bg-white border border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}"
						>
							<Icon icon="tabler:trending-down" class="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium block">
									{s('settings.contentFilter.filterEconomicPessimism') || 'Economic Pessimism'}
								</span>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									{s('settings.contentFilter.filterEconomicPessimismDesc') || 'Filter recession fears and economic doom coverage'}
								</p>
							</div>
							{#if smartContentFilter.preferences.filterEconomicPessimism}
								<Icon icon="tabler:check" class="w-4 h-4 flex-shrink-0 mt-0.5" />
							{/if}
						</button>
					</div>
				</div>
			{/if}
		</div>

		<!-- Content Similarity -->
		<div>
			<div class="flex items-center justify-between mb-1">
				<h3 class="text-base font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
					<Icon icon="tabler:brain" class="w-5 h-5 text-gray-600 dark:text-gray-400" />
					Content Similarity Detection
				</h3>
				<button
					onclick={() => {
						if (smartContentFilter.preferences.filterContentSimilarity) {
							// If enabled, disable it and set threshold to 0
							smartContentFilter.updatePreference('filterContentSimilarity', false);
							smartContentFilter.setContentSimilarityThreshold(0);
						} else {
							// If disabled, enable it and set threshold to a reasonable default if it's 0
							smartContentFilter.updatePreference('filterContentSimilarity', true);
							if (smartContentFilter.preferences.contentSimilarityThreshold === 0) {
								smartContentFilter.setContentSimilarityThreshold(70);
							}
						}
					}}
					type="button"
					class="focus-visible-ring relative inline-flex h-6 w-11 items-center rounded-full transition"
					class:bg-blue-600={smartContentFilter.preferences.filterContentSimilarity}
					class:bg-gray-200={!smartContentFilter.preferences.filterContentSimilarity}
					class:dark:bg-gray-600={!smartContentFilter.preferences.filterContentSimilarity}
					role="switch"
					aria-checked={smartContentFilter.preferences.filterContentSimilarity}
				>
					<span class="sr-only">Toggle content similarity</span>
					<span
						class="inline-block h-4 w-4 transform rounded-full bg-white transition"
						class:translate-x-6={smartContentFilter.preferences.filterContentSimilarity}
						class:translate-x-1={!smartContentFilter.preferences.filterContentSimilarity}
					></span>
				</button>
			</div>
			<p class="mt-0.5 mb-3 text-sm text-gray-500 dark:text-gray-400">
				{s('settings.contentFilter.filterContentSimilarityDesc') || 'Filter stories covering the same topics or events based on content analysis'}
			</p>
			
			{#if smartContentFilter.preferences.filterContentSimilarity}
				<div class="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
					<!-- Similarity Threshold -->
					<div>
						<label for="similarity-threshold" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							{s('settings.contentFilter.contentSimilarity.threshold') || 'Similarity Threshold'}: {smartContentFilter.preferences.contentSimilarityThreshold}%
							{#if smartContentFilter.preferences.contentSimilarityThreshold === 0}
								<span class="text-xs text-orange-600 dark:text-orange-400 ml-2">(Disabled)</span>
							{/if}
						</label>
						<div class="flex items-center space-x-3">
							<input
								id="similarity-threshold"
								type="range"
								min="0"
								max="100"
								step="1"
								bind:value={smartContentFilter.preferences.contentSimilarityThreshold}
								oninput={(e) => {
									const value = Number((e.target as HTMLInputElement).value);
									smartContentFilter.setContentSimilarityThreshold(value);
									// Auto-disable/enable filterContentSimilarity based on threshold
									if (value === 0 && smartContentFilter.preferences.filterContentSimilarity) {
										// Don't auto-disable, just show as effectively disabled
									} else if (value > 0 && !smartContentFilter.preferences.filterContentSimilarity) {
										smartContentFilter.updatePreference('filterContentSimilarity', true);
									}
								}}
								class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
							>
						</div>
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
							{smartContentFilter.preferences.contentSimilarityThreshold === 0 
								? 'Set above 0% to enable similarity detection' 
								: 'Higher values = stricter similarity detection (fewer stories filtered)'}
						</p>
					</div>
					
					{#if smartContentFilter.preferences.contentSimilarityThreshold > 0}
						<!-- Mode Selection -->
						<div>
							<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
								{s('settings.contentFilter.contentSimilarity.mode') || 'Similarity Detection Mode'}
							</span>
							<div class="space-y-3 px-1">
								<label class="flex items-start gap-3 cursor-pointer select-none py-1 min-h-[24px]">
									<input 
										type="radio" 
										name="similarity-mode"
										value="today"
										checked={smartContentFilter.preferences.contentSimilarityMode === 'today'}
										onchange={() => smartContentFilter.setContentSimilarityMode('today')}
										class="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer rounded-full border border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:checked:bg-blue-600 dark:focus:ring-blue-500"
									>
									<div class="flex-1 min-w-0">
										<span class="block text-sm font-medium text-gray-700 dark:text-gray-300">
											{s('settings.contentFilter.contentSimilarity.mode.today') || 'Today Only'}
										</span>
										<span class="block text-sm text-gray-500 dark:text-gray-400">
											Compare stories only within today's batch
										</span>
									</div>
								</label>
								<label class="flex items-start gap-3 cursor-pointer select-none py-1 min-h-[24px]">
									<input 
										type="radio" 
										name="similarity-mode"
										value="historical"
										checked={smartContentFilter.preferences.contentSimilarityMode === 'historical'}
										onchange={() => smartContentFilter.setContentSimilarityMode('historical')}
										class="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer rounded-full border border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:checked:bg-blue-600 dark:focus:ring-blue-500"
									>
									<div class="flex-1 min-w-0">
										<span class="block text-sm font-medium text-gray-700 dark:text-gray-300">
											{s('settings.contentFilter.contentSimilarity.mode.historical') || 'Historical'}
										</span>
										<span class="block text-sm text-gray-500 dark:text-gray-400">
											Compare stories across multiple days with memory
										</span>
									</div>
								</label>
							</div>
						</div>

						<!-- Expiry Setting (only for historical mode) -->
						{#if smartContentFilter.preferences.contentSimilarityMode === 'historical'}
						<div>
							<label for="similarity-expiry" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
								{s('settings.contentFilter.contentSimilarity.expiry') || 'Story Memory Duration'}
							</label>
							<Select
								value={smartContentFilter.preferences.contentSimilarityExpiry.toString()}
								onChange={(value) => smartContentFilter.setContentSimilarityExpiry(Number(value))}
								options={[
									{ value: '1', label: s('settings.contentFilter.contentSimilarity.expiry.1day') || '1 Day' },
									{ value: '3', label: s('settings.contentFilter.contentSimilarity.expiry.3days') || '3 Days' },
									{ value: '7', label: s('settings.contentFilter.contentSimilarity.expiry.1week') || '1 Week' },
									{ value: '14', label: s('settings.contentFilter.contentSimilarity.expiry.2weeks') || '2 Weeks' }
								]}
							/>
						</div>
						{/if}

						<!-- Similarity Scope -->
						<div>
							<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
								{s('settings.contentFilter.contentSimilarity.scope') || 'Similarity Detection Scope'}
							</span>
							<div class="space-y-3 px-1">
								<label class="flex items-start gap-3 cursor-pointer select-none py-1 min-h-[24px]">
									<input 
										type="radio" 
										name="similarity-scope"
										value="within-category"
										checked={smartContentFilter.preferences.contentSimilarityScope === 'within-category'}
										onchange={() => smartContentFilter.setContentSimilarityScope('within-category')}
										class="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer rounded-full border border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:checked:bg-blue-600 dark:focus:ring-blue-500"
									>
									<div class="flex-1 min-w-0">
										<span class="block text-sm font-medium text-gray-700 dark:text-gray-300">
											{s('settings.contentFilter.contentSimilarity.scope.withinCategory') || 'Within Categories'}
										</span>
										<span class="block text-sm text-gray-500 dark:text-gray-400">
											{s('settings.contentFilter.contentSimilarity.scope.withinCategory.desc') || 'Compare only within the same category (World vs World, Politics vs Politics)'}
										</span>
									</div>
								</label>
								<label class="flex items-start gap-3 cursor-pointer select-none py-1 min-h-[24px]">
									<input 
										type="radio" 
										name="similarity-scope"
										value="across-categories"
										checked={smartContentFilter.preferences.contentSimilarityScope === 'across-categories'}
										onchange={() => smartContentFilter.setContentSimilarityScope('across-categories')}
										class="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer rounded-full border border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:checked:bg-blue-600 dark:focus:ring-blue-500"
									>
									<div class="flex-1 min-w-0">
										<span class="block text-sm font-medium text-gray-700 dark:text-gray-300">
											{s('settings.contentFilter.contentSimilarity.scope.acrossCategories') || 'Across All Categories'}
										</span>
										<span class="block text-sm text-gray-500 dark:text-gray-400">
											{s('settings.contentFilter.contentSimilarity.scope.acrossCategories.desc') || 'Compare stories across all enabled categories'}
										</span>
									</div>
								</label>
							</div>
						</div>

						<!-- Advanced Similarity Weightings -->
						<div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
							<h5 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
								Advanced: Similarity Algorithm Weights
							</h5>
							<p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
								Adjust how different aspects of content are weighted when detecting similarity. Higher numbers = more important. The algorithm automatically normalizes these weights, so you can use any scale you prefer.
							</p>
							
							<!-- Zero Weight Warning -->
							{#if smartContentFilter.preferences.similarityTitleWeight === 0 && smartContentFilter.preferences.similarityContentWeight === 0 && smartContentFilter.preferences.similarityEntityWeight === 0}
								<div class="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg dark:bg-orange-900/20 dark:border-orange-800">
									<div class="flex items-center gap-2">
										<Icon icon="tabler:alert-triangle" class="w-4 h-4 text-orange-600 dark:text-orange-400" />
										<span class="text-sm font-medium text-orange-800 dark:text-orange-200">All weights are set to 0%</span>
									</div>
									<p class="text-xs text-orange-700 dark:text-orange-300 mt-1">
										Content similarity detection is effectively disabled. Set at least one weight above 0% for similarity detection to work.
									</p>
								</div>
							{/if}

							<!-- Title Weight -->
							<div class="mb-4">
								<label for="title-weight" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
									Title Similarity Weight: {smartContentFilter.preferences.similarityTitleWeight}
									{#if smartContentFilter.preferences.similarityTitleWeight === 0}
										<span class="text-xs text-orange-600 dark:text-orange-400 ml-1">(Disabled)</span>
									{/if}
								</label>
								<input
									id="title-weight"
									type="range"
									min="0"
									max="100"
									step="5"
									bind:value={smartContentFilter.preferences.similarityTitleWeight}
									oninput={(e) => smartContentFilter.updatePreference('similarityTitleWeight', Number((e.target as HTMLInputElement).value))}
									class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
								>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									How important headline similarity is (higher = focus on title matching)
								</p>
							</div>

							<!-- Content Weight -->
							<div class="mb-4">
								<label for="content-weight" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
									Content Similarity Weight: {smartContentFilter.preferences.similarityContentWeight}
									{#if smartContentFilter.preferences.similarityContentWeight === 0}
										<span class="text-xs text-orange-600 dark:text-orange-400 ml-1">(Disabled)</span>
									{/if}
								</label>
								<input
									id="content-weight"
									type="range"
									min="0"
									max="100"
									step="5"
									bind:value={smartContentFilter.preferences.similarityContentWeight}
									oninput={(e) => smartContentFilter.updatePreference('similarityContentWeight', Number((e.target as HTMLInputElement).value))}
									class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
								>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									How important summary/description similarity is (higher = focus on content matching)
								</p>
							</div>

							<!-- Entity Weight -->
							<div class="mb-4">
								<label for="entity-weight" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
									Entity Similarity Weight: {smartContentFilter.preferences.similarityEntityWeight}
									{#if smartContentFilter.preferences.similarityEntityWeight === 0}
										<span class="text-xs text-orange-600 dark:text-orange-400 ml-1">(Disabled)</span>
									{/if}
								</label>
								<input
									id="entity-weight"
									type="range"
									min="0"
									max="100"
									step="5"
									bind:value={smartContentFilter.preferences.similarityEntityWeight}
									oninput={(e) => smartContentFilter.updatePreference('similarityEntityWeight', Number((e.target as HTMLInputElement).value))}
									class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
								>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
									How important people/places/organizations overlap is (higher = focus on entities, best for international news)
								</p>
							</div>

							<!-- Preset buttons for common scenarios -->
							<div class="flex flex-wrap gap-2 mt-3">
								<button
									onclick={() => {
										smartContentFilter.updatePreference('similarityTitleWeight', 80);
										smartContentFilter.updatePreference('similarityContentWeight', 40);
										smartContentFilter.updatePreference('similarityEntityWeight', 20);
									}}
									class="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded border text-gray-700 dark:text-gray-300"
								>
									📍 Local Focus (80:40:20)
								</button>
								<button
									onclick={() => {
										smartContentFilter.updatePreference('similarityTitleWeight', 20);
										smartContentFilter.updatePreference('similarityContentWeight', 30);
										smartContentFilter.updatePreference('similarityEntityWeight', 90);
									}}
									class="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded border text-gray-700 dark:text-gray-300"
								>
									🌍 Global/International (20:30:90)
								</button>
								<button
									onclick={() => {
										smartContentFilter.updatePreference('similarityTitleWeight', 40);
										smartContentFilter.updatePreference('similarityContentWeight', 25);
										smartContentFilter.updatePreference('similarityEntityWeight', 35);
									}}
									class="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded border text-gray-700 dark:text-gray-300"
								>
									⚖️ Balanced (40:25:35)
								</button>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Active Filters -->
		{#if hasActiveFilters}
			<div>
				<button
					class="flex items-center justify-between w-full text-left mb-2"
					onclick={() => showActiveFilters = !showActiveFilters}
				>
					<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
						{s('settings.contentFilter.activeFilters') || 'Active Filters'}
					</h4>
					<span class="text-gray-400 text-lg transition-transform duration-200 {showActiveFilters ? 'rotate-90' : ''}">
						▶
					</span>
				</button>
				{#if showActiveFilters}
					<div class="animate-in fade-in slide-in-from-top-2 duration-200">
						<div class="flex flex-wrap gap-2 mb-3">
							{#each activeFilterNames as filter}
								<span class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
									{filter.name}
									<button
										onclick={() => removeFilter(filter.key)}
										class="ml-1 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-100"
										aria-label="Remove {filter.name}"
									>
										<Icon icon="tabler:x" class="w-3 h-3" />
									</button>
								</span>
							{/each}
						</div>
						<button
							onclick={clearAllFilters}
							class="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
						>
							{s('settings.contentFilter.clearAll') || 'Clear all filters'}
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Advanced Settings -->
		<div>
			<button
				class="flex items-center justify-between w-full text-left mb-3"
				onclick={() => showAdvanced = !showAdvanced}
			>
				<h3 class="text-base font-medium text-gray-900 dark:text-gray-100">
					{s('settings.contentFilter.advanced') || 'Advanced Settings'}
				</h3>
				<span class="text-gray-400 text-lg transition-transform duration-200 {showAdvanced ? 'rotate-90' : ''}">
					▶
				</span>
			</button>
			
			{#if showAdvanced}
				<div class="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
					<p class="text-sm text-gray-500 dark:text-gray-400">
						{s('settings.contentFilter.advancedDescription') || 'Fine-tune the algorithmic scoring thresholds. Higher values = stricter filtering.'}
					</p>
					
					<div class="space-y-3">
						<div>
							<div class="flex items-center gap-2 mb-1">
								<label for="relevance-slider" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									{s('settings.contentFilter.minimumRelevance') || 'Minimum Relevance'}: {smartContentFilter.preferences.minimumRelevance.toFixed(1)}
								</label>
								<Tooltip text={s('settings.contentFilter.relevanceTooltip') || 'How relevant the content must be to your interests'}>
									<Icon icon="tabler:info-circle" class="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
								</Tooltip>
							</div>
							<input
								id="relevance-slider"
								type="range"
								min="0"
								max="1"
								step="0.1"
								value={smartContentFilter.preferences.minimumRelevance}
								oninput={(e) => smartContentFilter.updatePreference('minimumRelevance', parseFloat(e.currentTarget.value))}
								class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
							>
						</div>
						
						<div>
							<div class="flex items-center gap-2 mb-1">
								<label for="quality-slider" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									{s('settings.contentFilter.minimumQuality') || 'Minimum Quality'}: {smartContentFilter.preferences.minimumQuality.toFixed(1)}
								</label>
								<Tooltip text={s('settings.contentFilter.qualityTooltip') || 'How high-quality the journalism and writing must be'}>
									<Icon icon="tabler:info-circle" class="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
								</Tooltip>
							</div>
							<input
								id="quality-slider"
								type="range"
								min="0"
								max="1"
								step="0.1"
								value={smartContentFilter.preferences.minimumQuality}
								oninput={(e) => smartContentFilter.updatePreference('minimumQuality', parseFloat(e.currentTarget.value))}
								class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
							>
						</div>
						
						<div>
							<div class="flex items-center gap-2 mb-1">
								<label for="sentiment-slider" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									{s('settings.contentFilter.minimumSentiment') || 'Minimum Sentiment'}: {smartContentFilter.preferences.minimumSentiment.toFixed(1)}
								</label>
								<Tooltip text={s('settings.contentFilter.sentimentTooltip') || 'How positive or neutral the content sentiment must be'}>
									<Icon icon="tabler:info-circle" class="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
								</Tooltip>
							</div>
							<input
								id="sentiment-slider"
								type="range"
								min="0"
								max="1"
								step="0.1"
								value={smartContentFilter.preferences.minimumSentiment}
								oninput={(e) => smartContentFilter.updatePreference('minimumSentiment', parseFloat(e.currentTarget.value))}
								class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
							>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Statistics -->
		{#if smartContentFilter.stats}
			<div>
				<h3 class="text-base font-medium text-gray-900 dark:text-gray-100 mb-3">
					{s('settings.contentFilter.statistics') || 'Filter Statistics'}
				</h3>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
					<div class="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
						<div class="text-xl font-bold text-blue-600 dark:text-blue-400">
							{smartContentFilter.stats.totalProcessed}
						</div>
						<div class="text-xs text-gray-600 dark:text-gray-400">
							{s('settings.contentFilter.totalProcessed') || 'Stories Processed'}
						</div>
					</div>
					<div class="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
						<div class="text-xl font-bold text-red-600 dark:text-red-400">
							{smartContentFilter.stats.filtered}
						</div>
						<div class="text-xs text-gray-600 dark:text-gray-400">
							{s('settings.contentFilter.filtered') || 'Stories Filtered'}
						</div>
					</div>
					<div class="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
						<div class="text-xl font-bold text-green-600 dark:text-green-400">
							{(smartContentFilter.stats.filterRate * 100).toFixed(1)}%
						</div>
						<div class="text-xs text-gray-600 dark:text-gray-400">
							{s('settings.contentFilter.filterRate') || 'Filter Rate'}
						</div>
					</div>
				</div>

				{#if smartContentFilter.stats.topFilterReasons.length > 0}
					<div class="pt-3 border-t border-gray-200 dark:border-gray-700">
						<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							{s('settings.contentFilter.topReasons') || 'Top Filter Reasons'}
						</h4>
						<div class="space-y-1">
							{#each smartContentFilter.stats.topFilterReasons.slice(0, 5) as reason}
								<div class="flex justify-between items-center text-sm">
									<span class="text-gray-600 dark:text-gray-400">{reason.reason}</span>
									<span class="text-gray-900 dark:text-gray-100 font-medium">{reason.count}</span>
								</div>
							{/each}
				</div>
					</div>
				{/if}
			</div>
		{/if}

	<!-- Filter Mode -->
	<fieldset>
		<legend class="text-base font-medium text-gray-900 dark:text-gray-100">
			{s('settings.contentFilter.filterMode.label') || 'Filter Mode'}
		</legend>
		<p class="mt-0.5 mb-2 text-sm text-gray-500 dark:text-gray-400">
			{s('settings.contentFilter.filterMode.description') || 'Choose how filtered content is handled'}
		</p>
		<div class="space-y-3 px-1">
			<label class="flex items-start gap-3 cursor-pointer select-none py-1 min-h-[24px]">
				<input
					type="radio"
					name="filter-mode"
					value="hide"
					checked={smartContentFilter.filterMode === 'hide'}
					onchange={() => smartContentFilter.setFilterMode('hide')}
					class="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer rounded-full border border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:checked:bg-blue-600 dark:focus:ring-blue-500"
				/>
				<div class="flex-1 min-w-0">
					<span class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						{s('settings.contentFilter.filterMode.hide') || 'Hide completely'}
					</span>
					<span class="block text-sm text-gray-500 dark:text-gray-400">
						{s('settings.contentFilter.filterMode.hideDescription') || 'Filtered stories are removed from view'}
					</span>
				</div>
			</label>
			<label class="flex items-start gap-3 cursor-pointer select-none py-1 min-h-[24px]">
				<input
					type="radio"
					name="filter-mode"
					value="blur"
					checked={smartContentFilter.filterMode === 'blur'}
					onchange={() => smartContentFilter.setFilterMode('blur')}
					class="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer rounded-full border border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:checked:bg-blue-600 dark:focus:ring-blue-500"
				/>
				<div class="flex-1 min-w-0">
					<span class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						{s('settings.contentFilter.filterMode.blur') || 'Blur with warning'}
					</span>
					<span class="block text-sm text-gray-500 dark:text-gray-400">
						{s('settings.contentFilter.filterMode.blurDescription') || 'Stories are blurred and can be revealed on click'}
					</span>
				</div>
			</label>
		</div>
	</fieldset>

	<!-- Filter Sensitivity -->
	<fieldset>
		<legend class="text-base font-medium text-gray-900 dark:text-gray-100">
			{s('settings.contentFilter.filterSensitivity.label') || 'Filter Sensitivity'}
		</legend>
		<p class="mt-0.5 mb-2 text-sm text-gray-500 dark:text-gray-400">
			{s('settings.contentFilter.filterSensitivity.description') || 'Control how cautious the filtering should be'}
		</p>
		<div class="space-y-3 px-1">
			<label class="flex items-start gap-3 cursor-pointer select-none py-1 min-h-[24px]">
				<input
					type="radio"
					name="filter-sensitivity"
					value="strict"
					checked={smartContentFilter.preferences.filterSensitivity === 'strict'}
					onchange={() => smartContentFilter.setFilterSensitivity('strict')}
					class="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer rounded-full border border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:checked:bg-blue-600 dark:focus:ring-blue-500"
				/>
				<div class="flex-1 min-w-0">
					<span class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						{s('settings.contentFilter.filterSensitivity.strict') || 'Strict (Cautious)'}
					</span>
					<span class="block text-sm text-gray-500 dark:text-gray-400">
						{s('settings.contentFilter.filterSensitivity.strictDescription') || 'Requires multiple indicators or strong context - fewest false positives'}
					</span>
				</div>
			</label>
			<label class="flex items-start gap-3 cursor-pointer select-none py-1 min-h-[24px]">
				<input
					type="radio"
					name="filter-sensitivity"
					value="balanced"
					checked={smartContentFilter.preferences.filterSensitivity === 'balanced'}
					onchange={() => smartContentFilter.setFilterSensitivity('balanced')}
					class="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer rounded-full border border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:checked:bg-blue-600 dark:focus:ring-blue-500"
				/>
				<div class="flex-1 min-w-0">
					<span class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						{s('settings.contentFilter.filterSensitivity.balanced') || 'Balanced (Recommended)'}
					</span>
					<span class="block text-sm text-gray-500 dark:text-gray-400">
						{s('settings.contentFilter.filterSensitivity.balancedDescription') || 'Smart filtering with good balance between precision and coverage'}
					</span>
				</div>
			</label>
			<label class="flex items-start gap-3 cursor-pointer select-none py-1 min-h-[24px]">
				<input
					type="radio"
					name="filter-sensitivity"
					value="loose"
					checked={smartContentFilter.preferences.filterSensitivity === 'loose'}
					onchange={() => smartContentFilter.setFilterSensitivity('loose')}
					class="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer rounded-full border border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:checked:bg-blue-600 dark:focus:ring-blue-500"
				/>
				<div class="flex-1 min-w-0">
					<span class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						{s('settings.contentFilter.filterSensitivity.loose') || 'Loose (Aggressive)'}
					</span>
					<span class="block text-sm text-gray-500 dark:text-gray-400">
						{s('settings.contentFilter.filterSensitivity.looseDescription') || 'Single strong indicator is enough - maximum filtering coverage'}
					</span>
				</div>
			</label>
		</div>
	</fieldset>



		<!-- Advanced Category Overrides -->
	{#if shouldShowAdvancedCategories || availableCategories.length > 0}
		<div>
			<button
				class="flex items-center justify-between w-full text-left mb-1"
				onclick={() => showAdvancedSensitivity = !showAdvancedSensitivity}
			>
				<h3 class="text-base font-medium text-gray-900 dark:text-gray-100">
					{s('settings.contentFilter.categoryOverrides.label') || 'Advanced Category Sensitivity'}
					{#if shouldShowAdvancedCategories && configurableCategories.length > 0}
						<span class="text-sm text-gray-500 dark:text-gray-400 font-normal ml-2">
							({configurableCategoriesText})
						</span>
					{/if}
				</h3>
				<span class="text-gray-400 text-lg transition-transform duration-200 {showAdvancedSensitivity ? 'rotate-90' : ''}">
					▶
				</span>
			</button>
		{#if showAdvancedSensitivity}
			<div class="animate-in fade-in slide-in-from-top-2 duration-200">
				{#if shouldShowAdvancedCategories}
					<p class="mt-0.5 mb-3 text-sm text-gray-500 dark:text-gray-400">
						{s('settings.contentFilter.categoryOverrides.description') || 'Override the global sensitivity for specific categories. Leave on "Default" to use the global setting.'}
					</p>
					
					<div class="space-y-4">
					<!-- Politics Override -->
					{#if smartContentFilter.preferences.filterPolitics}
						<div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
							<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
								<Icon icon="game-icons:capitol" class="w-4 h-4" />
								Politics Sensitivity
							</h4>
														<div class="grid grid-cols-5 gap-1 text-xs mb-2">
								{#each [
									{ value: undefined, label: 'Default' },
									{ value: 'strict' as const, label: 'Strict' },
									{ value: 'balanced' as const, label: 'Balanced' },
									{ value: 'loose' as const, label: 'Loose' }
								] as option}
									<button
										onclick={() => setCategoryOverride('politics', option.value)}
										class="px-2 py-1 rounded text-center transition-colors
											{(smartContentFilter.preferences.categoryOverrides?.politics || undefined) === option.value && !isCustomSensitivity('politics')
												? 'bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700'
												: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}"
									>
										{option.label}
									</button>
								{/each}
								<button
									onclick={() => setCategoryOverride('politics', getCustomSensitivity('politics'))}
									class="px-2 py-1 rounded text-center transition-colors
										{isCustomSensitivity('politics')
											? 'bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700'
											: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}"
								>
									{s('settings.contentFilter.categoryOverrides.custom') || 'Custom'}
								</button>
							</div>
							
							<!-- Direct Parameter Controls -->
							{#if isCustomSensitivity('politics')}
								<div class="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
									<h5 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Politics Filtering Parameters</h5>
									
									<div class="grid grid-cols-2 gap-4">
										<!-- Min Indicators -->
										<div>
											<label for="politics-min-indicators" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
												Min Indicators Required
											</label>
											<input
												id="politics-min-indicators"
												type="range"
												min="1"
												max="5"
												step="1"
												value={Math.ceil(1 + ((getCustomSensitivity('politics') / 100) * 4))}
												oninput={(e) => {
													const indicators = Number((e.target as HTMLInputElement).value);
													const sensitivity = ((indicators - 1) / 4) * 100;
													setCategoryOverride('politics', Math.round(sensitivity));
												}}
												class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
											>
											<div class="flex justify-between text-xs text-gray-500 mt-1">
												<span>1</span>
												<span>3</span>
												<span>5</span>
											</div>
											<div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
												Current: {Math.ceil(1 + ((getCustomSensitivity('politics') / 100) * 4))} indicators
											</div>
										</div>
										
										<!-- Title Weight -->
										<div>
											<label for="politics-title-weight" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
												Title Match Importance
											</label>
											<input
												id="politics-title-weight"
												type="range"
												min="30"
												max="70"
												step="5"
												value={30 + ((getCustomSensitivity('politics') / 100) * 40)}
												oninput={(e) => {
													const titleWeight = Number((e.target as HTMLInputElement).value);
													const sensitivity = ((titleWeight - 30) / 40) * 100;
													setCategoryOverride('politics', Math.round(sensitivity));
												}}
												class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
											>
											<div class="flex justify-between text-xs text-gray-500 mt-1">
												<span>30%</span>
												<span>50%</span>
												<span>70%</span>
											</div>
											<div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
												Current: {Math.round(30 + ((getCustomSensitivity('politics') / 100) * 40))}% weight
											</div>
										</div>
										
										<!-- Context Weight -->
										<div>
											<label for="politics-context-weight" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
												Context Evidence Weight
											</label>
											<input
												id="politics-context-weight"
												type="range"
												min="20"
												max="70"
												step="5"
												value={20 + ((getCustomSensitivity('politics') / 100) * 50)}
												oninput={(e) => {
													const contextWeight = Number((e.target as HTMLInputElement).value);
													const sensitivity = ((contextWeight - 20) / 50) * 100;
													setCategoryOverride('politics', Math.round(sensitivity));
												}}
												class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
											>
											<div class="flex justify-between text-xs text-gray-500 mt-1">
												<span>20%</span>
												<span>45%</span>
												<span>70%</span>
											</div>
											<div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
												Current: {Math.round(20 + ((getCustomSensitivity('politics') / 100) * 50))}% weight
											</div>
										</div>
										
										<!-- Allow Title-Only -->
										<div>
											<div class="flex items-center space-x-2">
												<input
													id="politics-title-only"
													type="checkbox"
													checked={getCustomSensitivity('politics') < 40}
													onchange={(e) => {
														const allowTitleOnly = (e.target as HTMLInputElement).checked;
														setCategoryOverride('politics', allowTitleOnly ? 35 : 50);
													}}
													class="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
												>
												<label for="politics-title-only" class="text-xs font-medium text-gray-600 dark:text-gray-400">
													Title-Only Filtering
												</label>
											</div>
											<p class="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
												Allow filtering based on title keywords alone
											</p>
										</div>
									</div>
									
									<div class="mt-3 p-2 bg-blue-50 dark:bg-blue-900/30 rounded text-xs text-blue-800 dark:text-blue-200">
										<strong>Combined Effect:</strong> {getSensitivityExplanation(getCustomSensitivity('politics'))}
									</div>
								</div>
							{/if}
						</div>
					{/if}

					<!-- Celebrity Override -->
					{#if smartContentFilter.preferences.filterCelebrity}
						<div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
							<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
								<Icon icon="tabler:star" class="w-4 h-4" />
								Celebrity Sensitivity
							</h4>
														<div class="grid grid-cols-5 gap-1 text-xs mb-2">
								{#each [
									{ value: undefined, label: 'Default' },
									{ value: 'strict' as const, label: 'Strict' },
									{ value: 'balanced' as const, label: 'Balanced' },
									{ value: 'loose' as const, label: 'Loose' }
								] as option}
									<button
										onclick={() => setCategoryOverride('celebrity', option.value)}
										class="px-2 py-1 rounded text-center transition-colors
											{(smartContentFilter.preferences.categoryOverrides?.celebrity || undefined) === option.value && !isCustomSensitivity('celebrity')
												? 'bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700'
												: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}"
									>
										{option.label}
									</button>
								{/each}
								<button
									onclick={() => setCategoryOverride('celebrity', getCustomSensitivity('celebrity'))}
									class="px-2 py-1 rounded text-center transition-colors
										{isCustomSensitivity('celebrity')
											? 'bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700'
											: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}"
								>
									{s('settings.contentFilter.categoryOverrides.custom') || 'Custom'}
								</button>
							</div>
							
							<!-- Direct Parameter Controls -->
							{#if isCustomSensitivity('celebrity')}
								<div class="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
									<h5 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Celebrity Filtering Parameters</h5>
									
									<div class="grid grid-cols-2 gap-4">
										<!-- Min Indicators -->
										<div>
											<label for="celebrity-min-indicators" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
												Min Indicators Required
											</label>
											<input
												id="celebrity-min-indicators"
												type="range"
												min="1"
												max="5"
												step="1"
												value={Math.ceil(1 + ((getCustomSensitivity('celebrity') / 100) * 4))}
												oninput={(e) => {
													const indicators = Number((e.target as HTMLInputElement).value);
													const sensitivity = ((indicators - 1) / 4) * 100;
													setCategoryOverride('celebrity', Math.round(sensitivity));
												}}
												class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
											>
											<div class="flex justify-between text-xs text-gray-500 mt-1">
												<span>1</span>
												<span>3</span>
												<span>5</span>
											</div>
											<div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
												Current: {Math.ceil(1 + ((getCustomSensitivity('celebrity') / 100) * 4))} indicators
											</div>
										</div>
										
										<!-- Title Weight -->
										<div>
											<label for="celebrity-title-weight" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
												Title Match Importance
											</label>
											<input
												id="celebrity-title-weight"
												type="range"
												min="30"
												max="70"
												step="5"
												value={30 + ((getCustomSensitivity('celebrity') / 100) * 40)}
												oninput={(e) => {
													const titleWeight = Number((e.target as HTMLInputElement).value);
													const sensitivity = ((titleWeight - 30) / 40) * 100;
													setCategoryOverride('celebrity', Math.round(sensitivity));
												}}
												class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
											>
											<div class="flex justify-between text-xs text-gray-500 mt-1">
												<span>30%</span>
												<span>50%</span>
												<span>70%</span>
											</div>
											<div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
												Current: {Math.round(30 + ((getCustomSensitivity('celebrity') / 100) * 40))}% weight
											</div>
										</div>
										
										<!-- Context Weight -->
										<div>
											<label for="celebrity-context-weight" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
												Context Evidence Weight
											</label>
											<input
												id="celebrity-context-weight"
												type="range"
												min="20"
												max="70"
												step="5"
												value={20 + ((getCustomSensitivity('celebrity') / 100) * 50)}
												oninput={(e) => {
													const contextWeight = Number((e.target as HTMLInputElement).value);
													const sensitivity = ((contextWeight - 20) / 50) * 100;
													setCategoryOverride('celebrity', Math.round(sensitivity));
												}}
												class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
											>
											<div class="flex justify-between text-xs text-gray-500 mt-1">
												<span>20%</span>
												<span>45%</span>
												<span>70%</span>
											</div>
											<div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
												Current: {Math.round(20 + ((getCustomSensitivity('celebrity') / 100) * 50))}% weight
											</div>
										</div>
										
										<!-- Allow Title-Only -->
										<div>
											<div class="flex items-center space-x-2">
												<input
													id="celebrity-title-only"
													type="checkbox"
													checked={getCustomSensitivity('celebrity') < 40}
													onchange={(e) => {
														const allowTitleOnly = (e.target as HTMLInputElement).checked;
														setCategoryOverride('celebrity', allowTitleOnly ? 35 : 50);
													}}
													class="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
												>
												<label for="celebrity-title-only" class="text-xs font-medium text-gray-600 dark:text-gray-400">
													Title-Only Filtering
												</label>
											</div>
											<p class="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
												Allow filtering based on title keywords alone
											</p>
										</div>
									</div>
									
									<div class="mt-3 p-2 bg-blue-50 dark:bg-blue-900/30 rounded text-xs text-blue-800 dark:text-blue-200">
										<strong>Combined Effect:</strong> {getSensitivityExplanation(getCustomSensitivity('celebrity'))}
									</div>
								</div>
							{/if}
						</div>
					{/if}

					<!-- Sports Override -->
					{#if smartContentFilter.preferences.filterSports}
						<div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
							<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
								<Icon icon="tabler:ball-american-football" class="w-4 h-4" />
								Sports Sensitivity
							</h4>
							<div class="grid grid-cols-4 gap-2 text-xs">
								{#each [
									{ value: undefined, label: 'Default' },
									{ value: 'strict' as const, label: 'Strict' },
									{ value: 'balanced' as const, label: 'Balanced' },
									{ value: 'loose' as const, label: 'Loose' }
								] as option}
									<button
										onclick={() => setCategoryOverride('sports', option.value)}
										class="px-2 py-1 rounded text-center transition-colors
											{(smartContentFilter.preferences.categoryOverrides?.sports || undefined) === option.value
												? 'bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700'
												: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}"
									>
										{option.label}
									</button>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Technology Override -->
					{#if smartContentFilter.preferences.filterTechnology}
						<div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
							<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
								<Icon icon="tabler:device-laptop" class="w-4 h-4" />
								Technology Sensitivity
							</h4>
							<div class="grid grid-cols-4 gap-2 text-xs">
								{#each [
									{ value: undefined, label: 'Default' },
									{ value: 'strict' as const, label: 'Strict' },
									{ value: 'balanced' as const, label: 'Balanced' },
									{ value: 'loose' as const, label: 'Loose' }
								] as option}
									<button
										onclick={() => setCategoryOverride('technology', option.value)}
										class="px-2 py-1 rounded text-center transition-colors
											{(smartContentFilter.preferences.categoryOverrides?.technology || undefined) === option.value
												? 'bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700'
												: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}"
									>
										{option.label}
									</button>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Social Media Override -->
					{#if smartContentFilter.preferences.filterSocialMediaDrama}
						<div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
							<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
								<Icon icon="tabler:brand-x" class="w-4 h-4" />
								Social Media Sensitivity
							</h4>
							<div class="grid grid-cols-4 gap-2 text-xs">
								{#each [
									{ value: undefined, label: 'Default' },
									{ value: 'strict' as const, label: 'Strict' },
									{ value: 'balanced' as const, label: 'Balanced' },
									{ value: 'loose' as const, label: 'Loose' }
								] as option}
									<button
										onclick={() => setCategoryOverride('socialMediaDrama', option.value)}
										class="px-2 py-1 rounded text-center transition-colors
											{(smartContentFilter.preferences.categoryOverrides?.socialMediaDrama || undefined) === option.value
												? 'bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700'
												: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}"
									>
										{option.label}
									</button>
								{/each}
							</div>
						</div>
					{/if}
					</div>
				{:else}
					<div class="mt-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
						<p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
							No category filters are currently enabled. Enable filters in the sections above to configure their sensitivity here.
						</p>
						{#if availableCategories.length > 0}
							<p class="text-xs text-gray-500 dark:text-gray-500">
								Available categories: {availableCategoriesText}
							</p>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
		</div>
	{/if}

	<!-- Filter Scope -->
	<div class="space-y-2">
		<Select
			value={smartContentFilter.filterScope}
			options={[
				{ value: 'title', label: s('settings.contentFilter.scope.title') || 'Title only' },
				{ value: 'summary', label: s('settings.contentFilter.scope.summary') || 'Title and summary' },
				{ value: 'all', label: s('settings.contentFilter.scope.all') || 'All content' }
			]}
			label={s('settings.contentFilter.scope.label') || 'Filter Scope'}
			onChange={(value: string) => smartContentFilter.setFilterScope(value as 'title' | 'summary' | 'all')}
		/>
		<p class="text-sm text-gray-500 dark:text-gray-400">
			{s('settings.contentFilter.scope.description') || 'Choose which parts of stories to check for keywords and content analysis'}
		</p>
	</div>

	<!-- Show Filtered Count -->
	<div class="flex items-center justify-between">
		<div>
			<label for="show-count" class="text-base font-medium text-gray-900 dark:text-gray-100">
				{s('settings.contentFilter.showCount.label') || 'Show Filtered Count'}
			</label>
			<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
				{s('settings.contentFilter.showCount.description') || 'Display number of filtered stories in each category'}
			</p>
		</div>
					<button
			id="show-count"
			onclick={() => smartContentFilter.setShowFilteredCount(!smartContentFilter.showFilteredCount)}
			type="button"
			class="focus-visible-ring relative inline-flex h-6 w-11 items-center rounded-full transition"
			class:bg-blue-600={smartContentFilter.showFilteredCount}
			class:bg-gray-200={!smartContentFilter.showFilteredCount}
			class:dark:bg-gray-600={!smartContentFilter.showFilteredCount}
			role="switch"
			aria-checked={smartContentFilter.showFilteredCount}
		>
			<span class="sr-only">Show filtered count</span>
			<span
				class="inline-block h-4 w-4 transform rounded-full bg-white transition"
				class:translate-x-6={smartContentFilter.showFilteredCount}
				class:translate-x-1={!smartContentFilter.showFilteredCount}
			></span>
					</button>
	</div>

	<!-- Export/Import Section -->
	<div class="pt-4 border-t border-gray-200 dark:border-gray-700">
		<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
			{s('settings.contentFilter.backupRestore') || 'Backup & Restore'}
		</h4>
		<p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
			{s('settings.contentFilter.backupDescription') || 'Export your content filter settings to a file or import from a previous backup'}
		</p>
		<div class="flex gap-3 relative">
					<button
				onclick={exportConfig}
				class="flex items-center gap-2 px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md text-gray-700 dark:text-gray-300"
			>
				<Icon icon="tabler:download" class="w-4 h-4" />
				{s('settings.contentFilter.export') || 'Export Settings'}
			</button>
			<button
				bind:this={importButtonElement}
				onclick={() => fileInputElement?.click()}
				class="flex items-center gap-2 px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md text-gray-700 dark:text-gray-300"
			>
				<Icon icon="tabler:upload" class="w-4 h-4" />
				{s('settings.contentFilter.import') || 'Import Settings'}
			</button>
			<input
				bind:this={fileInputElement}
				type="file"
				accept=".json"
				onchange={handleFileSelect}
				class="hidden"
			/>
			
			<!-- Import Confirmation Popup -->
			{#if showImportConfirm}
				<div 
					id="import-confirm-popup"
					class="absolute bottom-full mb-2 left-0 z-50 animate-in fade-in slide-in-from-bottom-1"
				>
					<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 w-80">
						<h5 class="font-medium text-gray-900 dark:text-gray-100 mb-2">
							{s('settings.contentFilter.importConfirm.title') || 'Import Settings?'}
						</h5>
						<p class="text-sm text-gray-700 dark:text-gray-300 mb-2">
							{s('settings.contentFilter.importConfirm.warning') || 'This will replace all current content filter settings.'}
						</p>
						{#if importWarning}
							<div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2 mb-3">
								<p class="text-xs text-yellow-800 dark:text-yellow-300">
									⚠️ {importWarning}
								</p>
							</div>
						{/if}
						<p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
							{s('settings.contentFilter.importConfirm.backup') || 'Tip: Export your current settings first to create a backup.'}
						</p>
						<div class="flex gap-2 justify-end">
							<button
								onclick={() => { showImportConfirm = false; if (fileInputElement) fileInputElement.value = ''; }}
								class="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md text-gray-700 dark:text-gray-300"
					>
						{s('common.cancel') || 'Cancel'}
					</button>
							<button
								onclick={confirmImport}
								class="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md"
							>
								{s('settings.contentFilter.importConfirm.action') || 'Import'}
							</button>
				</div>
			</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Reset Button -->
	<div class="pt-4 border-t border-gray-200 dark:border-gray-700 relative">
			<button
			bind:this={resetButtonElement}
			onclick={() => showResetConfirm = !showResetConfirm}
			class="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
			>
			{s('settings.contentFilter.reset') || 'Reset to Defaults'}
			</button>
		
		<!-- Floating Confirmation -->
		{#if showResetConfirm}
			<div 
				id="reset-confirm-popup"
				class="absolute bottom-full mb-2 left-0 z-50 animate-in fade-in slide-in-from-bottom-1"
			>
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 w-72">
					<p class="text-sm text-gray-700 dark:text-gray-300 mb-3">
						{s('settings.contentFilter.resetConfirm') || 'This will clear all filters and reset settings to defaults.'}
					</p>
					<div class="flex gap-2 justify-end">
						<button
							onclick={() => showResetConfirm = false}
							class="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md text-gray-700 dark:text-gray-300"
						>
							{s('common.cancel') || 'Cancel'}
						</button>
						<button
							onclick={resetToDefaults}
							class="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md"
						>
							{s('common.reset') || 'Reset'}
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div> 