<script lang="ts">
/**
 * Example component showing how to integrate Wikipedia tooltips with content
 * This can be used as a reference for integrating with story components
 */

import { onMount, onDestroy } from 'svelte';
import { browser } from '$app/environment';
import WikipediaTooltip from './WikipediaTooltip.svelte';
import { initializeWikipediaIntegration } from '$lib/utils/wikipediaIntegration.js';

interface Props {
  content: string;
  enableAutoLinking?: boolean;
}

let { content, enableAutoLinking = true }: Props = $props();

// Elements
let contentContainer: HTMLElement;
let tooltipComponent: WikipediaTooltip;

// Wikipedia integration
let wikipediaIntegration: ReturnType<typeof initializeWikipediaIntegration> | null = null;

// Initialize Wikipedia integration
function initializeWikipedia() {
  if (!tooltipComponent || !browser) return;

  wikipediaIntegration = initializeWikipediaIntegration(
    tooltipComponent,
    {
      handleWikipediaInteraction: tooltipComponent.handleWikipediaInteraction,
      handleWikipediaLeave: tooltipComponent.handleWikipediaLeave
    },
    {
      enableAutoLinking,
      enableTooltips: true,
      autoLinkOnMount: true
    }
  );
}

// Process content when it changes
async function processContent() {
  if (!contentContainer || !wikipediaIntegration) return;
  
  await wikipediaIntegration.processContent(contentContainer);
}

// Handle content updates
$effect(() => {
  if (content && contentContainer && wikipediaIntegration) {
    // Small delay to ensure DOM is updated
    setTimeout(() => {
      processContent();
    }, 10);
  }
});

onMount(() => {
  if (browser) {
    initializeWikipedia();
    
    // Process initial content
    if (contentContainer) {
      setTimeout(() => {
        processContent();
      }, 100);
    }
  }
});

onDestroy(() => {
  wikipediaIntegration?.cleanup();
});
</script>

<div bind:this={contentContainer} class="wikipedia-integrated-content">
  {@html content}
</div>

<!-- Wikipedia Tooltip Component -->
<WikipediaTooltip 
  bind:this={tooltipComponent}
  onWikipediaClick={(title, content, imageUrl, wikiUrl) => {
    // Handle Wikipedia popup if needed
    console.log('Wikipedia clicked:', { title, content, imageUrl, wikiUrl });
  }}
  onWikipediaContentFound={(wikiId, wikiUrl, title) => {
    // Handle Wikipedia content found if needed
    console.log('Wikipedia content found:', { wikiId, wikiUrl, title });
  }}
/>

<style>
  .wikipedia-integrated-content :global([data-wiki-id]) {
    color: rgb(37 99 235); /* text-blue-600 */
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 2px;
  }
  
  .wikipedia-integrated-content :global([data-wiki-id]:hover) {
    color: rgb(30 64 175); /* text-blue-800 */
    background-color: rgb(239 246 255); /* bg-blue-50 */
  }
  
  :global(.dark) .wikipedia-integrated-content :global([data-wiki-id]) {
    color: rgb(96 165 250); /* text-blue-400 */
  }
  
  :global(.dark) .wikipedia-integrated-content :global([data-wiki-id]:hover) {
    color: rgb(147 197 253); /* text-blue-300 */
    background-color: rgba(30 58 138 / 0.2); /* bg-blue-900/20 */
  }
</style>