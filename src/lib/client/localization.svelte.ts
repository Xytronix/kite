import { browser } from "$app/environment";
import { page } from "$app/stores";
import { get } from 'svelte/store';
import { language } from "$lib/stores/language.svelte.js";
import Mustache from "mustache";

export function s(key: string, view?: Record<string, string>, strict = false) {
  // Use server-side strings on server, client-side strings on client
  const strings = browser ? language.strings : get(page).data.strings;
  let value = strings?.[key];

  if (typeof value === "object") {
    value = value?.text;
  }

  if (!value) return strict ? undefined : key;

  return view ? Mustache.render(value, view) : value;
}
