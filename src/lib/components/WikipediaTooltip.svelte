<script lang="ts">
  import { browser } from "$app/environment";
  import { s } from "$lib/client/localization.svelte";
  import {
    fetchWikipediaContent,
    fetchWikipediaContentWithEnhancedSearch,
    type WikipediaContent,
  } from "$lib/services/wikipediaService";
  import { language } from "$lib/stores/language.svelte";
  import {
    openMapLocation,
    getMapServiceName,
    isAppleDevice,
  } from "$lib/utils/mapUtils";
  import { scrollLock } from "$lib/utils/scrollLock";
  import { resolveWikiTitleWithContext } from "$lib/utils/wikiResolver";
  import Icon from "@iconify/svelte";
  import {
    useFloating,
    offset,
    flip,
    shift,
    arrow,
    size,
  } from "@skeletonlabs/floating-ui-svelte";
  import { OverlayScrollbarsComponent } from "overlayscrollbars-svelte";
  import { onMount, onDestroy } from "svelte";
  import Portal from "svelte-portal";

  // Helper function to check if wikiId is a Q-ID
  function isQID(wikiId: string): boolean {
    return /^Q\d+$/.test(wikiId);
  }

  // Helper to derive flag emoji from country name using ISO mapping
  const countryToIso: Record<string, string> = {
    "United States": "US",
    "United Kingdom": "GB",
    Canada: "CA",
    Germany: "DE",
    France: "FR",
    Italy: "IT",
    Spain: "ES",
    China: "CN",
    India: "IN",
    Japan: "JP",
    Australia: "AU",
    // add more as needed
  };

  function getFlagEmoji(countryName: string): string {
    const iso = countryToIso[countryName];
    if (!iso) return "";
    const codePoints = [...iso.toUpperCase()].map(
      (c) => 0x1f1e6 + c.charCodeAt(0) - 65,
    );
    return String.fromCodePoint(...codePoints);
  }

  // Helper function to try multiple search variations for location-like content
  // Leverages the existing wikipediaService.ts fallback logic instead of reimplementing it
  async function tryLocationVariations(
    wikiId: string,
    contentLang: string,
  ): Promise<WikipediaContent | null> {
    // For location-like content, try multiple variations
    if (
      wikiId.includes(",") ||
      /\b(city|town|village|county|state|province|territory|island|mountain|river|lake)\b/i.test(
        wikiId,
      )
    ) {
      const variations = [
        wikiId, // Original: "Gaza-Stadt, Palästinensische Gebiete"
        wikiId.split(",")[0].trim(), // First part: "Gaza-Stadt"
        wikiId.replace(/,.*$/, "").trim(), // Remove everything after comma
      ];

      // Remove duplicates
      const uniqueVariations = [...new Set(variations)];

      for (const variation of uniqueVariations) {
        console.debug(
          "Trying Wikipedia search for location variation:",
          variation,
          "in language:",
          contentLang,
        );
        try {
          const result = await fetchWikipediaContent(variation, contentLang);
          if (
            result &&
            result.extract &&
            result.extract !== "Failed to load Wikipedia content."
          ) {
            console.debug(
              "Successfully fetched Wikipedia content for location variation:",
              variation,
            );
            return result;
          }
        } catch (error) {
          console.debug("Failed to fetch variation:", variation, error);
          continue;
        }
      }

      // Final attempt: resolve as place via Wikidata to avoid event pages
      try {
        const base = uniqueVariations[0] || wikiId;
        const resolved = await resolveWikiTitleWithContext(base, "place");
        if (resolved) {
          const qOrTitle = resolved.qid || resolved.title;
          const res = await fetchWikipediaContent(qOrTitle, contentLang);
          if (
            res &&
            res.extract &&
            res.extract !== "Failed to load Wikipedia content."
          ) {
            console.debug("Resolved place via Wikidata:", base, "->", qOrTitle);
            return res;
          }
        }
      } catch (e) {
        console.debug("Place resolution via Wikidata failed:", e);
      }
    }

    return null;
  }

  interface Props {
    onWikipediaClick?: (
      title: string,
      content: string,
      imageUrl?: string,
      wikiUrl?: string,
    ) => void;
    onWikipediaContentFound?: (
      wikiId: string,
      wikiUrl: string,
      title: string,
    ) => void;
  }

  let { onWikipediaClick, onWikipediaContentFound }: Props = $props();

  // State for dynamic sizing
  let tooltipMaxHeight = $state(300);

  // Check if scrollbar is needed
  const needsScrollbar = $derived.by(() => {
    if (!showTooltip || !tooltipContent) return false;

    // Estimate content height based on content length and image presence
    const baseHeight = 120; // Header + padding
    const imageHeight = tooltipImage ? 160 : 0; // Image height if present
    const textHeight = Math.max(60, Math.ceil(tooltipContent.length / 80) * 20); // Rough text height estimation
    const estimatedContentHeight = baseHeight + imageHeight + textHeight;

    return estimatedContentHeight > tooltipMaxHeight;
  });

  // Floating UI setup
  const floating = useFloating({
    placement: "bottom-start",
    strategy: "fixed",
    middleware: [
      offset(12),
      flip({
        fallbackPlacements: [
          "top-start",
          "bottom-end",
          "top-end",
          "bottom",
          "top",
        ],
      }),
      shift({
        padding: 8,
        crossAxis: true,
      }),
      size({
        apply({ availableHeight }) {
          const minHeight = 200;
          const maxHeight = Math.min(500, window.innerHeight * 0.6);
          const optimalHeight = Math.min(
            Math.max(minHeight, availableHeight - 16),
            maxHeight,
          );
          tooltipMaxHeight = optimalHeight;
        },
      }),
    ],
  });

  // State
  let showTooltip = $state(false);
  let tooltipTitle = $state("");
  let tooltipContent = $state("");
  let tooltipImage = $state("");
  let tooltipFullImage = $state("");
  let tooltipWikiUrl = $state("");
  let currentTooltipId = $state("");
  let isMobile = $state(false);
  let isLoading = $state(false);
  let tooltipFlag = $state("");
  let currentWikiId = $state("");
  let currentWikiAttrId = $state("");
  let imageObjectPosition = $state("50% 30%");
  let imageFitMode = $state("contain");
  let currentWikiElementRef: HTMLElement | null = $state(null);
  // Track the language of the currently displayed tooltip content (normalized primary subtag)
  let currentTooltipLang = $state("");

  // Cache loaded Wikipedia content per language and wikiId to avoid refetching on re-hover
  const contentCache = new Map<string, WikipediaContent>();

  // Elements
  let arrowElement: HTMLElement;
  let hideTimeout: number | null = null;
  let showTimeout: number | null = null;
  let lastProcessedId = $state("");
  let lastProcessedTime = $state(0);

  // OverlayScrollbars instance
  let tooltipScrollbars: any = $state();

  // Observer for <html lang> changes (UI language updates)
  let langAttrObserver: MutationObserver | null = null;

  // Detect mobile device
  function detectMobile() {
    try {
      const canHover = typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover)').matches;
      const hasFinePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
      const touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      return (!canHover && !hasFinePointer && touchCapable) || (!canHover && window.innerWidth < 768);
    } catch {
      return 'ontouchstart' in window || window.innerWidth < 768;
    }
  }

  // Get the content language from the current URL
  function getContentLanguage(): string {
    let contentLang = "en"; // Default fallback

    if (browser) {
      try {
        // Get current URL and extract data_lang parameter
        const currentUrl = new URL(window.location.href);
        const dataLang = currentUrl.searchParams.get("data_lang");
        if (dataLang) {
          contentLang = dataLang;
          // Only log language changes, not every usage
        } else {
          // Fallback to current data language
          contentLang = language.data || language.ui || "en";
        }
      } catch (error) {
        console.debug("Failed to parse URL for content language:", error);
        contentLang = language.data || language.ui || "en";
      }
    } else {
      contentLang = language.data || language.ui || "en";
    }

    // Handle "default" language - resolve to English or browser language
    if (contentLang === "default") {
      if (browser) {
        // Use browser's primary language, fallback to English
        const browserLang = navigator.language.split("-")[0];
        contentLang = browserLang || "en";
        console.debug(
          'Resolved "default" language to browser language:',
          contentLang,
        );
      } else {
        contentLang = "en";
        console.debug('Resolved "default" language to English (server-side)');
      }
    }

    return contentLang;
  }

  // Get the tooltip language (follows UI language, not data_lang)
  function getTooltipLanguage(): string {
    try {
      let uiLang = language.ui || "en";
      if (uiLang === "default") {
        // Resolve to browser language primary subtag
        const nav = typeof navigator !== "undefined" ? navigator : ({} as any);
        const browserLang = (nav.languages?.[0] || nav.language || "en").toString();
        uiLang = browserLang;
      }
      // Normalize to primary subtag and lowercase (Wikipedia subdomain)
      return uiLang.toLowerCase().split("-")[0] || "en";
    } catch {
      return "en";
    }
  }

  // Create a virtual reference element for better positioning on multi-line text
  function createVirtualReference(event: Event, element: HTMLElement) {
    const mouseEvent = event as MouseEvent;
    const touchEvent = event as TouchEvent;

    let clientX: number | undefined;
    let clientY: number | undefined;

    // Get coordinates from mouse or touch event
    if (mouseEvent.clientX !== undefined && mouseEvent.clientY !== undefined) {
      clientX = mouseEvent.clientX;
      clientY = mouseEvent.clientY;
    } else if (touchEvent.touches && touchEvent.touches.length > 0) {
      clientX = touchEvent.touches[0].clientX;
      clientY = touchEvent.touches[0].clientY;
    }

    // Try to get the text range at the interaction position for more precise positioning
    if (
      document.caretRangeFromPoint &&
      clientX !== undefined &&
      clientY !== undefined
    ) {
      try {
        const range = document.caretRangeFromPoint(clientX, clientY);
        if (range) {
          // Check if the range is within our target element or its children
          const rangeContainer =
            range.startContainer.nodeType === Node.TEXT_NODE
              ? range.startContainer.parentElement
              : (range.startContainer as Element);

          if (
            rangeContainer &&
            (element.contains(rangeContainer) || rangeContainer === element)
          ) {
            const rect = range.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return {
                getBoundingClientRect() {
                  return {
                    width: Math.max(rect.width, 1),
                    height: Math.max(rect.height, 1),
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    left: rect.left,
                    x: rect.x,
                    y: rect.y,
                  };
                },
              };
            }
          }
        }
      } catch (error) {
        console.debug("Range detection failed, using mouse position:", error);
      }
    }

    // Fallback: create a virtual reference based on mouse/touch position
    if (clientX !== undefined && clientY !== undefined) {
      return {
        getBoundingClientRect() {
          return {
            width: 1,
            height: 1,
            top: clientY,
            right: clientX + 1,
            bottom: clientY + 1,
            left: clientX,
            x: clientX,
            y: clientY,
          };
        },
      };
    }

    // Final fallback: use the original element but try to get a better position
    // For multi-line elements, use the first line's position
    const elementRect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    const lineHeight =
      parseFloat(computedStyle.lineHeight) || elementRect.height;

    // If the element is much taller than a single line, position at the first line
    if (elementRect.height > lineHeight * 1.5) {
      return {
        getBoundingClientRect() {
          return {
            width: elementRect.width,
            height: lineHeight,
            top: elementRect.top,
            right: elementRect.right,
            bottom: elementRect.top + lineHeight,
            left: elementRect.left,
            x: elementRect.x,
            y: elementRect.y,
          };
        },
      };
    }

    return element;
  }

  // Find the most specific Wikipedia element at the interaction point
  function findBestWikipediaElement(
    event: Event,
    target: HTMLElement,
  ): HTMLElement | null {
    const mouseEvent = event as MouseEvent;
    const touchEvent = event as TouchEvent;

    let clientX: number | undefined;
    let clientY: number | undefined;

    // Get coordinates from mouse or touch event
    if (mouseEvent.clientX !== undefined && mouseEvent.clientY !== undefined) {
      clientX = mouseEvent.clientX;
      clientY = mouseEvent.clientY;
    } else if (touchEvent.touches && touchEvent.touches.length > 0) {
      clientX = touchEvent.touches[0].clientX;
      clientY = touchEvent.touches[0].clientY;
    }

    // If we have coordinates, find all Wikipedia elements at that point
    if (clientX !== undefined && clientY !== undefined) {
      const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
      const wikiElements = elementsAtPoint.filter((el) =>
        el.hasAttribute("data-wiki-id"),
      ) as HTMLElement[];

      if (wikiElements.length > 1) {
        console.debug(
          "Multiple Wikipedia elements found at point:",
          wikiElements.map((el) => ({
            element: el.tagName,
            wikiId: el.getAttribute("data-wiki-id"),
            text: el.textContent?.substring(0, 30),
            zIndex: window.getComputedStyle(el).zIndex,
          })),
        );

        // Prioritize elements by specificity:
        // 1. Location-specific elements (containing commas or location keywords)
        // 2. Smallest element (most specific)
        // 3. Highest z-index
        // 4. Most nested element
        return wikiElements.reduce((best, current) => {
          const bestWikiId = best.getAttribute("data-wiki-id") || "";
          const currentWikiId = current.getAttribute("data-wiki-id") || "";
          const bestText = best.textContent || "";
          const currentText = current.textContent || "";

          // Decode wiki IDs for comparison
          const bestDecoded = bestWikiId.includes("%")
            ? decodeURIComponent(bestWikiId)
            : bestWikiId;
          const currentDecoded = currentWikiId.includes("%")
            ? decodeURIComponent(currentWikiId)
            : currentWikiId;

          // Check if elements are location-related
          const bestIsLocation =
            bestDecoded.includes(",") ||
            /\b(city|town|village|county|state|province|territory|island|mountain|river|lake)\b/i.test(
              bestDecoded,
            ) ||
            bestText.includes(",");
          const currentIsLocation =
            currentDecoded.includes(",") ||
            /\b(city|town|village|county|state|province|territory|island|mountain|river|lake)\b/i.test(
              currentDecoded,
            ) ||
            currentText.includes(",");

          // Strongly prefer location elements
          if (currentIsLocation && !bestIsLocation) return current;
          if (bestIsLocation && !currentIsLocation) return best;

          const bestRect = best.getBoundingClientRect();
          const currentRect = current.getBoundingClientRect();
          const bestArea = bestRect.width * bestRect.height;
          const currentArea = currentRect.width * currentRect.height;

          // Prefer smaller elements (more specific)
          if (currentArea < bestArea) return current;
          if (bestArea < currentArea) return best;

          // If same size, prefer higher z-index
          const bestZ = parseInt(window.getComputedStyle(best).zIndex) || 0;
          const currentZ =
            parseInt(window.getComputedStyle(current).zIndex) || 0;
          if (currentZ > bestZ) return current;
          if (bestZ > currentZ) return best;

          // If same z-index, prefer more nested element
          const bestDepth = best.parentElement
            ? Array.from(document.querySelectorAll("*")).indexOf(best)
            : 0;
          const currentDepth = current.parentElement
            ? Array.from(document.querySelectorAll("*")).indexOf(current)
            : 0;
          return currentDepth > bestDepth ? current : best;
        });
      } else if (wikiElements.length === 1) {
        return wikiElements[0];
      }
    }

    // Fallback to closest element
    return target.closest("[data-wiki-id]") as HTMLElement;
  }

  // Handle Wikipedia link interaction
  export async function handleWikipediaInteraction(event: Event) {
    const target = event.target as HTMLElement;
    // Prefer the exact element that received the handler to avoid picking overlapping elements
    const currentTargetEl = (event.currentTarget as HTMLElement) || target;

    // Choose the element in this order:
    // 1) currentTarget if it has data-wiki-id (the element we attached the listener to)
    // 2) heuristic search under the pointer as a fallback
    const wikiLink =
      currentTargetEl &&
      typeof (currentTargetEl as any).hasAttribute === "function" &&
      currentTargetEl.hasAttribute("data-wiki-id")
        ? currentTargetEl
        : findBestWikipediaElement(event, target);

    if (wikiLink) {
      const interactionType = event.type;
      let wikiId = wikiLink.getAttribute("data-wiki-id") || "";
      currentWikiAttrId = wikiId;
      const title =
        wikiLink.getAttribute("title") ||
        wikiLink.textContent?.trim() ||
        wikiId ||
        "";
      const href =
        wikiLink.getAttribute("href") ||
        wikiLink.getAttribute("data-url") ||
        "";

      // Properly decode URL-encoded Wikipedia IDs
      if (wikiId.includes("%")) {
        try {
          const decoded = decodeURIComponent(wikiId);
          console.debug("Decoded Wikipedia ID:", wikiId, "->", decoded);
          wikiId = decoded;
        } catch (error) {
          console.debug("Failed to decode Wikipedia ID:", wikiId, error);
        }
      }

      const tooltipId = `${wikiId}-${title}`;
      currentWikiElementRef = wikiLink;
      const now = Date.now();

      // Debounce rapid tooltip changes (prevent flickering from multiple rapid events)
      if (lastProcessedId === tooltipId && now - lastProcessedTime < 100) {
        console.debug(
          "Debouncing rapid tooltip change for same ID:",
          tooltipId,
        );
        return;
      }
      lastProcessedId = tooltipId;
      lastProcessedTime = now;

      isMobile = detectMobile();

      // For mobile clicks, prevent default link behavior
      if (isMobile && event.type === "click") {
        event.preventDefault();
      }

      // For desktop hovers, skip if already showing same tooltip
      if (
        !isMobile &&
        event.type === "mouseover" &&
        showTooltip &&
        currentTooltipId === tooltipId
      ) {
        // Cancel any pending hide timeout since we're still on the same element
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
        return;
      }

      // Clear any existing timeouts
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      if (showTimeout) {
        clearTimeout(showTimeout);
        showTimeout = null;
      }

      // Choose reference strategy:
      // Prefer the actual element anchor (old behavior) for stable placement,
      // but if the element spans multiple lines, use a virtual reference from the pointer
      // to position under the hovered line.
      const rect = wikiLink.getBoundingClientRect();
      const lineHeight =
        parseFloat(getComputedStyle(wikiLink).lineHeight || "0") || rect.height;
      const isMultiLine = rect.height > lineHeight * 1.5;
      if (isMultiLine) {
        const virtualReference = createVirtualReference(event, wikiLink);
        floating.elements.reference = virtualReference;
      } else {
        floating.elements.reference = wikiLink;
      }

      // Set initial state
      currentTooltipId = tooltipId;
      currentWikiId = wikiId; // Store the current wikiId for location detection
      tooltipTitle = title; // Use the actual title instead of "Loading..." to reduce flicker

      // Check for conflicts with auto-linking
      const isOnThisDay = wikiLink.closest(".onthisday-content") !== null;
      const hasBackendQID = isQID(wikiId);
      const allSameElements = document.querySelectorAll(
        `[data-wiki-id="${wikiLink.getAttribute("data-wiki-id")}"]`,
      );

      // Debug: Log the Wikipedia ID being processed (only when explicitly flagged)
      if (import.meta.env.DEV && wikiId.includes("debug-this-entity")) {
        console.debug("WikipediaTooltip processing:", {
          originalWikiId: wikiLink.getAttribute("data-wiki-id"),
          decodedWikiId: wikiId,
          title,
          href,
          isQID: hasBackendQID,
          element: wikiLink.tagName,
          content: wikiLink.textContent?.substring(0, 50),
          interactionType,
          isOnThisDay,
          duplicateCount: allSameElements.length,
          elementIndex: Array.from(allSameElements).indexOf(wikiLink),
        });
      }

      // Reset tooltip content state before loading
      tooltipContent = "";
      tooltipImage = "";
      tooltipFullImage = "";
      // Prefer the element's resolved link if available (ensures tooltip matches the clickable link)
      // For Q-IDs and titles alike, use the provided href/data-url when present. If the wikiId is a Q-ID,
      // do not synthesize a title URL here — allow the API to resolve the correct city page (e.g., Washington, D.C.).
      if (href) {
        tooltipWikiUrl = href;
      } else if (!isQID(wikiId)) {
        tooltipWikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiId.replace(/ /g, "_"))}`;
      } else {
        tooltipWikiUrl = "";
      }

      // For desktop hover, add a small delay to prevent flickering on quick mouse movements
      const showDelay = !isMobile && event.type === "mouseover" ? 150 : 0;

      // Start with loading state only if this page isn't cached already and not already visible
        const _uiLangForLoading = getTooltipLanguage();
        const _cacheKeyForLoading = `${_uiLangForLoading}:${wikiId}`;
        isLoading =
          !contentCache.has(_cacheKeyForLoading) &&
          !(showTooltip && currentTooltipId === tooltipId);

      // Show tooltip with optional delay
      if (showDelay > 0) {
        showTimeout = window.setTimeout(() => {
          showTooltip = true;
          showTimeout = null;
        }, showDelay);
      } else {
        showTooltip = true;
      }

      // Fetch Wikipedia content with enhanced features
      try {
          let loadedData: WikipediaContent | null = null;
          // Use UI language for Wikipedia tooltips
          const uiLang = getTooltipLanguage();
          const cacheKey = `${uiLang}:${wikiId}`;
        // Serve from local cache immediately if available
        if (contentCache.has(cacheKey)) {
          loadedData = contentCache.get(cacheKey)!;
        }

        // Debug: Check for multiple elements with same data-wiki-id
        const allSameElements = document.querySelectorAll(
          `[data-wiki-id="${wikiLink.getAttribute("data-wiki-id")}"]`,
        );
        if (allSameElements.length > 10) {
          console.debug(
            "Multiple elements found with same wiki-id:",
            wikiId,
            "count:",
            allSameElements.length,
          );
        }

        // Priority 0: If the element has a Wikipedia URL, resolve content based on that exact URL
          if (
            !loadedData &&
            href &&
            /^https?:\/\/[a-z-]+\.wikipedia\.org\/wiki\//i.test(href)
          ) {
            try {
              const match = href.match(
                /^https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/([^?#]+)/i,
              );
              if (match) {
                const urlLang = match[1].toLowerCase();
                const pageTitle = decodeURIComponent(match[2]).replace(
                  /_/g,
                  " ",
                );
                loadedData = await fetchWikipediaContent(pageTitle, urlLang);
              }
            } catch {}
          }
          // Priority 1: For Q-IDs, use direct Wikipedia API to resolve properly (in UI language)
          if (!loadedData && isQID(wikiId)) {
            loadedData = await fetchWikipediaContent(wikiId, uiLang);
          }
          // Priority 2: Direct Wikipedia API for exact titles (leverages existing fallback logic)
          else if (!loadedData) {
            loadedData = await fetchWikipediaContent(wikiId, uiLang);

            // Priority 3: For location-like names, try variations if direct fetch failed
            if (
              !loadedData ||
              loadedData.extract === "Failed to load Wikipedia content."
            ) {
              const locationResult = await tryLocationVariations(
                wikiId,
                uiLang,
              );
              if (locationResult) {
                loadedData = locationResult;
              }
            }

            // Priority 4: Enhanced search with Knowledge Graph as final fallback
            if (
              !loadedData ||
              loadedData.extract === "Failed to load Wikipedia content."
            ) {
              loadedData = await fetchWikipediaContentWithEnhancedSearch(
                wikiId,
                uiLang,
              );
            }
          }

        // Update tooltip if it's still showing for the same ID (or about to show)
        if ((showTooltip || showTimeout) && currentTooltipId === tooltipId) {
          // If we have a show timeout, clear it and show immediately since we have content
          if (showTimeout) {
            clearTimeout(showTimeout);
            showTimeout = null;
            showTooltip = true;
          }
          if (
            loadedData &&
            loadedData.extract &&
            loadedData.extract !== "Failed to load Wikipedia content."
          ) {
            // Valid content found - update tooltip
            tooltipTitle = loadedData.title || title; // Use the resolved Wikipedia title or fallback to original title
            tooltipContent = loadedData?.extract || "No summary available.";
            tooltipImage = loadedData?.thumbnail?.source || "";
            tooltipFullImage =
              loadedData?.originalImage?.source || tooltipImage;
            // Always use the resolved URL from the API, especially important for Q-IDs
            const resolvedUrl = loadedData?.wikiUrl;
            const fallbackUrl = tooltipWikiUrl;

              // Always use the resolved URL from the API which respects the language setting
              tooltipWikiUrl = resolvedUrl || fallbackUrl;
              // Cache loaded content to avoid re-fetching on re-hover
              contentCache.set(cacheKey, loadedData);
              // Persist resolved URL on the element so external logic (e.g., Summary click) can use it
              try {
                wikiLink.setAttribute("data-url", tooltipWikiUrl || "");
              } catch {}

              // Track the actual language shown in the tooltip (from URL subdomain), fallback to UI language
              try {
                const m = (tooltipWikiUrl || "").match(/^https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\//i);
                const detected = (m ? m[1] : getTooltipLanguage()).toLowerCase();
                currentTooltipLang = detected.split("-")[0] || detected || getTooltipLanguage();
              } catch {
                currentTooltipLang = getTooltipLanguage();
              }

            // Adjust image focal point to avoid cutting off faces in tall portraits
            try {
              const original = (loadedData as any)?.originalImage;
              const thumb = (loadedData as any)?.thumbnail;
              const width = original?.width || thumb?.width;
              const height = original?.height || thumb?.height;
              if (width && height) {
                const aspect = width / height;
                // Bias focal point upward to keep heads in-frame across orientations
                if (aspect < 0.95) {
                  // Portrait
                  imageObjectPosition = "50% 30%";
                } else if (aspect < 1.2) {
                  // Near-square
                  imageObjectPosition = "50% 40%";
                } else if (aspect < 2.2) {
                  // Landscape (common) — lift slightly to avoid cutting off faces
                imageObjectPosition = "50% 40%";
                } else {
                  // Very wide panoramas — lift a bit more
                  imageObjectPosition = "50% 45%";
                }

                // Prefer contain to show as much of the image as possible
                imageFitMode = "contain";
              } else {
                imageObjectPosition = "50% 30%";
                imageFitMode = "contain";
              }
            } catch {}

            // Country flag detection – if description contains 'country' etc.
            const desc = (loadedData as any)?.description as
              | string
              | undefined;
            if (desc && /\bcountry\b/i.test(desc)) {
              tooltipFlag = getFlagEmoji(loadedData.title);
            } else {
              tooltipFlag = "";
            }

            // Set loading to false
            isLoading = false;

            // Notify parent component that Wikipedia content was found
            if (typeof onWikipediaContentFound === "function") {
              onWikipediaContentFound(
                wikiId,
                tooltipWikiUrl,
                loadedData.title || title,
              );
            }

            // If this was a click/tap interaction and a callback is provided, open full popup
            if (
              interactionType === "click" &&
              typeof onWikipediaClick === "function"
            ) {
              // Prefer full-size image if available
              const imgUrl =
                loadedData?.originalImage?.source ||
                loadedData?.thumbnail?.source ||
                "";
              // Hide any tooltip that may have appeared
              hideTooltip();
              // Defer call slightly to allow tooltip hide state
              setTimeout(() => {
                onWikipediaClick(
                  loadedData.title || wikiId,
                  loadedData.extract || "",
                  imgUrl,
                  loadedData.wikiUrl,
                );
              }, 0);
            }

            // Update scrollbars after content loads
            setTimeout(() => {
              try {
                if (tooltipScrollbars?.osInstance) {
                  const instance = tooltipScrollbars.osInstance();
                  if (instance) {
                    instance.update(true);
                  }
                }
              } catch (error) {
                // Silently handle scrollbar update errors
                console.debug("Scrollbar update failed:", error);
              }
            }, 10);
          } else {
            // No valid content found — hide tooltip entirely
            console.debug(
              "No valid Wikipedia content found for tooltip:",
              wikiId,
              "loadedData:",
              loadedData,
            );
            isLoading = false;
            hideTooltip();
          }
        }
      } catch (error) {
        console.error("Error loading Wikipedia content:", error);
        // Show error message instead of hiding tooltip
        if ((showTooltip || showTimeout) && currentTooltipId === tooltipId) {
          if (showTimeout) {
            clearTimeout(showTimeout);
            showTimeout = null;
            showTooltip = true;
          }
          tooltipContent = "Error loading Wikipedia content.";
          tooltipImage = "";
          tooltipFullImage = "";
          isLoading = false;
        }
      }
    }
  }

  // Handle mouse leave from Wikipedia link
  export function handleWikipediaLeave(event: Event) {
    if (isMobile) return; // Mobile tooltips are manually closed

    // Cancel any pending show timeout
    if (showTimeout) {
      clearTimeout(showTimeout);
      showTimeout = null;
      return;
    }

    const relatedTarget = (event as MouseEvent).relatedTarget as Node;
    const tooltip = floating.elements.floating;

    // If moving to the tooltip itself, don't hide it
    if (tooltip && relatedTarget && tooltip.contains(relatedTarget)) {
      return;
    }

    // For virtual references, we need to check the original Wikipedia element
    const currentWikiElement = (event.target as HTMLElement).closest(
      "[data-wiki-id]",
    ) as HTMLElement;

    // Check if we're moving to ANY part of the same Wikipedia element
    if (
      relatedTarget &&
      relatedTarget instanceof Element &&
      currentWikiElement
    ) {
      const targetWikiLink = relatedTarget.closest("[data-wiki-id]");

      // If we're moving to the same Wikipedia element (same data-wiki-id), don't hide
      if (
        targetWikiLink &&
        targetWikiLink.getAttribute("data-wiki-id") ===
          currentWikiElement.getAttribute("data-wiki-id")
      ) {
        return;
      }
    }

    // Timeout to prevent flickering
    hideTimeout = window.setTimeout(() => {
      hideTooltip();
    }, 150);
  }

  // Handle tooltip mouse leave
  function handleTooltipLeave(event: MouseEvent) {
    if (isMobile) return;

    const relatedTarget = event.relatedTarget as Node;

    // If moving back to any Wikipedia element with the same ID, don't hide
    if (
      relatedTarget &&
      relatedTarget instanceof Element &&
      (currentWikiAttrId || currentWikiId)
    ) {
      const targetWikiLink = relatedTarget.closest("[data-wiki-id]");
      if (targetWikiLink) {
        const attrVal = targetWikiLink.getAttribute("data-wiki-id") || "";
        // Prefer raw attribute comparison; fallback to decoded/normalized comparison
        if (currentWikiAttrId && attrVal === currentWikiAttrId) {
          return;
        }
        try {
          const decodedAttr = attrVal.includes("%")
            ? decodeURIComponent(attrVal)
            : attrVal;
          if (
            currentWikiId &&
            decodedAttr.replace(/ /g, "_") === currentWikiId.replace(/ /g, "_")
          ) {
            return;
          }
        } catch {}
      }
    }

    // Add small grace area: if pointer leaves by just a few pixels around the tooltip, don't immediately close
    const tooltipEl = floating.elements.floating as HTMLElement | undefined;
    if (tooltipEl) {
      const rect = tooltipEl.getBoundingClientRect();
      const padding = 6; // grace area in px
      const expanded = new DOMRect(
        rect.left - padding,
        rect.top - padding,
        rect.width + padding * 2,
        rect.height + padding * 2,
      );
      const e = event as MouseEvent;
      if (
        e.clientX >= expanded.left &&
        e.clientX <= expanded.right &&
        e.clientY >= expanded.top &&
        e.clientY <= expanded.bottom
      ) {
        return; // still near the tooltip; ignore transient leave
      }
    }

    // Timeout - if we're truly leaving, hide the tooltip
    hideTimeout = window.setTimeout(() => {
      hideTooltip();
    }, 180);
  }

  // Handle tooltip mouse enter (cancel hide timeout)
  function handleTooltipEnter() {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
  }

  // Hide tooltip
  function hideTooltip() {
    // Clear any pending show timeout
    if (showTimeout) {
      clearTimeout(showTimeout);
      showTimeout = null;
    }
    showTooltip = false;
    currentTooltipId = "";
    currentWikiAttrId = "";
    isLoading = false;
  }

  // Close mobile modal
  function closeMobileModal() {
    hideTooltip();
  }

  // Check if current content is location-related
  const isLocationContent = $derived.by(() => {
    return (
      currentWikiId &&
      (currentWikiId.includes(",") ||
        /\b(city|town|village|county|state|province|territory|island|mountain|river|lake)\b/i.test(
          currentWikiId,
        ))
    );
  });

  // Handle Apple Maps button click
  function handleAppleMapsClick() {
    if (currentWikiId) {
      // Force Apple Maps by creating a maps:// URL
      const encodedLocation = encodeURIComponent(currentWikiId);
      const link = document.createElement("a");
      link.href = `maps://maps.apple.com/?q=${encodedLocation}`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // Handle Google Maps button click
  function handleGoogleMapsClick() {
    if (currentWikiId) {
      // Force Google Maps
      const encodedLocation = encodeURIComponent(currentWikiId);
      const googleMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;
      window.open(googleMapUrl, "_blank");
    }
  }

  // Lock/unlock page scroll for mobile
  $effect(() => {
    if (isMobile && showTooltip) {
      scrollLock.lock();
    } else {
      scrollLock.unlock();
    }
  });

  // Hide tooltip on scroll (desktop only)
  function hideTooltipOnScroll() {
    if (!isMobile && showTooltip) {
      hideTooltip();
    }
  }

  // Setup scroll listener
  onMount(() => {
    if (browser) {
      window.addEventListener("scroll", hideTooltipOnScroll, { passive: true });
    }

    // Live update tooltip content when language changes while the tooltip is open
    // We react to two signals:
    // 1) UI language changes (detected via <html lang=...> mutation)
    // 2) Data language changes (custom 'data-language-changed' event)
    // In both cases, we refresh using the tooltip's language policy (UI language).

    // Helper to refresh the currently open tooltip in a given language
    async function refreshTooltipForLanguageChange(forcedLang?: string) {
      try {
        if (!showTooltip || !currentWikiId) return;
        const newLang = (forcedLang || getTooltipLanguage());
        // Avoid duplicate work if already showing this language
        if (
          (currentTooltipLang || "") &&
          currentTooltipLang.toLowerCase().split("-")[0] === newLang.toLowerCase().split("-")[0]
        ) {
          return;
        }
        const cacheKey = `${newLang}:${currentWikiId}`;
        const applyData = (d: WikipediaContent) => {
          tooltipTitle = d.title || tooltipTitle;
          tooltipContent = d.extract || tooltipContent;
          tooltipImage = d.thumbnail?.source || tooltipImage;
          tooltipFullImage = d.originalImage?.source || tooltipFullImage;
          tooltipWikiUrl = d.wikiUrl || tooltipWikiUrl;
          currentTooltipLang = newLang;
          try { currentWikiElementRef?.setAttribute("data-url", tooltipWikiUrl || ""); } catch {}
          isLoading = false;
        };

        if (contentCache.has(cacheKey)) {
          const d = contentCache.get(cacheKey)! as WikipediaContent;
          applyData(d);
          return;
        }

        // Fetch new language variant while keeping tooltip open
        isLoading = true;
        const fetched = await fetchWikipediaContent(currentWikiId, newLang);
        if (
          fetched &&
          fetched.extract &&
          fetched.extract !== "Failed to load Wikipedia content."
        ) {
          contentCache.set(cacheKey, fetched);
          applyData(fetched);
        } else {
          isLoading = false; // keep prior content
        }
      } catch {
        isLoading = false; // keep prior content
      }
    }

    // Observe <html lang> attribute to detect UI language changes
    let langAttrObserver: MutationObserver | null = null;
    try {
      if (browser && typeof MutationObserver !== 'undefined') {
        langAttrObserver = new MutationObserver(() => {
          // Debounced refresh to coalesce rapid changes
          refreshTooltipForLanguageChange();
        });
        langAttrObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
      }
    } catch {}

    // Listen to data language changes as well (may affect expectations for users)
    function handleDataLanguageChanged() {
      refreshTooltipForLanguageChange();
    }
    try {
      if (browser) {
        window.addEventListener('data-language-changed', handleDataLanguageChanged as any);
      }
    } catch {}

    // Cleanup for observers/listeners is handled in the outer onDestroy below

    function isInside(el: Node | null): boolean {
      const tooltip = floating.elements.floating as HTMLElement | undefined;
      if (!el || !(el instanceof Element)) return false;

      // Check if inside tooltip
      if (tooltip && tooltip.contains(el)) return true;

      // For virtual references, check if inside any Wikipedia element with the same ID
      const wikiElement = el.closest("[data-wiki-id]");
      if (wikiElement) {
        const attrVal = wikiElement.getAttribute("data-wiki-id") || "";
        if (currentWikiAttrId && attrVal === currentWikiAttrId) return true;
        try {
          const decodedAttr = attrVal.includes("%")
            ? decodeURIComponent(attrVal)
            : attrVal;
          if (
            currentWikiId &&
            decodedAttr.replace(/ /g, "_") === currentWikiId.replace(/ /g, "_")
          ) {
            return true;
          }
        } catch {}
      }

      return false;
    }

    function handleGlobalPointerMove(e: PointerEvent) {
      if (isMobile || !showTooltip) return;
      const target = e.target as Node;
      const inside = isInside(target);

      // Consider proximity to the current reference (link/virtual ref) as "inside"
      let nearReference = false;
      try {
        const reference: any = floating.elements.reference as any;
        if (
          reference &&
          typeof reference.getBoundingClientRect === "function"
        ) {
          const rect = reference.getBoundingClientRect();
          const padding = 8; // small grace zone around the reference
          const x = e.clientX;
          const y = e.clientY;
          if (
            x >= rect.left - padding &&
            x <= rect.right + padding &&
            y >= rect.top - padding &&
            y <= rect.bottom + padding
          ) {
            nearReference = true;
          }
        }
      } catch {}

      if (!inside && !nearReference) {
        if (!hideTimeout)
          hideTimeout = window.setTimeout(() => hideTooltip(), 240);
      } else if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
    }

    function handleGlobalClick(e: Event) {
      if (isMobile || !showTooltip) return;
      if (!isInside(e.target as Node)) hideTooltip();
    }

    if (browser) {
      window.addEventListener("pointermove", handleGlobalPointerMove, {
        passive: true,
      });
      window.addEventListener("click", handleGlobalClick, true);
    }

    onDestroy(() => {
      if (browser) {
        window.removeEventListener(
          "pointermove",
          handleGlobalPointerMove as any,
        );
        window.removeEventListener(
          "click",
          handleGlobalClick as any,
          true as any,
        );
        try { window.removeEventListener('data-language-changed', handleDataLanguageChanged as any); } catch {}
      }
      try { langAttrObserver?.disconnect(); } catch {}
    });
  });

  onDestroy(() => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }
    if (showTimeout) {
      clearTimeout(showTimeout);
    }
    if (browser) {
      window.removeEventListener("scroll", hideTooltipOnScroll);
    }
    // Make sure scroll is unlocked
    if (showTooltip) {
      scrollLock.unlock();
    }
  });
