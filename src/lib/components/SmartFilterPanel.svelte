<script lang="ts">
	import { smartContentFilter } from '$lib/stores/smartContentFilter.svelte';
	
	export let stories: any[] = [];
	
	let showAdvanced = false;
	let analysisResult: any = null;
	let recommendations: any = null;
	
	// Reactive analysis when stories change
	$: if (stories.length > 0) {
		analysisResult = smartContentFilter.analyzeContent(stories);
		recommendations = smartContentFilter.getRecommendations(stories);
	}
	
	function handleFilterToggle() {
		smartContentFilter.toggleEnabled();
	}
	
	function handlePreferenceToggle(key: keyof typeof smartContentFilter.preferences) {
		smartContentFilter.togglePreference(key);
	}
	
	function handleThresholdChange(key: keyof typeof smartContentFilter.preferences, value: number) {
		smartContentFilter.updatePreference(key, value);
	}
	
	function applyRecommendation(rec: any) {
		smartContentFilter.updatePreference(rec.setting, rec.recommendedValue);
	}
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
	<div class="flex items-center justify-between mb-4">
		<div>
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
				🤖 Smart Content Filter
			</h3>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				AI-powered content filtering using algorithms instead of keyword lists
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

	{#if smartContentFilter.isEnabled}
		<!-- Filter Preferences -->
		<div class="space-y-4 mb-6">
			<h4 class="font-medium text-gray-900 dark:text-white">Content Filters</h4>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<label class="flex items-center space-x-3">
					<input
						type="checkbox"
						checked={smartContentFilter.preferences.filterPolitics}
						onchange={() => handlePreferenceToggle('filterPolitics')}
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					>
					<span class="text-sm text-gray-700 dark:text-gray-300">Filter Politics</span>
				</label>
				
				<label class="flex items-center space-x-3">
					<input
						type="checkbox"
						checked={smartContentFilter.preferences.filterNegativeNews}
						onchange={() => handlePreferenceToggle('filterNegativeNews')}
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					>
					<span class="text-sm text-gray-700 dark:text-gray-300">Filter Negative News</span>
				</label>
				
				<label class="flex items-center space-x-3">
					<input
						type="checkbox"
						checked={smartContentFilter.preferences.filterLowQuality}
						onchange={() => handlePreferenceToggle('filterLowQuality')}
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					>
					<span class="text-sm text-gray-700 dark:text-gray-300">Filter Low Quality</span>
				</label>
				
				<label class="flex items-center space-x-3">
					<input
						type="checkbox"
						checked={smartContentFilter.preferences.filterViolence}
						onchange={() => handlePreferenceToggle('filterViolence')}
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					>
					<span class="text-sm text-gray-700 dark:text-gray-300">Filter Violence</span>
				</label>
				
				<label class="flex items-center space-x-3">
					<input
						type="checkbox"
						checked={smartContentFilter.preferences.filterCelebrity}
						onchange={() => handlePreferenceToggle('filterCelebrity')}
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					>
					<span class="text-sm text-gray-700 dark:text-gray-300">Filter Celebrity News</span>
				</label>
			</div>
		</div>

		<!-- Advanced Settings -->
		<div class="border-t border-gray-200 dark:border-gray-700 pt-4">
			<button
				class="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
				onclick={() => showAdvanced = !showAdvanced}
			>
				{showAdvanced ? '▼' : '▶'} Advanced Settings
			</button>
			
			{#if showAdvanced}
				<div class="mt-4 space-y-4">
					<div>
						<label for="relevance-slider" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Minimum Relevance: {smartContentFilter.preferences.minimumRelevance.toFixed(1)}
						</label>
						<input
							id="relevance-slider"
							type="range"
							min="0"
							max="1"
							step="0.1"
							value={smartContentFilter.preferences.minimumRelevance}
							oninput={(e) => handleThresholdChange('minimumRelevance', parseFloat(e.currentTarget.value))}
							class="w-full"
						>
					</div>
					
					<div>
						<label for="quality-slider" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Minimum Quality: {smartContentFilter.preferences.minimumQuality.toFixed(1)}
						</label>
						<input
							id="quality-slider"
							type="range"
							min="0"
							max="1"
							step="0.1"
							value={smartContentFilter.preferences.minimumQuality}
							oninput={(e) => handleThresholdChange('minimumQuality', parseFloat(e.currentTarget.value))}
							class="w-full"
						>
					</div>
					
					<div>
						<label for="sentiment-slider" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Minimum Sentiment: {smartContentFilter.preferences.minimumSentiment.toFixed(1)}
						</label>
						<input
							id="sentiment-slider"
							type="range"
							min="0"
							max="1"
							step="0.1"
							value={smartContentFilter.preferences.minimumSentiment}
							oninput={(e) => handleThresholdChange('minimumSentiment', parseFloat(e.currentTarget.value))}
							class="w-full"
						>
					</div>
				</div>
			{/if}
		</div>

		<!-- Content Analysis -->
		{#if analysisResult}
			<div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
				<h4 class="font-medium text-gray-900 dark:text-white mb-3">Content Analysis</h4>
				<div class="grid grid-cols-3 gap-4 text-center">
					<div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
						<div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
							{(analysisResult.averageQuality * 100).toFixed(0)}%
						</div>
						<div class="text-xs text-gray-600 dark:text-gray-400">Avg Quality</div>
					</div>
					<div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
						<div class="text-2xl font-bold text-green-600 dark:text-green-400">
							{(analysisResult.averageRelevance * 100).toFixed(0)}%
						</div>
						<div class="text-xs text-gray-600 dark:text-gray-400">Avg Relevance</div>
					</div>
					<div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
						<div class="text-2xl font-bold text-purple-600 dark:text-purple-400">
							{(analysisResult.averageSentiment * 100).toFixed(0)}%
						</div>
						<div class="text-xs text-gray-600 dark:text-gray-400">Avg Sentiment</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Recommendations -->
		{#if recommendations && recommendations.recommendations.length > 0}
			<div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
				<h4 class="font-medium text-gray-900 dark:text-white mb-3">💡 Recommendations</h4>
				<div class="space-y-2">
					{#each recommendations.recommendations as rec}
						<div class="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
							<div class="flex-1">
								<p class="text-sm text-gray-700 dark:text-gray-300">{rec.reason}</p>
							</div>
							<button
								class="ml-3 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
								onclick={() => applyRecommendation(rec)}
							>
								Apply
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Filter Stats -->
		{#if smartContentFilter.stats}
			<div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
				<h4 class="font-medium text-gray-900 dark:text-white mb-3">Filter Statistics</h4>
				<div class="text-sm text-gray-600 dark:text-gray-400">
					<p>Processed: {smartContentFilter.stats.totalProcessed} stories</p>
					<p>Filtered: {smartContentFilter.stats.filtered} stories ({(smartContentFilter.stats.filterRate * 100).toFixed(1)}%)</p>
				</div>
			</div>
		{/if}
	{/if}
</div>