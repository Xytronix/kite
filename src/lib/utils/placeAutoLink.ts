// Very light client-side heuristic to auto-link place names to Wikipedia.
// Looks for capitalised word sequences (1-4 tokens) optionally preceded by a preposition.
// If Wikipedia search returns a page and its Wikidata item is classified as a place,
// we wrap the text in <a data-wiki-id="…"> so the existing tooltip activates.

import { experimental } from '$lib/stores/experimental.svelte.js';
import { resolveWikiTitleWithContext, type WikiResolveResult } from '$lib/utils/wikiResolver';

const WIKI_CACHE = new Map<string, string>(); // query -> title ("" means rejected)

// Simple helper to query Wikipedia search API and return top title (or '')
async function searchWikiTitle(term: string): Promise<string> {
  const cached = WIKI_CACHE.get(term);
  if (cached !== undefined) return cached;

  try {
    const resp = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        term,
      )}&srlimit=1&format=json&origin=*`,
    );
    if (!resp.ok) {
      WIKI_CACHE.set(term, '');
      return '';
    }
    const data = (await resp.json()) as any;
    const title = data?.query?.search?.[0]?.title as string | undefined;
    WIKI_CACHE.set(term, title || '');
    return title || '';
  } catch {
    WIKI_CACHE.set(term, '');
    return '';
  }
}

const SKIP_SELECTOR = '[data-no-wiki]';
const HEADING_SELECTOR = 'h1,h2,h3,h4,h5,h6,[role="heading"],.question-title,.question-heading';

// Common words that should never trigger a location tooltip. Includes generic geographic terms
// and month names in both English and German to avoid false positives when parsing other languages.
const GENERIC_WORDS = new Set([
  // Generic geographic terms
  'city', 'state', 'country', 'province', 'district', 'region', 'county', 'village',
  'town', 'road', 'street', 'bridge', 'river', 'lake', 'mountain',
  // English month names
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  // German month names
  'januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember',
  // Spanish month names
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  // French month names
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  // Italian month names
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
  // Portuguese month names
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  // Dutch month names
  'januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december',
  // Common German articles / generic words that can be capitalised at sentence start
  'die', 'der', 'das',

  // Generic geographic terms in other languages
  // German
  'stadt', 'provinz', 'bezirk', 'region', 'kreis', 'gemeinde', 'kanton',
  // Spanish
  'ciudad', 'provincia', 'departamento', 'región', 'distrito', 'municipio',
  // French
  'ville', 'province', 'département', 'région', 'district', 'commune',
  // Italian
  'città', 'provincia', 'regione', 'distretto', 'comune',
  // Portuguese
  'cidade', 'província', 'região', 'distrito', 'município',
  // Dutch
  'stad', 'provincie', 'regio', 'district', 'gemeente',

  // Cardinal directions (common false positives) - English
  'north', 'south', 'east', 'west',
  // German
  'nord', 'süd', 'ost', 'west',
  // Spanish
  'norte', 'sur', 'este', 'oeste',
  // French
  'nord', 'sud', 'est', 'ouest',
  // Italian
  'nord', 'sud', 'est', 'ovest',
  // Portuguese
  'norte', 'sul', 'leste', 'oeste',
  // Dutch
  'noord', 'zuid', 'oost', 'west',

  // Weekday names (English)
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  // German
  'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag',
  // Spanish
  'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo',
  // French
  'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche',
  // Italian
  'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica',
  // Portuguese
  'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo',
  // Dutch
  'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'
]);

// Comprehensive list of UN-recognised sovereign states (short English names)
// Lower-cased for quick look-ups
const COUNTRY_NAMES = new Set([
  'afghanistan','albania','algeria','andorra','angola','antigua and barbuda','argentina','armenia','australia',
  'austria','azerbaijan','bahamas','bahrain','bangladesh','barbados','belarus','belgium','belize','benin','bhutan','bolivia','bosnia and herzegovina','botswana','brazil','brunei','bulgaria','burkina faso','burundi','cabo verde','cambodia','cameroon','canada','central african republic','chad','chile','china','colombia','comoros','congo','costa rica','cote d’ivoire','croatia','cuba','cyprus','czechia','democratic republic of the congo','denmark','djibouti','dominica','dominican republic','ecuador','egypt','el salvador','equatorial guinea','eritrea','estonia','eswatini','ethiopia','fiji','finland','france','gabon','gambia','georgia','germany','ghana','greece','grenada','guatemala','guinea','guinea-bissau','guyana','haiti','honduras','hungary','iceland','india','indonesia','iran','iraq','ireland','israel','italy','jamaica','japan','jordan','kazakhstan','kenya','kiribati','kuwait','kyrgyzstan','laos','latvia','lebanon','lesotho','liberia','libya','liechtenstein','lithuania','luxembourg','madagascar','malawi','malaysia','maldives','mali','malta','marshall islands','mauritania','mauritius','mexico','micronesia','moldova','monaco','mongolia','montenegro','morocco','mozambique','myanmar','namibia','nauru','nepal','netherlands','new zealand','nicaragua','niger','nigeria','north korea','north macedonia','norway','oman','pakistan','palau','panama','papua new guinea','paraguay','peru','philippines','poland','portugal','qatar','romania','russia','rwanda','saint kitts and nevis','saint lucia','saint vincent and the grenadines','samoa','san marino','sao tome and principe','saudi arabia','senegal','serbia','seychelles','sierra leone','singapore','slovakia','slovenia','solomon islands','somalia','south africa','south korea','south sudan','spain','sri lanka','sudan','suriname','sweden','switzerland','syria','tajikistan','tanzania','thailand','timor-leste','togo','tonga','trinidad and tobago','tunisia','turkey','turkmenistan','tuvalu','uganda','ukraine','united arab emirates','united kingdom','united states','uruguay','uzbekistan','vanuatu','venezuela','vietnam','yemen','zambia','zimbabwe'
]);

export async function autoLinkPlaces(root: HTMLElement) {
  if (!root || !experimental.showWikipediaTooltips) return;

  // Regex: optional preposition + location phrase of 1-4 capitalised words (supports Unicode letters)
  // Using Unicode property escapes to include characters like "ö" or "É".
  // The `u` flag is mandatory when using `\p{L}`.
  const placeRegex = /\b(?:in|at|from|near|over|across|around|into)?\s*([A-Z][\p{L}]+(?:\s+[A-Z][\p{L}]+){0,3})\b/gu;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node || !node.textContent) return NodeFilter.FILTER_REJECT;
      const txt = node.textContent.trim();
      if (txt.length < 5) return NodeFilter.FILTER_REJECT;
      // Skip if inside an existing wiki link or excluded area
      const el = node.parentElement as HTMLElement;
      if (el?.closest('a')) return NodeFilter.FILTER_REJECT; // already has link
      if (el?.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
      if (experimental.disableWikiTooltipsInHeadlines && el?.closest(HEADING_SELECTOR)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const tasks: Promise<void>[] = [];

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const content = textNode.textContent as string;
    placeRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = placeRegex.exec(content))) {
      const place = match[1];
      const lcPlace = place.toLowerCase();
      // Number of words in the candidate phrase
      const wordCount = place.split(' ').length;

      // Skip clearly generic or short matches
      if (GENERIC_WORDS.has(lcPlace)) continue;
      if (wordCount === 1 && place.length <= 3) continue; // avoid 3-letter fragments like "Rio", "Die", "Beh"

      // Allow single-word match only if it exactly equals a recognised country name
      if (wordCount === 1 && !COUNTRY_NAMES.has(lcPlace)) continue;
      const index = match.index + (match[0].length - place.length); // start of place within node

      tasks.push(
        (async () => {
          const res: WikiResolveResult | null = await resolveWikiTitleWithContext(place, 'place');
          if (!res) return;
          const title = res.title;
          const qid = res.qid;

          // Ensure still in DOM
          if (!textNode.parentNode) return;

          const anchor = document.createElement('a');
          anchor.textContent = place;
          const wikiId = qid && qid !== '' ? qid : encodeURIComponent(title.replace(/ /g, '_'));
          anchor.setAttribute('data-wiki-id', wikiId);
          const wikiUrl = `https://en.wikipedia.org/wiki/${wikiId}`;
          anchor.setAttribute('data-url', wikiUrl);
          anchor.className = 'text-blue-500 hover:underline cursor-pointer';
          anchor.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); window.open(wikiUrl, '_blank', 'noopener'); });

          // Replace using Range to avoid cutting words
          const range = document.createRange();
          range.setStart(textNode, index);
          range.setEnd(textNode, index + place.length);
          range.deleteContents();
          range.insertNode(anchor);
        })(),
      );
    }
  }

  await Promise.allSettled(tasks);
} 