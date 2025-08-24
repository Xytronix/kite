<script lang="ts">
import { getTimeAgo } from '$lib/utils/getTimeAgo';
import { s } from '$lib/client/localization.svelte';
import type { Article } from '$lib/types';
import SmartImage from '../SmartImage.svelte';

interface Props {
	item: { article: Article | null; number: number; isCommon?: boolean };
	highlightedNumber?: number;
	isMobile?: boolean;
	showCitationNumber?: boolean;
	maxCitationNumber?: number; // The highest citation number in the current set
}

let { item, highlightedNumber, isMobile = false, showCitationNumber = true, maxCitationNumber = 0 }: Props = $props();

const isHighlighted = $derived(
	item.isCommon ? highlightedNumber === -1 : highlightedNumber === item.number
);

const badgeClasses = $derived(
    isHighlighted
        ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white'
        : item.isCommon
        ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
        : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
);

const containerClasses = $derived(
    isHighlighted
        ? 'rounded-md ring-1 ring-blue-400/40 dark:ring-blue-300/40 bg-blue-500/5 dark:bg-blue-400/10 transition-colors'
        : ''
);

const paddingClasses = $derived(isMobile ? 'px-2 py-1' : 'px-1.5 py-0.5');
const textSizeClasses = $derived(isMobile ? '' : 'text-xs');
const iconSizeClasses = $derived(isMobile ? 'h-6 w-6' : 'h-4 w-4');
// Consistent spacing between icon and text regardless of citation number digits
const iconTextSpacing = $derived(() => {
	if (isMobile) return 'space-x-2'; // Mobile stays the same
	return 'space-x-1.5'; // Desktop: consistent spacing for all citations
});
// Calculate margin to align with content, accounting for citation number slot width
const marginClasses = $derived(() => {
 const baseMargin = isMobile ? 'mb-4' : 'mb-2';
 const hasDoubleDigits = maxCitationNumber >= 10;
 // Align link/time block directly under the domain text column
 const leftMargin = hasDoubleDigits ? 'ml-16' : 'ml-12'; // 4rem vs 3rem
 return `${leftMargin} ${baseMargin}`;
});
const linkClasses = $derived(isMobile ? 'font-medium' : 'text-xs'); // allow full line wrapping
const dateClasses = $derived(isMobile ? 'mt-1' : 'mt-0.5 text-xs');
</script>

{#if item.isCommon}
	<!-- Common knowledge citation -->
	<div class="citation-row grid gap-x-2 items-start {textSizeClasses} {containerClasses} {maxCitationNumber >= 10 ? 'double-digit' : ''}" 
		data-citation-number="-1">
		<div class="citation-number-slot flex-shrink-0 {maxCitationNumber >= 10 ? 'citation-number-slot-wide' : ''}">
			<span class="citation-number-badge rounded {paddingClasses} font-medium leading-none {badgeClasses}">
				[*]
			</span>
		</div>
		<div class="flex-1">
			<div class="font-medium text-gray-700 dark:text-gray-300 {isMobile ? 'mb-2' : 'mb-1'}">
				{s('citation.commonKnowledge.title') || 'Common Knowledge'}
			</div>
			<div class="text-gray-600 dark:text-gray-400 {isMobile ? 'leading-relaxed' : 'text-xs leading-relaxed'}">
				{s('citation.commonKnowledge.description') || 'This information is common knowledge not pulled from a specific news source, but is included for context and completeness of the story.'}
			</div>
		</div>
	</div>
{:else if item.article}
	<!-- Regular article citation -->
<div class="citation-row grid gap-x-2 {textSizeClasses} {containerClasses} {maxCitationNumber >= 10 ? 'double-digit' : ''}" data-citation-number={item.number}>
  <!-- Column 1 – badge -->
  <div class="citation-number-slot flex-shrink-0 {maxCitationNumber >= 10 ? 'citation-number-slot-wide' : ''}">
    {#if showCitationNumber}
      <span class="citation-number-badge rounded {paddingClasses} font-medium leading-none {badgeClasses}">[{item.number}]</span>
    {/if}
  </div>

  <!-- Column 2 – content -->
  <div class="flex flex-col gap-y-1 min-w-0">
    <!-- first line: favicon + domain   |   time -->
    <div class="flex items-center justify-between min-w-0">
      <div class="flex items-center {iconTextSpacing()} min-w-0">
        <SmartImage
          domain={item.article.domain}
          alt="{item.article.domain} favicon"
          class="{iconSizeClasses} rounded-full flex-shrink-0"
          size={isMobile ? 24 : 16}
          loading="eager"
          preferIconify={true}
          addBackground={true}
        />
        <span class="font-medium text-gray-700 dark:text-gray-300 truncate leading-none ml-1">
          {item.article.domain}
        </span>
      </div>
      {#if item.article.date}
        <div class="text-gray-500 dark:text-gray-400 {dateClasses} flex-shrink-0 ml-2 whitespace-nowrap">
          {getTimeAgo(item.article.date)}
        </div>
      {/if}
    </div>

    <!-- second line: headline link -->
    <a
      href={item.article.link}
      target="_blank"
      rel="noopener noreferrer"
      class="text-blue-600 dark:text-blue-400 hover:underline {linkClasses}"
      title={item.article.title}
    >
      {item.article.title}
    </a>
  </div>
</div>
{/if}

<style>
.line-clamp-2 {
	display: -webkit-box;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.citation-number-slot {
	/* Fixed width for single digits - ensures alignment */
	width: 2.5rem;
	margin-left: -0.25rem; /* shift badge 4px left */
	display: flex;
	align-items: center;
	justify-content: center;
}

.citation-number-slot-wide {
	/* Fixed width for double digits - ensures alignment */
	width: 3.5rem;
}
.citation-row {
	grid-template-columns: 2.5rem 1fr;
}
.double-digit .citation-row {
	grid-template-columns: 3.5rem 1fr;
}
</style>