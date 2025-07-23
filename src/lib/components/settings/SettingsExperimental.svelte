<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import { experimental } from '$lib/stores/experimental.svelte.js';

// Toggle handlers
function toggleArticleIcons() {
	experimental.toggleFeature('showArticleIcons');
}

function toggleUseArticleEmojis() {
	experimental.toggleFeature('useArticleEmojis');
}

function toggleCategoryIcons() {
	experimental.toggleFeature('showCategoryIcons');
}

function toggleUseCategoryEmojis() {
	experimental.toggleFeature('useCategoryEmojis');
}

function toggleDisableCategorySwipe() {
	experimental.toggleFeature('disableCategorySwipe');
}

function toggleChaosIndex() {
	experimental.toggleFeature('showChaosIndex');
}

function toggleWikiTooltips() {
	experimental.toggleFeature('showWikipediaTooltips');
}

function toggleDisableWikiHeadlines() {
	experimental.toggleFeature('disableWikiTooltipsInHeadlines');
}

// Article/Category display helper functions
// Unified decoration style and target toggles
type VisualMode = 'none' | 'icons' | 'emojis';

let styleMode: VisualMode;
let headlinesOn: boolean;
let categoriesOn: boolean;

// Derive current state from individual feature flags
$: styleMode = experimental.showArticleIcons || experimental.showCategoryIcons
	? 'icons'
	: experimental.useArticleEmojis || experimental.useCategoryEmojis
	? 'emojis'
	: 'none';

$: headlinesOn = experimental.showArticleIcons || experimental.useArticleEmojis;
$: categoriesOn = experimental.showCategoryIcons || experimental.useCategoryEmojis;

/** Apply current style to headlines/categories depending on toggle state */
function applyStyleToTargets() {
	// Headlines (story titles)
	if (headlinesOn) {
		experimental.setFeatures(
			styleMode === 'icons'
				? { showArticleIcons: true, useArticleEmojis: false }
				: styleMode === 'emojis'
				? { showArticleIcons: false, useArticleEmojis: true }
				: { showArticleIcons: false, useArticleEmojis: false },
		);
	} else {
		experimental.setFeatures({ showArticleIcons: false, useArticleEmojis: false });
	}

	// Categories (pills)
	if (categoriesOn) {
		experimental.setFeatures(
			styleMode === 'icons'
				? { showCategoryIcons: true, useCategoryEmojis: false }
				: styleMode === 'emojis'
				? { showCategoryIcons: false, useCategoryEmojis: true }
				: { showCategoryIcons: false, useCategoryEmojis: false },
		);
	} else {
		experimental.setFeatures({ showCategoryIcons: false, useCategoryEmojis: false });
	}
}

function setVisualMode(mode: VisualMode) {
	styleMode = mode;
	applyStyleToTargets();
}

function toggleHeadlines() {
	headlinesOn = !headlinesOn;
	applyStyleToTargets();
}

function toggleCategories() {
	categoriesOn = !categoriesOn;
	applyStyleToTargets();
}

</script>

