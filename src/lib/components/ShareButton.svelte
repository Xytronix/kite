<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import { generateShareUrl, slugify } from '$lib/utils/urlShortener';
  import Icon from '@iconify/svelte';
  import { s } from '$lib/client/localization.svelte';
  import { useFloating, offset, flip, shift } from '@skeletonlabs/floating-ui-svelte';
  import Portal from 'svelte-portal';
  import { onMount, onDestroy } from 'svelte';
  
  interface Props {
    title?: string;
    description?: string;
    batchId?: string | null;
    categoryId?: string | null;
    storyIndex?: number | null;
    dataLang?: string | null;
    topicId?: string | null;
    class?: string;
  }
  
  const { 
    title = s('article.shareDefaultTitle') || 'Check out this story',
    description = '',
    batchId,
    categoryId, 
    storyIndex,
    dataLang,
    topicId,
    class: className = ''
  }: Props = $props();
  
  let showCopiedFeedback = $state(false);
  let isLoading = $state(false);
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  
  // Floating UI setup for the "Copied!" tooltip
  const floating = useFloating({
    placement: 'left',
    strategy: 'fixed',
    middleware: [
      offset(8), // 8px gap from button
      flip({
        fallbackPlacements: ['right', 'top', 'bottom']
      }), // Flip if no space
      shift({ 
        padding: 8
      }) // Keep within viewport
    ]
  });
  
  // Hide tooltip on scroll
  function hideTooltipOnScroll() {
    if (showCopiedFeedback) {
      showCopiedFeedback = false;
      if (feedbackTimer) {
        clearTimeout(feedbackTimer);
        feedbackTimer = undefined;
      }
    }
  }
  
  // Setup scroll listener
  onMount(() => {
    if (browser) {
      window.addEventListener('scroll', hideTooltipOnScroll, { passive: true });
    }
  });
  
  onDestroy(() => {
    if (browser) {
      window.removeEventListener('scroll', hideTooltipOnScroll);
    }
    if (feedbackTimer) {
      clearTimeout(feedbackTimer);
    }
  });
  
  /**
   * Robustly copy text to the user clipboard.
   * 1. Prefer the modern Clipboard API (requires secure context)
   * 2. Fallback to the deprecated `execCommand('copy')` for older browsers
   *    – Ensure we focus & select the textarea before executing the command.
   *
   * Returns `true` when the copy succeeds, `false` otherwise.
   */
  async function copyToClipboard(text: string): Promise<boolean> {
    try {
      if (browser && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      // Continue to fallback below
      console.warn('Primary clipboard API failed – falling back to execCommand', err);
    }

    // Fallback for Safari < 13 and other legacy browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.top = '-9999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error('Fallback clipboard copy failed', err);
      return false;
    }
  }

  async function handleShare(event?: MouseEvent) {
    event?.stopPropagation?.();
    if (!browser || isLoading || showCopiedFeedback) return;
    
    // Generate full URL first (sync to preserve user-gesture context)
    const baseUrl = window.location.origin;
    const slug = title ? slugify(title) : undefined;
    const fullUrl = generateShareUrl(baseUrl, {
      batchId,
      categoryId,
      storyIndex,
      dataLang,
      topicId,
      slug
    });

    // Decide mobile vs desktop early
    const isMobile = /mobile|android|iphone|ipad/i.test(navigator.userAgent);

    // Perform share / copy IMMEDIATELY while still in user-gesture
    try {
      if (isMobile && navigator.share) {
        const shareTitle = `${title} - Kite News`;
        const shareText = description ? `${description}\n\nRead more on Kite:` : `${title}\n\nRead more on Kite:`;
        await navigator.share({ title: shareTitle, text: shareText, url: fullUrl });
        return; // Native share handled
      }

      const copied = await copyToClipboard(fullUrl);
      if (copied) {
        // Show feedback
        showCopiedFeedback = true;
        if (feedbackTimer) clearTimeout(feedbackTimer);
        feedbackTimer = setTimeout(() => (showCopiedFeedback = false), 2000);
      } else {
        console.error('Clipboard copy failed (initial)');
      }
    } catch (err) {
      console.error('Initial share/copy failed:', err);
    }

    // 🔗 Background: attempt to shorten URL and update clipboard (best effort)
    ;(async () => {
      try {
        const response = await fetch('/api/shorten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: fullUrl,
            batchId,
            categoryId,
            storyIndex,
            languageCode: dataLang
          })
        });
        if (response.ok) {
          const data = await response.json();
          const shortUrl = data?.shortUrl as string | undefined;
          if (shortUrl && /^https?:\/\//.test(shortUrl)) {
            await copyToClipboard(shortUrl).catch(() => {});
          }
        }
      } catch (err) {
        // Ignore background shortening errors
      }
    })();
  }
  
</script>

<!-- Share Button (icon only) -->
<button
  bind:this={floating.elements.reference}
  onclick={handleShare}
  type="button"
  class="group relative flex h-10 w-10 items-center justify-center rounded-lg {className}"
  aria-label={s('article.shareStory') || 'Share story'}
  title={s('article.shareStory') || 'Share story'}
  disabled={isLoading}
>
  {#if isLoading}
    <!-- Loading spinner -->
    <Icon icon="tabler:loader-2" 
      class="animate-spin text-gray-500 dark:text-gray-400 w-5 h-5"
    />
  {:else}
    <!-- Share icon -->
    <Icon icon="tabler:share" 
      class="transition-colors text-gray-600 group-hover:text-gray-800 dark:text-gray-400 dark:group-hover:text-gray-200 w-5 h-5"
    />
  {/if}
</button>

<!-- Floating "Copied!" feedback -->
{#if showCopiedFeedback}
  <Portal>
    <div
      bind:this={floating.elements.floating}
      class="absolute top-0 left-0 z-[2000] flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white shadow-lg transition-opacity duration-200 dark:bg-green-700 {floating.isPositioned ? 'opacity-100' : 'opacity-0 invisible'}"
      style={floating.floatingStyles}
    >
      <Icon icon="tabler:check" 
        class="text-white w-4 h-4"
      />
      <span>{s('article.shareCopied') || 'Copied!'}</span>
    </div>
  </Portal>
{/if}

<style lang="postcss">
  button {
    -webkit-tap-highlight-color: transparent;
  }
</style>