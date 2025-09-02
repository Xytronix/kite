<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import { theme, type ThemeOption } from '$lib/stores/theme.svelte.js';
import { language, type SupportedLanguage } from '$lib/stores/language.svelte.js';
import { settings, type FontSize } from '$lib/stores/settings.svelte.js';
import { categories } from '$lib/stores/categories.svelte.js';
import { smartContentFilter } from '$lib/stores/smartContentFilter.svelte';
import { SUPPORTED_LANGUAGES } from '$lib/constants/languages.js';
import { dataReloadService } from '$lib/services/dataService.js';
import { locationService, type LocationInfo } from '$lib/services/locationService';
import Select from '$lib/components/Select.svelte';
import Tooltip from '$lib/components/Tooltip.svelte';
import Icon from '@iconify/svelte';

// Props
interface Props {
	onShowAbout?: () => void;
}

let { onShowAbout }: Props = $props();

// Theme options for display
const themeOptions = $derived([
	{ value: 'system', label: s('settings.theme.system') || 'System' },
	{ value: 'light', label: s('settings.theme.light') || 'Light' },
	{ value: 'dark', label: s('settings.theme.dark') || 'Dark' }
]);

// UI Language options - exclude "default" since UI needs a specific language
const uiLanguageOptions = $derived(
	SUPPORTED_LANGUAGES.filter(lang => lang.code !== 'default').map((lang) => ({
		value: lang.code,
		label: lang.name
	}))
);

// Data Language options - include "default" for untranslated content
const dataLanguageOptions = $derived(
	SUPPORTED_LANGUAGES.map((lang) => ({
		value: lang.code,
		label: lang.code === 'default' ? (s('settings.language.default') || 'Default') : lang.name
	}))
);

// Font size options for display
const fontSizeOptions = $derived([
	{ value: 'xs', label: s('settings.fontSize.xs') || 'Extra Small' },
	{ value: 'small', label: s('settings.fontSize.small') || 'Small' },
	{ value: 'normal', label: s('settings.fontSize.normal') || 'Normal' },
	{ value: 'large', label: s('settings.fontSize.large') || 'Large' },
	{ value: 'xl', label: s('settings.fontSize.xl') || 'Extra Large' }
]);

// Local state for UI
let currentTheme = $state<string>(theme.current);
let currentLanguage = $state<string>(language.ui);
let currentDataLanguage = $state<string>(language.data);
let currentFontSize = $state<string>(settings.fontSize);
let currentCategoryHeaderPosition = $state<string>(settings.categoryHeaderPosition);
let isLanguageLoading = $state(false);
let isDataLanguageLoading = $state(false);
let locationInfo = $state<LocationInfo | null>(null);
let isResetConfirming = $state(false);
let resetTimeout: NodeJS.Timeout | null = null;

// Sync local state with stores
$effect(() => {
	currentTheme = theme.current;
});

$effect(() => {
	currentLanguage = language.ui;
});

$effect(() => {
	currentDataLanguage = language.data;
});

$effect(() => {
	currentFontSize = settings.fontSize;
});

$effect(() => {
	currentCategoryHeaderPosition = settings.categoryHeaderPosition;
});

// Load location info on component mount
$effect(() => {
	loadLocationInfo();
});

// Load location information for language suggestions
async function loadLocationInfo() {
	try {
		locationInfo = await locationService.detectLocation();
	} catch (error) {
		console.error('Failed to detect location for language suggestions:', error);
		locationInfo = null;
	}
}

// Cleanup timeout on component destroy
$effect(() => {
	return () => {
		if (resetTimeout) {
			clearTimeout(resetTimeout);
		}
	};
});

// Theme change handler
function handleThemeChange(newTheme: string) {
	theme.set(newTheme as ThemeOption);
	currentTheme = newTheme;
}

// UI Language change handler
async function handleLanguageChange(newLanguage: string) {
	currentLanguage = newLanguage;
	isLanguageLoading = true;
	
	try {
		// Set UI language first
		language.setUI(newLanguage as SupportedLanguage);
		
		// Wait a brief moment to ensure state is updated
		await new Promise(resolve => setTimeout(resolve, 50));
		
		// Explicitly load new locale strings for UI language
		const targetLang = newLanguage === 'default' ? navigator.language.split('-')[0] : newLanguage;
		console.log('Loading locale strings for language change:', targetLang);
		await language.loadNewStrings(targetLang);
		console.log('Locale strings loaded successfully for:', targetLang);
	} catch (error) {
		console.error('Failed to load locale strings during language change:', error);
	} finally {
		isLanguageLoading = false;
	}
}

