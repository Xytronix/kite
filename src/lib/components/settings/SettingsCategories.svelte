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
	import { locationService, type LocationInfo } from '$lib/services/locationService';
	import Select from '$lib/components/Select.svelte';
	import Icon from '$lib/components/Icon.svelte';
	
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
	let locationInfo = $state<LocationInfo | null>(null);
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

	// Setup function to run when props change
	function setup(props: Props) {
		if (props.categories && props.categories.length > 0) {
			untrack(() => {
				categories.setAllCategories(props.categories);
				loadLocationInfo().then(() => {
					categories.initWithLocationDefaults(locationInfo?.suggestedCategories);
				});
				loadCategoryMetadata();
				syncFromStore();
			});
		}
	}
	$effect(() => setup({ categories: allCategories }));

	// Load category metadata for filtering
	async function loadCategoryMetadata() {
		try {
			categoryMetadata = await categoryMetadataService.loadMetadata();
		} catch (error) {
			console.error('Failed to load category metadata:', error);
			categoryMetadata = [];
		}
	}

	// Load location information for dynamic suggestions
	async function loadLocationInfo() {
		try {
			locationInfo = await locationService.detectLocation();
		} catch (error) {
			console.error('Failed to detect location:', error);
			locationInfo = null;
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

	// Bulk action handlers
	function handleEnableAll() {
		const categoriesToEnable = categoryFilter === 'all' 
			? filteredDisabledItems.map(item => item.id)
			: filteredDisabledItems.map(item => item.id);
		
		for (const categoryId of categoriesToEnable) {
			categories.enableCategory(categoryId);
		}
	}

	function handleDisableAll() {
		// Get all enabled items that match the current filter
		const enabledItemsToDisable = enabledItems.filter(item => {
			if (categoryFilter === 'all') return true;
			const categoryType = getCategoryType(item.id);
			return categoryType === categoryFilter;
		});

		// Prevent disabling all categories if it would leave none enabled
		const remainingEnabled = enabledItems.filter(item => {
			if (categoryFilter === 'all') return false;
			const categoryType = getCategoryType(item.id);
			return categoryType !== categoryFilter;
		});

		if (remainingEnabled.length === 0) {
			// Don't allow disabling all categories
			return;
		}

		// Disable the filtered categories
		for (const item of enabledItemsToDisable) {
			categories.disableCategory(item.id);
		}
	}

	function handleReset() {
		// Force reset by clearing current state first, then applying defaults
		const allCategoryIds = categories.allCategories.map((cat) => cat.id);
		
		// Determine which categories should be enabled by default
		const defaultEnabledCategories = (locationInfo?.suggestedCategories && locationInfo.suggestedCategories.length > 0)
			? locationInfo.suggestedCategories
			: [
				"world",
				"usa", 
				"business",
				"tech",
				"science",
				"sports",
				"gaming",
				"onthisday",
			];

		// Filter to only include categories that actually exist
		const validDefaultEnabled = defaultEnabledCategories.filter(categoryId =>
			allCategoryIds.includes(categoryId)
		);

		// Create ordered list with World first, then location categories, then other defaults
		let newOrder = [];
		
		// Add World first if it's in the enabled defaults
		if (validDefaultEnabled.includes("world")) {
			newOrder.push("world");
		}
		
		// Add location-based categories after World (if using location suggestions)
		if (locationInfo?.suggestedCategories && locationInfo.suggestedCategories.length > 0) {
			const locationCategories = validDefaultEnabled.filter(categoryId => 
				categoryId !== "world" && 
				!["business", "tech", "science", "sports", "gaming", "onthisday", "usa"].includes(categoryId)
			);
			newOrder.push(...locationCategories);
		}
		
		// Add remaining default categories in their original order
		const remainingDefaults = validDefaultEnabled.filter(categoryId => 
			!newOrder.includes(categoryId)
		);
		newOrder.push(...remainingDefaults);
		
		// Add all other categories that aren't in defaults
		const remainingCategories = allCategoryIds.filter(
			categoryId => !validDefaultEnabled.includes(categoryId)
		);
		newOrder.push(...remainingCategories);
		
		// Apply the reset
		categories.setOrder(newOrder);
		categories.setEnabled(validDefaultEnabled);
	}

	// Check if bulk actions should be shown
	const showBulkActions = $derived(filteredDisabledItems.length > 0);
	
	// Check if disable all button should be shown
	const showDisableAll = $derived(() => {
		if (categoryFilter === 'all') return false;
		
		// Check if there are enabled items of the filtered type
		const enabledOfType = enabledItems.filter(item => {
			const categoryType = getCategoryType(item.id);
			return categoryType === categoryFilter;
		});
		
		// Only show if there are items to disable and it won't leave zero enabled categories
		const remainingEnabled = enabledItems.filter(item => {
			const categoryType = getCategoryType(item.id);
			return categoryType !== categoryFilter;
		});
		
		return enabledOfType.length > 0 && remainingEnabled.length > 0;
	});
	
	// Get current default categories (location-based if available)
	const getCurrentDefaults = $derived(() => {
		if (locationInfo?.suggestedCategories && locationInfo.suggestedCategories.length > 0) {
			return locationInfo.suggestedCategories.filter(categoryId =>
				categories.allCategories.some(cat => cat.id === categoryId)
			);
		}
		
		// Fallback to static defaults
		const staticDefaults = [
			"world",
			"usa", 
			"business",
			"tech",
			"science",
			"sports",
			"gaming",
			"onthisday",
		];
		
		return staticDefaults.filter(categoryId =>
			categories.allCategories.some(cat => cat.id === categoryId)
		);
	});
	
	const canReset = $derived(() => {
		const availableDefaults = getCurrentDefaults();
		
		// Check if current enabled differs from defaults
		return categories.enabled.length !== availableDefaults.length || 
			!categories.enabled.every(id => availableDefaults.includes(id));
	});

	// Get location display text - only show when using location-based defaults
	let locationDisplayText = $state('');
	
	$effect(() => {
		if (!locationInfo || !locationInfo.suggestedCategories || locationInfo.suggestedCategories.length === 0) {
			locationDisplayText = '';
			return;
		}
		
		// Check if current enabled categories match the location-based suggestions
		const validSuggestions = locationInfo.suggestedCategories.filter(categoryId =>
			categories.allCategories.some(cat => cat.id === categoryId)
		);
		
		const isUsingLocationDefaults = 
			categories.enabled.length === validSuggestions.length &&
			categories.enabled.every(id => validSuggestions.includes(id));
		
		if (!isUsingLocationDefaults) {
			locationDisplayText = '';
			return;
		}
		
		const parts = [];
		if (locationInfo.country) {
			parts.push(locationInfo.country);
		}
		if (locationInfo.timezone) {
			parts.push(locationInfo.timezone.split('/').pop()?.replace('_', ' '));
		}
		
		locationDisplayText = parts.length > 0 ? 'Optimized for: ' + parts.join(', ') : '';
	});
</script>

<div class="space-y-4">
	<div class="mb-4">
		<p class="text-sm text-gray-600 dark:text-gray-400">
			{s('settings.categories.instructions') || 'Drag to reorder, or click to enable/disable. Drag between sections to move categories.'}
		</p>
		{#if locationDisplayText}
			<p class="text-xs text-gray-500 dark:text-gray-500 mt-1 flex items-center gap-1">
				<Icon icon="tabler:map-pin" class="w-3 h-3" />
				{locationDisplayText}
			</p>
		{/if}
	</div>

	<div>
		<h4 class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
			<Icon icon="tabler:eye" class="w-4 h-4 mr-2" />
			Enabled Categories
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
				<Icon icon="tabler:eye-off" class="w-4 h-4 inline mr-1" />{s('settings.categories.disabled') || 'Disabled Categories'}
tings.categories.enabled') || 'Enabled Categories'}
				</div>
			{/if}
		</div>
	</div>

	<div>
		<div class="flex items-center justify-between mb-3">
			<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
				<Icon icon="tabler:eye-off" class="w-4 h-4 mr-2" />
				Disabled Categories
			</h4>
			<div class="flex items-center gap-2">
				{#if showBulkActions}
					<button
						type="button"
						onclick={handleEnableAll}
						class="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20"
					>
						{categoryFilter === 'all' 
							? (s('settings.categories.enableAll') || 'Enable All')
							: (s('settings.categories.enableFiltered') || `Enable All ${filterOptions.find(opt => opt.value === categoryFilter)?.label || ''}`)}
					</button>
				{/if}
				{#if showDisableAll}
					<button
						type="button"
						onclick={handleDisableAll}
						class="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
					>
						{s('settings.categories.disableFiltered') || `Disable All ${filterOptions.find(opt => opt.value === categoryFilter)?.label || ''}`}
					</button>
				{/if}
				{#if canReset}
					<button
						type="button"
						onclick={handleReset}
						class="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800"
						title={locationInfo?.country ? `Reset to defaults for ${locationInfo.country}` : 'Reset to defaults'}
					>
						{s('settings.categories.reset') || 'Reset'}
					</button>
				{/if}
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