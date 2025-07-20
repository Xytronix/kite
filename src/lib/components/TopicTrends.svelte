<script lang="ts">
	import type { Topic } from '$lib/types';
	import { dataService } from '$lib/services/dataService';
	import { onMount } from 'svelte';
	import { createEventDispatcher } from 'svelte';

	export let language: string = 'en';

	const dispatch = createEventDispatcher<{
		topicSelected: { topic: Topic };
	}>();

	let topics: Topic[] = [];
	let loading = true;
	let error: string | null = null;
	let lastUpdated: Date | null = null;

	// Auto-refresh every 5 minutes for dynamic data
	let refreshInterval: ReturnType<typeof setInterval>;

	async function loadTopics() {
		try {
			loading = true;
			// Get trending topics (already sorted by frequency)
			topics = await dataService.getTrendingTopics(20, language); // Get top 20 trending topics
			lastUpdated = new Date();
			error = null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load topic trends';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		// Kick off the initial load but don't make onMount itself async
		void loadTopics();

		// Set up auto-refresh for dynamic updates
		refreshInterval = setInterval(loadTopics, 5 * 60 * 1000); // 5 minutes

		// Cleanup when the component is destroyed
		return () => {
			clearInterval(refreshInterval);
		};
	});

	function selectTopic(topic: Topic) {
		dispatch('topicSelected', { topic });
	}

	function getBarWidth(count: number, maxCount: number): number {
		return maxCount > 0 ? (count / maxCount) * 100 : 0;
	}

	function formatCount(count: number): string {
		if (count >= 1000) {
			return `${(count / 1000).toFixed(1)}k`;
		}
		return count.toString();
	}

	function getTypeIcon(type: string): string {
		switch (type) {
			case 'organization': return '🏢';
			case 'person': return '👤';
			case 'technology': return '💻';
			case 'event': return '📅';
			case 'location': return '📍';
			case 'concept': return '💡';
			default: return '📊';
		}
	}

	// Enhanced color system similar to world temper
	function getIntensityColor(count: number, maxCount: number, index: number): string {
		if (maxCount === 0) return 'from-gray-400 to-gray-500';
		
		const intensity = count / maxCount;
		const position = index / Math.min(topics.length, 10); // Top 10 for color variation
		
		if (intensity >= 0.8) return 'from-red-500 to-red-600';
		if (intensity >= 0.6) return 'from-orange-500 to-orange-600';
		if (intensity >= 0.4) return 'from-yellow-500 to-yellow-600';
		if (intensity >= 0.2) return 'from-green-500 to-green-600';
		return 'from-blue-500 to-blue-600';
	}

	function getTrendIndicator(count: number, maxCount: number): { icon: string; color: string } {
		const intensity = count / maxCount;
		if (intensity >= 0.8) return { icon: '🔥', color: 'text-red-500' };
		if (intensity >= 0.6) return { icon: '📈', color: 'text-orange-500' };
		if (intensity >= 0.4) return { icon: '⚡', color: 'text-yellow-500' };
		if (intensity >= 0.2) return { icon: '📊', color: 'text-green-500' };
		return { icon: '💭', color: 'text-blue-500' };
	}

	$: maxCount = topics.length > 0 ? Math.max(...topics.map(t => t.article_count)) : 0;
</script>

<div>
	<header class="text-center mb-8">
		<h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-2">
			📈 Topic Trends
		</h2>
		<p class="text-gray-600 dark:text-gray-400">Topics ranked by number of mentions</p>
		{#if lastUpdated}
			<p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
				Last updated: {lastUpdated.toLocaleTimeString()}
			</p>
		{/if}
	</header>

	{#if loading}
		<div class="flex flex-col items-center justify-center py-12">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
			<p class="text-gray-600 dark:text-gray-400">Loading trends...</p>
		</div>
	{:else if error}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
			<p class="text-red-800 dark:text-red-200">Error: {error}</p>
		</div>
	{:else if topics.length > 0}
		<div class="space-y-4">
			{#each topics as topic, index}
				{@const trendInfo = getTrendIndicator(topic.article_count, maxCount)}
				{@const colorGradient = getIntensityColor(topic.article_count, maxCount, index)}
				<button 
					class="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 text-left group"
					on:click={() => selectTopic(topic)}
					title="Click to view {topic.name} feed"
				>
					<div class="flex flex-col items-center min-w-[4rem]">
						<div class="text-xl font-bold text-blue-600 dark:text-blue-400 mb-1">
							#{index + 1}
						</div>
						<span class="text-lg {trendInfo.color} group-hover:scale-110 transition-transform">
							{trendInfo.icon}
						</span>
					</div>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 mb-3">
							<span class="text-lg">{getTypeIcon(topic.type)}</span>
							<span class="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
								{topic.name}
							</span>
							<span class="ml-auto px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full capitalize">
								{topic.type}
							</span>
						</div>
						<div class="relative mb-2">
							<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden shadow-inner">
								<div 
									class="h-full bg-gradient-to-r {colorGradient} rounded-full transition-all duration-1000 shadow-sm"
									style="width: {getBarWidth(topic.article_count, maxCount)}%"
								></div>
							</div>
							<div class="absolute -top-7 right-0 flex items-center gap-2">
								<span class="text-sm font-bold text-gray-900 dark:text-white">
									{formatCount(topic.article_count)}
								</span>
								<span class="text-xs text-gray-500 dark:text-gray-400">
									mentions
								</span>
							</div>
						</div>
						{#if topic.description}
							<p class="text-sm text-gray-600 dark:text-gray-400 overflow-hidden" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
								{topic.description}
							</p>
						{/if}
					</div>
				</button>
			{/each}
		</div>
	{:else}
		<div class="text-center py-12">
			<div class="text-6xl mb-4">📊</div>
			<p class="text-gray-500 dark:text-gray-400">No topic trends available</p>
		</div>
	{/if}
</div>

<style>

</style>