<script lang="ts">
	import { flip } from 'svelte/animate';
	import { dragHandleZone, dragHandle } from 'svelte-dnd-action';
	import { s } from '$lib/client/localization.svelte';
	import { sections } from '$lib/stores/sections.svelte.js';
	import type { SectionConfig } from '$lib/constants/sections';
	import { getSectionIcon } from '$lib/constants/sections';
	import Icon from '@iconify/svelte';

	// Local state for sections with required ID field
	const flipDurationMs = 200;

	// Initialize and keep local copy of sections that can be reordered
	let sectionItems = $state(
		sections.list
			.sort((a, b) => a.order - b.order)
			.map(section => ({ ...section, id: section.id }))
	);

	// Update local sectionItems whenever the sections store changes
	$effect(() => {
		sectionItems = sections.list
			.sort((a, b) => a.order - b.order)
			.map(section => ({ ...section, id: section.id }));
	});

	// Handle drag and drop
	function handleConsider(e: CustomEvent) {
		sectionItems = e.detail.items;
	}

	function handleFinalize(e: CustomEvent) {
		sectionItems = e.detail.items;
		updateSectionOrder();
	}

	function updateSectionOrder() {
		// Update the order of all sections based on their new positions
		sectionItems.forEach((section, index) => {
			sections.setOrder(section.id, index + 1);
		});
	}

	// Toggle section enabled state
	function toggleSection(sectionId: string) {
		sections.toggleSection(sectionId);
	}

	// Enable all sections
	function enableAllSections() {
		sections.enableAll();
	}

	// Disable all sections
	function disableAllSections() {
		// Disable each section individually since there might not be a disableAll method
		sectionItems.forEach(section => {
			if (section.enabled) {
				sections.toggleSection(section.id);
			}
		});
	}

	// Reset to defaults
	function resetToDefaults() {
		sections.reset();
	}

	// Get localized section name
	function getSectionName(id: string): string {
		const key = `section.${id}`;
		return s(key) || id.charAt(0).toUpperCase() + id.slice(1);
	}

	// Check if there are any disabled sections
	const hasDisabledSections = $derived(sectionItems.some(section => !section.enabled));
	
	// Check if there are any enabled sections
	const hasEnabledSections = $derived(sectionItems.some(section => section.enabled));

	// Icon resolution moved to centralized mapping in `$lib/constants/sections.ts`
</script>

<div class="space-y-4">
	<div>
		<div class="flex items-center justify-between mb-3">
			<div>
				<h4 class="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
					{s('settings.sections.title') || 'Article Sections'}
				</h4>
				<p class="text-xs text-gray-500 dark:text-gray-400">
					{s('settings.sections.instructions') || 'Drag to reorder sections. Toggle to enable/disable.'}
				</p>
			</div>
					<div class="flex items-center justify-end gap-2 flex-wrap">
			{#if hasDisabledSections}
				<button
					type="button"
					onclick={enableAllSections}
					class="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20 whitespace-nowrap"
				>
					{s('settings.sections.enableAll') || 'Enable All'}
				</button>
			{/if}
			{#if hasEnabledSections}
				<button
					type="button"
					onclick={disableAllSections}
					class="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 whitespace-nowrap"
				>
					{s('settings.sections.disableAll') || 'Disable All'}
				</button>
			{/if}
			<button
				type="button"
				onclick={resetToDefaults}
				class="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800 whitespace-nowrap"
			>
				{s('settings.sections.reset') || 'Reset'}
			</button>
		</div>
		</div>

		<div
			class="space-y-2"
			use:dragHandleZone={{
				items: sectionItems,
				flipDurationMs,
				type: 'section',
				delayTouchStart: true,
				dropTargetStyle: { 
					outline: 'rgba(59, 130, 246, 0.5) solid 2px',
					outlineOffset: '-1px',
					borderRadius: '0.5rem'
				}
			}}
			onconsider={handleConsider}
			onfinalize={handleFinalize}
		>
			{#each sectionItems as section (section.id)}
				<div
					animate:flip={{ duration: flipDurationMs }}
					class="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
				>
					<div class="flex items-center space-x-3">
						<!-- Drag Handle -->
						<div 
							class="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 touch-manipulation"
							use:dragHandle
							aria-label="drag handle for {getSectionName(section.id)}"
							role="button"
							tabindex="0"
						>
							<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
								<circle cx="3" cy="4" r="1"/>
								<circle cx="3" cy="8" r="1"/>
								<circle cx="3" cy="12" r="1"/>
								<circle cx="8" cy="4" r="1"/>
								<circle cx="8" cy="8" r="1"/>
								<circle cx="8" cy="12" r="1"/>
							</svg>
						</div>

						<!-- Section Icon -->
						<Icon 
							icon={getSectionIcon(section.id)} 
							class="h-4 w-4 text-gray-500 dark:text-gray-400" 
						/>

						<!-- Section Name -->
						<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
							{getSectionName(section.id)}
						</span>
					</div>

					<!-- Toggle Switch -->
					<button
						type="button"
						onclick={() => toggleSection(section.id)}
						class="focus-visible-ring relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
						class:bg-blue-600={section.enabled}
						class:bg-gray-200={!section.enabled}
						class:dark:bg-gray-600={!section.enabled}
						role="switch"
						aria-checked={section.enabled}
						aria-label={`${s('settings.sections.switch') || 'Enable/disable'} ${getSectionName(section.id)}`}
					>
						<span
							class="inline-block h-4 w-4 transform rounded-full bg-white transition"
							class:translate-x-6={section.enabled}
							class:translate-x-1={!section.enabled}
						></span>
					</button>
				</div>
			{/each}
		</div>
	</div>
</div> 