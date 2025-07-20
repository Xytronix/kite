<script lang="ts">
	import { flip } from 'svelte/animate';
	import { untrack } from 'svelte';
	import { dndzone } from 'svelte-dnd-action';
	import { s } from '$lib/client/localization.svelte';
	import { categories } from '$lib/stores/categories.svelte.js';
	import type { Category } from '$lib/types';

	// Local type for items used in drag-and-drop lists
	type CategoryItem = {
		id: string;
		name: string;
	};
	import { getCategoryDisplayName } from '$lib/utils/category';
	import { categoryMetadataService, type CategoryMetadata } from '$lib/services/categoryMetadataService';
	import Select from '$lib/components/Select.svelte';
	import Icon from '@iconify/svelte';
	
	// Props
	interface Props {
		categories?: Category[];
	}

	const { categories: allCategories = [] }: Props = $props();

	const flipDurationMs = 200;
	
	// Track dragging state
	let isDragging = $state(false);
	
	// Local state for drag and drop - only updated when not dragging
	let enabledItems = $state<Array<{id: string, name: string}>>([]);
	let disabledItems = $state<Array<{id: string, name: string}>>([]);
	
	// Category metadata and filtering
	let categoryMetadata = $state<CategoryMetadata[]>([]);
	// biome-ignore lint/style/useConst -- categoryFilter is updated via UI events later in the component
	let categoryFilter = $state('all');
	
	// Filter options for the Select component
	const filterOptions = $derived([
		{ value: 'all', label: s('settings.categories.types.all') || 'All types' },
		{ value: 'core', label: s('settings.categories.types.core') || 'Core', icon: 'tabler:news' },
		{ value: 'country', label: s('settings.categories.types.country') || 'Countries', icon: 'tabler:world' },
		{ value: 'region', label: s('settings.categories.types.region') || 'Regions', icon: 'tabler:map-pin' },
		{ value: 'city', label: s('settings.categories.types.city') || 'Cities', icon: 'tabler:building' },
		{ value: 'topic', label: s('settings.categories.types.topic') || 'Topics', icon: 'tabler:bulb' },
		{ value: 'other', label: s('settings.categories.types.other') || 'Other', icon: 'tabler:dots' }
	]);

	// Initialize categories when they change
	$effect(() => {
		if (allCategories.length > 0) {
			untrack(() => {
				categories.setAllCategories(allCategories);
				categories.initWithDefaults();
				loadCategoryMetadata();
				syncFromStore();
			});
		}
	});

	// Load category metadata for filtering
	async function loadCategoryMetadata() {
		try {
			categoryMetadata = await categoryMetadataService.loadMetadata();
		} catch (error) {
			console.error('Failed to load category metadata:', error);
			categoryMetadata = [];
		}
	}

	// Sync from store when not dragging
	$effect(() => {
		if (!isDragging) {
			syncFromStore();
		}
	});

	function syncFromStore() {
		enabledItems = categories.enabled.map(categoryId => {
			const category = categories.allCategories.find(cat => cat.id === categoryId);
			return {
				id: categoryId,
				name: category?.name || categoryId
			};
		});

		disabledItems = categories.disabled.map(categoryId => {
			const category = categories.allCategories.find(cat => cat.id === categoryId);
			return {
				id: categoryId,
				name: category?.name || categoryId
			};
		});
	}

	// Get category type for filtering
	function getCategoryType(categoryId: string): string {
		const metadata = categoryMetadata.find(meta => meta.categoryId === categoryId.toLowerCase());
		if (!metadata) {
			console.warn(`No metadata found for category: ${categoryId}`);
			return 'other';
		}
		return metadata.categoryType;
	}

	// Filter disabled items based on selected filter
	function getFilteredDisabledItems() {
		if (categoryFilter === 'all') {
			return disabledItems;
		}
		
		return disabledItems.filter(item => {
			const categoryType = getCategoryType(item.id);
			return categoryType === categoryFilter;
		});
	}

	// Get filtered items for display (derived state)
	const filteredDisabledItems = $derived(getFilteredDisabledItems());

	// Count categories by type for filter labels
	function getCategoryCounts() {
		const counts: Record<string, number> = {
			all: disabledItems.length,
			core: 0,
			country: 0,
			region: 0,
			city: 0,
			topic: 0,
			other: 0
		};

		for (const item of disabledItems) {
			const type = getCategoryType(item.id);
			if (type in counts) {
				counts[type]++;
			}
		}

		return counts;
	}

	// Update filter options with counts
	const filterOptionsWithCounts = $derived.by(() => {
		const counts = getCategoryCounts();
		return filterOptions.map(option => ({
			...option,
			label: option.value === 'all'
				? `All Categories (${counts.all})`
				: `${option.label} (${counts[option.value] || 0})`
		}));
	});

	// Drag handlers for enabled zone
	function handleEnabledConsider(e: CustomEvent) {
		isDragging = true;
		enabledItems = e.detail.items;
	}

	function handleEnabledFinalize(e: CustomEvent) {
		isDragging = false;
		const newItems = e.detail.items;
		
		// Extract the new enabled categories in their drag order
		const newEnabled = newItems.map((item: any) => item.id);
		// Update enabled/disabled states
		categories.setEnabled(newEnabled);
		
		// Update the global order to preserve the exact drag order within enabled categories
		// Build new order: enabled categories in drag order + disabled categories in original order
		const currentDisabled = categories.disabled;
		const disabledInOrder = categories.order.filter(id => currentDisabled.includes(id));
		
		// Merge enabled (in new order) with disabled (in old order)
		// For now, put enabled first, then disabled - this preserves the drag order
		const newOrder = [...newEnabled, ...disabledInOrder];
		categories.setOrder(newOrder);
	}

	// Drag handlers for disabled zone
	function handleDisabledConsider(e: CustomEvent) {
		isDragging = true;
		// Update the filtered items during drag
		// Note: we need to be careful here since we're showing filtered items
	}

	function handleDisabledFinalize(e: CustomEvent) {
		isDragging = false;
		const newItems = e.detail.items as CategoryItem[];
		
		// Extract the new disabled categories in their drag order
		const newDisabled = newItems.map(item => item.id);
		
		// When working with filtered items, we need to preserve the order of categories
		// that aren't currently visible in the filter
		const hiddenDisabled = disabledItems.filter(item => {
			const categoryType = getCategoryType(item.id);
			return categoryFilter !== 'all' && categoryType !== categoryFilter;
		}).map(item => item.id);
		
		// Combine visible reordered items with hidden items (maintain their original order)
		const allDisabled = [...newDisabled, ...hiddenDisabled];
		
		// Update enabled/disabled states
		categories.setDisabled(allDisabled);
		
		// Update the global order to preserve the exact drag order within disabled categories
		const currentEnabled = categories.enabled;
		const enabledInOrder = categories.order.filter(id => currentEnabled.includes(id));
		
		// Merge enabled (in old order) with disabled (in new order)
		const newOrder = [...enabledInOrder, ...allDisabled];
		categories.setOrder(newOrder);
	}

	// Click handlers for toggling categories
	function handleEnabledClick(categoryId: string) {
		// Prevent disabling the last category
		if (enabledItems.length > 1) {
			// Move from enabled to disabled
			categories.disableCategory(categoryId);
		}
	}

	function handleDisabledClick(categoryId: string) {
		// Move from disabled to enabled
		categories.enableCategory(categoryId);
	}
