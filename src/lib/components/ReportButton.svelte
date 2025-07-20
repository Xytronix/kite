<script lang="ts">
import BaseModal from './BaseModal.svelte';
import Icon from '@iconify/svelte';
import { s } from '$lib/client/localization.svelte';
import { browser } from '$app/environment';

interface Props {
    story: any;
    url?: string;
    class?: string;
}

let { story, url = '', class: className = '' }: Props = $props();

// Modal state
let isModalOpen = $state(false);
let submitting = $state(false);
let submitted = $state(false);

// Add translate helper that falls back if key is missing
const tr = (key: string, fallback: string) => {
    const res = s(key);
    return res === key ? fallback : res;
};

// Reporting
const REPORT_REASONS = [
    { id: 'misinformation', label: tr('report.reason.misinformation', 'Misinformation or false content') },
    { id: 'bad_categorization', label: tr('report.reason.badCategorization', 'Incorrect category or tagging') },
    { id: 'bad_image', label: tr('report.reason.badImage', 'Inappropriate or irrelevant image') },
    { id: 'uncredible_sources', label: tr('report.reason.uncredibleSources', 'Uncredible or biased sources') },
    { id: 'missing_parallelism', label: tr('report.reason.missingParallelism', 'Missing parallel/opposite viewpoints') },
    { id: 'plagiarism', label: tr('report.reason.plagiarism', 'Plagiarism or copyright infringement') },
    { id: 'privacy', label: tr('report.reason.privacy', 'Privacy or personal data concern') },
    { id: 'other', label: tr('report.reason.other', 'Other') }
] as const;

type ReasonId = typeof REPORT_REASONS[number]['id'];

let selectedReason = $state<ReasonId | null>(null);

// User-provided details
let detailsText = $state('');

// For source selection when reporting uncredible sources
interface SourceOption { label: string; value: string; }
const sourceOptions: SourceOption[] = (() => {
    if (!story?.articles) return [];
    const seen = new Set<string>();
    return story.articles.map(a => {
        const label = a.domain || (() => { try { return new URL(a.link).hostname; } catch { return a.title || a.link; }})();
        if (seen.has(label)) return null;
        seen.add(label);
        return { label, value: label };
    }).filter(Boolean) as SourceOption[];
})();

let selectedSources = $state<string[]>([]);

async function submitReport() {
    if (!selectedReason || submitting) return;
    submitting = true;

    try {
        const body = {
            storyId: story?.cluster_number ?? story?.title ?? 'unknown',
            reason: selectedReason,
            url: url || undefined,
            details: detailsText || undefined,
            sources: selectedReason === 'uncredible_sources' ? (selectedSources.length ? selectedSources : undefined) : undefined
        };
        if (browser) {
            await fetch('/api/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        }
        submitted = true;
        // Auto close after short delay
        setTimeout(() => {
            isModalOpen = false;
            submitted = false;
            selectedReason = null;
            detailsText = '';
            selectedSources = [];
        }, 1500);
    } catch (err) {
        console.error('Failed to submit report', err);
    } finally {
        submitting = false;
    }
}
</script>

<!-- Report / Flag Button -->
<button
    onclick={() => (isModalOpen = true)}
    class="group relative flex h-10 w-10 items-center justify-center rounded-lg {className}"
    aria-label={tr('report.flagStory', 'Report story')}
    title={tr('report.flagStory', 'Report story')}
>
         <Icon icon="tabler:flag" 
         class="transition-colors text-gray-600 group-hover:text-gray-800 dark:text-gray-400 dark:group-hover:text-gray-200 w-5 h-5" />
</button>

<!-- Report Modal -->
<BaseModal
    isOpen={isModalOpen}
    onClose={() => (isModalOpen = false)}
    title={tr('report.reportStory', 'Report this story')}
    size="sm"
>
    <div class="p-4 space-y-4 text-sm text-gray-800 dark:text-gray-100">
        {#if !submitted}
            <p>{tr('report.selectReason', 'Why are you reporting this story?')}</p>

            <div class="space-y-3">
                {#each REPORT_REASONS as reason}
                    <label class="flex items-start gap-3 cursor-pointer select-none">
                        <input
                            type="radio"
                            class="mt-1.5 h-4 w-4 shrink-0 cursor-pointer border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-blue-500"
                            name="report-reason"
                            value={reason.id}
                            checked={selectedReason === reason.id}
                            onchange={() => (selectedReason = reason.id)}
                        />
                        <span>{reason.label}</span>
                    </label>
                {/each}
            </div>

            {#if selectedReason === 'uncredible_sources' && sourceOptions.length > 0}
                <div>
                    <label for="source-select" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {tr('report.selectSource', 'Select the problematic source')}
                    </label>
                    <select
                        id="source-select"
                        multiple
                        size="1"
                        bind:value={selectedSources}
                        class="w-full rounded-md border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    >
                        <option disabled value="">{tr('report.sourcePlaceholder', 'Choose source(s)')}</option>
                        {#each sourceOptions as opt}
                            <option value={opt.value}>{opt.label}</option>
                        {/each}
                    </select>
                </div>
            {/if}

            <!-- Additional details textbox for any reason -->
            <textarea
                bind:value={detailsText}
                rows="3"
                placeholder={tr('report.optionalDetails', 'Provide additional details (optional)')}
                class="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            ></textarea>

            <div class="flex justify-end gap-3 pt-2">
                <button
                    onclick={() => (isModalOpen = false)}
                    class="rounded-md bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                    {tr('ui.cancel', 'Cancel')}
                </button>
                <button
                    onclick={submitReport}
                    class="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
                    disabled={
                        !selectedReason || submitting ||
                        (selectedReason === 'uncredible_sources' && selectedSources.length === 0)
                    }
                >
                    {#if submitting}
                        <Icon icon="tabler:loader-2" class="animate-spin w-[18px] h-[18px]" />
                        <span>{tr('report.submitting', 'Submitting')}</span>
                    {:else if submitted}
                        <Icon icon="tabler:check" class="w-[18px] h-[18px]" />
                        <span>{tr('report.submitted', 'Submitted')}</span>
                    {:else}
                        <span>{tr('report.submit', 'Submit')}</span>
                    {/if}
                </button>
            </div>
        {:else}
            <div class="flex flex-col items-center gap-4 py-8">
                                 <Icon icon="tabler:check" class="text-green-600 dark:text-green-400 w-10 h-10" />
                <p class="text-center text-base font-medium">
                    {tr('report.thankYou', 'Thank you for helping keep Kite safe and accurate.')}
                </p>
            </div>
        {/if}
    </div>
</BaseModal>

<style>
    textarea {
        resize: vertical;
    }
</style> 