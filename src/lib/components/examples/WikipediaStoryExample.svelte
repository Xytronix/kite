<script lang="ts">
/**
 * Example showing Wikipedia integration in a story-like component
 * This demonstrates how to add Wikipedia tooltips to story content
 */

import { onMount } from 'svelte';
import { browser } from '$app/environment';
import WikipediaTooltip from '../WikipediaTooltip.svelte';
import { initializeWikipediaIntegration } from '$lib/utils/wikipediaIntegration.js';

// Example story content with entities that should be auto-linked
const exampleContent = `
Albert Einstein was a German-born theoretical physicist who developed the theory of relativity. 
He was born in Ulm, Germany, and later moved to Princeton, New Jersey. His work on quantum mechanics 
and the photoelectric effect earned him the Nobel Prize in Physics in 1921.

Einstein's famous equation E=mc² revolutionized our understanding of mass and energy. 
He spent his later years at Princeton University, where he worked on unified field theory.
`;

// Elements
let contentContainer: HTMLElement;
let wikipediaTooltip: WikipediaTooltip;
let wikipediaIntegration: ReturnType<typeof initializeWikipediaIntegration> | null = null;

onMount(() => {
  if (browser && wikipediaTooltip) {
    // Initialize Wikipedia integration
    wikipediaIntegration = initializeWikipediaIntegration(
      wikipediaTooltip,
      {
        handleWikipediaInteraction: wikipediaTooltip.handleWikipediaInteraction,
        handleWikipediaLeave: wikipediaTooltip.handleWikipediaLeave
      },
      {
        enableAutoLinking: true,
        enableTooltips: true
      }
    );

    // Process the content for auto-linking
    if (contentContainer) {
      setTimeout(() => {
        wikipediaIntegration?.processContent(contentContainer);
      }, 100);
    }
  }
});
</script>

<div class="max-w-2xl mx-auto p-6">
  <h1 class="text-2xl font-bold mb-4">Wikipedia Integration Example</h1>
  
  <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4">
    <p class="text-sm text-gray-600 dark:text-gray-400">
      This example shows how Wikipedia auto-linking works. Hover over the linked entities 
      (like "Albert Einstein", "Germany", "Princeton University") to see Wikipedia tooltips.
    </p>
  </div>

  <div bind:this={contentContainer} class="prose dark:prose-invert">
    {#each exampleContent.trim().split('\n\n') as paragraph}
      <p class="mb-4">{paragraph.trim()}</p>
    {/each}
  </div>

  <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
    <h3 class="font-semibold mb-2">How it works:</h3>
    <ul class="text-sm space-y-1">
      <li>• Entities are automatically detected using Wikidata</li>
      <li>• Hover (desktop) or tap (mobile) to see Wikipedia summaries</li>
      <li>• Links are styled with dotted underlines</li>
      <li>• Tooltips show images, summaries, and links to full articles</li>
    </ul>
  </div>
</div>

<!-- Wikipedia Tooltip Component -->
<WikipediaTooltip 
  bind:this={wikipediaTooltip}
  onWikipediaClick={(title, content, imageUrl, wikiUrl) => {
    console.log('Wikipedia article clicked:', { title, wikiUrl });
  }}
  onWikipediaContentFound={(wikiId, wikiUrl, title) => {
    console.log('Wikipedia content found:', { wikiId, title });
  }}
/>

<style>
  /* Custom styling for Wikipedia links in this example */
  :global(.prose [data-wiki-id]) {
    color: rgb(37 99 235); /* text-blue-600 */
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 3px;
    text-decoration-thickness: 1px;
    transition: all 0.2s ease;
  }
  
  :global(.prose [data-wiki-id]:hover) {
    color: rgb(30 64 175); /* text-blue-800 */
    background-color: rgb(219 234 254); /* bg-blue-100 */
    padding-left: 0.25rem; /* px-1 */
    padding-right: 0.25rem; /* px-1 */
    border-radius: 0.25rem; /* rounded */
    text-decoration-style: solid;
  }
  
  :global(.dark .prose [data-wiki-id]) {
    color: rgb(96 165 250); /* text-blue-400 */
  }
  
  :global(.dark .prose [data-wiki-id]:hover) {
    color: rgb(147 197 253); /* text-blue-300 */
    background-color: rgba(30 58 138 / 0.3); /* bg-blue-900/30 */
  }
</style>