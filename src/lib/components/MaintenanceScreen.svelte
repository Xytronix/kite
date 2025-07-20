<script lang="ts">
import { s } from '$lib/client/localization.svelte';
</script>

<div class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-dark-bg p-6 text-center">
    <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-4">
        {s('maintenance.title') || 'Maintenance in progress'}
    </h1>
    <p class="text-gray-600 dark:text-gray-400 max-w-md">
        {s('maintenance.message') || 'We are performing routine updates to improve your experience. Please check back shortly.'}
    </p>
</div> 