import { experimental } from '$lib/stores/experimental.svelte.js';
import { resolveWikiTitleWithContext } from '$lib/utils/wikiResolver';

export async function autoLinkPersons(root: HTMLElement) {
  if (!root || !experimental.showWikipediaTooltips) return;

  // Basic cache to avoid duplicate fetches in a session
  const wikiCache = new Map<string, string>(); // name -> wikiTitle ("" if not human)

  // Regex for simple First Last or First M. Last patterns, not at sentence start
  const nameRegex = /\b([A-Z][a-z]+(?: [A-Z]\.)? [A-Z][a-z]+)\b/g;

  const SKIP_SELECTOR = '[data-no-wiki]';
  const HEADING_SELECTOR = 'h1,h2,h3,h4,h5,h6,[role="heading"],.question-title,.question-heading';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      // Skip tiny nodes
      if (!node || !node.textContent || node.textContent.trim().length < 5) return NodeFilter.FILTER_REJECT;
      // Skip inside existing link or excluded regions
      const el = node.parentElement as HTMLElement | null;
      if (el?.closest('a')) return NodeFilter.FILTER_REJECT; // already linked
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

  for (const { node, match, index } of candidates) {
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

    // Replace substring using Range to avoid cutting words incorrectly
    const anchor = document.createElement('a');
    anchor.textContent = match;
    const wikiId = wikiQid && wikiQid !== '' ? wikiQid : encodeURIComponent(wikiTitle.replace(/ /g, '_'));
    const wikiUrl = `https://en.wikipedia.org/wiki/${wikiId}`;
    anchor.setAttribute('data-wiki-id', wikiId);
    anchor.setAttribute('data-url', wikiUrl);
    anchor.className = 'text-blue-500 hover:underline cursor-pointer';
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(wikiUrl, '_blank', 'noopener');
    });

    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + match.length);
    range.deleteContents();
    range.insertNode(anchor);
  }
} 