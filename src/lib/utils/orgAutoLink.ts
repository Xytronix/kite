// Utility to auto-link organization/company names to Wikipedia in the client.
// Heuristic: detect capitalised phrases ending with suffixes like Inc., Corp, Ltd, University, Bank, Agency,
// or phrases starting with The and multiple capitalised words e.g. "United Nations".

import { experimental } from '$lib/stores/experimental.svelte.js';
import { language } from '$lib/stores/language.svelte.js';
import { browser } from '$app/environment';
import { resolveQIdToWikipediaUrl } from './qidResolver.js';

// Map language codes used in UI to Wikipedia sub-domains
function normalizeWikiLang(lang: string | undefined): string {
    if (!lang) return 'en';
    const lower = lang.toLowerCase();
    const overrides: Record<string, string> = {
        'pt-br': 'pt',
        'zh-hans': 'zh',
        'zh-hant': 'zh',
        'nb': 'no'
    };
    if (overrides[lower]) return overrides[lower];
    // Take first segment before dash (e.g. "en-us" -> "en")
    return lower.split('-')[0] || 'en';
}
import { resolveWikiTitleWithContext, type WikiResolveResult } from '$lib/utils/wikiResolver';
import { validateWikipediaEntry } from '$lib/services/wikipediaService';

const orgCache = new Map<string, string>(); // phrase -> wikiTitle or '' if rejected

const SKIP_SELECTOR = '[data-no-wiki]';
const HEADING_SELECTOR = 'h1,h2,h3,h4,h5,h6,[role="heading"],.question-title,.question-heading';

// Generic terms that are too broad and should not trigger Wikipedia look-ups
const GENERIC_WORDS = new Set([
  'government', 'ministry', 'minister', 'state', 'agency', 'committee', 'commission',
  'university', 'college', 'council', 'assembly', 'department', 'court', 'bank',
  'company', 'corporation', 'inc', 'organisation', 'organization',
  // Add common symbols-only matches that aren't real organizations
  '&', 'h&m', 'at&t' // These will be handled by the enhanced regex but filtered out if too generic
]);

// old searchWiki removed – use resolver

export async function autoLinkOrgs(root: HTMLElement) {
  if (!root || !experimental.showWikipediaTooltips) return;
  
  // Skip auto-linking in OnThisDay content since it already has backend-provided QIDs
  if (root.closest('.onthisday-content') || root.classList.contains('onthisday-content')) {
    console.debug('Skipping org auto-linking: OnThisDay content detected');
    return;
  }
  
  // Also skip if this element or any parent already has Wikipedia links
  if (root.querySelector('[data-wiki-id]') || root.closest('[data-wiki-id]')) {
    console.debug('Skipping org auto-linking: Existing Wikipedia links detected');
    return;
  }

  // Additional check: if any OnThisDay content exists in the document, be more conservative
  if (document.querySelector('.onthisday-content [data-wiki-id]')) {
    console.debug('OnThisDay content with Wikipedia links detected in document, being conservative with auto-linking');
    // Only auto-link if we're clearly outside any content area that might have backend links
    if (root.closest('article, .story-content, .content, main')) {
      console.debug('Skipping auto-linking: Near content areas that might have backend Wikipedia links');
      return;
    }
  }

  // Regex captures phrases like "Apple Inc.", "World Health Organization", "The United Nations", "AT&T", "H&M"
  const suffixes = '(?:Inc|Corp|Corporation|Ltd|LLC|University|College|Bank|Agency|Committee|Organization|Organisation|Institute|Association|Company)\\.?' ;
  // Enhanced regex to handle symbols like &, apostrophes, hyphens, and Unicode characters
  const orgRegex = new RegExp(`\\b(?:The\\s+)?([A-Z][\\p{L}\\p{N}'&-]+(?:\\s+[A-Z&][\\p{L}\\p{N}'&-]*){0,3}\\s+${suffixes}|[A-Z][\\p{L}\\p{N}'&-]+(?:\\s+[A-Z&][\\p{L}\\p{N}'&-]*){1,4})\\b`, 'gu');

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node || !node.textContent) return NodeFilter.FILTER_REJECT;
      if (node.textContent.length < 6) return NodeFilter.FILTER_REJECT;
      // Skip inside existing wiki links or excluded areas
      const el = node.parentElement as HTMLElement;
      if (el?.closest('a')) return NodeFilter.FILTER_REJECT; // already inside link
      if (el?.closest('[data-wiki-id]')) return NodeFilter.FILTER_REJECT; // already has Wikipedia ID
      if (el?.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
      if (experimental.disableWikiTooltipsInHeadlines && el?.closest(HEADING_SELECTOR)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const tasks: Promise<void>[] = [];

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const txt = textNode.textContent as string;
    orgRegex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = orgRegex.exec(txt))) {
      const phrase = m[1] || m[0];
      const start = m.index + (m[0].length - phrase.length);

      tasks.push((async () => {
        // skip if generic term or too short with symbols
        const cleanPhrase = phrase.trim().toLowerCase();
        if (GENERIC_WORDS.has(cleanPhrase)) return;
        
        // Skip if it's mostly symbols or very short
        if (phrase.length < 3 || /^[&'-]+$/.test(phrase)) return;

        const res: WikiResolveResult | null = await resolveWikiTitleWithContext(phrase, 'organisation');
        if (!res) return;
        const wikiTitle = res.title;
        const qid = res.qid;
        
        // Validate that this Wikipedia entry exists before creating link
        const checkWikiId = qid && qid !== '' ? qid : encodeURIComponent(wikiTitle.replace(/ /g, '_'));
        const isValid = await validateWikipediaEntry(checkWikiId);
        if (!isValid) return;
        
        if (!textNode.parentNode) return;

        const anchor = document.createElement('a');
        anchor.textContent = phrase;
        anchor.setAttribute('data-wiki-id', checkWikiId);
        
        anchor.className = 'text-blue-500 hover:underline cursor-pointer';
        
        // Resolve Q-IDs to proper Wikipedia URLs immediately
        const currentLang = (browser ? language.ui : 'en') || 'en';
        const wikiLang = normalizeWikiLang(currentLang);
        let wikiUrl: string;
        if (checkWikiId.startsWith('Q')) {
          wikiUrl = await resolveQIdToWikipediaUrl(checkWikiId, currentLang);
        } else {
          wikiUrl = `https://${wikiLang}.wikipedia.org/wiki/${checkWikiId}`;
        }
        
        anchor.setAttribute('data-url', wikiUrl);
        anchor.setAttribute('href', wikiUrl);
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noopener noreferrer');
        // Do NOT set href to avoid accidental navigation during hover
        anchor.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          window.open(wikiUrl, '_blank', 'noopener');
        });
        
        const range = document.createRange();
        range.setStart(textNode, start);
        range.setEnd(textNode, start + phrase.length);
        range.deleteContents();
        range.insertNode(anchor);
      })());
    }
  }

  await Promise.allSettled(tasks);
} 