<div class="space-y-6">
	<p class="mb-6 text-sm text-gray-600 dark:text-gray-400">
		⚠️ <span class="ml-1">{s('settings.experimental.warning') || 'These features are experimental and may change or be removed in future versions.'}</span>
	</p>

	<!-- Visual Decoration Style -->
	<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
		<div class="mb-2 flex items-center justify-between">
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.experimental.visualStyle.label') || 'Decoration Style'}
			</span>
		</div>
		<div class="grid grid-cols-3 gap-2">
			<button
				onclick={() => setVisualMode('none')}
				type="button"
				class="focus-visible-ring relative inline-flex h-10 w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
				class:bg-blue-600={styleMode === 'none'}
				class:bg-gray-200={styleMode !== 'none'}
				class:dark:bg-gray-600={styleMode !== 'none'}
				role="switch"
				aria-checked={styleMode === 'none'}
			>
				<span class="sr-only">Decoration: None</span>
				<span class="text-lg">None</span>
			</button>
			<button
				onclick={() => setVisualMode('icons')}
				type="button"
				class="focus-visible-ring relative inline-flex h-10 w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
				class:bg-blue-600={styleMode === 'icons'}
				class:bg-gray-200={styleMode !== 'icons'}
				class:dark:bg-gray-600={styleMode !== 'icons'}
				role="switch"
				aria-checked={styleMode === 'icons'}
			>
				<span class="sr-only">Decoration: Icons</span>
				<span class="text-lg">Icons</span>
			</button>
			<button
				onclick={() => setVisualMode('emojis')}
				type="button"
				class="focus-visible-ring relative inline-flex h-10 w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
				class:bg-blue-600={styleMode === 'emojis'}
				class:bg-gray-200={styleMode !== 'emojis'}
				class:dark:bg-gray-600={styleMode !== 'emojis'}
				role="switch"
				aria-checked={styleMode === 'emojis'}
			>
				<span class="sr-only">Decoration: Emojis</span>
				<span class="text-lg">Emojis</span>
			</button>
		</div>
		<p class="text-xs text-gray-500 dark:text-gray-400">
			{s('settings.experimental.visualStyle.description') || 'Choose how headlines and categories are decorated.'}
		</p>
	</div>

	<!-- Apply to Headlines -->
	<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
		<div class="mb-2 flex items-center justify-between">
			<label for="toggle-headlines" class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.experimental.visualTargets.headlines') || 'Apply to Headlines'}
			</label>
			<button
				id="toggle-headlines"
				onclick={toggleHeadlines}
				type="button"
				class="focus-visible-ring relative inline-flex h-6 w-11 items-center rounded-full transition"
				class:bg-blue-600={headlinesOn}
				class:bg-gray-200={!headlinesOn}
				class:dark:bg-gray-600={!headlinesOn}
				role="switch"
				aria-checked={headlinesOn}
			>
				<span class="sr-only">Toggle headlines decoration</span>
				<span
					class="inline-block h-4 w-4 transform rounded-full bg-white transition"
					class:translate-x-6={headlinesOn}
					class:translate-x-1={!headlinesOn}
				></span>
			</button>
		</div>
	</div>

	<!-- Apply to Categories -->
	<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
		<div class="mb-2 flex items-center justify-between">
			<label for="toggle-categories" class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.experimental.visualTargets.categories') || 'Apply to Categories'}
			</label>
			<button
				id="toggle-categories"
				onclick={toggleCategories}
				type="button"
				class="focus-visible-ring relative inline-flex h-6 w-11 items-center rounded-full transition"
				class:bg-blue-600={categoriesOn}
				class:bg-gray-200={!categoriesOn}
				class:dark:bg-gray-600={!categoriesOn}
				role="switch"
				aria-checked={categoriesOn}
			>
				<span class="sr-only">Toggle categories decoration</span>
				<span
					class="inline-block h-4 w-4 transform rounded-full bg-white transition"
					class:translate-x-6={categoriesOn}
					class:translate-x-1={!categoriesOn}
				></span>
			</button>
		</div>
	</div>

	<!-- Disable Category Swipe (Mobile Only) -->
	<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700 md:hidden">
		<div class="mb-2 flex items-center justify-between">
			<label for="disable-category-swipe" class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.experimental.disableCategorySwipe.label') || 'Disable horizontal category swiping'}
			</label>
			<button
				id="disable-category-swipe"
				onclick={toggleDisableCategorySwipe}
				type="button"
				class="focus-visible-ring relative inline-flex h-6 w-11 items-center rounded-full transition"
				class:bg-blue-600={experimental.disableCategorySwipe}
				class:bg-gray-200={!experimental.disableCategorySwipe}
				class:dark:bg-gray-600={!experimental.disableCategorySwipe}
				role="switch"
				aria-checked={experimental.disableCategorySwipe}
			>
				<span class="sr-only">{s('settings.experimental.disableCategorySwipe.label') || 'Disable horizontal category swiping'}</span>
				<span
					class="inline-block h-4 w-4 transform rounded-full bg-white transition"
					class:translate-x-6={experimental.disableCategorySwipe}
					class:translate-x-1={!experimental.disableCategorySwipe}
				></span>
			</button>
		</div>
		<p class="text-xs text-gray-500 dark:text-gray-400">
			{s('settings.experimental.disableCategorySwipe.description') || 'When enabled, horizontal swiping to change categories on mobile devices will be disabled.'}
		</p>
	</div>

	<!-- Chaos Index -->
	<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
		<div class="mb-2 flex items-center justify-between">
			<label for="show-chaos-index" class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{s('settings.experimental.chaosIndex.label') || 'Show World Tension Index'}
			</label>
			<button
				id="show-chaos-index"
				onclick={toggleChaosIndex}
				type="button"
				class="focus-visible-ring relative inline-flex h-6 w-11 items-center rounded-full transition"
				class:bg-blue-600={experimental.showChaosIndex}
				class:bg-gray-200={!experimental.showChaosIndex}
				class:dark:bg-gray-600={!experimental.showChaosIndex}
				role="switch"
				aria-checked={experimental.showChaosIndex}
			>
				<span class="sr-only">{s('settings.experimental.chaosIndex.label') || 'Show World Tension Index'}</span>
				<span
					class="inline-block h-4 w-4 transform rounded-full bg-white transition"
					class:translate-x-6={experimental.showChaosIndex}
					class:translate-x-1={!experimental.showChaosIndex}
				></span>
			</button>
		</div>
		<p class="text-xs text-gray-500 dark:text-gray-400">
			{s('settings.experimental.chaosIndex.description') || 'Display a global temperature reading of world stability based on current events.'}
		</p>
	</div>

    <!-- Wikipedia Tooltips in Stories -->
    <div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <div class="mb-2 flex items-center justify-between">
            <label for="wiki-tooltips" class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Show Wikipedia Tooltips in Stories
            </label>
            <button
                id="wiki-tooltips"
                onclick={toggleWikiTooltips}
                type="button"
                class="focus-visible-ring relative inline-flex h-6 w-11 items-center rounded-full transition"
                class:bg-blue-600={experimental.showWikipediaTooltips}
                class:bg-gray-200={!experimental.showWikipediaTooltips}
                class:dark:bg-gray-600={!experimental.showWikipediaTooltips}
                role="switch"
                aria-checked={experimental.showWikipediaTooltips}
            >
                <span class="sr-only">Show Wikipedia Tooltips</span>
                <span
                    class="inline-block h-4 w-4 transform rounded-full bg-white transition"
                    class:translate-x-6={experimental.showWikipediaTooltips}
                    class:translate-x-1={!experimental.showWikipediaTooltips}
                ></span>
            </button>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400">
            Enable or disable automatic Wikipedia hover tooltips inside story content.
        </p>
    </div>

    <!-- Disable Tooltips in Headlines -->
    <div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <div class="mb-2 flex items-center justify-between">
            <label for="wiki-headlines" class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Disable Wikipedia Tooltips in Headlines
            </label>
            <button
                id="wiki-headlines"
                onclick={toggleDisableWikiHeadlines}
                type="button"
                class="focus-visible-ring relative inline-flex h-6 w-11 items-center rounded-full transition"
                class:bg-blue-600={experimental.disableWikiTooltipsInHeadlines}
                class:bg-gray-200={!experimental.disableWikiTooltipsInHeadlines}
                class:dark:bg-gray-600={!experimental.disableWikiTooltipsInHeadlines}
                role="switch"
                aria-checked={experimental.disableWikiTooltipsInHeadlines}
            >
                <span class="sr-only">Disable tooltips in headlines</span>
                <span
                    class="inline-block h-4 w-4 transform rounded-full bg-white transition"
                    class:translate-x-6={experimental.disableWikiTooltipsInHeadlines}
                    class:translate-x-1={!experimental.disableWikiTooltipsInHeadlines}
                ></span>
            </button>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400">
            Prevent Wikipedia links from being added to story headlines, questions, and similar titles.
        </p>
    </div>

</div> 