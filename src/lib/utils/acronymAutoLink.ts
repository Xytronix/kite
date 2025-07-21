import { experimental } from '$lib/stores/experimental.svelte.js';
import { resolveWikiTitleWithContext, type WikiResolveResult } from '$lib/utils/wikiResolver';

const acronymCache = new Map<string, string>();

// old searchWiki removed

export async function autoLinkAcronyms(root: HTMLElement) {
  if (!root || !experimental.showWikipediaTooltips) return;
  const acronymRegex = /\(([A-Z]{2,6})\)/g; // captures NASA in (NASA)
  const SKIP_SELECTOR = '[data-no-wiki]';
  const HEADING_SELECTOR = 'h1,h2,h3,h4,h5,h6,[role="heading"],.question-title,.question-heading';

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node || !node.textContent) return NodeFilter.FILTER_REJECT;
      const el = node.parentElement as HTMLElement;
      if (el?.closest('a')) return NodeFilter.FILTER_REJECT; // skip if already link
      if (el?.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
      if (experimental.disableWikiTooltipsInHeadlines && el?.closest(HEADING_SELECTOR)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const promises: Promise<void>[] = [];

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const text = textNode.textContent as string;
    acronymRegex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = acronymRegex.exec(text))) {
      const acronym = m[1];
      const start = m.index + 1; // within parentheses
      promises.push((async () => {
        let cached = acronymCache.get(acronym);
        let title: string = '';
        let qid: string = '';
        if (cached === undefined) {
          const res: WikiResolveResult | null = await resolveWikiTitleWithContext(acronym, 'generic');
          title = res?.title || '';
          qid = res?.qid || '';
          acronymCache.set(acronym, title);
        } else {
          title = cached;
        }
        if (!title) return;
        if (!textNode.parentNode) return;
        const anchor = document.createElement('a');
        anchor.textContent = acronym;
        const wikiId = qid && qid !== '' ? qid : encodeURIComponent(title.replace(/ /g, '_'));
        anchor.setAttribute('data-wiki-id', wikiId);
        const wikiUrl = `https://en.wikipedia.org/wiki/${wikiId}`;
        anchor.setAttribute('data-url', wikiUrl);
        anchor.className = 'text-blue-500 hover:underline cursor-pointer';
        anchor.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); window.open(wikiUrl, '_blank', 'noopener'); });
        const range = document.createRange();
        range.setStart(textNode, start);
        range.setEnd(textNode, start + acronym.length);
        range.deleteContents();
        range.insertNode(anchor);
      })());
    }
  }

  await Promise.allSettled(promises);
} 