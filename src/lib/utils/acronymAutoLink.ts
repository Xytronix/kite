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
        
        // Validate that this Wikipedia entry exists before creating link
        const checkWikiId = qid && qid !== '' ? qid : encodeURIComponent(title.replace(/ /g, '_'));
        const isValid = await validateWikipediaEntry(checkWikiId);
        if (!isValid) return;
        
        if (!textNode.parentNode) return;
        const anchor = document.createElement('a');
        anchor.textContent = acronym;
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