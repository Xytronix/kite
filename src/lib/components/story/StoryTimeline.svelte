<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import CitationText from './CitationText.svelte';
import SourceTooltip from './SourceTooltip.svelte';
import { replaceWithNumberedCitations, type CitationMapping } from '$lib/utils/citationContext';
import { aggregateCitationsFromTexts } from '$lib/utils/citationAggregator';
import { parseTimelineEvent } from '$lib/utils/textParsing';
import type { Article } from '$lib/types';
import Icon from '@iconify/svelte';
import { getSectionIcon } from '$lib/constants/sections';

// Props
interface Props {
	timeline: Array<any>; // Can be objects with date/description or strings with "::" separator
	articles?: Article[];
	citationMapping?: CitationMapping;
}

let { timeline, articles = [], citationMapping }: Props = $props();

// Shared tooltip reference
let citationTooltip = $state<SourceTooltip | undefined>();

// Parse timeline events once and prepare display data
const timelineData = $derived.by(() => {
	// First, parse all timeline events to get structured data
	const parsedEvents = timeline.map(event => parseTimelineEvent(event));
	
	// For citation aggregation, we need to convert domain citations to numbered format first
	// This is because timeline data may still have [domain#n] format
	let processedDescriptions = parsedEvents.map(event => event.description);
	
	// If we have citation mapping, convert domain citations to numbered ones for aggregation
	if (citationMapping) {
		processedDescriptions = processedDescriptions.map(desc => 
			replaceWithNumberedCitations(desc, citationMapping)
		);
	}
	
	// Get all cited articles from the processed descriptions
	const citedArticles = aggregateCitationsFromTexts(processedDescriptions, citationMapping, articles);
	
	// Now create display events with numbered citations
	const displayEvents = parsedEvents.map(event => {
		if (citationMapping && event.description) {
			return {
				...event,
				description: replaceWithNumberedCitations(event.description, citationMapping)
			};
		}
		return event;
	});
	
	return {
		displayEvents,
		citedArticles
	};
});
</script>

<section class="mt-6">
	<h3 class="mb-2 flex items-center gap-2 text-xl font-semibold text-gray-800 dark:text-gray-200">
		<Icon icon={getSectionIcon('timeline')} class="h-5 w-5 text-gray-500 dark:text-gray-400" />
		<span>{s('section.timeline') || 'Timeline'}</span>
	</h3>
    <div class="timeline">
		{#each timelineData.displayEvents as event, index}
			<div class="timeline-item">
				<div class="timeline-marker">
					<div class="timeline-dot">
						{index + 1}
					</div>
				</div>
				<div class="timeline-content">
					{#if event.date}
						<div class="timeline-date">
							{event.date}
						</div>
					{/if}
					<div class="timeline-description">
                        <CitationText 
							text={event.description} 
							showFavicons={false} 
							showNumbers={false} 
							inline={true} 
                            articles={timelineData.citedArticles.citedArticles} 
                            allArticles={articles}
							{citationMapping}
							citationTooltip={citationTooltip}
						/>
					</div>
				</div>
			</div>
		{/each}
	</div>
</section>

<!-- Shared Source Tooltip -->
<SourceTooltip 
	bind:this={citationTooltip} 
	articles={timelineData.citedArticles.citedArticles} 
	citationNumbers={timelineData.citedArticles.citedNumbers} 
	hasCommonKnowledge={timelineData.citedArticles.hasCommonKnowledge}
	citedItems={timelineData.citedArticles.citedItems}
	{citationMapping}
/>

<style>
	.timeline {
		position: relative;
		padding-left: 0;
	}

	.timeline-item {
		position: relative;
		display: flex;
		padding-bottom: 24px;
	}

	.timeline-item:last-child {
		padding-bottom: 0;
	}

	.timeline-marker {
		position: relative;
		flex-shrink: 0;
		width: 32px;
		height: 32px;
		margin-right: 16px;
	}

	.timeline-dot {
		width: 24px;
		height: 24px;
		background-color: var(--color-header);
		border-radius: 50%;
		position: absolute;
		top: 4px;
		left: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		font-weight: 600;
		color: white;
	}

	.timeline-marker::after {
		content: '';
		position: absolute;
		width: 2px;
		height: calc(100% + 48px);
		background-color: var(--color-header);
		left: 15px;
		top: 28px;
	}

	.timeline-item:last-child .timeline-marker::after {
		display: none;
	}

	.timeline-content {
		flex: 1;
		padding-top: 2px;
		min-height: 70px; /* Ensure consistent height whether date exists or not */
	}

	.timeline-date {
		font-weight: 600;
		margin-bottom: 4px;
		color: var(--color-header);
	}

	.timeline-description {
		color: var(--color-text-secondary);
		line-height: 1.5;
	}

	/* Dark mode styles */
	:global(.dark) .timeline-date {
		color: #e5e7eb;
	}

	:global(.dark) .timeline-description {
		color: #d1d5db;
	}
</style> 