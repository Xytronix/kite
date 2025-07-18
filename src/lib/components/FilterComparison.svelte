<script lang="ts">
	import { smartContentFilter } from '$lib/stores/smartContentFilter.svelte';
	import { contentFilter } from '$lib/stores/contentFilter.svelte';
	
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
		
		// Test with keyword-based filtering (simulate politics filter)
		const keywordFiltered = testStories.filter(story => {
			const text = `${story.title} ${story.short_summary}`.toLowerCase();
			// Simulate basic keyword matching for politics
			const politicsKeywords = ['trump', 'biden', 'election', 'democrat', 'republican', 'congress', 'senate'];
			return !politicsKeywords.some(keyword => text.includes(keyword));
		});
		
		// Test with smart algorithmic filtering
		smartContentFilter.updatePreference('filterPolitics', true);
		smartContentFilter.updatePreference('filterLowQuality', true);
		smartContentFilter.updatePreference('filterViolence', true);
		
		const smartFiltered = smartContentFilter.filterStories(testStories);
		const analysis = smartContentFilter.analyzeContent(testStories);
		
		comparisonResults = {
			original: testStories,
			keywordFiltered,
			smartFiltered: smartFiltered.filtered,
			smartRemoved: smartFiltered.removed,
			analysis,
			stats: {
				original: testStories.length,
				keywordKept: keywordFiltered.length,
				smartKept: smartFiltered.filtered.length,
				keywordRemoved: testStories.length - keywordFiltered.length,
				smartRemoved: smartFiltered.removed.length
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
				⚖️ Algorithm vs Keywords Comparison
			</h3>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				See how smart algorithms outperform traditional keyword filtering
			</p>
		</div>
		<button
			class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
			onclick={runComparison}
		>
			Run Comparison
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
			
			<div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
				<div class="text-2xl font-bold text-red-600 dark:text-red-400">
					{comparisonResults.stats.keywordKept}
				</div>
				<div class="text-sm text-gray-600 dark:text-gray-400">
					Keyword Filter Kept
					<br>
					<span class="text-xs">({comparisonResults.stats.keywordRemoved} removed)</span>
				</div>
			</div>
			
			<div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
				<div class="text-2xl font-bold text-green-600 dark:text-green-400">
					{comparisonResults.stats.smartKept}
				</div>
				<div class="text-sm text-gray-600 dark:text-gray-400">
					Smart Filter Kept
					<br>
					<span class="text-xs">({comparisonResults.stats.smartRemoved} removed)</span>
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
						{@const isKeywordFiltered = !comparisonResults.keywordFiltered.includes(story)}
						{@const smartRemovedItem = comparisonResults.smartRemoved.find(item => item.story === story)}
						{@const isSmartFiltered = !!smartRemovedItem}
						
						<div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
							<div class="flex items-start justify-between mb-2">
								<h5 class="font-medium text-gray-900 dark:text-white text-sm">
									{story.title}
								</h5>
								<div class="flex gap-2 ml-4">
									<span class="px-2 py-1 text-xs rounded {isKeywordFiltered ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'}">
										{isKeywordFiltered ? 'Keyword ❌' : 'Keyword ✅'}
									</span>
									<span class="px-2 py-1 text-xs rounded {isSmartFiltered ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'}">
										{isSmartFiltered ? 'Smart ❌' : 'Smart ✅'}
									</span>
								</div>
							</div>
							
							<p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
								{story.short_summary}
							</p>
							
							{#if smartRemovedItem}
								<div class="bg-red-50 dark:bg-red-900/20 rounded p-2">
									<p class="text-xs text-red-700 dark:text-red-300">
										<strong>Smart Filter Reasons:</strong> {smartRemovedItem.reasons.join(', ')}
									</p>
								</div>
							{/if}
							
							{#if isKeywordFiltered && !isSmartFiltered}
								<div class="bg-yellow-50 dark:bg-yellow-900/20 rounded p-2">
									<p class="text-xs text-yellow-700 dark:text-yellow-300">
										<strong>Note:</strong> Keyword filter removed this story, but smart filter kept it (likely high quality despite containing filtered terms)
									</p>
								</div>
							{/if}
							
							{#if !isKeywordFiltered && isSmartFiltered}
								<div class="bg-blue-50 dark:bg-blue-900/20 rounded p-2">
									<p class="text-xs text-blue-700 dark:text-blue-300">
										<strong>Smart Advantage:</strong> Keyword filter missed this low-quality content, but smart filter caught it
									</p>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Key Advantages -->
		<div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
			<h4 class="font-medium text-gray-900 dark:text-white mb-3">🎯 Smart Algorithm Advantages</h4>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div class="space-y-2">
					<h5 class="text-sm font-medium text-green-600 dark:text-green-400">✅ What Smart Filtering Does Better:</h5>
					<ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
						<li>• Detects clickbait and low-quality content</li>
						<li>• Considers context, not just keywords</li>
						<li>• Analyzes sentiment and tone</li>
						<li>• Evaluates source credibility</li>
						<li>• Adapts to content patterns</li>
						<li>• Reduces false positives</li>
					</ul>
				</div>
				<div class="space-y-2">
					<h5 class="text-sm font-medium text-red-600 dark:text-red-400">❌ Keyword Filtering Limitations:</h5>
					<ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
						<li>• Blocks legitimate news with keywords</li>
						<li>• Misses low-quality content without keywords</li>
						<li>• No context understanding</li>
						<li>• Requires constant maintenance</li>
						<li>• Language-specific limitations</li>
						<li>• High false positive rate</li>
					</ul>
				</div>
			</div>
		</div>
	{:else}
		<div class="text-center py-8 text-gray-500 dark:text-gray-400">
			<p>Click "Run Comparison" to see how smart algorithms outperform keyword-based filtering</p>
		</div>
	{/if}
</div>