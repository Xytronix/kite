// Shared utilities for entity auto-linking

import { browser } from '$app/environment';
import { language } from '$lib/stores/language.svelte.js';
import { getWikipediaUrlFromQid } from '$lib/services/wikidataService.js';
import { validateWikipediaEntry } from '$lib/services/wikipediaService.js';
import { wikipediaTooltipManager } from './wikipediaTooltipManager.js';

/**
 * Normalize language code for Wikipedia sub-domains
 */
export function normalizeWikiLang(lang: string | undefined): string {
  if (!lang) return 'en';
  const lower = lang.toLowerCase();
  const overrides: Record<string, string> = {
    'pt-br': 'pt',
    'zh-hans': 'zh',
    'zh-hant': 'zh',
    'nb': 'no'
  };
  if (overrides[lower]) return overrides[lower];
  return lower.split('-')[0] || 'en';
}

/**
 * Get current UI language
 */
export function getCurrentLanguage(): string {
  return (browser ? language.ui : 'en') || 'en';
}

// React to UI language changes by exposing a simple listener registrant
type LangListener = () => void;
const languageListeners: Set<LangListener> = new Set();
export function onLanguageChange(listener: LangListener): () => void {
  languageListeners.add(listener);
  return () => languageListeners.delete(listener);
}
try {
  if (browser) {
    // Observe Svelte store for UI language and notify listeners
    (language as any).subscribe?.(() => {
      languageListeners.forEach((fn) => {
        try { fn(); } catch {}
      });
    });
  }
} catch {}

/**
 * Create Wikipedia link element with proper attributes and event handlers
 */
export async function createWikipediaLink(
  text: string,
  wikiId: string,
  lang?: string
): Promise<HTMLAnchorElement | null> {
  // Resolve URL first to decide whether we should create a link at all
  const currentLang = lang || getCurrentLanguage();
  const wikiLang = normalizeWikiLang(currentLang);

  let wikiUrl: string | null = null;
  if (wikiId.startsWith('Q')) {
    // Only link Q-IDs when a proper Wikipedia sitelink exists
    wikiUrl = await getWikipediaUrlFromQid(wikiId, currentLang);
    if (!wikiUrl) return null; // do not create broken Q-ID links
  } else {
    // Skip pre-validation in browser to avoid CORS/duplicate routing; tooltip fetch will validate
    wikiUrl = `https://${wikiLang}.wikipedia.org/wiki/${wikiId}`;
  }

  const anchor = document.createElement('a');
  anchor.textContent = text;
  anchor.setAttribute('data-wiki-id', wikiId);
  // Keep styling minimal and let the app's existing link styles apply
  anchor.className = 'wiki-link cursor-pointer';

  anchor.setAttribute('data-url', wikiUrl);
  anchor.setAttribute('href', wikiUrl);
  anchor.setAttribute('target', '_blank');
  anchor.setAttribute('rel', 'noopener noreferrer');

  // Downrank obviously media-like pages when surface text is a personal name
  try {
    const looksLikePerson = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(text) || /^Putin$/i.test(text);
    if (looksLikePerson && /\(film\)|\(movie\)|\(tv\)|\(television\)/i.test(wikiId)) {
      return null; // do not create movie links for person-looking text
    }
  } catch {}

  // Prevent default navigation on touch so tooltip can handle the interaction
  anchor.addEventListener('click', (e) => {
    const isTouch = 'ontouchstart' in window || window.innerWidth < 768;
    if (isTouch) {
      e.preventDefault();
    }
  });

  return anchor;
}

/**
 * Compare surface text and Wikipedia title for precision gating.
 * Uses case-insensitive and punctuation-insensitive comparison; allows language fallbacks.
 */
export function isTitleSimilarToText(surfaceText: string, wikiTitle: string): boolean {
  const normalize = (s: string) => s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}+/gu, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
  const a = normalize(surfaceText);
  const b = normalize(wikiTitle);
  if (!a || !b) return false;
  if (a === b) return true;
  // Accept if one contains the other and overlap is substantial
  const minLen = Math.min(a.length, b.length);
  const overlap = a.includes(b) || b.includes(a);
  return overlap && minLen >= 4;
}

