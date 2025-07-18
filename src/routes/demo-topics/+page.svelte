<script lang="ts">
	import TopicTrends from '$lib/components/TopicTrends.svelte';
	import TopicFeed from '$lib/components/TopicFeed.svelte';
	import type { Topic } from '$lib/types';

	let selectedTopic: Topic | null = null;
	let language = 'en';

	function handleTopicSelected(event: CustomEvent<{ topic: Topic }>) {
		selectedTopic = event.detail.topic;
	}

	function goBack() {
		selectedTopic = null;
	}
</script>

<svelte:head>
	<title>{selectedTopic ? `${selectedTopic.name} - Topic Feed` : 'Topic Trends Demo'} | Kite</title>
</svelte:head>

<main class="demo-page">
	{#if selectedTopic}
		<div class="topic-feed-container">
			<button class="back-button" on:click={goBack}>
				← Back to Trends
			</button>
			<TopicFeed topicId={selectedTopic.id} {language} />
		</div>
	{:else}
		<div class="trends-container">
			<header class="demo-header">
				<h1>📈 Topic Trends Demo</h1>
				<p>Click on any topic to see all articles mentioning it</p>
			</header>
			<TopicTrends {language} on:topicSelected={handleTopicSelected} />
		</div>
	{/if}
</main>

<style>
	.demo-page {
		min-height: 100vh;
		background: #fafafa;
	}

	.trends-container {
		padding: 2rem 0;
	}

	.demo-header {
		text-align: center;
		margin-bottom: 3rem;
		padding: 0 2rem;
	}

	.demo-header h1 {
		font-size: 2.5rem;
		color: #333;
		margin-bottom: 1rem;
	}

	.demo-header p {
		font-size: 1.1rem;
		color: #666;
		max-width: 500px;
		margin: 0 auto;
	}

	.topic-feed-container {
		background: #fff;
		min-height: 100vh;
	}

	.back-button {
		background: #1976d2;
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 1rem;
		margin: 2rem;
		transition: background-color 0.3s ease;
	}

	.back-button:hover {
		background: #1565c0;
	}

	@media (max-width: 768px) {
		.demo-header h1 {
			font-size: 2rem;
		}

		.demo-header p {
			font-size: 1rem;
		}

		.back-button {
			margin: 1rem;
		}
	}
</style>