</script>

<div class="space-y-4">
	<div class="mb-4">
		<p class="text-sm text-gray-600 dark:text-gray-400">
			{s('settings.categories.instructions') || 'Drag to reorder, or click to enable/disable. Drag between sections to move categories.'}
		</p>
	</div>

	<div>
		<h4 class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
			{s('settings.categories.enabled') || 'Enabled Categories'}
		</h4>
		<div
			class="min-h-[40px] rounded-lg p-3 flex flex-wrap gap-2 border-2 border-dashed"
			class:border-gray-300={!isDragging}
			class:dark:border-gray-600={!isDragging}
			class:border-transparent={isDragging}
			use:dndzone={{
				items: enabledItems,
				flipDurationMs,
				type: 'category',
				dropTargetStyle: { 
					outline: 'rgba(59, 130, 246, 0.5) solid 2px',
					outlineOffset: '-2px',
					borderRadius: '0.5rem'
				},
				dragDisabled: enabledItems.length === 1
			}}
			onconsider={handleEnabledConsider}
			onfinalize={handleEnabledFinalize}
		>
			{#each enabledItems as category (category.id)}
				<div
					animate:flip={{ duration: flipDurationMs }}
					class="inline-flex items-center rounded-md bg-blue-100 px-3 py-2 text-sm font-medium text-blue-800 hover:shadow-sm transition-colors dark:bg-blue-800 dark:text-blue-200
						{enabledItems.length > 1 ? 'cursor-grab active:cursor-grabbing hover:bg-blue-200 dark:hover:bg-blue-700' : 'cursor-not-allowed opacity-75'}"
					onclick={() => handleEnabledClick(category.id)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							handleEnabledClick(category.id);
						}
					}}
					role="button"
					tabindex="0"
					title={enabledItems.length === 1 ? s('settings.categories.lastCategory') || 'Cannot disable the last category' : ''}
				>
					<span>
						{getCategoryDisplayName(category)}
					</span>
				</div>
			{/each}
			{#if enabledItems.length === 0}
				<div class="text-sm text-gray-500 dark:text-gray-400">
					{s('settings.categories.noEnabled') || 'No enabled categories'}
				</div>
			{/if}
		</div>
	</div>

	<div>
		<div class="flex items-center justify-between mb-3">
			<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.categories.disabled') || 'Disabled Categories'}
			</h4>
			<div class="w-48">
				<Select
					bind:value={categoryFilter}
					options={filterOptionsWithCounts}
					placeholder={s('settings.categories.filterByType') || 'Filter by type...'}
					className="text-xs"
					height="h-8"
					onChange={(value: string) => {
						categoryFilter = value;
					}}
				/>
			</div>
		</div>
		<div
			class="min-h-[40px] rounded-lg p-3 flex flex-wrap gap-2 border-2 border-dashed"
			class:border-gray-300={!isDragging}
			class:dark:border-gray-600={!isDragging}
			class:border-transparent={isDragging}
			use:dndzone={{
				items: filteredDisabledItems,
				flipDurationMs,
				type: 'category',
				dropTargetStyle: { 
					outline: 'rgba(156, 163, 175, 0.5) solid 2px',
					outlineOffset: '-2px',
					borderRadius: '0.5rem'
				}
			}}
			onconsider={handleDisabledConsider}
			onfinalize={handleDisabledFinalize}
		>
			{#each filteredDisabledItems as category (category.id)}
				<div
					animate:flip={{ duration: flipDurationMs }}
					class="inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 cursor-grab active:cursor-grabbing hover:bg-gray-200 hover:shadow-sm transition-colors dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
					onclick={() => handleDisabledClick(category.id)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							handleDisabledClick(category.id);
						}
					}}
					role="button"
					tabindex="0"
				>
					<span>
						{getCategoryDisplayName(category)}
					</span>
				</div>
			{/each}
			{#if filteredDisabledItems.length === 0 && categoryFilter === 'all'}
				<div class="text-sm text-gray-500 dark:text-gray-400 pointer-events-none select-none">
					{s('settings.categories.noDisabled') || 'All categories enabled'}
				</div>
			{:else if filteredDisabledItems.length === 0}
				<div class="text-sm text-gray-500 dark:text-gray-400 pointer-events-none select-none">
					{s('settings.categories.noFiltered') || 'No categories of this type are disabled'}
				</div>
			{/if}
		</div>
	</div>

	<div class="text-center">
		<a
			href="https://github.com/kagisearch/kite-public"
			target="_blank"
			class="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
		>
			{s('settings.categories.contribute') || 'Suggest new categories on GitHub'}
		</a>
	</div>
</div> 