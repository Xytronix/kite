<script lang="ts">
  import { s } from "$lib/client/localization.svelte";
  import { dataService, dataReloadService } from "$lib/services/dataService";
  import { experimental } from "$lib/stores/experimental.svelte.js";
  import { feedDate } from "$lib/stores/feedDate.svelte";
  import { language } from "$lib/stores/language.svelte.js";
  import { settings } from "$lib/stores/settings.svelte.js";
  import { theme } from "$lib/stores/theme.svelte.js";
  import { timeTravel } from "$lib/stores/timeTravel.svelte.js";
  import { timeTravelBatch } from "$lib/stores/timeTravelBatch.svelte.js";
  import ChaosIndex from "./ChaosIndex.svelte";
  import Icon from "@iconify/svelte";
  import { get } from "svelte/store";

  // Props
  interface Props {
    totalReadCount?: number;
    totalStoriesRead?: number;
    offlineMode?: boolean;
    getLastUpdated?: string;
    batchTimestamp?: number; // Unix timestamp of the batch creation
    chaosIndex?: {
      score: number;
      summary: string;
      lastUpdated: string;
    };
  }

  const {
    totalReadCount = 0,
    totalStoriesRead = 0,
    offlineMode = false,
    getLastUpdated = "Never",
    batchTimestamp,
    chaosIndex,
  }: Props = $props();

  // Date click state for cycling through different stats
  let dateClickCount = $state(0);

  // Loading state for exiting time travel
  // biome-ignore lint/style/useConst: This $state variable is reassigned in the onclick handler
  let isExitingTimeTravel = $state(false);

  // Theme-aware logo source
  const logoSrc = $derived(
    theme.current === "dark" ? "/svg/kite_dark.svg" : "/svg/kite.svg",
  );

  function handleLogoClick() {
    // Add animation class for 3 seconds
    const logo = document.querySelector(".logo");
    logo?.classList.add("kite-logo");
    setTimeout(() => {
      logo?.classList.remove("kite-logo");
    }, 3000);
  }

  function handleDateClick() {
    dateClickCount = (dateClickCount + 1) % 5;
  }

  // Handle date area keyboard events
  function handleDateKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleDateClick();
    }
  }

  // Helper to capitalize first letter
  function capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Computed date/stats display
  const dateDisplay = $derived.by(() => {
    // If in time travel mode, show the selected date
    if (timeTravel.selectedDate) {
      const dateStr = new Intl.DateTimeFormat(language.locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(timeTravel.selectedDate);
      return capitalizeFirst(dateStr);
    }

    if (dateClickCount === 0) {
      const feedDateValue = get(feedDate);
      // If user scrolled to an older feed date, show that instead of today
      if (feedDateValue) {
        const parsed = new Date(feedDateValue + "T00:00:00Z");
        const dateStr = new Intl.DateTimeFormat(language.locale, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }).format(parsed);
        return capitalizeFirst(dateStr);
      }

      // Default date format (batch date or today)
      const dateToShow = batchTimestamp ? new Date(batchTimestamp * 1000) : new Date();
      const dateStr = new Intl.DateTimeFormat(language.locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(dateToShow);
      return capitalizeFirst(dateStr);
    }
    if (dateClickCount === 1) {
      return getLastUpdated;
    }
    if (dateClickCount === 2) {
      return (
        s("stats.newsToday", { count: totalReadCount.toString() }) ||
        `News today: ${totalReadCount}`
      );
    }
    if (dateClickCount === 3) {
      return (
        s("stats.storiesRead", { count: totalStoriesRead.toString() }) ||
        `Stories read: ${totalStoriesRead}`
      );
    }
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil(
      (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7),
    );
    const day = Math.ceil(
      (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    return (
      s("stats.weekDay", { week: week.toString(), day: day.toString() }) ||
      `Week ${week}, Day ${day}`
    );
  });

  // Update document title when feedDate changes (outside of time travel)
  $effect(() => {
    const feedDateValue = get(feedDate);
    if (!timeTravel.selectedDate) {
      if (feedDateValue) {
        document.title = `${s("app.title") || "Kite"} - ${feedDateValue}`;
      } else {
        document.title = `${s("app.title") || "Kite"} - ${s("app.motto") || "News. Elevated."}`;
      }
    }
  });
</script>

<header class="mb-1">
  <div class="relative flex items-center">
    <div class="flex items-center">
      <img
        src={logoSrc}
        alt={s("app.logo.newsAlt") || "Kite News"}
        class="logo mr-2 h-8 w-8"
        onclick={handleLogoClick}
        role="presentation"
      />
      <h1 class="text-xl font-bold text-gray-800 dark:text-gray-200">
        {s("app.title") || "Kite"}
      </h1>
    </div>

    <div class="absolute left-1/2 flex -translate-x-1/2 transform items-center">
      {#if isExitingTimeTravel}
        <!-- Loading state when exiting time travel -->
        <div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <div
            class="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 dark:border-gray-600 dark:border-t-blue-400"
          ></div>
          <span class="text-sm"
            >{s("timeTravel.returningToLive") || "Returning to live..."}</span
          >
        </div>
      {:else if timeTravel.selectedDate && timeTravelBatch.isTimeTravelMode()}
        <div
          class="flex items-center gap-2 rounded-lg bg-blue-50 px-2 py-1 dark:bg-blue-900/30"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 text-blue-600 dark:text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div class="text-sm font-medium text-blue-600 dark:text-blue-400">
            {dateDisplay}
          </div>
          <button
            onclick={() => {
              // Immediately reset time travel state
              timeTravel.reset();
              timeTravelBatch.set(null);
              dataService.setTimeTravelBatch(null);

              // Navigate to root URL to exit time travel mode
              // Use window.location.href for a clean navigation
              if (typeof window !== "undefined") {
                window.location.href = "/";
              }
            }}
            class="ml-1 rounded p-0.5 transition-colors hover:bg-blue-100 dark:hover:bg-blue-800/50"
            aria-label="Exit time travel mode"
            disabled={isExitingTimeTravel}
            title="Return to current news"
          >
            <svg
              class="h-3 w-3 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      {:else}
        <div
          class="focus-visible-ring cursor-pointer rounded px-1 py-1 text-gray-600 dark:text-gray-400"
          onclick={handleDateClick}
          onkeydown={handleDateKeydown}
          role="button"
          tabindex="0"
          aria-label="Cycle through date and statistics"
        >
          {dateDisplay}
        </div>
      {/if}
      {#if offlineMode}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="ml-1 inline h-4 w-4 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M1 1l22 22M16.72 11.06a9 9 0 010 1.88M5.64 3.77A9.95 9.95 0 0112 2c2.35 0 4.5.78 6.22 2.08M12 18v-3.5M12 14H9"
          />
        </svg>
      {/if}
    </div>

    <div class="ml-auto flex items-center space-x-2">
      <!-- Chaos Index - Hidden on mobile, shown in second row -->
      {#if experimental.showChaosIndex && chaosIndex && chaosIndex.score > 0}
        <div class="hidden md:block">
          <ChaosIndex
            score={chaosIndex.score}
            summary={chaosIndex.summary}
            lastUpdated={chaosIndex.lastUpdated}
          />
        </div>
      {/if}



      {#if experimental.enableTimeTravel}
        <button
          onclick={() => timeTravel.toggle()}
          title={s("header.timeTravel") || "Time Travel"}
          aria-label={s("header.timeTravel") || "Time Travel"}
          class="ml-2"
          type="button"
        >
          <Icon
            icon="tabler:clock"
            class="h-6 w-6 text-gray-600 dark:text-gray-400"
          />
        </button>
      {/if}

      <button
        onclick={() => settings.open()}
        title={s("header.settings") || "Settings"}
        class="ml-2"
        type="button"
      >
        <img
          src="/svg/gear.svg"
          alt=""
          class="h-6 w-6 text-gray-600 dark:text-gray-400 dark:invert"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>

  <!-- Chaos Index on mobile - Second row -->
  {#if experimental.showChaosIndex && chaosIndex && chaosIndex.score > 0}
    <div class="mt-1 md:hidden">
      <ChaosIndex
        score={chaosIndex.score}
        summary={chaosIndex.summary}
        lastUpdated={chaosIndex.lastUpdated}
      />
    </div>
  {/if}
</header>