</script>

{#if showTooltip}
  {#if !isMobile}
    <!-- Desktop Tooltip -->
    <Portal>
      <div
        bind:this={floating.elements.floating}
        class="absolute top-0 left-0 z-[2000] w-80 max-w-[min(320px,calc(100vw-16px))] rounded-lg border border-gray-300 bg-white shadow-lg transition-opacity duration-200 dark:border-gray-600 dark:bg-gray-700 {floating.isPositioned
          ? 'opacity-100'
          : 'invisible opacity-0'}"
        style={floating.floatingStyles}
        onmouseenter={handleTooltipEnter}
        onmouseleave={handleTooltipLeave}
        role="tooltip"
      >
        <!-- Arrow - temporarily commented out -->
        <!-- <div
					bind:this={arrowElement}
					class="arrow border border-gray-300 dark:border-gray-600"
					style={floating.arrowStyles}
					data-placement={floating.placement}
				></div> -->

        <!-- Content -->
        <OverlayScrollbarsComponent
          bind:this={tooltipScrollbars}
          class="w-full overflow-hidden transition-[max-height] duration-200"
          style="max-height: {tooltipMaxHeight}px"
          defer
          options={{
            overflow: {
              x: "hidden",
              y: "scroll",
            },
            scrollbars: {
              visibility: needsScrollbar ? "auto" : "hidden",
              autoHide: needsScrollbar ? "leave" : "never",
              autoHideDelay: 300,
            },
          }}
        >
          <div class="p-3">
            <h4
              class="mb-2 font-semibold break-words text-gray-800 dark:text-gray-200"
            >
              {#if tooltipFlag}{tooltipFlag}&nbsp;{/if}{tooltipTitle}
            </h4>

            {#if isLoading}
              <div
                class="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400"
              >
                <div
                  class="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500"
                ></div>
                <span>Loading...</span>
              </div>
            {:else if tooltipContent}
              {#if tooltipImage}
                <img
                  src={tooltipImage}
                  alt={tooltipTitle}
                  class="mb-2 h-40 w-full rounded"
                  style="object-fit: {imageFitMode}; object-position: {imageObjectPosition}"
                  loading="lazy"
                />
              {/if}
              <p class="text-sm break-words text-gray-600 dark:text-gray-400">
                {tooltipContent}
              </p>
            {/if}
          </div>
        </OverlayScrollbarsComponent>
      </div>
    </Portal>
  {:else}
    <!-- Mobile Modal (Fullscreen) -->
    <Portal>
      <div
        class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 dark:bg-black/80"
        onclick={closeMobileModal}
        onkeydown={(e) => e.key === "Escape" && closeMobileModal()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wikipedia-modal-title"
        tabindex="-1"
      >
        <div
          class="flex h-full w-full flex-col bg-white shadow-xl dark:bg-gray-800"
          onclick={(e) => e.stopPropagation()}
          onkeydown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <!-- Header with arrow back button -->
          <div
            class="flex items-center border-b border-gray-200 p-4 dark:border-gray-700"
          >
            <button
              class="mr-3 rounded-full p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
              onclick={closeMobileModal}
              aria-label={s("common.back")}
            >
              <svg
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>
            <h3
              id="wikipedia-modal-title"
              class="flex-1 text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              {tooltipTitle}
            </h3>
          </div>

          <!-- Content -->
          <OverlayScrollbarsComponent
            class="flex-1 overflow-hidden"
            defer
            options={{
              overflow: {
                x: "hidden",
                y: "scroll",
              },
              scrollbars: {
                visibility: "auto",
                autoHide: "leave",
                autoHideDelay: 300,
              },
            }}
          >
            <div class="p-4">
              {#if isLoading}
                <div
                  class="flex items-center justify-center space-x-2 py-8 text-gray-500 dark:text-gray-400"
                >
                  <div
                    class="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500"
                  ></div>
                  <span>Loading Wikipedia content...</span>
                </div>
              {:else if tooltipContent}
                {#if tooltipFullImage || tooltipImage}
                  <img
                    src={tooltipFullImage || tooltipImage}
                    alt={tooltipTitle}
                    class="mb-4 h-56 w-full rounded-lg shadow-sm"
                    style="object-fit: {imageFitMode}; object-position: {imageObjectPosition}"
                    loading="lazy"
                  />
                {/if}
                <p class="text-gray-700 dark:text-gray-300">{tooltipContent}</p>
                <div class="mt-4 flex flex-wrap gap-2">
                  {#if tooltipWikiUrl}
                    <a
                      href={tooltipWikiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      {s("wikipedia.readMore")}
                      <Icon icon="mdi:external-link" class="ml-1 h-3 w-3" />
                    </a>
                  {/if}

                  {#if isLocationContent}
                    <button
                      onclick={handleAppleMapsClick}
                      class="inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      <Icon icon="simple-icons:apple" class="mr-2 h-4 w-4" />
                      Apple Maps
                    </button>
                    <button
                      onclick={handleGoogleMapsClick}
                      class="inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      <Icon icon="mdi:google-maps" class="mr-2 h-4 w-4" />
                      Google Maps
                    </button>
                  {/if}
                </div>
              {/if}
            </div>
          </OverlayScrollbarsComponent>
        </div>
      </div>
    </Portal>
  {/if}
{/if}