// Data Language change handler
async function handleDataLanguageChange(newLanguage: string) {
	// Persist the preferred data language
	language.setData(newLanguage as SupportedLanguage);
	currentDataLanguage = newLanguage;
	isDataLanguageLoading = true;
	
	try {
		// Reflect the preference in the URL so links/bookmarks remain consistent
		if (typeof window !== 'undefined') {
			try {
				const url = new URL(window.location.href);
				url.searchParams.set('data_lang', newLanguage);
				window.history.replaceState({}, '', url.toString());
			} catch (e) {
				console.warn('Failed to update data_lang in URL:', e);
			}
		}
		// Reload all data for the new data language
		await dataReloadService.reloadData();
	} finally {
		isDataLanguageLoading = false;
	}
}

// Font size change handler
function handleFontSizeChange(newSize: string) {
	settings.setFontSize(newSize as FontSize);
	currentFontSize = newSize;
}

// Story count change handler
function handleStoryCountChange(count: number) {
	settings.setStoryCount(count);
}

// Category header position change handler
function handleCategoryHeaderPositionChange(position: string) {
	settings.setCategoryHeaderPosition(position as any);
	currentCategoryHeaderPosition = position;
}

// Show about screen
function showAbout() {
	if (onShowAbout) onShowAbout();
}

// Handle reset button click (first click shows confirmation)
function handleResetClick() {
	if (isResetConfirming) {
		// Second click - actually reset
		resetAllSettings();
	} else {
		// First click - show confirmation
		isResetConfirming = true;
		// Reset confirmation state after 3 seconds
		if (resetTimeout) clearTimeout(resetTimeout);
		resetTimeout = setTimeout(() => {
			isResetConfirming = false;
		}, 3000);
	}
}

// Reset all settings to defaults
async function resetAllSettings() {
	// Clear confirmation state
	isResetConfirming = false;
	if (resetTimeout) {
		clearTimeout(resetTimeout);
		resetTimeout = null;
	}

	// Get location-based defaults
	let locationDefaults;
	try {
		locationDefaults = await locationService.detectLocation();
	} catch (error) {
		console.warn('Failed to get location for reset, using fallback defaults:', error);
		locationDefaults = null;
	}

	// Determine reset values based on location or fallback to defaults
	const resetUILanguage = locationDefaults?.suggestedUILanguage || 'en';
	const resetDataLanguage = locationDefaults?.suggestedDataLanguage || 'en';

	// Reset stores with location-aware values
	theme.reset(); // Always reset to 'system'
	settings.reset(); // Always reset to defaults
	smartContentFilter.reset(); // Reset content filtering settings

	// Set languages based on location
	language.setUI(resetUILanguage as any);
	language.setData(resetDataLanguage as any);

	// Reset categories to location-based defaults
	categories.initWithLocationDefaults(locationDefaults?.suggestedCategories);

	// Update local state to reflect the reset values
	currentTheme = 'system';
	currentLanguage = resetUILanguage;
	currentDataLanguage = resetDataLanguage;
	currentFontSize = 'normal';
	currentCategoryHeaderPosition = 'bottom';

	// Explicitly load new locale strings for UI language
	isLanguageLoading = true;
	try {
		// Wait a brief moment to ensure language state is updated
		await new Promise(resolve => setTimeout(resolve, 50));
		
		const targetLang = resetUILanguage === 'default' ? navigator.language.split('-')[0] : resetUILanguage;
		console.log('Loading locale strings for reset:', targetLang);
		await language.loadNewStrings(targetLang);
		console.log('Locale strings loaded successfully for reset:', targetLang);
	} catch (error) {
		console.error('Failed to load locale strings during reset:', error);
	} finally {
		isLanguageLoading = false;
	}

	// Trigger data reload for language change
	isDataLanguageLoading = true;
	try {
		await dataReloadService.reloadData();
	} finally {
		isDataLanguageLoading = false;
	}
}
</script>