/**
 * Safely replace text in DOM node using Range API
 */
export function replaceTextWithElement(
  textNode: Text, 
  startIndex: number, 
  endIndex: number, 
  element: HTMLElement
): boolean {
  try {
    // Verify the node is still valid
    if (!textNode.parentNode || !textNode.textContent) return false;
    // Never replace text if it already sits inside a link
    const parentEl = textNode.parentElement as HTMLElement | null;
    if (parentEl && parentEl.closest('a')) return false;
    
    // Verify the indices are still valid
    const currentText = textNode.textContent;
    if (startIndex < 0 || endIndex > currentText.length || startIndex >= endIndex) {
      return false;
    }

    const range = document.createRange();
    range.setStart(textNode, startIndex);
    range.setEnd(textNode, endIndex);
    range.deleteContents();
    range.insertNode(element);
    
    return true;
  } catch (error) {
    console.warn('Failed to replace text with element:', error);
    return false;
  }
}

/**
 * Check if a node should be skipped for auto-linking
 */
export function shouldSkipNode(node: Node, skipSelector: string, headingSelector: string, disableInHeadlines: boolean): boolean {
  if (!node || !node.textContent) return true;
  
  const element = node.parentElement as HTMLElement;
  if (!element) return true;
  
  // Skip if inside existing links or excluded areas
  if (element.closest('a')) return true;
  if (element.closest('[data-wiki-id]')) return true;
  if (element.closest(skipSelector)) return true;
  if (disableInHeadlines && element.closest(headingSelector)) return true;
  
  return false;
}

/**
 * Check if element or its parents have OnThisDay content
 */
export function hasOnThisDayContent(root: HTMLElement): boolean {
  // Skip auto-linking in OnThisDay content since it already has backend-provided QIDs
  if (root.closest('.onthisday-content') || root.classList.contains('onthisday-content')) {
    return true;
  }
  // Do not block auto-linking merely because a descendant/ancestor already has a Wikipedia link.
  // Stories often include a single pre-existing Wikipedia link (e.g., location in Summary).
  // That should not suppress entity linking for the rest of the content.
  return false;
}

/**
 * Batch process async operations with concurrency limit
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(processor));
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        // result.value is of type Awaited<R>; cast to R for our accumulated results
        results.push(result.value as R);
      }
    }
  }
  
  return results;
}

/**
 * Attach Wikipedia tooltips to all elements with data-wiki-id in a container
 */
export function attachWikipediaTooltips(container: HTMLElement): void {
  wikipediaTooltipManager.attachTooltipsToContainer(container);
}

/**
 * Refresh Wikipedia tooltips after content changes
 */
