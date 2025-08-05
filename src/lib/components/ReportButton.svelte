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

// NEW: allow users to choose submission method

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

async function submitReport(method: 'github' | 'email') {
    if (!selectedReason || submitting) return;
    submitting = true;

    try {
        const storyTitle = story?.title ?? '';
        const storySummary = story?.short_summary ?? '';
        const storyQuote = story?.quote ? `"${story.quote}"${story.quote_author ? ` - ${story.quote_author}` : ''}` : '';
        const storyPerspectives = story?.perspectives?.map((p: any) => p.text).join('\n\n') ?? '';
        const storyTimeline = story?.timeline?.filter((t: any) => (t.description || t.text) && t.date && t.date !== 'Date unknown')
            .map((t: any) => `${t.date}: ${t.description || t.text}`).join('\n') ?? '';
        const storyTalkingPoints = story?.talking_points?.join('\n- ') ?? '';
        const storySourcesList: string[] = (() => {
            if (!story?.articles) return [];
            const seen = new Set<string>();
            return story.articles.map((a: any) => {
                const link = a.link || '';
                if (seen.has(link) || !link) return null;
                seen.add(link);
                return link;
            }).filter(Boolean) as string[];
        })();

        const body = {
            storyId: story?.cluster_number ?? story?.title ?? 'unknown',
            storyTitle,
            storySummary,
            storyQuote,
            storyPerspectives,
            storyTimeline,
            storyTalkingPoints,
            storySources: storySourcesList,
            reason: selectedReason,
            url: url || undefined,
            details: detailsText || undefined,
            sources: selectedReason === 'uncredible_sources' ? (selectedSources.length ? selectedSources : undefined) : undefined
        };

        if (browser) {
            if (method === 'github') {
                const response = await fetch('/api/report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.githubUrl) {
                        // Open GitHub issue creation page in new tab
                        window.open(data.githubUrl, '_blank');
                    }
                }
            } else {
                // Build email link
                const reasonFormatted = body.reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const titlePart = body.storyTitle ? ` | ${body.storyTitle}` : '';
                const subject = encodeURIComponent(`Kite Report: ${reasonFormatted}${titlePart} (#${body.storyId})`);
                const emailLines: string[] = [
                    `Story ID: ${body.storyId}`,
                    body.storyTitle ? `Title: ${body.storyTitle}` : '',
                    body.storySummary ? `Summary: ${body.storySummary}` : '',
                    `Reason: ${body.reason}`,
                    body.url ? `Story URL: ${body.url}` : '',
                    body.storySources && body.storySources.length ? `Sources:\n${body.storySources.map(src => `- ${src}`).join('\n')}` : '',
                    body.sources && body.sources.length ? `Problematic Sources: ${body.sources.join(', ')}` : '',
                    body.storyQuote ? `Quote: ${body.storyQuote}` : '',
                    body.storyTalkingPoints ? `Talking Points:\n- ${body.storyTalkingPoints}` : '',
                    body.storyPerspectives ? `Perspectives:\n${body.storyPerspectives}` : '',
                    body.storyTimeline ? `Timeline:\n${body.storyTimeline}` : '',
                    body.details ? `Additional Details: ${body.details}` : ''
                ].filter(Boolean);
                const mailto = `mailto:support@kagi.com?subject=${subject}&body=${encodeURIComponent(emailLines.join('\n'))}`;
                window.open(mailto, '_blank');
            }
        }

        submitted = true;
        lastSubmissionMethod = method;
        // Auto close after short delay
        setTimeout(() => {
            isModalOpen = false;
            submitted = false;
            selectedReason = null;
            detailsText = '';
            selectedSources = [];
            lastSubmissionMethod = null;
        }, 1500);
    } catch (err) {
        console.error('Failed to submit report', err);
    } finally {
        submitting = false;
    }
}

let lastSubmissionMethod = $state<'github' | 'email' | null>(null);
</script>

<!-- Report / Flag Button -->
<button
    onclick={(e) => { e.stopPropagation(); isModalOpen = true; }}
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
            <div class="space-y-3 px-1">
                {#each REPORT_REASONS as reason}
                    <label class="flex items-start gap-3 cursor-pointer select-none py-1 min-h-[24px]">
                        <input
                            type="radio"
                            class="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer rounded-full border border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:checked:bg-blue-600 dark:focus:ring-blue-500"
                            name="report-reason"
                            value={reason.id}
                            checked={selectedReason === reason.id}
                            onchange={() => (selectedReason = reason.id)}
                        />
                        <span class="leading-relaxed text-sm flex-1 min-w-0">{reason.label}</span>
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
                        size={Math.min(sourceOptions.length, 6)}
                        bind:value={selectedSources}
                        onclick={(e) => e.stopPropagation()}
                        class="w-full rounded-md border border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-white dark:text-gray-900 p-2 text-sm overflow-y-auto"
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

            <div class="pt-4 border-t border-gray-200 dark:border-gray-600">
                <p class="mb-3 text-sm text-gray-700 dark:text-gray-300">{tr('report.chooseSubmissionMethod', 'Choose how to submit your report:')}</p>
                <div class="flex gap-2">
                    <button
                        onclick={() => submitReport('github')}
                        class="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
                        disabled={
                            !selectedReason || submitting ||
                            (selectedReason === 'uncredible_sources' && selectedSources.length === 0)
                        }
                    >
                        {#if submitting}
                            <Icon icon="tabler:loader-2" class="animate-spin w-4 h-4" />
                        {:else}
                            <Icon icon="tabler:brand-github" class="w-4 h-4" />
                        {/if}
                        <span>{tr('report.submitViaGithub', 'GitHub')}</span>
                    </button>
                    <button
                        onclick={() => submitReport('email')}
                        class="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-blue-100 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 transition-colors"
                        disabled={
                            !selectedReason || submitting ||
                            (selectedReason === 'uncredible_sources' && selectedSources.length === 0)
                        }
                    >
                        {#if submitting}
                            <Icon icon="tabler:loader-2" class="animate-spin w-4 h-4" />
                        {:else}
                            <Icon icon="tabler:mail" class="w-4 h-4" />
                        {/if}
                        <span>{tr('report.submitViaEmail', 'Email')}</span>
                    </button>
                </div>
            </div>

            <div class="flex justify-end gap-3 pt-4">
                <button
                    onclick={() => (isModalOpen = false)}
                    class="rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                    {tr('ui.cancel', 'Cancel')}
                </button>
            </div>
        {:else}
                            <div class="flex flex-col items-center gap-4 py-8">
                                 <Icon icon="tabler:check" class="text-green-600 dark:text-green-400 w-10 h-10" />
                <p class="text-center text-base font-medium">
                    {tr('report.thankYou', 'Thank you for helping keep Kite safe and accurate.')}
                </p>
                <p class="text-center text-sm text-gray-600 dark:text-gray-400">
                    {#if lastSubmissionMethod === 'github'}
                        {tr('report.githubRedirect', 'A GitHub issue page has been opened for you to complete the report.')}
                    {:else}
                        {tr('report.emailRedirect', 'Your email client has opened with a draft to complete the report.')}
                    {/if}
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