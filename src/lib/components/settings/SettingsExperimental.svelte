<script lang="ts">
  import { s } from "$lib/client/localization.svelte";
  import { experimental } from "$lib/stores/experimental.svelte.js";
  import Icon from "$lib/components/Icon.svelte";

  // Toggle handlers
  function toggleArticleIcons() {
    experimental.toggleFeature("showArticleIcons");
  }

  function toggleUseArticleEmojis() {
    experimental.toggleFeature("useArticleEmojis");
  }

  function toggleCategoryIcons() {
    experimental.toggleFeature("showCategoryIcons");
  }

  function toggleUseCategoryEmojis() {
    experimental.toggleFeature("useCategoryEmojis");
  }

  function toggleDisableCategorySwipe() {
    experimental.toggleFeature("disableCategorySwipe");
  }

  function toggleChaosIndex() {
    experimental.toggleFeature("showChaosIndex");
  }

  function toggleWikiTooltips() {
    experimental.toggleFeature("showWikipediaTooltips");
  }

  function toggleDisableWikiHeadlines() {
    experimental.toggleFeature("disableWikiTooltipsInHeadlines");
  }

  function togglePreferIconifyIcons() {
    experimental.toggleFeature("preferIconifyIcons");
  }

  function toggleDisableStoryScrolling() {
    experimental.toggleFeature("disableStoryScrolling");
  }

  function setSourceIconPosition(
    position: "none" | "inline" | "section-end" | "story-end",
  ) {
    experimental.setFeature("sourceIconPosition", position);
  }

  function toggleCollapseOtherStories() {
    experimental.toggleFeature("collapseOtherStories");
  }

  function toggleEnableTimeTravel() {
    experimental.toggleFeature("enableTimeTravel");
  }

  function toggleEnableHistoricalLoadMore() {
    experimental.toggleFeature("enableHistoricalLoadMore");
  }

  function toggleAutoTopUpShortDays() {
    experimental.toggleFeature("autoTopUpShortDays");
  }

  function setEntityLinkingMode(mode: "mixed" | "wikidata" | "dbpedia") {
    experimental.setFeature("entityLinkingMode", mode);
  }

  // Article/Category display helper functions
  // Unified decoration style and target toggles
  type VisualMode = "none" | "icons" | "emojis";

  let styleMode: VisualMode;
  let headlinesOn: boolean;
  let categoriesOn: boolean;

  // Derive current state from individual feature flags
  $: styleMode =
    experimental.showArticleIcons || experimental.showCategoryIcons
      ? "icons"
      : experimental.useArticleEmojis || experimental.useCategoryEmojis
        ? "emojis"
        : "none";

  $: headlinesOn =
    experimental.showArticleIcons || experimental.useArticleEmojis;
  $: categoriesOn =
    experimental.showCategoryIcons || experimental.useCategoryEmojis;

  // Initialize with Icons as default for headlines if nothing is set
  $: if (!headlinesOn && !categoriesOn && styleMode === "none") {
    experimental.setFeatures({ showArticleIcons: true });
  }

  // Dynamic text based on current style
  $: decorationType =
    styleMode === "icons"
      ? "Icons"
      : styleMode === "emojis"
        ? "Emojis"
        : "Decorations";
  $: headlineDescription =
    styleMode === "icons"
      ? "Show icons on story titles and article headlines."
      : styleMode === "emojis"
        ? "Show emojis on story titles and article headlines."
        : "Show decorations on story titles and article headlines.";
  $: categoryDescription =
    styleMode === "icons"
      ? "Show icons on category tags and filters."
      : styleMode === "emojis"
        ? "Show emojis on category tags and filters."
        : "Show decorations on category tags and filters.";

  /** Apply current style to headlines/categories depending on toggle state */
  function applyStyleToTargets() {
    // Headlines (story titles)
    if (headlinesOn) {
      experimental.setFeatures(
        styleMode === "icons"
          ? { showArticleIcons: true, useArticleEmojis: false }
          : styleMode === "emojis"
            ? { showArticleIcons: false, useArticleEmojis: true }
            : { showArticleIcons: false, useArticleEmojis: false },
      );
    } else {
      experimental.setFeatures({
        showArticleIcons: false,
        useArticleEmojis: false,
      });
    }

    // Categories (pills)
    if (categoriesOn) {
      experimental.setFeatures(
        styleMode === "icons"
          ? { showCategoryIcons: true, useCategoryEmojis: false }
          : styleMode === "emojis"
            ? { showCategoryIcons: false, useCategoryEmojis: true }
            : { showCategoryIcons: false, useCategoryEmojis: false },
      );
    } else {
      experimental.setFeatures({
        showCategoryIcons: false,
        useCategoryEmojis: false,
      });
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
    ⚠️ <span class="ml-1"
      >{s("settings.experimental.warning") ||
        "These features are experimental and may change or be removed in future versions."}</span
    >
  </p>

  <!-- Visual Decoration Style -->
  <div class="mb-6">
    <div class="mb-3 flex items-center justify-between">
      <span
        class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <Icon icon="tabler:palette" class="mr-2 h-4 w-4" />
        Decoration Style
      </span>
    </div>
    <div
      class="flex w-full rounded-lg border border-gray-200 dark:border-gray-600"
      role="group"
    >
      <button
        onclick={() => setVisualMode("none")}
        type="button"
        class="relative flex-1 items-center justify-center rounded-l-lg border-r border-gray-200 px-3 py-2 text-sm font-medium transition-colors focus:z-10 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none dark:border-gray-600"
        class:bg-blue-600={styleMode === "none"}
        class:text-white={styleMode === "none"}
        class:bg-white={styleMode !== "none"}
        class:text-gray-700={styleMode !== "none"}
        class:hover:bg-gray-50={styleMode !== "none"}
        class:dark:bg-blue-600={styleMode === "none"}
        class:dark:text-white={styleMode === "none"}
        class:dark:bg-gray-800={styleMode !== "none"}
        class:dark:text-gray-300={styleMode !== "none"}
        class:dark:hover:bg-gray-700={styleMode !== "none"}
        aria-pressed={styleMode === "none"}
      >
        None
      </button>
      <button
        onclick={() => setVisualMode("icons")}
        type="button"
        class="relative flex-1 items-center justify-center border-r border-gray-200 px-3 py-2 text-sm font-medium transition-colors focus:z-10 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none dark:border-gray-600"
        class:bg-blue-600={styleMode === "icons"}
        class:text-white={styleMode === "icons"}
        class:bg-white={styleMode !== "icons"}
        class:text-gray-700={styleMode !== "icons"}
        class:hover:bg-gray-50={styleMode !== "icons"}
        class:dark:bg-blue-600={styleMode === "icons"}
        class:dark:text-white={styleMode === "icons"}
        class:dark:bg-gray-800={styleMode !== "icons"}
        class:dark:text-gray-300={styleMode !== "icons"}
        class:dark:hover:bg-gray-700={styleMode !== "icons"}
        aria-pressed={styleMode === "icons"}
      >
        Icons
      </button>
      <button
        onclick={() => setVisualMode("emojis")}
        type="button"
        class="relative flex-1 items-center justify-center rounded-r-lg px-3 py-2 text-sm font-medium transition-colors focus:z-10 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
        class:bg-blue-600={styleMode === "emojis"}
        class:text-white={styleMode === "emojis"}
        class:bg-white={styleMode !== "emojis"}
        class:text-gray-700={styleMode !== "emojis"}
        class:hover:bg-gray-50={styleMode !== "emojis"}
        class:dark:bg-blue-600={styleMode === "emojis"}
        class:dark:text-white={styleMode === "emojis"}
        class:dark:bg-gray-800={styleMode !== "emojis"}
        class:dark:text-gray-300={styleMode !== "emojis"}
        class:dark:hover:bg-gray-700={styleMode !== "emojis"}
        aria-pressed={styleMode === "emojis"}
      >
        Emojis
      </button>
    </div>
    <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
      Select visual decoration style for headlines and categories.
    </p>
  </div>

  <!-- Apply to Headlines - Hidden when None is selected -->
  {#if styleMode !== "none"}
    <div class="mb-6">
      <div class="mb-2 flex items-center justify-between">
        <label
          for="toggle-headlines"
          class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          <Icon icon="tabler:news" class="mr-2 h-4 w-4" />
          Apply {decorationType} to Headlines
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
          <span class="sr-only"
            >Toggle headlines {decorationType.toLowerCase()}</span
          >
          <span
            class="inline-block h-4 w-4 transform rounded-full bg-white transition"
            class:translate-x-6={headlinesOn}
            class:translate-x-1={!headlinesOn}
          ></span>
        </button>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {headlineDescription}
      </p>
    </div>

    <!-- Apply to Categories - Hidden when None is selected -->
    <div class="mb-6">
      <div class="mb-2 flex items-center justify-between">
        <label
          for="toggle-categories"
          class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          <Icon icon="tabler:tags" class="mr-2 h-4 w-4" />
          Apply {decorationType} to Categories
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
          <span class="sr-only"
            >Toggle categories {decorationType.toLowerCase()}</span
          >
          <span
            class="inline-block h-4 w-4 transform rounded-full bg-white transition"
            class:translate-x-6={categoriesOn}
            class:translate-x-1={!categoriesOn}
          ></span>
        </button>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {categoryDescription}
      </p>
    </div>
  {/if}

  <!-- Disable Category Swipe (Mobile Only) -->
  <div class="mb-6 md:hidden">
    <div class="mb-2 flex items-center justify-between">
      <label
        for="disable-category-swipe"
        class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <Icon icon="tabler:swipe" class="mr-2 h-4 w-4" />
        Disable Category Swipe
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
        <span class="sr-only">Disable category swipe</span>
        <span
          class="inline-block h-4 w-4 transform rounded-full bg-white transition"
          class:translate-x-6={experimental.disableCategorySwipe}
          class:translate-x-1={!experimental.disableCategorySwipe}
        ></span>
      </button>
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400">
      Disable horizontal swipe gestures for changing categories on mobile.
    </p>
  </div>

  <!-- Chaos Index -->
  <div class="mb-6">
    <div class="mb-2 flex items-center justify-between">
      <label
        for="show-chaos-index"
        class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <Icon icon="tabler:activity" class="mr-2 h-4 w-4" />
        Show World Tension Index
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
        <span class="sr-only">Show World Tension Index</span>
        <span
          class="inline-block h-4 w-4 transform rounded-full bg-white transition"
          class:translate-x-6={experimental.showChaosIndex}
          class:translate-x-1={!experimental.showChaosIndex}
        ></span>
      </button>
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400">
      Display a global stability indicator based on current events.
    </p>
  </div>

  <!-- Wikipedia Tooltips in Stories -->
  <div class="mb-6">
    <div class="mb-2 flex items-center justify-between">
      <label
        for="wiki-tooltips"
        class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <Icon icon="tabler:tooltip" class="mr-2 h-4 w-4" />
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
      Show Wikipedia tooltips when hovering over terms in stories.
    </p>
  </div>

  <!-- Disable Tooltips in Headlines -->
  <div class="mb-6">
    <div class="mb-2 flex items-center justify-between">
      <label
        for="wiki-headlines"
        class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <Icon icon="tabler:eye-off" class="mr-2 h-4 w-4" />
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
      Remove Wikipedia tooltips from headlines and titles.
    </p>
  </div>

  <!-- Prefer Iconify Icons -->
  <div class="mb-6">
    <div class="mb-2 flex items-center justify-between">
      <label
        for="prefer-iconify"
        class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <Icon icon="tabler:brand-tabler" class="mr-2 h-4 w-4" />
        Prefer Iconify Icons Over Brand Logos
      </label>
      <button
        id="prefer-iconify"
        onclick={togglePreferIconifyIcons}
        type="button"
        class="focus-visible-ring relative inline-flex h-6 w-11 items-center rounded-full transition"
        class:bg-blue-600={experimental.preferIconifyIcons}
        class:bg-gray-200={!experimental.preferIconifyIcons}
        class:dark:bg-gray-600={!experimental.preferIconifyIcons}
        role="switch"
        aria-checked={experimental.preferIconifyIcons}
      >
        <span class="sr-only">Prefer Iconify icons</span>
        <span
          class="inline-block h-4 w-4 transform rounded-full bg-white transition"
          class:translate-x-6={experimental.preferIconifyIcons}
          class:translate-x-1={!experimental.preferIconifyIcons}
        ></span>
      </button>
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400">
      Use consistent Iconify icons instead of brand-specific logo URLs for
      source favicons.
    </p>
  </div>

  <!-- Disable Story Scrolling -->
  <div class="mb-6">
    <div class="mb-2 flex items-center justify-between">
      <label
        for="disable-story-scrolling"
        class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <Icon icon="tabler:hand-stop" class="mr-2 h-4 w-4" />
        Disable Story Scrolling
      </label>
      <button
        id="disable-story-scrolling"
        onclick={toggleDisableStoryScrolling}
        type="button"
        class="focus-visible-ring relative inline-flex h-6 w-11 items-center rounded-full transition"
        class:bg-blue-600={experimental.disableStoryScrolling}
        class:bg-gray-200={!experimental.disableStoryScrolling}
        class:dark:bg-gray-600={!experimental.disableStoryScrolling}
        role="switch"
        aria-checked={experimental.disableStoryScrolling}
      >
        <span class="sr-only">Disable story scrolling</span>
        <span
          class="inline-block h-4 w-4 transform rounded-full bg-white transition"
          class:translate-x-6={experimental.disableStoryScrolling}
          class:translate-x-1={!experimental.disableStoryScrolling}
        ></span>
      </button>
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400">
      Prevent automatic scrolling when clicking on story titles.
    </p>
  </div>

  <!-- Source Icon Position -->
  <div class="mb-6">
    <div class="mb-3 flex items-center justify-between">
      <span
        class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <Icon icon="tabler:sitemap" class="mr-2 h-4 w-4" />
        Source Icon Position
      </span>
    </div>
    <div
      class="flex w-full rounded-lg border border-gray-200 dark:border-gray-600"
      role="group"
    >
      <button
        onclick={() => setSourceIconPosition("none")}
        type="button"
        class="relative flex-1 items-center justify-center rounded-l-lg border-r border-gray-200 px-3 py-2 text-sm font-medium transition-colors focus:z-10 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none dark:border-gray-600"
        class:bg-blue-600={experimental.sourceIconPosition === "none"}
        class:text-white={experimental.sourceIconPosition === "none"}
        class:bg-white={experimental.sourceIconPosition !== "none"}
        class:text-gray-700={experimental.sourceIconPosition !== "none"}
        class:hover:bg-gray-50={experimental.sourceIconPosition !== "none"}
        class:dark:bg-blue-600={experimental.sourceIconPosition === "none"}
        class:dark:text-white={experimental.sourceIconPosition === "none"}
        class:dark:bg-gray-800={experimental.sourceIconPosition !== "none"}
        class:dark:text-gray-300={experimental.sourceIconPosition !== "none"}
        class:dark:hover:bg-gray-700={experimental.sourceIconPosition !==
          "none"}
        aria-pressed={experimental.sourceIconPosition === "none"}
      >
        None
      </button>
      <button
        onclick={() => setSourceIconPosition("inline")}
        type="button"
        class="relative flex-1 items-center justify-center border-r border-gray-200 px-3 py-2 text-sm font-medium transition-colors focus:z-10 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none dark:border-gray-600"
        class:bg-blue-600={experimental.sourceIconPosition === "inline"}
        class:text-white={experimental.sourceIconPosition === "inline"}
        class:bg-white={experimental.sourceIconPosition !== "inline"}
        class:text-gray-700={experimental.sourceIconPosition !== "inline"}
        class:hover:bg-gray-50={experimental.sourceIconPosition !== "inline"}
        class:dark:bg-blue-600={experimental.sourceIconPosition === "inline"}
        class:dark:text-white={experimental.sourceIconPosition === "inline"}
        class:dark:bg-gray-800={experimental.sourceIconPosition !== "inline"}
        class:dark:text-gray-300={experimental.sourceIconPosition !== "inline"}
        class:dark:hover:bg-gray-700={experimental.sourceIconPosition !==
          "inline"}
        aria-pressed={experimental.sourceIconPosition === "inline"}
      >
        Inline
      </button>
      <button
        onclick={() => setSourceIconPosition("section-end")}
        type="button"
        class="relative flex-1 items-center justify-center border-r border-gray-200 px-3 py-2 text-sm font-medium transition-colors focus:z-10 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none dark:border-gray-600"
        class:bg-blue-600={experimental.sourceIconPosition === "section-end"}
        class:text-white={experimental.sourceIconPosition === "section-end"}
        class:bg-white={experimental.sourceIconPosition !== "section-end"}
        class:text-gray-700={experimental.sourceIconPosition !== "section-end"}
        class:hover:bg-gray-50={experimental.sourceIconPosition !==
          "section-end"}
        class:dark:bg-blue-600={experimental.sourceIconPosition ===
          "section-end"}
        class:dark:text-white={experimental.sourceIconPosition ===
          "section-end"}
        class:dark:bg-gray-800={experimental.sourceIconPosition !==
          "section-end"}
        class:dark:text-gray-300={experimental.sourceIconPosition !==
          "section-end"}
        class:dark:hover:bg-gray-700={experimental.sourceIconPosition !==
          "section-end"}
        aria-pressed={experimental.sourceIconPosition === "section-end"}
      >
        Section End
      </button>
      <button
        onclick={() => setSourceIconPosition("story-end")}
        type="button"
        class="relative flex-1 items-center justify-center rounded-r-lg px-3 py-2 text-sm font-medium transition-colors focus:z-10 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
        class:bg-blue-600={experimental.sourceIconPosition === "story-end"}
        class:text-white={experimental.sourceIconPosition === "story-end"}
        class:bg-white={experimental.sourceIconPosition !== "story-end"}
        class:text-gray-700={experimental.sourceIconPosition !== "story-end"}
        class:hover:bg-gray-50={experimental.sourceIconPosition !== "story-end"}
        class:dark:bg-blue-600={experimental.sourceIconPosition === "story-end"}
        class:dark:text-white={experimental.sourceIconPosition === "story-end"}
        class:dark:bg-gray-800={experimental.sourceIconPosition !== "story-end"}
        class:dark:text-gray-300={experimental.sourceIconPosition !==
          "story-end"}
        class:dark:hover:bg-gray-700={experimental.sourceIconPosition !==
          "story-end"}
        aria-pressed={experimental.sourceIconPosition === "story-end"}
      >
        Story End
      </button>
    </div>
    <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
      Control where source icons appear: none (disabled), inline with content,
      at the end of each section, or only at the end of the story.
    </p>
  </div>

  <!-- Collapse Other Stories -->
  <div class="mb-6">
    <div class="mb-2 flex items-center justify-between">
      <label
        for="collapse-other-stories"
        class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <Icon icon="tabler:fold" class="mr-2 h-4 w-4" />
        Collapse Other Stories When Opening New Story
      </label>
      <button
        id="collapse-other-stories"
        onclick={toggleCollapseOtherStories}
        type="button"
        class="focus-visible-ring relative inline-flex h-6 w-11 items-center rounded-full transition"
        class:bg-blue-600={experimental.collapseOtherStories}
        class:bg-gray-200={!experimental.collapseOtherStories}
        class:dark:bg-gray-600={!experimental.collapseOtherStories}
        role="switch"
        aria-checked={experimental.collapseOtherStories}
      >
        <span class="sr-only">Collapse other stories</span>
        <span
          class="inline-block h-4 w-4 transform rounded-full bg-white transition"
          class:translate-x-6={experimental.collapseOtherStories}
          class:translate-x-1={!experimental.collapseOtherStories}
        ></span>
      </button>
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400">
      When enabled (default), opening a new story will automatically collapse
      any previously expanded stories. When disabled, multiple stories can be
      expanded simultaneously.
    </p>
  </div>

  <!-- Enable History Manager / Time Travel -->
  <div class="mb-6">
    <div class="mb-2 flex items-center justify-between">
      <label
        for="enable-time-travel"
        class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <Icon icon="tabler:clock" class="mr-2 h-4 w-4" />
        Enable History Manager / Time Travel
      </label>
      <button
        id="enable-time-travel"
        onclick={toggleEnableTimeTravel}
        type="button"
        class="focus-visible-ring relative inline-flex h-6 w-11 items-center rounded-full transition"
        class:bg-blue-600={experimental.enableTimeTravel}
        class:bg-gray-200={!experimental.enableTimeTravel}
        class:dark:bg-gray-600={!experimental.enableTimeTravel}
        role="switch"
        aria-checked={experimental.enableTimeTravel}
      >
        <span class="sr-only">Enable Time Travel</span>
        <span
          class="inline-block h-4 w-4 transform rounded-full bg-white transition"
          class:translate-x-6={experimental.enableTimeTravel}
          class:translate-x-1={!experimental.enableTimeTravel}
        ></span>
      </button>
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400">
      Show the history/time-travel button and enable URL history management.
    </p>
  </div>

  <!-- Enable Historical Load More -->
  <div class="mb-6">
    <div class="mb-2 flex items-center justify-between">
      <label
        for="enable-historical-load"
        class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <Icon icon="tabler:history" class="mr-2 h-4 w-4" />
        Enable Historical Load More
      </label>
      <button
        id="enable-historical-load"
        onclick={toggleEnableHistoricalLoadMore}
        type="button"
        class="focus-visible-ring relative inline-flex h-6 w-11 items-center rounded-full transition"
        class:bg-blue-600={experimental.enableHistoricalLoadMore}
        class:bg-gray-200={!experimental.enableHistoricalLoadMore}
        class:dark:bg-gray-600={!experimental.enableHistoricalLoadMore}
        role="switch"
        aria-checked={experimental.enableHistoricalLoadMore}
      >
        <span class="sr-only">Enable historical load more</span>
        <span
          class="inline-block h-4 w-4 transform rounded-full bg-white transition"
          class:translate-x-6={experimental.enableHistoricalLoadMore}
          class:translate-x-1={!experimental.enableHistoricalLoadMore}
        ></span>
      </button>
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400">
      Show the load-more control below the story list. When disabled (default),
      the button only appears in the empty-state card.
    </p>
  </div>

  <!-- Auto top-up short days -->
  <div class="mb-6">
    <div class="mb-2 flex items-center justify-between">
      <label
        for="auto-topup"
        class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <Icon icon="tabler:download" class="mr-2 h-4 w-4" />
        Auto top-up short days
      </label>
      <button
        id="auto-topup"
        onclick={toggleAutoTopUpShortDays}
        type="button"
        class="focus-visible-ring relative inline-flex h-6 w-11 items-center rounded-full transition"
        class:bg-blue-600={experimental.autoTopUpShortDays}
        class:bg-gray-200={!experimental.autoTopUpShortDays}
        class:dark:bg-gray-600={!experimental.autoTopUpShortDays}
        role="switch"
        aria-checked={experimental.autoTopUpShortDays}
      >
        <span class="sr-only">Auto top-up short days</span>
        <span
          class="inline-block h-4 w-4 transform rounded-full bg-white transition"
          class:translate-x-6={experimental.autoTopUpShortDays}
          class:translate-x-1={!experimental.autoTopUpShortDays}
        ></span>
      </button>
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400">
      When a category has very few stories today (≤ 3), automatically fetch a
      small number of recent stories from yesterday to fill the list.
    </p>
  </div>

  <!-- Entity Linking Mode -->
  <div class="mb-6">
    <div class="mb-3 flex items-center justify-between">
      <span
        class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <Icon icon="tabler:link" class="mr-2 h-4 w-4" />
        Wikipedia Entity Linking Mode
      </span>
    </div>
    <div
      class="flex w-full rounded-lg border border-gray-200 dark:border-gray-600"
      role="group"
    >
      <!-- Mixed (default) -->
      <button
        onclick={() => setEntityLinkingMode("mixed")}
        type="button"
        class="relative flex-1 items-center justify-center rounded-l-lg border-r border-gray-200 px-3 py-2 text-sm font-medium transition-colors focus:z-10 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none dark:border-gray-600"
        class:bg-blue-600={experimental.entityLinkingMode === "mixed"}
        class:text-white={experimental.entityLinkingMode === "mixed"}
        class:bg-white={experimental.entityLinkingMode !== "mixed"}
        class:text-gray-700={experimental.entityLinkingMode !== "mixed"}
        class:hover:bg-gray-50={experimental.entityLinkingMode !== "mixed"}
        class:dark:bg-blue-600={experimental.entityLinkingMode === "mixed"}
        class:dark:text-white={experimental.entityLinkingMode === "mixed"}
        class:dark:bg-gray-800={experimental.entityLinkingMode !== "mixed"}
        class:dark:text-gray-300={experimental.entityLinkingMode !== "mixed"}
        class:dark:hover:bg-gray-700={experimental.entityLinkingMode !== "mixed"}
        aria-pressed={experimental.entityLinkingMode === "mixed"}
      >
        Mixed
      </button>
      <!-- Wikidata -->
      <button
        onclick={() => setEntityLinkingMode("wikidata")}
        type="button"
        class="relative flex-1 items-center justify-center border-r border-gray-200 px-3 py-2 text-sm font-medium transition-colors focus:z-10 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none dark:border-gray-600"
        class:bg-blue-600={experimental.entityLinkingMode === "wikidata"}
        class:text-white={experimental.entityLinkingMode === "wikidata"}
        class:bg-white={experimental.entityLinkingMode !== "wikidata"}
        class:text-gray-700={experimental.entityLinkingMode !== "wikidata"}
        class:hover:bg-gray-50={experimental.entityLinkingMode !== "wikidata"}
        class:dark:bg-blue-600={experimental.entityLinkingMode === "wikidata"}
        class:dark:text-white={experimental.entityLinkingMode === "wikidata"}
        class:dark:bg-gray-800={experimental.entityLinkingMode !== "wikidata"}
        class:dark:text-gray-300={experimental.entityLinkingMode !== "wikidata"}
        class:dark:hover:bg-gray-700={experimental.entityLinkingMode !==
          "wikidata"}
        aria-pressed={experimental.entityLinkingMode === "wikidata"}
      >
        Wikidata
      </button>
      <!-- DBpedia -->
      <button
        onclick={() => setEntityLinkingMode("dbpedia")}
        type="button"
        class="relative flex-1 items-center justify-center rounded-r-lg px-3 py-2 text-sm font-medium transition-colors focus:z-10 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
        class:bg-blue-600={experimental.entityLinkingMode === "dbpedia"}
        class:text-white={experimental.entityLinkingMode === "dbpedia"}
        class:bg-white={experimental.entityLinkingMode !== "dbpedia"}
        class:text-gray-700={experimental.entityLinkingMode !== "dbpedia"}
        class:hover:bg-gray-50={experimental.entityLinkingMode !== "dbpedia"}
        class:dark:bg-blue-600={experimental.entityLinkingMode === "dbpedia"}
        class:dark:text-white={experimental.entityLinkingMode === "dbpedia"}
        class:dark:bg-gray-800={experimental.entityLinkingMode !== "dbpedia"}
        class:dark:text-gray-300={experimental.entityLinkingMode !== "dbpedia"}
        class:dark:hover:bg-gray-700={experimental.entityLinkingMode !== "dbpedia"}
        aria-pressed={experimental.entityLinkingMode === "dbpedia"}
      >
        DBpedia
      </button>
    </div>
    <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
      Choose how entities are linked: Mixed uses both Wikidata and DBpedia,
      Wikidata uses only Wikidata’s entity linking, and DBpedia uses the
      DBpedia-backed approach.
    </p>
  </div>
</div>
