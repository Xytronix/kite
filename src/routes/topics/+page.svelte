<script lang="ts">
	import TopicSearch from '$lib/components/TopicSearch.svelte';
	import TopicFeed from '$lib/components/TopicFeed.svelte';
	import TopicTrends from '$lib/components/TopicTrends.svelte';
	import SmartFilterPanel from '$lib/components/SmartFilterPanel.svelte';
	import FilterComparison from '$lib/components/FilterComparison.svelte';
	import FilterMigrationPanel from '$lib/components/FilterMigrationPanel.svelte';
	import type { Topic } from '$lib/types';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let selectedTopic: Topic | null = null;
	let currentView: 'trends' | 'search' | 'smart-filter' = 'trends';
	let language = 'en'; // Could be derived from user settings
	let sampleStories: any[] = [];

	onMount(() => {
		// Check if there's a topic in the URL after component mounts
		const topicId = $page.url.searchParams.get('topic');
		if (topicId && !selectedTopic) {
			// Load topic details if needed
			loadTopicFromUrl(topicId);
		}
	});

	async function loadTopicFromUrl(topicId: string) {
		try {
			const response = await fetch(`/api/topics?lang=${language}`);
			const topics = await response.json();
			const topic = topics.find((t: Topic) => t.id === topicId);
			if (topic) {
				selectedTopic = topic;
			}
		} catch (error) {
			console.error('Failed to load topic from URL:', error);
		}
	}

	function handleTopicSelected(event: CustomEvent<{ topic: Topic }>) {
		selectedTopic = event.detail.topic;
		// Update URL without page reload
		goto(`/topics?topic=${selectedTopic.id}`, { replaceState: true });
	}

	function goBack() {
		selectedTopic = null;
		goto('/topics', { replaceState: true });
	}

	function switchView(view: 'trends' | 'search' | 'smart-filter') {
		currentView = view;
	}
</script>

<svelte:head>
	<title>{selectedTopic ? `${selectedTopic.name} - Topic Feed` : 'Topic Feeds'} | Kite</title>
	<meta name="description" content={selectedTopic ? 
		`All news articles about ${selectedTopic.name}. ${selectedTopic.description || ''}` : 
		'Explore news by topic. Find all articles about specific subjects like AI, climate change, and more.'
	} />
</svelte:head>

<!-- Use Kite's main layout structure -->
<main class="pb-[56px] md:pb-0">
	<div class="container mx-auto max-w-[732px] px-4 py-8">
		{#if selectedTopic}
			<!-- Back button with Kite styling -->
			<div class="mb-6">
				<button 
					class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
					onclick={goBack}
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
					</svg>
					Back to Topics
				</button>
			</div>
			<TopicFeed topicId={selectedTopic.id} {language} />
		{:else}
			<!-- Topic discovery interface with Kite styling -->
			<header class="text-center mb-8">
				<h1 class="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
					Explore News by Topic
				</h1>
				<p class="text-base md:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
					Discover all past articles about specific subjects that interest you
				</p>
			</header>
			
			<!-- Navigation Tabs with Kite styling -->
			<div class="flex justify-center mb-8">
				<div class="inline-flex bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-300 dark:border-gray-600">
					<button 
						class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors {currentView === 'trends' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}"
						onclick={() => switchView('trends')}
					>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polyline points="22,6 13.5,15.5 8.5,10.5 2,17"></polyline>
							<polyline points="16,6 22,6 22,12"></polyline>
						</svg>
						Trends
					</button>
					<button 
						class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors {currentView === 'search' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}"
						onclick={() => switchView('search')}
					>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="11" cy="11" r="8"></circle>
							<path d="m21 21-4.35-4.35"></path>
						</svg>
						Search
					</button>
					<button 
						class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors {currentView === 'smart-filter' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}"
						onclick={() => switchView('smart-filter')}
					>
						🤖
						Smart Filter Demo
					</button>
				</div>
			</div>

			<!-- Content based on current view -->
			{#if currentView === 'trends'}
				<TopicTrends {language} on:topicSelected={handleTopicSelected} />
			{:else if currentView === 'search'}
				<TopicSearch {language} on:topicSelected={handleTopicSelected} />
			{:else if currentView === 'smart-filter'}
				<!-- Smart Filter Demo Section -->
				<div class="space-y-8">
					<!-- Introduction -->
					<div class="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
						<h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
							🚀 Smart Algorithmic Filtering
							<span class="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-medium rounded-full">
								NEW
							</span>
						</h2>
						<p class="text-gray-700 dark:text-gray-300 mb-4">
							Experience the future of content filtering! Our smart algorithms replace massive keyword lists with intelligent content analysis.
						</p>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
							<div>
								<h3 class="font-semibold text-green-600 dark:text-green-400 mb-2">✅ Smart Algorithm Benefits:</h3>
								<ul class="space-y-1 text-gray-600 dark:text-gray-400">
									<li>• Context-aware filtering</li>
									<li>• Quality and credibility scoring</li>
									<li>• Sentiment analysis</li>
									<li>• Automatic topic detection</li>
									<li>• Minimal false positives</li>
								</ul>
							</div>
							<div>
								<h3 class="font-semibold text-red-600 dark:text-red-400 mb-2">❌ Old Keyword Problems:</h3>
								<ul class="space-y-1 text-gray-600 dark:text-gray-400">
									<li>• 1600+ lines of keywords</li>
									<li>• Blocks legitimate news</li>
									<li>• Misses low-quality content</li>
									<li>• Constant maintenance needed</li>
									<li>• High false positive rate</li>
								</ul>
							</div>
						</div>
					</div>

					<!-- Migration Panel -->
					<FilterMigrationPanel />

					<!-- Smart Filter Panel Demo -->
					<SmartFilterPanel stories={sampleStories} />

					<!-- Algorithm vs Keywords Comparison -->
					<FilterComparison stories={sampleStories} />

					<!-- Implementation Guide -->
					<div class="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
						<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
							🛠️ Implementation Guide
						</h3>
						<div class="space-y-4 text-sm text-gray-600 dark:text-gray-400">
							<div>
								<h4 class="font-medium text-gray-900 dark:text-white mb-2">1. Topic Extraction Algorithm</h4>
								<p>Uses TF-IDF, Named Entity Recognition, and burst detection to automatically discover trending topics without predefined lists.</p>
							</div>
							<div>
								<h4 class="font-medium text-gray-900 dark:text-white mb-2">2. Smart Content Filtering</h4>
								<p>Analyzes content quality, sentiment, and source credibility using pattern recognition instead of keyword matching.</p>
							</div>
							<div>
								<h4 class="font-medium text-gray-900 dark:text-white mb-2">3. Adaptive Learning</h4>
								<p>The system learns from content patterns and user preferences to improve filtering accuracy over time.</p>
							</div>
						</div>
						<div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
							<p class="text-sm text-blue-800 dark:text-blue-200">
								<strong>Result:</strong> Replace your 1600+ line keyword files with intelligent algorithms that provide better filtering with less maintenance.
							</p>
						</div>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</main>

