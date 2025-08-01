<script lang="ts">
import { browser } from '$app/environment';
</script>

{#if browser}
    <slot />
{:else}
    <slot name="fallback" />
{/if} 