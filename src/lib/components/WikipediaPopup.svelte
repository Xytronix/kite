<script lang="ts">
import BaseModal from './BaseModal.svelte';

// Props
interface Props {
	visible: boolean;
	title: string;
	content: string;
	imageUrl?: string;
	wikiUrl?: string;
	onClose: () => void;
}

let { visible, title, content, imageUrl, wikiUrl, onClose }: Props = $props();
</script>

<BaseModal
	isOpen={visible}
	{onClose}
	{title}
	size="md"
	position="center"
	ariaLabel="Wikipedia article information"
    closeOnBackdrop={true}
>
	<div class="p-6">
		{#if imageUrl}
			<img
				src={imageUrl}
				alt={title}
				class="mb-4 h-48 w-full rounded-lg object-cover"
			/>
		{/if}
		<p class="text-gray-700 dark:text-gray-300">{content}</p>
		{#if wikiUrl}
			<a
				href={wikiUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="mt-4 inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
			>
				Read more on Wikipedia
				<svg class="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
				</svg>
			</a>
		{/if}
	</div>
</BaseModal>