// Utility to auto-link organization/company names to Wikipedia in the client.
// Heuristic: detect capitalised phrases ending with suffixes like Inc., Corp, Ltd, University, Bank, Agency,
// or phrases starting with The and multiple capitalised words e.g. "United Nations".

import { experimental } from '$lib/stores/experimental.svelte.js';
import { resolveWikiTitleWithContext, type WikiResolveResult } from '$lib/utils/wikiResolver';

const orgCache = new Map<string, string>(); // phrase -> wikiTitle or '' if rejected

const SKIP_SELECTOR = '[data-no-wiki]';
const HEADING_SELECTOR = 'h1,h2,h3,h4,h5,h6,[role="heading"],.question-title,.question-heading';

// Generic terms that are too broad and should not trigger Wikipedia look-ups
const GENERIC_WORDS = new Set([
  'government', 'ministry', 'minister', 'state', 'agency', 'committee', 'commission',
  'university', 'college', 'council', 'assembly', 'department', 'court', 'bank',
  'company', 'corporation', 'inc', 'organisation', 'organization'
]);

// old searchWiki removed – use resolver

export async function autoLinkOrgs(root: HTMLElement) {
  if (!root || !experimental.showWikipediaTooltips) return;

  // Regex captures phrases like "Apple Inc.", "World Health Organization", "The United Nations"
  const suffixes = '(?:Inc|Corp|Corporation|Ltd|LLC|University|College|Bank|Agency|Committee|Organization|Organisation|Institute|Association|Company)\\.?' ;
  const orgRegex = new RegExp(`\\b(?:The\\s+)?([A-Z][a-zA-Z]+(?:\\s+[A-Z][a-zA-Z]+){0,3}\\s+${suffixes}|[A-Z][a-zA-Z]+(?:\\s+[A-Z][a-zA-Z]+){1,4})\\b`, 'g');

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node || !node.textContent) return NodeFilter.FILTER_REJECT;
      if (node.textContent.length < 6) return NodeFilter.FILTER_REJECT;
      // Skip inside existing wiki links or excluded areas
      const el = node.parentElement as HTMLElement;
      if (el?.closest('a')) return NodeFilter.FILTER_REJECT; // already inside link
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
        // skip if generic term
        if (GENERIC_WORDS.has(phrase.trim().toLowerCase())) return;

        const res: WikiResolveResult | null = await resolveWikiTitleWithContext(phrase, 'organisation');
        if (!res) return;
        const wikiTitle = res.title;
        const qid = res.qid;
        if (!textNode.parentNode) return;

        const anchor = document.createElement('a');
        anchor.textContent = phrase;
        const wikiId = qid && qid !== '' ? qid : encodeURIComponent(wikiTitle.replace(/ /g, '_'));
        anchor.setAttribute('data-wiki-id', wikiId);
        const wikiUrl = `https://en.wikipedia.org/wiki/${wikiId}`;
        // Do NOT set href to avoid accidental navigation during hover
        anchor.setAttribute('data-url', wikiUrl);
        anchor.className = 'text-blue-500 hover:underline cursor-pointer';
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