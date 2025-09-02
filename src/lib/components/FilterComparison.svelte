<script lang="ts">
	import { smartContentFilter } from '$lib/stores/smartContentFilter.svelte';
	
	
	export let stories: any[] = [];
	
	let comparisonResults: any = null;
	let showDetails = false;
	
	// Sample problematic stories that demonstrate the difference
	const sampleStories = [
		{
			title: "Trump Announces New Economic Policy Initiative",
			short_summary: "Former president outlines comprehensive plan for economic recovery focusing on manufacturing and trade policies.",
			source_url: "reuters.com"
		},
		{
			title: "SHOCKING: You Won't Believe What This Celebrity Did!",
			short_summary: "Click here to see the most amazing celebrity scandal that will blow your mind! Doctors hate this one trick!",
			source_url: "dailymail.co.uk"
		},
		{
			title: "Federal Reserve Adjusts Interest Rates Amid Economic Uncertainty",
			short_summary: "The central bank's decision reflects ongoing concerns about inflation and employment levels in the current economic climate.",
			source_url: "wsj.com"
		},
		{
			title: "Local Community Celebrates Annual Harvest Festival",
			short_summary: "Residents gather for traditional celebration featuring local produce, music, and family activities in downtown area.",
			source_url: "localnews.com"
		},
		{
			title: "Breaking: Multiple Casualties in Downtown Shooting Incident",
			short_summary: "Police respond to active shooter situation with multiple victims reported. Investigation ongoing.",
			source_url: "cnn.com"
		}
	];
	
	function runComparison() {
		const testStories = stories.length > 0 ? stories.slice(0, 10) : sampleStories;
		
		// Apply smart algorithmic filtering with different configurations
		smartContentFilter.updatePreference('filterPolitics', true);
		smartContentFilter.updatePreference('filterLowQuality', true);
		smartContentFilter.updatePreference('filterViolence', true);
		
		const smartFiltered = smartContentFilter.filterStories(testStories);
		const analysis = smartContentFilter.analyzeContent(testStories);
		
		comparisonResults = {
			original: testStories,
			smartFiltered: smartFiltered.filtered,
			smartRemoved: smartFiltered.removed,
			analysis,
			stats: {
				original: testStories.length,
				smartKept: smartFiltered.filtered.length,
				smartRemoved: smartFiltered.removed.length,
				filterRate: (smartFiltered.removed.length / testStories.length) * 100
			}
		};
	}
	
	function getQualityColor(score: number): string {
		if (score >= 0.7) return 'text-green-600 dark:text-green-400';
		if (score >= 0.4) return 'text-yellow-600 dark:text-yellow-400';
		return 'text-red-600 dark:text-red-400';
	}
	
	function getQualityLabel(score: number): string {
		if (score >= 0.7) return 'High';
		if (score >= 0.4) return 'Medium';
		return 'Low';
	}
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
	<div class="flex items-center justify-between mb-6">
		<div>
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
				🤖 Smart Content Filter Demo
			</h3>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				See how AI-powered algorithms analyze and filter content
			</p>
		</div>
		<button
			class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
			onclick={runComparison}
		>
			Run Demo
		</button>
	</div>

	{#if comparisonResults}
		<!-- Summary Stats -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
			<div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
				<div class="text-2xl font-bold text-gray-900 dark:text-white">
					{comparisonResults.stats.original}
				</div>
				<div class="text-sm text-gray-600 dark:text-gray-400">Original Stories</div>
			</div>
			
			<div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
				<div class="text-2xl font-bold text-green-600 dark:text-green-400">
					{comparisonResults.stats.smartKept}
				</div>
				<div class="text-sm text-gray-600 dark:text-gray-400">Stories Kept</div>
			</div>
			
			<div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
				<div class="text-2xl font-bold text-red-600 dark:text-red-400">
					{comparisonResults.stats.smartRemoved}
				</div>
				<div class="text-sm text-gray-600 dark:text-gray-400">
					Stories Filtered
					<br>
					<span class="text-xs">({comparisonResults.stats.filterRate.toFixed(1)}% filtered)</span>
				</div>
			</div>
		</div>

		<!-- Content Quality Analysis -->
		<div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
			<h4 class="font-medium text-gray-900 dark:text-white mb-3">📊 Content Quality Analysis</h4>
			<div class="grid grid-cols-3 gap-4 text-center">
				<div>
					<div class="text-lg font-bold {getQualityColor(comparisonResults.analysis.averageQuality)}">
						{(comparisonResults.analysis.averageQuality * 100).toFixed(0)}%
					</div>
					<div class="text-xs text-gray-600 dark:text-gray-400">Average Quality</div>
				</div>
				<div>
					<div class="text-lg font-bold {getQualityColor(comparisonResults.analysis.averageRelevance)}">
						{(comparisonResults.analysis.averageRelevance * 100).toFixed(0)}%
					</div>
					<div class="text-xs text-gray-600 dark:text-gray-400">Average Relevance</div>
				</div>
				<div>
					<div class="text-lg font-bold {getQualityColor(comparisonResults.analysis.averageSentiment)}">
						{(comparisonResults.analysis.averageSentiment * 100).toFixed(0)}%
					</div>
					<div class="text-xs text-gray-600 dark:text-gray-400">Average Sentiment</div>
				</div>
			</div>
		</div>

		<!-- Detailed Comparison -->
		<div class="border-t border-gray-200 dark:border-gray-700 pt-4">
			<button
				class="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-4"
				onclick={() => showDetails = !showDetails}
			>
				{showDetails ? '▼' : '▶'} Show Detailed Story Analysis
			</button>
			
			{#if showDetails}
				<div class="space-y-4">
					{#each comparisonResults.original as story, index}
						{@const smartRemovedItem = comparisonResults.smartRemoved.find(item => item.story === story)}
						{@const isSmartFiltered = !!smartRemovedItem}
						
						<div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
							<div class="flex items-start justify-between mb-2">
								<h5 class="font-medium text-gray-900 dark:text-white text-sm">
									{story.title}
								</h5>
								<div class="flex gap-2 ml-4">
									<span class="px-2 py-1 text-xs rounded {isSmartFiltered ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'}">
										{isSmartFiltered ? 'Filtered ❌' : 'Kept ✅'}
									</span>
								</div>
							</div>
							
							<p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
								{story.short_summary}
							</p>
							
							{#if smartRemovedItem}
								<div class="bg-red-50 dark:bg-red-900/20 rounded p-2">
									<p class="text-xs text-red-700 dark:text-red-300">
										<strong>Filter Reasons:</strong> {smartRemovedItem.reasons.join(', ')}
									</p>
								</div>
							{:else}
								<div class="bg-green-50 dark:bg-green-900/20 rounded p-2">
									<p class="text-xs text-green-700 dark:text-green-300">
										<strong>Quality Assessment:</strong> Story meets quality and relevance standards
									</p>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Smart Filter Features -->
		<div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
			<h4 class="font-medium text-gray-900 dark:text-white mb-3">🤖 Smart Filter Capabilities</h4>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div class="space-y-2">
					<h5 class="text-sm font-medium text-blue-600 dark:text-blue-400">📊 Content Analysis</h5>
					<ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
						<li>• Quality scoring based on writing style</li>
						<li>• Relevance analysis for news content</li>
						<li>• Sentiment detection for emotional tone</li>
						<li>• Source credibility evaluation</li>
					</ul>
				</div>
				<div class="space-y-2">
					<h5 class="text-sm font-medium text-green-600 dark:text-green-400">🎯 Smart Detection</h5>
					<ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
						<li>• Clickbait and low-quality detection</li>
						<li>• Context-aware content categorization</li>
						<li>• Toxic and violent content filtering</li>
						<li>• Adaptable filtering preferences</li>
					</ul>
				</div>
			</div>
		</div>
	{:else}
		<div class="text-center py-8 text-gray-500 dark:text-gray-400">
			<p>Click "Run Demo" to see how smart algorithms analyze and filter content</p>
		</div>
	{/if}
</div>