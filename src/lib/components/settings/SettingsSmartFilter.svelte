<script lang="ts">
	import { s } from '$lib/client/localization.svelte';
	import { smartContentFilter } from '$lib/stores/smartContentFilter.svelte';
	import { IconInfoCircle } from '@tabler/icons-svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';

	let showAdvanced = $state(false);
	let showResetConfirm = $state(false);

	function handleFilterToggle() {
		smartContentFilter.toggleEnabled();
	}

	function handlePreferenceToggle(key: keyof typeof smartContentFilter.preferences) {
		smartContentFilter.togglePreference(key);
	}

	function handleThresholdChange(key: keyof typeof smartContentFilter.preferences, value: number) {
		smartContentFilter.updatePreference(key, value);
	}

	function resetToDefaults() {
		smartContentFilter.reset();
		showResetConfirm = false;
	}
</script>

<div class="max-w-4xl">
	<!-- Header Section -->
	<div class="mb-6">
		<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
			{s('settings.smartFilter.title') || 'Smart Content Filter'}
		</h2>
		<p class="text-sm text-gray-600 dark:text-gray-400">
			{s('settings.smartFilter.description') || 'AI-powered content filtering using algorithms to analyze relevance, quality, and sentiment instead of simple keyword matching.'}
		</p>
	</div>

	<!-- Enable/Disable Toggle -->
	<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="text-lg font-medium text-gray-900 dark:text-white">
					{s('settings.smartFilter.enableTitle') || 'Enable Smart Filtering'}
				</h3>
				<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
					{s('settings.smartFilter.enableDescription') || 'Automatically filter low-quality, irrelevant, or unwanted content using AI analysis'}
				</p>
			</div>
			<button
				class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 {smartContentFilter.isEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}"
				onclick={handleFilterToggle}
				aria-label="Toggle smart content filter"
			>
				<span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {smartContentFilter.isEnabled ? 'translate-x-6' : 'translate-x-1'}"></span>
			</button>
		</div>
	</div>

	{#if smartContentFilter.isEnabled}
		<!-- Content Type Filters -->
		<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
			<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
				{s('settings.smartFilter.contentTypes') || 'Content Type Filters'}
			</h3>
			<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
				{s('settings.smartFilter.contentTypesDescription') || 'Choose which types of content to filter out automatically'}
			</p>
			
			<!-- Basic Content Filters -->
			<div class="mb-6">
				<h4 class="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">📰 Content & Quality</h4>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					<label class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
						<input
							type="checkbox"
							checked={smartContentFilter.preferences.filterLowQuality}
							onchange={() => handlePreferenceToggle('filterLowQuality')}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						>
						<div class="flex-1">
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{s('settings.smartFilter.filterLowQuality') || 'Low Quality Content'}
							</span>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
								{s('settings.smartFilter.filterLowQualityDesc') || 'Filter clickbait, spam, and poor journalism'}
							</p>
						</div>
					</label>

					<label class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
						<input
							type="checkbox"
							checked={smartContentFilter.preferences.filterPromotional}
							onchange={() => handlePreferenceToggle('filterPromotional')}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						>
						<div class="flex-1">
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{s('settings.smartFilter.filterPromotional') || 'Promotional Content'}
							</span>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
								{s('settings.smartFilter.filterPromotionalDesc') || 'Filter press releases and marketing disguised as news'}
							</p>
						</div>
					</label>

					<label class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
						<input
							type="checkbox"
							checked={smartContentFilter.preferences.filterOpinions}
							onchange={() => handlePreferenceToggle('filterOpinions')}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						>
						<div class="flex-1">
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{s('settings.smartFilter.filterOpinions') || 'Opinion Pieces'}
							</span>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
								{s('settings.smartFilter.filterOpinionsDesc') || 'Filter editorials and commentary, keep factual reporting'}
							</p>
						</div>
					</label>

					<label class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
						<input
							type="checkbox"
							checked={smartContentFilter.preferences.filterSocialMediaDrama}
							onchange={() => handlePreferenceToggle('filterSocialMediaDrama')}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						>
						<div class="flex-1">
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{s('settings.smartFilter.filterSocialMediaDrama') || 'Social Media Drama'}
							</span>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
								{s('settings.smartFilter.filterSocialMediaDramaDesc') || 'Filter Twitter feuds and online controversies'}
							</p>
						</div>
					</label>
				</div>
			</div>

			<!-- Subject Matter Filters -->
			<div class="mb-6">
				<h4 class="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">📰 Topics & Subjects</h4>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					<label class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
						<input
							type="checkbox"
							checked={smartContentFilter.preferences.filterPolitics}
							onchange={() => handlePreferenceToggle('filterPolitics')}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						>
						<div class="flex-1">
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{s('settings.smartFilter.filterPolitics') || 'Political Content'}
							</span>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
								{s('settings.smartFilter.filterPoliticsDesc') || 'Filter political news and partisan content'}
							</p>
						</div>
					</label>

					<label class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
						<input
							type="checkbox"
							checked={smartContentFilter.preferences.filterSports}
							onchange={() => handlePreferenceToggle('filterSports')}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						>
						<div class="flex-1">
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{s('settings.smartFilter.filterSports') || 'Sports Coverage'}
							</span>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
								{s('settings.smartFilter.filterSportsDesc') || 'Filter all sports news, scores, and coverage'}
							</p>
						</div>
					</label>

					<label class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
						<input
							type="checkbox"
							checked={smartContentFilter.preferences.filterFinancial}
							onchange={() => handlePreferenceToggle('filterFinancial')}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						>
						<div class="flex-1">
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{s('settings.smartFilter.filterFinancial') || 'Financial News'}
							</span>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
								{s('settings.smartFilter.filterFinancialDesc') || 'Filter stock market, earnings, and corporate financial news'}
							</p>
						</div>
					</label>

					<label class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
						<input
							type="checkbox"
							checked={smartContentFilter.preferences.filterTechnology}
							onchange={() => handlePreferenceToggle('filterTechnology')}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						>
						<div class="flex-1">
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{s('settings.smartFilter.filterTechnology') || 'Technology News'}
							</span>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
								{s('settings.smartFilter.filterTechnologyDesc') || 'Filter tech company news and product launches'}
							</p>
						</div>
					</label>

					<label class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
						<input
							type="checkbox"
							checked={smartContentFilter.preferences.filterEntertainment}
							onchange={() => handlePreferenceToggle('filterEntertainment')}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						>
						<div class="flex-1">
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{s('settings.smartFilter.filterEntertainment') || 'Entertainment Industry'}
							</span>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
								{s('settings.smartFilter.filterEntertainmentDesc') || 'Filter movie, TV, and music industry news'}
							</p>
						</div>
					</label>

					<label class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
						<input
							type="checkbox"
							checked={smartContentFilter.preferences.filterCelebrity}
							onchange={() => handlePreferenceToggle('filterCelebrity')}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						>
						<div class="flex-1">
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{s('settings.smartFilter.filterCelebrity') || 'Celebrity News'}
							</span>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
								{s('settings.smartFilter.filterCelebrityDesc') || 'Filter celebrity gossip and entertainment news'}
							</p>
						</div>
					</label>
				</div>
			</div>

			<!-- Wellness & Mental Health Filters -->
			<div class="mb-6">
				<h4 class="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">🧠 Wellness & Mental Health</h4>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					<label class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
						<input
							type="checkbox"
							checked={smartContentFilter.preferences.filterNegativeNews}
							onchange={() => handlePreferenceToggle('filterNegativeNews')}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						>
						<div class="flex-1">
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{s('settings.smartFilter.filterNegative') || 'Negative News'}
							</span>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
								{s('settings.smartFilter.filterNegativeDesc') || 'Filter depressing or distressing content'}
							</p>
						</div>
					</label>

					<label class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
						<input
							type="checkbox"
							checked={smartContentFilter.preferences.filterViolence}
							onchange={() => handlePreferenceToggle('filterViolence')}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						>
						<div class="flex-1">
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{s('settings.smartFilter.filterViolence') || 'Violent Content'}
							</span>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
								{s('settings.smartFilter.filterViolenceDesc') || 'Filter violence, crime, and disturbing content'}
							</p>
						</div>
					</label>

					<label class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
						<input
							type="checkbox"
							checked={smartContentFilter.preferences.filterAnxietyInducing}
							onchange={() => handlePreferenceToggle('filterAnxietyInducing')}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						>
						<div class="flex-1">
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{s('settings.smartFilter.filterAnxietyInducing') || 'Anxiety-Inducing Content'}
							</span>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
								{s('settings.smartFilter.filterAnxietyInducingDesc') || 'Filter disaster coverage and doomsday scenarios'}
							</p>
						</div>
					</label>
				</div>
			</div>
		</div>

		<!-- Advanced Settings -->
		<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
			<button
				class="flex items-center justify-between w-full text-left"
				onclick={() => showAdvanced = !showAdvanced}
			>
				<h3 class="text-lg font-medium text-gray-900 dark:text-white">
					{s('settings.smartFilter.advanced') || 'Advanced Settings'}
				</h3>
				<span class="text-gray-400 text-lg">
					{showAdvanced ? '▼' : '▶'}
				</span>
			</button>
			
			{#if showAdvanced}
				<div class="mt-6 space-y-6">
					<p class="text-sm text-gray-600 dark:text-gray-400">
						{s('settings.smartFilter.advancedDescription') || 'Fine-tune the algorithmic scoring thresholds. Higher values = stricter filtering.'}
					</p>
					
					<div class="space-y-4">
						<div>
							<div class="flex items-center gap-2 mb-2">
								<label for="relevance-slider" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									{s('settings.smartFilter.minimumRelevance') || 'Minimum Relevance'}: {smartContentFilter.preferences.minimumRelevance.toFixed(1)}
								</label>
								<Tooltip text={s('settings.smartFilter.relevanceTooltip') || 'How relevant the content must be to your interests'}>
									<IconInfoCircle class="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
								</Tooltip>
							</div>
							<input
								id="relevance-slider"
								type="range"
								min="0"
								max="1"
								step="0.1"
								value={smartContentFilter.preferences.minimumRelevance}
								oninput={(e) => handleThresholdChange('minimumRelevance', parseFloat(e.currentTarget.value))}
								class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
							>
						</div>
						
						<div>
							<div class="flex items-center gap-2 mb-2">
								<label for="quality-slider" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									{s('settings.smartFilter.minimumQuality') || 'Minimum Quality'}: {smartContentFilter.preferences.minimumQuality.toFixed(1)}
								</label>
								<Tooltip text={s('settings.smartFilter.qualityTooltip') || 'How high-quality the journalism and writing must be'}>
									<IconInfoCircle class="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
								</Tooltip>
							</div>
							<input
								id="quality-slider"
								type="range"
								min="0"
								max="1"
								step="0.1"
								value={smartContentFilter.preferences.minimumQuality}
								oninput={(e) => handleThresholdChange('minimumQuality', parseFloat(e.currentTarget.value))}
								class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
							>
						</div>
						
						<div>
							<div class="flex items-center gap-2 mb-2">
								<label for="sentiment-slider" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									{s('settings.smartFilter.minimumSentiment') || 'Minimum Sentiment'}: {smartContentFilter.preferences.minimumSentiment.toFixed(1)}
								</label>
								<Tooltip text={s('settings.smartFilter.sentimentTooltip') || 'How positive or neutral the content sentiment must be'}>
									<IconInfoCircle class="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
								</Tooltip>
							</div>
							<input
								id="sentiment-slider"
								type="range"
								min="0"
								max="1"
								step="0.1"
								value={smartContentFilter.preferences.minimumSentiment}
								oninput={(e) => handleThresholdChange('minimumSentiment', parseFloat(e.currentTarget.value))}
								class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
							>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Statistics -->
		{#if smartContentFilter.stats}
			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
				<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
					{s('settings.smartFilter.statistics') || 'Filter Statistics'}
				</h3>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div class="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
						<div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
							{smartContentFilter.stats.totalProcessed}
						</div>
						<div class="text-sm text-gray-600 dark:text-gray-400">
							{s('settings.smartFilter.totalProcessed') || 'Stories Processed'}
						</div>
					</div>
					<div class="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
						<div class="text-2xl font-bold text-red-600 dark:text-red-400">
							{smartContentFilter.stats.filtered}
						</div>
						<div class="text-sm text-gray-600 dark:text-gray-400">
							{s('settings.smartFilter.filtered') || 'Stories Filtered'}
						</div>
					</div>
					<div class="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
						<div class="text-2xl font-bold text-green-600 dark:text-green-400">
							{(smartContentFilter.stats.filterRate * 100).toFixed(1)}%
						</div>
						<div class="text-sm text-gray-600 dark:text-gray-400">
							{s('settings.smartFilter.filterRate') || 'Filter Rate'}
						</div>
					</div>
				</div>
			</div>
		{/if}
	{/if}

	<!-- Reset Section -->
	<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
		<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
			{s('settings.smartFilter.reset') || 'Reset Settings'}
		</h3>
		<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
			{s('settings.smartFilter.resetDescription') || 'Reset all smart filter settings to their default values.'}
		</p>
		
		{#if showResetConfirm}
			<div class="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/20 dark:border-red-800">
				<p class="text-sm text-red-800 dark:text-red-300 mb-3">
					{s('settings.smartFilter.resetConfirm') || 'Are you sure you want to reset all smart filter settings to defaults?'}
				</p>
				<div class="flex gap-2">
					<button
						onclick={resetToDefaults}
						class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
					>
						{s('settings.smartFilter.confirmReset') || 'Yes, Reset'}
					</button>
					<button
						onclick={() => showResetConfirm = false}
						class="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
					>
						{s('common.cancel') || 'Cancel'}
					</button>
				</div>
			</div>
		{:else}
			<button
				onclick={() => showResetConfirm = true}
				class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
			>
				{s('settings.smartFilter.resetButton') || 'Reset to Defaults'}
			</button>
		{/if}
	</div>
</div> 