export function refreshWikipediaTooltips(container: HTMLElement): void {
  wikipediaTooltipManager.refreshTooltips(container);
  try {
    // Cache resolved content URLs to avoid re-loading animations on re-hover
    const links = container.querySelectorAll('a.wiki-link[data-url]');
    links.forEach((a) => {
      const url = a.getAttribute('data-url');
      if (url) {
        a.setAttribute('data-wiki-loaded', 'true');
      }
    });
  } catch {}
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Performance monitoring utility
 */
export class PerformanceMonitor {
  private startTime: number = 0;
  private marks: Map<string, number> = new Map();
  
  start(): void {
    this.startTime = performance.now();
    this.marks.clear();
  }
  
  mark(label: string): void {
    this.marks.set(label, performance.now() - this.startTime);
  }
  
  getResults(): Record<string, number> {
    const results: Record<string, number> = {};
    for (const [label, time] of this.marks) {
      results[label] = Math.round(time * 100) / 100; // Round to 2 decimal places
    }
    results.total = Math.round((performance.now() - this.startTime) * 100) / 100;
    return results;
  }
  
  log(prefix: string = 'AutoLink'): void {
    const results = this.getResults();
    console.debug(`${prefix} Performance:`, results);
  }
}

/**
 * Link a known entity (with a resolved Wikidata QID) across a root container.
 * This will find whole-word occurrences of the provided label and replace the
 * first occurrence in each eligible text node with a Wikipedia link created
 * from the QID. It respects skip areas and headline settings.
 */
export async function linkKnownEntityAcrossRoot(
  root: HTMLElement,
  label: string,
  qid: string,
  lang?: string,
  options?: { 
    treatAsPlace?: boolean; 
    avoidBreakingFullNames?: boolean;
    allowSurnameIfUnambiguous?: boolean; // only link a surname when no conflicting forenames in the same story
    fullNameForSurname?: string; // optional full name for context (e.g., "Donald Trump")
  }
): Promise<void> {
  if (!root || !label || !qid) return;

  const currentLang = lang || getCurrentLanguage();
  const WORD_CHAR = /[\p{L}\p{N}_]/u;

  const findWholeWordIndex = (haystack: string, needle: string): number => {
    if (!needle) return -1;
    let from = 0;
    while (true) {
      const idx = haystack.indexOf(needle, from);
      if (idx === -1) return -1;
      const start = idx;
      const end = idx + needle.length;
      const before = start === 0 ? '' : haystack[start - 1];
      const after = end >= haystack.length ? '' : haystack[end];
      const beforeOk = before === '' || (!WORD_CHAR.test(before) && before !== '-' && before !== '_');
      const afterOk = after === '' || (!WORD_CHAR.test(after) && after !== '-' && after !== '_');
      if (beforeOk && afterOk) return idx;
      from = idx + needle.length;
    }
  };

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        return shouldSkipNode(
          node,
          '[data-no-wiki]',
          'h1,h2,h3,h4,h5,h6,[role="heading"],.question-title,.question-heading',
          false
        ) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  // If linking a surname globally, ensure it is unambiguous within this root
  let surnameAmbiguous = false;
  if (options?.allowSurnameIfUnambiguous) {
    try {
      const surname = label;
      const text = (root.innerText || root.textContent || '').toString();
      const surnameRe = new RegExp(`\\b([A-Z][A-Za-z\u00C0-\u024F'\-]+)\\s+${surname.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'g');
      const forenames = new Set<string>();
      let m: RegExpExecArray | null;
      while ((m = surnameRe.exec(text)) !== null) {
        const first = (m[1] || '').toLowerCase();
        if (first) forenames.add(first);
      }
      // If we have more than one distinct forename attached to the surname, treat as ambiguous
      if (forenames.size > 1) {
        surnameAmbiguous = true;
      }
      // If only one forename and it equals the provided full name's first token, keep allowed
      if (forenames.size === 1 && options?.fullNameForSurname) {
        const providedFirst = options.fullNameForSurname.split(/\s+/)[0]?.toLowerCase();
        if (providedFirst && forenames.has(providedFirst)) {
          surnameAmbiguous = false;
        }
      }
    } catch {}
  }

  // Build alias list (place-friendly)
  const aliases: string[] = [label];
  if (options?.treatAsPlace) {
    const raw = label;
    const beforeComma = raw.split(',')[0]?.trim();
    const noParen = raw.replace(/\([^)]*\)/g, '').trim();
    const stripSuffix = (s: string) => s
      .replace(/\b(City|Province|Region|District|County|Prefecture|State|Municipality|Governorate|Oblast|Krai)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const cands = new Set<string>();
    if (beforeComma && beforeComma.length > 2) cands.add(beforeComma);
    if (noParen && noParen.length > 2) cands.add(noParen);
    cands.add(stripSuffix(beforeComma || raw));
    cands.add(stripSuffix(noParen));
    cands.add(stripSuffix(raw));
    // Special handling for Washington, D.C. variants
    // If any candidate contains "Washington" and DC tokens, generate D.C. and District variants
    try {
      const dcLike = Array.from(cands).find(c => /\bWashington\b/i.test(c) && /(DC|D\.C\.|District of Columbia)/i.test(raw));
      if (dcLike) {
        cands.add('Washington, D.C.');
        cands.add('Washington, DC');
        cands.add('Washington, District of Columbia');
      }
    } catch {}
    const blocked = new Set<string>(['china','united states','united kingdom','russia','india','germany','france','italy','spain','japan','brazil','canada','australia','uk','usa','russian federation']);
    for (const c of cands) {
      const v = c.trim();
      if (v && v.toLowerCase() !== raw.toLowerCase() && !blocked.has(v.toLowerCase())) {
        aliases.push(v);
      }
    }
    // De-duplicate and prefer longer labels
    const uniq = Array.from(new Set(aliases));
    uniq.sort((a,b)=>b.length-a.length);
    aliases.splice(0, aliases.length, ...uniq);
  }

  for (const textNode of textNodes) {
    if (!textNode.parentNode || !textNode.textContent) continue;
    // Skip if already inside a link or wiki-tagged element
    if ((textNode.parentElement?.closest('a, [data-wiki-id]')) != null) continue;

    const text = textNode.textContent;
    let placed = false;
    for (const alias of aliases) {
      if (placed) break;
      const index = findWholeWordIndex(text, alias);
      if (index === -1) continue;

      // If alias is a surname and we detected ambiguity, skip
      if (options?.allowSurnameIfUnambiguous && surnameAmbiguous && alias === label) {
        continue;
      }

      // Optional: avoid breaking full names when linking surnames
      if (options?.avoidBreakingFullNames) {
        try {
          const beforeText = text.slice(0, index);
          const afterText = text.slice(index + alias.length);
          // Find previous word
          const prevMatch = beforeText.match(/([A-Za-z\p{L}][A-Za-z\p{L}'-]*)\s*$/u);
          const nextMatch = afterText.match(/^\s*([A-Za-z\p{L}][A-Za-z\p{L}'-]*)/u);
          const prevWord = prevMatch ? prevMatch[1] : '';
          const nextWord = nextMatch ? nextMatch[1] : '';
          const looksLikeFirstName = prevWord && /^[A-Z][a-z\p{Ll}'-]+$/u.test(prevWord);
          const looksLikeMiddle = nextWord && /^[A-Z][a-z\p{Ll}'-]+$/u.test(nextWord);
          // If preceding word is TitleCase (e.g., Vladimir) and we would create "Vladimir" + linked "Putin",
          // skip to avoid splitting an existing or intended full-name link
          if (looksLikeFirstName && !looksLikeMiddle) {
            continue;
          }
          // Avoid linking surnames when they are part of an organization name like "Trump Foundation"
          const orgSuffixes = new Set([
            'Foundation','Organization','Administration','University','Government','Party','Campaign','Company','Corporation','Corp','Incorporated','Inc','LLC','LLP','Group','Holdings','Bank','Press','Media','Center','Centre','Committee','Council','Association','Institute','Agency'
          ]);
          if (nextWord && orgSuffixes.has(nextWord)) {
            continue;
          }

          // Avoid linking place aliases when followed by organization/media words (e.g., "Washington Post")
          const blockedFollowing = new Set([
            'Post','Times','Journal','Herald','Tribune','Gazette','Chronicle','Press','Media','News','Company','University','College','State','FC','SC','City','Capitals','Wizards','Nationals','Commanders'
          ]);
          const nextToken = afterText.match(/^\s*[,–-]?\s*([A-Za-z\p{L}][A-Za-z\p{L}'-]*)/u)?.[1];
          if (nextToken && blockedFollowing.has(nextToken)) {
            continue;
          }
        } catch {}
      }

      try {
        const link = await createWikipediaLink(alias, qid, currentLang);
        if (!link) continue;

        // Overwrite ambiguous prior links that have same visible text but different data-wiki-id
        try {
          const existingAnchors = root.querySelectorAll('a.wiki-link');
          existingAnchors.forEach((a) => {
            if (a.textContent === alias && a.getAttribute('data-wiki-id') && a.getAttribute('data-wiki-id') !== qid) {
              const tn = document.createTextNode(alias);
              a.replaceWith(tn);
            }
          });
        } catch {}

        const range = document.createRange();
        range.setStart(textNode, index);
        range.setEnd(textNode, index + alias.length);
        range.deleteContents();
        range.insertNode(link);
        placed = true;
      } catch (e) {
        console.debug('linkKnownEntityAcrossRoot failed:', e);
      }
    }
  }
}