<div class="space-y-6">
	<!-- Location-based settings info -->
	{#if locationInfo && language.isFirstVisit() && (locationInfo.suggestedUILanguage !== 'en' || locationInfo.suggestedDataLanguage !== 'en')}
		<div class="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-sm">
			<div class="flex items-center gap-2 text-blue-700 dark:text-blue-300">
				<Icon icon="tabler:map-pin" class="w-4 h-4" />
				<span class="font-medium">Location-optimized settings</span>
			</div>
			<p class="mt-1 text-blue-600 dark:text-blue-400">
				{s('settings.location.detected') || 'Settings have been automatically optimized based on your location. You can change them anytime.'}
			</p>
		</div>
	{/if}

	<!-- Theme Setting -->
	<div class="flex flex-col space-y-2">
		<div class="flex items-center gap-2 mb-1">
			<Icon icon="tabler:palette" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.theme.label') || 'Theme'}
			</span>
		</div>
		<Select
			value={currentTheme}
			options={themeOptions}
			hideLabel={true}
			label={s('settings.theme.label') || 'Theme'}
			onChange={handleThemeChange}
		/>
	</div>

	<!-- UI Language Setting -->
	<div class="flex flex-col space-y-2">
		<div class="flex items-center space-x-1 mb-1">
			<Icon icon="tabler:language" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
			<label for="ui-language-select" class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.uiLanguage.label') || 'Interface Language'}
			</label>
			<Tooltip text={s('settings.uiLanguage.tooltip') || 'Controls the language of buttons, menus, and interface text.'} position="bottom">
				<button type="button" class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
					<Icon icon="tabler:info-circle" width="14" height="14" />
				</button>
			</Tooltip>
			{#if locationInfo && language.isFirstVisit() && locationInfo.suggestedUILanguage && locationInfo.suggestedUILanguage !== 'en'}
				<div class="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
					<Icon icon="tabler:map-pin" class="w-3 h-3" />
					<span>Auto-detected</span>
				</div>
			{/if}
		</div>
		<div class="relative">
			<Select
				id="ui-language-select"
				value={currentLanguage}
				options={uiLanguageOptions}
				hideLabel={true}
				label={s('settings.uiLanguage.label') || 'Interface Language'}
				onChange={handleLanguageChange}
			/>
			{#if isLanguageLoading}
				<div class="absolute right-3 top-2.5">
					<div class="animate-spin h-4 w-4 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 dark:border-t-blue-400 rounded-full"></div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Data Language Setting -->
	<div class="flex flex-col space-y-2">
		<div class="flex items-center space-x-1 mb-1">
			<Icon icon="tabler:world" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
			<label for="data-language-select" class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.dataLanguage.label') || 'Content Language'}
			</label>
			<Tooltip text={s('settings.dataLanguage.tooltip') || 'News stories are generated in their original source language, then translated. \'Default\' shows stories in their original languages without translation.'} position="bottom">
				<button type="button" class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
					<Icon icon="tabler:info-circle" width="14" height="14" />
				</button>
			</Tooltip>
			{#if locationInfo && language.isFirstVisit() && locationInfo.suggestedDataLanguage && locationInfo.suggestedDataLanguage !== 'en'}
				<div class="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
					<Icon icon="tabler:map-pin" class="w-3 h-3" />
					<span>Auto-detected</span>
				</div>
			{/if}
		</div>
		<div class="relative">
			<Select
				id="data-language-select"
				value={currentDataLanguage}
				options={dataLanguageOptions}
				hideLabel={true}
				label={s('settings.dataLanguage.label') || 'Content Language'}
				onChange={handleDataLanguageChange}
			/>
			{#if isDataLanguageLoading}
				<div class="absolute right-3 top-2.5">
					<div class="animate-spin h-4 w-4 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 dark:border-t-blue-400 rounded-full"></div>
				</div>
			{/if}
		</div>
		<div class="mt-1 flex items-center justify-end text-xs text-gray-500 dark:text-gray-400">
			<a
				href="https://kagi.com/translate"
				target="_blank"
				class="flex items-center hover:text-gray-700 dark:hover:text-gray-300"
			>
				<span>{s('settings.language.poweredBy') || 'Translated with Kagi Translate'}</span>
				<img src="/svg/translate.svg" alt="Kagi Translate" class="ml-1 h-3 w-3" />
				</a>
		</div>
	</div>

	<!-- Mobile-only category header position setting -->
	<div class="flex flex-col space-y-2 md:hidden">
		<div class="flex items-center gap-2 mb-1">
			<Icon icon="tabler:layout-navbar" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.categoryHeaderPosition.label') || 'Category Header Position'}
			</span>
		</div>
		<Select
			value={currentCategoryHeaderPosition}
			options={[
				{ value: 'bottom', label: s('settings.categoryHeaderPosition.bottom') || 'Bottom' },
				{ value: 'top', label: s('settings.categoryHeaderPosition.top') || 'Top' }
			]}
			hideLabel={true}
			label={s('settings.categoryHeaderPosition.label') || 'Category Header Position'}
			onChange={handleCategoryHeaderPositionChange}
		/>
		<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
			{s('settings.categoryHeaderPosition.description') || 'Choose where category tabs appear on mobile devices'}
		</p>
	</div>

	<!-- Font Size Setting -->
	<div class="flex flex-col space-y-2">
		<div class="flex items-center gap-2 mb-1">
			<Icon icon="tabler:typography" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.fontSize.label') || 'Text Size'}
			</span>
		</div>
		<Select
			value={currentFontSize}
			options={fontSizeOptions}
			hideLabel={true}
			label={s('settings.fontSize.label') || 'Text Size'}
			onChange={handleFontSizeChange}
		/>
	</div>

	<!-- Story Count Setting -->
	<div class="flex flex-col space-y-2">
		<div class="flex items-center gap-2 mb-1">
			<Icon icon="tabler:list-numbers" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
			<label for="story-count-range" class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.storyCount.label') || 'Stories per category'}: {settings.storyCount}
			</label>
		</div>
		<input
			id="story-count-range"
			type="range"
			min="3"
			max="12"
			value={settings.storyCount}
			oninput={(e) => {
				const target = e.target as HTMLInputElement;
				if (target) handleStoryCountChange(parseInt(target.value));
			}}
			class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
		/>
	</div>

	<!-- About Button -->
	<div class="flex flex-col space-y-2">
		<button
			type="button"
			onclick={showAbout}
			class="flex w-full items-center justify-center space-x-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 transition-colors duration-200 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
		>
			<img
				src={theme.current === 'dark' ? '/svg/kite_dark.svg' : '/svg/kite.svg'}
				alt={s('app.logo.iconAlt') || 'Kite'}
				class="h-4 w-4"
			/>
			<span>{s('settings.aboutKite.button') || 'About Kite'}</span>
		</button>
	</div>

	<!-- Report Issue Button -->
	<div class="flex flex-col space-y-2">
		<button
			type="button"
			onclick={() => window.open('https://github.com/kagisearch/kite-public/issues', '_blank')}
			class="flex w-full items-center justify-center space-x-2 rounded-lg bg-blue-100 px-4 py-2 text-sm font-medium text-blue-800 transition-colors duration-200 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
		>
			<Icon icon="tabler:bug" class="h-4 w-4" />
			<span>{s('settings.reportIssue.button') || 'Report Issue'}</span>
		</button>
	</div>

	<!-- Reset Settings Button -->
	<div class="flex flex-col space-y-2">
		<button
			type="button"
			onclick={handleResetClick}
			class={`flex w-full items-center justify-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 ${
				isResetConfirming 
					? 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700'
					: 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30'
			}`}
		>
			<Icon icon="tabler:refresh" class="h-4 w-4" />
			<span>
				{#if isResetConfirming}
					{s('settings.resetSettings.confirm') || 'Confirm Reset'}
				{:else}
					{s('settings.resetSettings.button') || 'Reset All Settings'}
				{/if}
			</span>
		</button>
		<p class="text-xs text-gray-500 dark:text-gray-400 text-center">
			{#if isResetConfirming}
				{s('settings.resetSettings.confirmDescription') || 'Click again to confirm reset'}
			{:else}
				{s('settings.resetSettings.description') || 'This will reset all settings to their default values'}
			{/if}
		</p>
		<p class="text-xs text-gray-400 dark:text-gray-500 text-center">
			Website icons provided by <a href="https://logo.dev" target="_blank" class="text-blue-600 dark:text-blue-400 hover:underline">logo.dev</a>
		</p>
	</div>
</div> 