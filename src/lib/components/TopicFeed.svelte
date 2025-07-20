<script lang="ts">
	import type { TopicFeed } from '$lib/types';
	import type { Story } from '$lib/types';
	import { onMount } from 'svelte';
	import { topicService } from '$lib/services/topicService';
	import StoryCard from './story/StoryCard.svelte';
	import SmartFilterPanel from './SmartFilterPanel.svelte';
	import { smartContentFilter } from '$lib/stores/smartContentFilter.svelte';
	import { SmartFilterService } from '$lib/services/smartFilterService';
	import { settings } from '$lib/stores/settings.svelte.js';
	import { s } from '$lib/client/localization.svelte';

	interface Props {
	    topicId: string;
	    language?: string;
	}

	const {
	    topicId = $bindable(),
	    language = $bindable('en')
	}: Props = $props();

	let topicFeed = $state<TopicFeed | null>(null);
	let loading = $state(true);
	let loadingMore = $state(false);
	let error = $state<string | null>(null);
	let expandedStories = $state<Record<string, boolean>>({});
	let readStories = $state<Record<string, boolean>>({});
	let displayedStories = $state<Story[]>([]);
	let filteredStories = $state<Story[]>([]);
	// Use a local filter service to avoid side effects (stats updates) that could trigger circular reactivity
	const _localFilterService = new SmartFilterService();
	let currentPage = $state(0);
	let hasMoreStories = $state(true);
	// Stories per pagination chunk controlled by user settings
	let STORIES_PER_PAGE = settings.storyCount || 12;
	let fetchLimit = settings.storyCount || 12;

	// Reactively update when settings change
	$effect(() => {
	    STORIES_PER_PAGE = settings.storyCount || 12;
	    fetchLimit = settings.storyCount || 12;
	});
	// biome-ignore lint/style/useConst: This variable is reassigned in click handlers
	let showSmartFilter = $state(false);

	// Source overlay state (required by StoryCard)
	// biome-ignore lint/style/useConst: These variables are used in bind: directives
	let showSourceOverlay = $state(false);
	// biome-ignore lint/style/useConst: These variables are used in bind: directives
	let currentSource = $state<unknown>(null);
	// biome-ignore lint/style/useConst: These variables are used in bind: directives
	let sourceArticles = $state<unknown[]>([]);
	// biome-ignore lint/style/useConst: These variables are used in bind: directives
	let currentMediaInfo = $state<unknown>(null);
	// biome-ignore lint/style/useConst: These variables are used in bind: directives
	let isLoadingMediaInfo = $state(false);

	// Intersection observer for infinite scroll
	let loadMoreTrigger = $state<HTMLElement | null>(null);

	onMount(async () => {
		try {
			// Fetch up to the configured maximum number of stories
			topicFeed = await topicService.getTopicFeed(topicId, fetchLimit, language);
			if (topicFeed) {
				applySmartFiltering();
				loadInitialStories();
				setupInfiniteScroll();
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load topic feed';
		} finally {
			loading = false;
		}
	});

	// Apply smart filtering to stories
	function applySmartFiltering() {
		if (!topicFeed) return;
		
		if (smartContentFilter.isEnabled) {
			// Perform filtering locally to avoid updating global stats and causing reactive loops
			const filterResult = _localFilterService.filterStories(
				topicFeed.stories,
				smartContentFilter.preferences
			);
			filteredStories = filterResult.filtered;
		} else {
			filteredStories = topicFeed.stories;
		}
	}

	// Reactive filtering when smart filter settings change
	$effect(() => {
		if (topicFeed && smartContentFilter.isEnabled !== undefined) {
			applySmartFiltering();
			// Reset pagination when filtering changes
			currentPage = 0;
			displayedStories = [];
			loadInitialStories();
		}
	});

	function loadInitialStories() {
		if (filteredStories.length > 0) {
			displayedStories = filteredStories.slice(0, STORIES_PER_PAGE);
			currentPage = 1;
			hasMoreStories = filteredStories.length > STORIES_PER_PAGE;
		}
	}

	async function fetchMoreFromServer() {
		try {
			fetchLimit += STORIES_PER_PAGE;
			const moreFeed = await topicService.getTopicFeed(topicId, fetchLimit, language);
			if (moreFeed) {
				topicFeed = moreFeed;
				applySmartFiltering();
			}
		} catch (err) {
			console.error('Failed to fetch additional stories:', err);
		}
	}

	async function loadMoreStories() {
		if (!filteredStories || loadingMore || !hasMoreStories) return;
		
		loadingMore = true;

		const startIndex = currentPage * STORIES_PER_PAGE;
		const endIndex = startIndex + STORIES_PER_PAGE;

		// If we don't have enough preloaded stories, fetch more from server first
		if (endIndex > filteredStories.length) {
			await fetchMoreFromServer();
		}

		// After ensuring we have enough stories, slice and display
		const newStories = filteredStories.slice(startIndex, endIndex);

		if (newStories.length > 0) {
			displayedStories = [...displayedStories, ...newStories];
			currentPage++;
			hasMoreStories = endIndex < filteredStories.length;
		} else {
			hasMoreStories = false;
		}

		loadingMore = false;
	}

	function setupInfiniteScroll() {
		if (typeof IntersectionObserver !== 'undefined' && loadMoreTrigger) {
			const observer = new IntersectionObserver(
				(entries) => {
					if (entries[0].isIntersecting && hasMoreStories && !loadingMore) {
						loadMoreStories();
					}
				},
				{ threshold: 0.1 }
			);

			observer.observe(loadMoreTrigger);

			// Cleanup observer on component destroy
			return () => observer.disconnect();
		}
	}

	// Set up intersection observer when the trigger element is available
	$effect(() => {
		if (loadMoreTrigger && hasMoreStories) {
			setupInfiniteScroll();
		}
	});

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'numeric',
			day: 'numeric'
		});
	}

	function formatRelativeDate(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffTime = Math.abs(now.getTime() - date.getTime());
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays} days ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
		if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
		return `${Math.floor(diffDays / 365)} years ago`;
	}

	function handleStoryToggle(story: Story) {
		const storyId = story.cluster_number?.toString() || story.title;
		const newExpandedStories = { ...expandedStories };
		newExpandedStories[storyId] = !newExpandedStories[storyId];
		expandedStories = newExpandedStories; // Trigger reactivity
	}

	function handleReadToggle(story: Story) {
		const newReadStories = { ...readStories };
		newReadStories[story.title] = !newReadStories[story.title];
		readStories = newReadStories; // Trigger reactivity
	}

	// Calculate max count for frequency chart
	const maxCount = $derived.by(() => {
		return topicFeed?.mention_frequency?.daily ? 
			Math.max(...topicFeed.mention_frequency.daily.map(d => d.count)) : 0;
	});

	// Get dynamic color based on mention intensity
	function getIntensityColor(count: number, maxCount: number): string {
		if (maxCount === 0) return 'bg-gray-300 dark:bg-gray-600';
		const intensity = count / maxCount;
		if (intensity <= 0.2) return 'bg-blue-400 dark:bg-blue-500';
		if (intensity <= 0.4) return 'bg-green-400 dark:bg-green-500';
		if (intensity <= 0.6) return 'bg-yellow-400 dark:bg-yellow-500';
		if (intensity <= 0.8) return 'bg-orange-400 dark:bg-orange-500';
		return 'bg-red-400 dark:bg-red-500';
	}

	// Get trend description
	function getTrendDescription(trend: string): { text: string; color: string; icon: string } {
		switch (trend) {
			case 'up':
				return { text: 'Rising Interest', color: 'text-green-600 dark:text-green-400', icon: '📈' };
			case 'down':
				return { text: 'Declining Interest', color: 'text-red-600 dark:text-red-400', icon: '📉' };
			default:
				return { text: 'Stable Activity', color: 'text-blue-600 dark:text-blue-400', icon: '➡️' };
		}
	}
