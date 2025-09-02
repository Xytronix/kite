<script>
  import SmartImage from '$lib/components/SmartImage.svelte';
  
  const testDomains = [
    'nytimes.com',
    'bbc.com',
    'cnn.com',
    'reuters.com',
    'techcrunch.com',
    'github.com',
    'wikipedia.org',
    'reddit.com',
    'invalid-domain-test.xyz'
  ];
</script>

<div class="p-8">
  <h1 class="text-2xl font-bold mb-6">Icon Test Page</h1>
  
  <section class="mb-8">
    <h2 class="text-xl font-semibold mb-4">With Circular Background (addBackground=true)</h2>
    <div class="flex flex-wrap gap-4">
      {#each testDomains as domain}
        <div class="flex flex-col items-center gap-2">
          <SmartImage
            {domain}
            alt="{domain} icon"
            class="w-12 h-12"
            size={48}
            loading="eager"
            preferIconify={true}
            addBackground={true}
          />
          <span class="text-xs text-gray-600 dark:text-gray-400">{domain}</span>
        </div>
      {/each}
    </div>
  </section>

  <section class="mb-8">
    <h2 class="text-xl font-semibold mb-4">Without Background (addBackground=false)</h2>
    <div class="flex flex-wrap gap-4">
      {#each testDomains as domain}
        <div class="flex flex-col items-center gap-2">
          <SmartImage
            {domain}
            alt="{domain} icon"
            class="w-12 h-12"
            size={48}
            loading="eager"
            preferIconify={false}
            addBackground={false}
          />
          <span class="text-xs text-gray-600 dark:text-gray-400">{domain}</span>
        </div>
      {/each}
    </div>
  </section>

  <section class="mb-8">
    <h2 class="text-xl font-semibold mb-4">Different Sizes with Background</h2>
    <div class="flex flex-wrap items-end gap-4">
      {#each [16, 24, 32, 48, 64] as size}
        <div class="flex flex-col items-center gap-2">
          <SmartImage
            domain="github.com"
            alt="GitHub icon"
            class="w-{size/4} h-{size/4}"
            {size}
            loading="eager"
            preferIconify={true}
            addBackground={true}
          />
          <span class="text-xs text-gray-600 dark:text-gray-400">{size}px</span>
        </div>
      {/each}
    </div>
  </section>
</div>
