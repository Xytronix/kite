<script lang="ts">
	import type { Topic } from '$lib/types';
	import { dataService } from '$lib/services/dataService';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	export let language: string = 'en';
	export let compact: boolean = false;
	export let showTrends: boolean = false;

	let trendingTopics: Topic[] = [];
	let loading = true;

	onMount(async () => {
		try {
			trendingTopics = await dataService.getTrendingTopics(compact ? 4 : 12, language);
		} catch (error) {
			console.error('Failed to load trending topics:', error);
		} finally {
			loading = false;
		}
	});

	function viewTopic(topic: Topic) {
		goto(`/topics?topic=${topic.id}`);
	}

	function viewAllTopics() {
		goto('/topics');
	}

	function toggleTrends() {
		showTrends = !showTrends;
	}
</script>

<div class="topic-browser" class:compact>
	<div class="header">
		<h3>
			{#if showTrends}
				📈 Topic Trends
			{:else}
				📊 Trending Topics
			{/if}
		</h3>
		<div class="header-actions">
			<button class="trends-btn" on:click={toggleTrends} title={showTrends ? 'Show list view' : 'Show trends view'}>
				{#if showTrends}
					📋
				{:else}
					📈
				{/if}
			</button>
			{#if !compact}
				<button class="view-all-btn" on:click={viewAllTopics}>
					View All Topics →
				</button>
			{/if}
		</div>
	</div>

	{#if loading}
		<div class="loading">
			<div class="skeleton-item"></div>
			<div class="skeleton-item"></div>
			<div class="skeleton-item"></div>
		</div>
	{:else if trendingTopics.length > 0}
		{#if showTrends}
			<!-- Trends Graph View -->
			<div class="trends-view">
				{#each trendingTopics as topic, index}
					{@const maxCount = Math.max(...trendingTopics.map(t => t.article_count || 0))}
					{@const barWidth = maxCount > 0 ? ((topic.article_count || 0) / maxCount) * 100 : 0}
					<button 
						class="trend-item"
						on:click={() => viewTopic(topic)}
						title={topic.description}
					>
						<div class="trend-info">
							<span class="trend-rank">#{index + 1}</span>
							<span class="trend-name">{topic.name}</span>
							<span class="trend-count">{topic.article_count || 0} mentions</span>
						</div>
						<div class="trend-bar">
							<div class="trend-fill" style="width: {barWidth}%"></div>
						</div>
					</button>
				{/each}
			</div>
		{:else}
			<!-- Regular List View -->
			<div class="topics-list">
				{#each trendingTopics as topic}
					<button 
						class="topic-item"
						on:click={() => viewTopic(topic)}
						title={topic.description}
					>
						<span class="topic-name">{topic.name}</span>
						{#if topic.article_count > 0}
							<span class="article-count">{topic.article_count}</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}

		{#if compact}
			<button class="view-all-compact" on:click={viewAllTopics}>
				Explore All Topics
			</button>
		{/if}
	{:else}
		<p class="no-topics">No trending topics available</p>
	{/if}
</div>

<style>
	.topic-browser {
		background: #fff;
		border-radius: 12px;
		padding: 1.5rem;
		border: 1px solid #eee;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
	}

	.topic-browser.compact {
		padding: 1rem;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.header h3 {
		margin: 0;
		font-size: 1.2rem;
		color: #333;
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.trends-btn {
		background: #f8f9fa;
		border: 1px solid #e9ecef;
		border-radius: 6px;
		padding: 0.4rem 0.6rem;
		cursor: pointer;
		font-size: 1rem;
		transition: all 0.3s ease;
	}

	.trends-btn:hover {
		background: #e9ecef;
		border-color: #1976d2;
	}

	.view-all-btn {
		background: none;
		border: none;
		color: #1976d2;
		cursor: pointer;
		font-size: 0.9rem;
		text-decoration: none;
		transition: color 0.3s ease;
	}

	.view-all-btn:hover {
		color: #1565c0;
		text-decoration: underline;
	}

	.loading {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.skeleton-item {
		height: 2rem;
		background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
		background-size: 200% 100%;
		animation: loading 1.5s infinite;
		border-radius: 4px;
	}

	@keyframes loading {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}

	.topics-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.topic-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background: #f8f9fa;
		border: 1px solid #e9ecef;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.3s ease;
		text-align: left;
		width: 100%;
	}

	.topic-item:hover {
		background: #e3f2fd;
		border-color: #1976d2;
		transform: translateY(-1px);
	}

	.topic-name {
		font-weight: 500;
		color: #333;
		font-size: 0.9rem;
	}

	.article-count {
		background: #1976d2;
		color: white;
		padding: 0.2rem 0.5rem;
		border-radius: 12px;
		font-size: 0.7rem;
		font-weight: 600;
	}

	.view-all-compact {
		width: 100%;
		margin-top: 1rem;
		padding: 0.75rem;
		background: #1976d2;
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-weight: 500;
		transition: background-color 0.3s ease;
	}

	.view-all-compact:hover {
		background: #1565c0;
	}

	.no-topics {
		color: #666;
		font-style: italic;
		text-align: center;
		margin: 1rem 0;
	}

	/* Compact mode adjustments */
	.topic-browser.compact .header h3 {
		font-size: 1rem;
	}

	.topic-browser.compact .topic-item {
		padding: 0.5rem 0.75rem;
	}

	.topic-browser.compact .topic-name {
		font-size: 0.8rem;
	}

	.topic-browser.compact .article-count {
		font-size: 0.6rem;
		padding: 0.1rem 0.4rem;
	}

	/* Trends View Styles */
	.trends-view {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.trend-item {
		display: flex;
		flex-direction: column;
		padding: 0.75rem;
		background: #f8f9fa;
		border: 1px solid #e9ecef;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.3s ease;
		text-align: left;
		width: 100%;
		gap: 0.5rem;
	}

	.trend-item:hover {
		background: #e3f2fd;
		border-color: #1976d2;
		transform: translateY(-1px);
	}

	.trend-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.trend-rank {
		font-weight: 700;
		color: #1976d2;
		font-size: 0.8rem;
		min-width: 2rem;
	}

	.trend-name {
		font-weight: 500;
		color: #333;
		font-size: 0.9rem;
		flex: 1;
	}

	.trend-count {
		font-size: 0.7rem;
		color: #666;
		font-weight: 500;
	}

	.trend-bar {
		height: 4px;
		background: #e9ecef;
		border-radius: 2px;
		overflow: hidden;
	}

	.trend-fill {
		height: 100%;
		background: linear-gradient(90deg, #1976d2, #42a5f5);
		border-radius: 2px;
		transition: width 0.5s ease;
	}

	/* Compact mode trends adjustments */
	.topic-browser.compact .trend-item {
		padding: 0.5rem;
	}

	.topic-browser.compact .trend-name {
		font-size: 0.8rem;
	}

	.topic-browser.compact .trend-count {
		font-size: 0.6rem;
	}
</style>