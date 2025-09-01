<script lang="ts">
  import { browser } from "$app/environment";
  import { s } from "$lib/client/localization.svelte";
  import type { SupportedLanguage } from "$lib/stores/language.svelte";

  interface Props {
    show?: boolean;
    preferredLanguage: SupportedLanguage;
    onSwitch?: () => void;
    onDismiss?: () => void;
  }

  let { show = false, preferredLanguage, onSwitch, onDismiss }: Props = $props();

  // Auto hide after a short delay if not interacted with
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    if (!browser) return;
    if (show) {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        onDismiss?.();
      }, 7000);
    } else if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  });
</script>

{#if show}
  <div class="fixed left-1/2 top-16 z-[70] -translate-x-1/2 transform px-3">
    <div class="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 shadow-md dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
      <div class="flex items-center gap-3">
        <span class="text-xs sm:text-sm">
          {s('language.mismatchNotice') || 'You are viewing a different content language from your preference.'}
        </span>
        <button
          class="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          onclick={() => onSwitch?.()}
        >
          {s('language.switchToPreferred') || 'Switch to preferred'} ({preferredLanguage})
        </button>
        <button
          class="rounded-md px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40 focus:outline-none"
          aria-label="Dismiss language tooltip"
          onclick={() => onDismiss?.()}
        >
          {s('common.dismiss') || 'Dismiss'}
        </button>
      </div>
    </div>
  </div>
{/if}