</script>

<!-- Enhanced Navigation Bar -->
<nav class="sticky top-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 mb-8">
	<div class="container mx-auto max-w-[732px] px-4 py-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4">
				<button 
					class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
					onclick={() => history.back()}
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
					</svg>
					Back
				</button>
				<div class="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
				<span class="text-sm font-medium text-gray-900 dark:text-white">Topic Feed</span>
			</div>
			
			<!-- Quick Navigation -->
			<div class="flex items-center gap-2">
				<a 
					href="/" 
					class="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
					title="Home"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
					</svg>
					Home
				</a>
				<a 
					href="/topics" 
					class="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-md"
					title="All Topics"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
					</svg>
					Topics
				</a>
				<a 
					href="/search" 
					class="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
					title="Search"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<circle cx="11" cy="11" r="8"></circle>
						<path d="m21 21-4.35-4.35"></path>
					</svg>
					Search
				</a>
			</div>
		</div>
	</div>
</nav>

<!-- Use Kite's container styling -->
<div class="container mx-auto max-w-[732px] px-4 py-8">
	{#if loading}
		<div class="flex flex-col items-center justify-center py-16">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
			<p class="text-gray-600 dark:text-gray-400">Loading topic feed...</p>
		</div>
	{:else if error}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
			<p class="text-red-800 dark:text-red-200">Error: {error}</p>
		</div>
	{:else if topicFeed}
		<!-- Topic Header - Kite style -->
		<header class="text-center mb-8">
			<div class="flex items-center justify-between mb-4">
				<div class="flex-1"></div>
				<h1 class="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
					{topicFeed.topic.name}
				</h1>
				<div class="flex-1 flex justify-end">
					<button
						class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
						onclick={() => showSmartFilter = !showSmartFilter}
						title="Smart Content Filter"
					>
						🤖 Filter
						{#if smartContentFilter.isEnabled}
							<span class="w-2 h-2 bg-green-500 rounded-full"></span>
						{/if}
					</button>
				</div>
			</div>
			{#if topicFeed.topic.description}
				<p class="text-base md:text-lg text-gray-600 dark:text-gray-400 mb-6">
					{topicFeed.topic.description}
				</p>
			{/if}
			<div class="flex flex-col sm:flex-row justify-center items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
				<span>
					<strong class="text-gray-900 dark:text-white">{filteredStories.length}</strong> 
					{#if smartContentFilter.isEnabled && filteredStories.length !== topicFeed.total_count}
						of {topicFeed.total_count}
					{/if}
					articles
					{#if smartContentFilter.isEnabled && filteredStories.length !== topicFeed.total_count}
						<span class="text-xs text-blue-600 dark:text-blue-400">(filtered)</span>
					{/if}
				</span>
				{#if topicFeed.total_count > 0}
					<span class="hidden sm:inline">•</span>
					<span>
						From {formatDate(topicFeed.date_range.earliest)} to {formatDate(topicFeed.date_range.latest)}
					</span>
				{/if}
			</div>
		</header>

		<!-- Smart Filter Panel -->
		{#if showSmartFilter}
			<div class="mb-8">
				<SmartFilterPanel stories={topicFeed.stories} />
			</div>
		{/if}

		<!-- Enhanced Activity Pulse Chart - World Temper Style -->
		{#if topicFeed.mention_frequency && topicFeed.mention_frequency.daily.length > 0}
			{@const trendInfo = getTrendDescription(topicFeed.mention_frequency.weekly_trend)}
			{@const weeklyTotal = topicFeed.mention_frequency.daily.slice(-7).reduce((sum, day) => sum + day.count, 0)}
			{@const previousWeekTotal = topicFeed.mention_frequency.daily.slice(-14, -7).reduce((sum, day) => sum + day.count, 0)}
			{@const changePercent = previousWeekTotal > 0 ? ((weeklyTotal - previousWeekTotal) / previousWeekTotal * 100) : 0}
			<section class="mb-8">
				<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
					🌡️ Activity Pulse
				</h2>
				<div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
					<!-- Chart Area -->
					<div class="relative mb-6">
						<!-- Chart container with proper spacing -->
						<div class="flex items-end justify-center h-32 gap-1 mb-4 px-2">
							{#each topicFeed.mention_frequency.daily.slice(-14) as day, index}
								{@const barHeight = maxCount > 0 ? Math.max((day.count / maxCount) * 100, 2) : 2}
								{@const colorClass = getIntensityColor(day.count, maxCount)}
								{@const isWeekend = new Date(day.date).getDay() === 0 || new Date(day.date).getDay() === 6}
								<div class="flex flex-col items-center group relative" style="width: 24px;">
									<!-- Bar -->
									<div 
										class="w-full {colorClass} rounded-t-md transition-all duration-300 hover:opacity-80 relative"
										class:ring-1={isWeekend}
										class:ring-gray-400={isWeekend}
										class:dark:ring-gray-500={isWeekend}
										style="height: {barHeight}%; min-height: 4px;"
										title="{new Date(day.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}: {day.count} mentions"
									>
										<!-- Value label on hover -->
										<div class="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
											{day.count}
										</div>
									</div>
									
									<!-- Date label -->
									<span class="text-xs text-gray-400 dark:text-gray-500 mt-1 transform -rotate-45 origin-center whitespace-nowrap">
										{new Date(day.date).getDate()}
									</span>
								</div>
							{/each}
						</div>
						
						<!-- X-axis labels -->
						<div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 px-2">
							<span>2 weeks ago</span>
							<span>1 week ago</span>
							<span>Today</span>
						</div>
					</div>

					<!-- Enhanced Trend Analysis -->
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div class="flex items-center gap-3">
							<span class="text-3xl animate-bounce">{trendInfo.icon}</span>
							<div>
								<p class="text-sm font-bold {trendInfo.color}">
									{trendInfo.text}
								</p>
								<p class="text-xs text-gray-500 dark:text-gray-400">
									{changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}% vs last week
								</p>
							</div>
						</div>
						
						<div class="text-center">
							<p class="text-2xl font-bold text-gray-900 dark:text-white">
								{weeklyTotal}
							</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								mentions this week
							</p>
						</div>
						
						<div class="text-center md:text-right">
							<p class="text-lg font-semibold text-gray-700 dark:text-gray-300">
								{Math.round(weeklyTotal / 7)} avg/day
							</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								daily average
							</p>
						</div>
					</div>
				</div>
			</section>
		{/if}

		<!-- Stories Section - Use Kite's StoryCard components with pagination -->
		{#if displayedStories.length > 0}
			<section class="mb-8">
				<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">
					Recent Stories
					<span class="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
						({displayedStories.length} of {filteredStories.length})
					</span>
				</h2>
				<div class="space-y-6">
					{#each displayedStories as story, index}
						<div data-story-id="{story.cluster_number?.toString() || story.title}">
							<StoryCard 
								{story}
								storyIndex={index}
								categoryId="topics"
								isRead={readStories[story.title] || false}
								isExpanded={expandedStories[story.cluster_number?.toString() || story.title] || false}
								onToggle={() => handleStoryToggle(story)}
								onReadToggle={() => handleReadToggle(story)}
								priority={index < 3}
								bind:showSourceOverlay
								bind:currentSource
								bind:sourceArticles
								bind:currentMediaInfo
								bind:isLoadingMediaInfo
							/>
						</div>
					{/each}
				</div>

				<!-- Infinite scroll trigger -->
				{#if hasMoreStories}
					<div bind:this={loadMoreTrigger} class="flex justify-center py-8">
						{#if loadingMore}
							<div class="flex items-center gap-3">
								<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 dark:border-blue-400"></div>
								<span class="text-gray-600 dark:text-gray-400">Loading more stories...</span>
							</div>
						{:else}
							<button 
								class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
								onclick={loadMoreStories}
							>
								Load More Stories
							</button>
						{/if}
					</div>
				{/if}
			</section>
		{/if}

		{#if topicFeed.stories.length === 0}
			<div class="text-center py-12">
				<div class="text-6xl mb-4">📰</div>
				<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
					No recent stories found
				</h3>
				<p class="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
					We haven't found any recent news stories specifically mentioning {topicFeed.topic.name}. 
					This could mean there hasn't been much news about this topic recently.
				</p>
			</div>
		{/if}
	{/if}
</div>