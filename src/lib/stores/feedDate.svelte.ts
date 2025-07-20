import { writable } from 'svelte/store';

/**
 * Stores the date string (ISO yyyy-mm-dd) that is currently at the
 * top/center of the viewport when scrolling through the StoryList.
 * null means we are on the current day (live feed).
 */
export const feedDate = writable<string | null>(null); 