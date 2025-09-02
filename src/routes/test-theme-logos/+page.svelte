<script lang="ts">
  import { onMount } from 'svelte';
  
  let testUrls: string[] = [];
  
  onMount(async () => {
    // Import getFaviconUrlSync to test theme-aware URLs
    const { getFaviconUrlSync } = await import('$lib/utils/citationUtils');
    
    const testDomains = [
      'github.com',
      'stackoverflow.com', 
      'medium.com',
      'twitter.com',
      'discord.com'
    ];
    
    testUrls = testDomains.map(domain => getFaviconUrlSync(domain, 64));
  });
</script>

<div class="p-8">
  <h1 class="text-2xl font-bold mb-6">Theme-Aware Logo Test</h1>
  
  <div class="mb-6">
    <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
      These logos should automatically adjust for optimal visibility on your current theme.
      Toggle between light/dark mode to see the difference!
    </p>
  </div>
  
  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
    {#each testUrls as url, i}
      <div class="text-center">
        <div class="w-16 h-16 mx-auto mb-2 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
          <img src={url} alt="Logo" class="w-12 h-12 object-contain" />
        </div>
        <p class="text-xs text-gray-500 break-all">{url.split('?')[0].replace('https://img.logo.dev/', '')}</p>
      </div>
    {/each}
  </div>
  
  <div class="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
    <h2 class="font-semibold mb-2">URL Examples:</h2>
    <div class="space-y-1 text-xs font-mono text-gray-600 dark:text-gray-400">
      {#each testUrls.slice(0, 2) as url}
        <div class="break-all">{url}</div>
      {/each}
    </div>
  </div>
</div>
