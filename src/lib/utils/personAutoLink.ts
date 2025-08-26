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
import { resolveWikiTitleWithContext } from '$lib/utils/wikiResolver';
import { validateWikipediaEntry } from '$lib/services/wikipediaService';

export async function autoLinkPersons(root: HTMLElement) {
  if (!root || !experimental.showWikipediaTooltips) return;

  // Skip auto-linking in OnThisDay content since it already has backend-provided QIDs
  if (root.closest('.onthisday-content') || root.classList.contains('onthisday-content')) {
    console.debug('Skipping person auto-linking: OnThisDay content detected');
    return;
  }

  // Also skip if this element or any parent already has Wikipedia links
  if (root.querySelector('[data-wiki-id]') || root.closest('[data-wiki-id]')) {
    console.debug('Skipping person auto-linking: Existing Wikipedia links detected');
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

  // Basic cache to avoid duplicate fetches in a session
  const wikiCache = new Map<string, string>(); // name -> wikiTitle ("" if not human)

  // Enhanced regex for names with symbols: First Last, First M. Last, O'Connor, Jean-Claude, etc.
  // Supports Unicode characters for international names
  const nameRegex = /\b([A-Z][\p{L}'-]+(?: [A-Z]\.)? [A-Z][\p{L}'-]+)\b/gu;

  const SKIP_SELECTOR = '[data-no-wiki]';
  const HEADING_SELECTOR = 'h1,h2,h3,h4,h5,h6,[role="heading"],.question-title,.question-heading';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      // Skip tiny nodes
      if (!node || !node.textContent || node.textContent.trim().length < 5) return NodeFilter.FILTER_REJECT;
      // Skip inside existing link or excluded regions
      const el = node.parentElement as HTMLElement | null;
      if (el?.closest('a')) return NodeFilter.FILTER_REJECT; // already linked
      if (el?.closest('[data-wiki-id]')) return NodeFilter.FILTER_REJECT; // already has Wikipedia ID
      if (node.parentElement?.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
      if (experimental.disableWikiTooltipsInHeadlines && node.parentElement?.closest(HEADING_SELECTOR)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const candidates: { node: Text; match: string; index: number }[] = [];
  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const text = textNode.textContent as string;
    let match: RegExpExecArray | null;
    nameRegex.lastIndex = 0;
    while ((match = nameRegex.exec(text))) {
      const spanText = match[1];
      candidates.push({ node: textNode, match: spanText, index: match.index });
    }
  }

  // Process candidates in reverse order to avoid index invalidation
  for (const { node, match, index } of candidates.reverse()) {
    // Verify the node is still valid and the text hasn't changed
    if (!node.parentNode || !node.textContent) continue;

    // Skip if it's mostly symbols or too short
    if (match.length < 4 || /^['-]+$/.test(match)) continue;

    // Check if the match is still at the expected position
    const currentText = node.textContent;
    if (index + match.length > currentText.length ||
      currentText.substring(index, index + match.length) !== match) {
      continue;
    }

    // Resolve with context-sensitive helper (kind: human)
    let wikiTitle = wikiCache.get(match);
    let wikiQid: string | undefined = undefined;
    if (wikiTitle === undefined) {
      const res = await resolveWikiTitleWithContext(match, 'human');
      wikiTitle = res?.title || '';
      wikiQid = res?.qid || '';
      wikiCache.set(match, wikiTitle);
    }

    if (!wikiTitle) continue;

    // Validate that this Wikipedia entry exists before creating link
    const checkWikiId = wikiQid && wikiQid !== '' ? wikiQid : encodeURIComponent(wikiTitle.replace(/ /g, '_'));
    const isValid = await validateWikipediaEntry(checkWikiId);
    if (!isValid) continue;

    // Replace substring using Range to avoid cutting words incorrectly
    const anchor = document.createElement('a');
    anchor.textContent = match;
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
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(wikiUrl, '_blank', 'noopener');
    });

    try {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + match.length);
      range.deleteContents();
      range.insertNode(anchor);
    } catch (error) {
      // Skip this replacement if range creation fails
      console.warn('Failed to create range for auto-linking:', error);
      continue;
    }
  }
} 