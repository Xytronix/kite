<script lang="ts">
	import type { Topic } from '$lib/types';
	import { topicService } from '$lib/services/topicService';
	import { createEventDispatcher } from 'svelte';

	export let language: string = 'en';

	const dispatch = createEventDispatcher<{
		topicSelected: { topic: Topic };
	}>();

	let searchQuery = '';
	let searchResults: Topic[] = [];
	let trendingTopics: Topic[] = [];
	let loading = false;
	let searchTimeout: NodeJS.Timeout;

	// Load trending topics on mount
	$: loadTrendingTopics(language);

	async function loadTrendingTopics(lang: string) {
		try {
			trendingTopics = await topicService.getTrendingTopics(8, lang);
		} catch (error) {
			console.error('Failed to load trending topics:', error);
		}
	}

	async function handleSearch() {
		if (!searchQuery.trim()) {
			searchResults = [];
			return;
		}

		loading = true;
		try {
			searchResults = await topicService.searchTopics(searchQuery, language);
		} catch (error) {
			console.error('Search failed:', error);
			searchResults = [];
		} finally {
			loading = false;
		}
	}

	function debounceSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(handleSearch, 300);
	}

	function selectTopic(topic: Topic) {
		dispatch('topicSelected', { topic });
	}

	$: if (searchQuery) {
		debounceSearch();
	} else {
		searchResults = [];
	}
</script>

<div>
	<!-- Search Input with Kite styling -->
	<div class="relative mb-8">
		<input
			type="text"
			bind:value={searchQuery}
			placeholder="Search topics (e.g., AI, climate, crypto...)"
			class="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
		/>
		{#if loading}
			<div class="absolute right-3 top-1/2 transform -translate-y-1/2">
				<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 dark:border-blue-400"></div>
			</div>
		{/if}
	</div>

	{#if searchResults.length > 0}
		<div class="mb-8">
			<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">Search Results</h3>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				{#each searchResults as topic}
					<button
						class="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all text-left"
						on:click={() => selectTopic(topic)}
					>
						<h4 class="font-semibold text-gray-900 dark:text-white mb-2">{topic.name}</h4>
						{#if topic.description}
							<p class="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
								{topic.description}
							</p>
						{/if}
						<div class="flex flex-wrap items-center gap-2 text-xs">
							<span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
								{topic.keywords.length} keywords
							</span>
							{#if topic.article_count > 0}
								<span class="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
									{topic.article_count} articles
								</span>
							{/if}
						</div>
					</button>
				{/each}
			</div>
		</div>
	{:else if !searchQuery && trendingTopics.length > 0}
		<div>
			<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
				🔥 Trending Topics
			</h3>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				{#each trendingTopics as topic}
					<button
						class="p-4 bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/20 dark:to-gray-800 border border-orange-200 dark:border-orange-800 rounded-lg hover:shadow-md hover:border-orange-300 dark:hover:border-orange-600 transition-all text-left"
						on:click={() => selectTopic(topic)}
					>
						<h4 class="font-semibold text-gray-900 dark:text-white mb-2">{topic.name}</h4>
						{#if topic.description}
							<p class="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
								{topic.description}
							</p>
						{/if}
						<div class="flex flex-wrap items-center gap-2 text-xs">
							<span class="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full font-medium">
								🔥 Trending
							</span>
							{#if topic.article_count > 0}
								<span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
									{topic.article_count} articles
								</span>
							{/if}
						</div>
					</button>
				{/each}
			</div>
		</div>
	{:else if searchQuery && !loading}
		<div class="text-center py-12">
			<div class="text-6xl mb-4">🔍</div>
			<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
				No topics found
			</h3>
			<p class="text-gray-500 dark:text-gray-400">
				Try searching for different keywords or browse trending topics above.
			</p>
		</div>
	{/if}
</div>