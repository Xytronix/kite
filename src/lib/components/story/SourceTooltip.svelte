<script lang="ts">
  import { browser } from "$app/environment";
  import { s } from "$lib/client/localization.svelte";
  import { experimental } from "$lib/stores/experimental.svelte.js";
  import type { Article } from "$lib/types";
  import {
    getOrganizationNames,
    getOrganizationName,
  } from "$lib/utils/domainUtils";
  import { scrollLock } from "$lib/utils/scrollLock";
  import {
    getEnhancedArticleKey,
    smartDeduplicateArticles,
  } from "$lib/utils/sourceUtils";
  import SmartImage from "../SmartImage.svelte";
  import CitationItem from "./CitationItem.svelte";
  import {
    useFloating,
    offset,
    flip,
    shift,
    size,
  } from "@skeletonlabs/floating-ui-svelte";
  import { OverlayScrollbarsComponent } from "overlayscrollbars-svelte";
  import { onMount, onDestroy } from "svelte";
  import Portal from "svelte-portal";

  interface Props {
    articles: Article[]; // All available articles
    allArticles?: Article[]; // Additional articles that may not be cited but available for display
    citationNumbers?: number[]; // The actual global citation numbers
    hasCommonKnowledge?: boolean; // Whether [*] appears in the text
    citedItems?: Array<{
      article: Article | null;
      number: number;
      isCommon?: boolean;
    }>; // All cited items including common knowledge
    citationMapping?: any; // Global citation mapping
  }

  const {
    articles,
    allArticles = [],
    citedItems = [],
    citationMapping,
  }: Props = $props();

  // Derive combined articles list
  const combinedArticles = $derived([...articles, ...allArticles]);

  // Helpers to normalize links and build robust dedupe keys
  function normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      u.hostname = u.hostname.replace(/^www\./, "").toLowerCase();
      u.protocol = u.protocol.toLowerCase();
      // remove common tracking params and sort remaining
      const tracking = new Set([
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "utm_id",
        "utm_name",
        "utm_reader",
        "utm_place",
        "utm_brand",
        "utm_social",
        "utm_social-type",
        "fbclid",
        "gclid",
        "mc_cid",
        "mc_eid",
        "ref",
        "ref_src",
        "ref_url",
        "irclickid",
        "cmp",
        "ncid",
        "mbid",
        "campaign",
        "cid",
      ]);
      const kept: Array<[string, string]> = [];
      u.searchParams.forEach((v, k) => {
        if (!tracking.has(k)) kept.push([k, v]);
      });
      kept.sort((a, b) => a[0].localeCompare(b[0]));
      u.search = kept.length
        ? `?${kept.map(([k, v]) => `${k}=${v}`).join("&")}`
        : "";
      u.hash = "";
      if (u.pathname !== "/" && u.pathname.endsWith("/"))
        u.pathname = u.pathname.slice(0, -1);
      return u.toString();
    } catch {
      return (url || "").trim();
    }
  }

  function getArticleKey(a: Article | null | undefined): string {
    if (!a) return "null";
    // Use enhanced article key for better deduplication
    return getEnhancedArticleKey(a);
  }

  // State for dynamic sizing
  let tooltipMaxHeight = $state(300);

  // Check if scrollbar is needed
  const needsScrollbar = $derived.by(() => {
    if (!showTooltip || displayItems.length === 0) return false;

    // Estimate content height based on number of items
    const itemHeight = isMobile ? 80 : 60; // Approximate height per item
    const headerHeight = 40; // Header height
    const padding = 24; // Top and bottom padding
    const estimatedContentHeight =
      displayItems.length * itemHeight + headerHeight + padding;

    return estimatedContentHeight > tooltipMaxHeight;
  });

  // Floating UI setup
  const floating = useFloating({
    placement: "bottom-start",
    strategy: "fixed",
    middleware: [
      offset(({ placement, rects, elements }) => {
        // Detect if this is likely an inline citation or small element like favicon
        const referenceRect = elements.reference?.getBoundingClientRect();
        const isInlineCitation = referenceRect && referenceRect.height < 30;
        const isSmallElement =
          referenceRect &&
          (referenceRect.width < 32 || referenceRect.height < 32);
        const needsExtraSpace = isInlineCitation || isSmallElement;

        // Consistent offset regardless of placement to maintain same gap
        const baseOffset = needsExtraSpace ? 12 : 8;
        return baseOffset;
      }),
      flip({
        fallbackPlacements: [
          "top-start",
          "bottom-end",
          "top-end",
          "bottom",
          "top",
        ],
        padding: 12,
      }),
      shift({
        padding: 10,
        crossAxis: true, // Allow cross-axis shifting for better positioning with virtual references
      }),
      // Size middleware for height calculation
      size({
        apply({ availableHeight, availableWidth, placement, elements }) {
          const minHeight = 150;
          const maxHeight = Math.min(400, window.innerHeight * 0.7);

          // Detect inline citations and use larger buffer
          const referenceRect = elements.reference?.getBoundingClientRect();
          const isInlineCitation = referenceRect && referenceRect.height < 30;

          // Use consistent buffer regardless of placement
          const buffer = isInlineCitation ? 24 : 16;

          const safeHeight = availableHeight - buffer;
          const optimalHeight = Math.min(
            Math.max(minHeight, safeHeight),
            maxHeight,
          );
          tooltipMaxHeight = optimalHeight;
        },
      }),
    ],
  });

  // State
  let showTooltip = $state(false);
  let currentTooltipId = $state("");
  let isMobile = $state(false);
  let highlightedNumber = $state<number | undefined>(undefined);
  let hideTimeout: number | null = null;
  // Track the actual DOM element that triggered the tooltip. This is important
  // because we often use a virtual reference for positioning which is not an HTMLElement.
  let activeReferenceElement: HTMLElement | null = $state(null);
  let displayItems = $state<
    Array<{
      article: Article | null;
      number: number;
      isCommon?: boolean;
      isCited?: boolean;
    }>
  >([]);
  let tooltipTitle = $state("Sources");

  // Using any to avoid type issues with external typings
  let tooltipScrollbars: any | null = $state(null);

  // Detect mobile device
  function detectMobile() {
    return "ontouchstart" in window || window.innerWidth < 768;
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

  // Handle source interaction - renamed from handleCitationInteraction for broader usage
  export async function handleSourceInteraction(
    event: Event,
    domains: string[],
    highlightNumber?: number,
    overrideArticles?: Article[],
  ) {
    const target = event.target as HTMLElement;

    // Find the most specific reference element - prioritize individual favicon buttons
    const wrapper =
      target.closest(".section-favicon") ||
      target.closest(".favicon-wrapper") ||
      target.closest(".source-item") ||
      target.closest('button[aria-label*="View citations"]') ||
      target.closest(".section-sources") ||
      target.closest(".citation-sources") ||
      target;

    // Persist the concrete HTMLElement that served as the trigger for better outside detection
    activeReferenceElement = (wrapper as HTMLElement) ?? null;

    if (wrapper) {
      const tooltipId = `sources-${domains.join("-")}`;

      isMobile = detectMobile();

      // For mobile clicks, prevent default
      if (isMobile && event.type === "click") {
        event.preventDefault();
      }

      // For desktop hovers, update highlighted number even if tooltip is already showing
      if (
        !isMobile &&
        event.type === "mouseover" &&
        showTooltip &&
        currentTooltipId === tooltipId
      ) {
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }

        // Update reference element and recalculate position for new hover target
        floating.elements.reference = wrapper;
        floating.update();

        // Update highlighted number and scroll if needed
        if (highlightNumber && highlightedNumber !== highlightNumber) {
          highlightedNumber = highlightNumber;
          setTimeout(() => {
            scrollToHighlightedSource(highlightNumber);
          }, 50);
        }
        return;
      }

      // Clear any existing timeout
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }

      // Create a virtual reference element for better positioning on multi-line text
      const virtualReference = createVirtualReference(
        event,
        wrapper as HTMLElement,
      );
      floating.elements.reference = virtualReference;

      // Force immediate position recalculation when switching reference elements
      if (showTooltip) {
        floating.update();
      }

      // Ensure the reference element is properly positioned and force fresh calculations
      if (wrapper && wrapper instanceof HTMLElement) {
        // Force a layout recalculation and get fresh positioning
        const rect = wrapper.getBoundingClientRect();

        // For small elements like favicons, add extra safety margin
        const isSmallElement = rect.width < 32 || rect.height < 32;
        if (isSmallElement) {
          // Force a complete recalculation for small elements after scroll
          setTimeout(() => {
            floating.update();
          }, 0);
        }
      }

      // Prepare display items
      if (overrideArticles && overrideArticles.length > 0) {
        // Handle a custom list of articles (section-specific) - only show articles from the provided context
        const overrideArticleLinks = new Set(
          overrideArticles.map((a) => getArticleKey(a)),
        );
        const seenLinks = new Set<string>();

        if (citationMapping) {
          const cited: Array<{
            article: Article;
            number: number;
            isCommon?: boolean;
            isCited?: boolean;
          }> = [];
          // Only include cited articles that are BOTH in the citation mapping AND in the override list
          for (const [
            number,
            mappedArticle,
          ] of citationMapping.numberToArticle.entries()) {
            if (
              mappedArticle &&
              overrideArticleLinks.has(getArticleKey(mappedArticle))
            ) {
              const key = getArticleKey(mappedArticle);
              if (!seenLinks.has(key)) {
                cited.push({
                  article: mappedArticle,
                  number,
                  isCommon: false,
                  isCited: true,
                });
                seenLinks.add(key);
              }
            }
          }

          // If we have cited articles, show them first
          if (cited.length > 0) {
            displayItems = cited.sort(
              (a, b) => (a.number || 0) - (b.number || 0),
            );
          } else {
            // No cited articles found - show all override articles as non-cited
            displayItems = overrideArticles
              .filter((a) => {
                const k = getArticleKey(a);
                if (seenLinks.has(k)) return false;
                seenLinks.add(k);
                return true;
              })
              .map((article) => ({
                article,
                number: -1,
                isCommon: false,
                isCited: false,
              }));
          }
        } else {
          // No mapping: just unique articles in given order, but only if they seem relevant
          displayItems = overrideArticles
            .filter((a) => {
              const k = getArticleKey(a);
              if (seenLinks.has(k)) return false;
              seenLinks.add(k);
              return true;
            })
            .map((article) => ({
              article,
              number: -1,
              isCommon: false,
              isCited: false,
            }));
        }
      } else {
        // Use cited items if available; otherwise prefer articles that have citation mapping numbers first
        if (citedItems.length > 0) {
          // Deduplicate by link
          const seen = new Set<string>();
          displayItems = citedItems
            .filter((it) => {
              const key = it.article
                ? getArticleKey(it.article)
                : `${it.isCommon ? "common" : ""}-${it.number}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .map((item) => ({ ...item, isCited: true }));
        } else if (citationMapping) {
          const citedFromMapping: Array<{
            article: Article | null;
            number: number;
            isCommon?: boolean;
            isCited?: boolean;
          }> = [];
          const seenCited = new Set<string>();
          for (const [
            number,
            mappedArticle,
          ] of citationMapping.numberToArticle.entries()) {
            if (mappedArticle) {
              const k = getArticleKey(mappedArticle);
              if (!seenCited.has(k)) {
                seenCited.add(k);
                citedFromMapping.push({
                  article: mappedArticle,
                  number,
                  isCommon: false,
                  isCited: true,
                });
              }
            }
          }
          const citedLinks = new Set(Array.from(seenCited));
          const seenNon = new Set<string>();
          const nonCited = combinedArticles
            .filter((a) => {
              const k = getArticleKey(a);
              if (citedLinks.has(k)) return false;
              if (seenNon.has(k)) return false;
              seenNon.add(k);
              return true;
            })
            .map((a) => ({
              article: a,
              number: -1,
              isCommon: false,
              isCited: false,
            }));
          displayItems = [
            ...citedFromMapping.sort(
              (a, b) => (a.number || 0) - (b.number || 0),
            ),
            ...nonCited.sort((a, b) =>
              a.article!.title.localeCompare(b.article!.title),
            ),
          ];
        } else {
          // Fallback: show all as non-cited
          const seen = new Set<string>();
          displayItems = combinedArticles
            .filter((a) => {
              if (seen.has(a.link)) return false;
              seen.add(a.link);
              return true;
            })
            .map((article, index) => ({
              article,
              number: index + 1,
              isCommon: false,
              isCited: false,
            }));
        }
      }

      // Only show tooltip if we have items to display
      if (displayItems.length === 0) {
        return; // Don't show empty tooltip
      }

      // Set highlighted number
      highlightedNumber = highlightNumber;

      // Set initial state
      currentTooltipId = tooltipId;
      showTooltip = true;

      // Preload organization names for better performance
      const domainsToPreload = displayItems
        .map((item) => item.article?.domain)
        .filter((domain): domain is string => Boolean(domain));

      if (domainsToPreload.length > 0) {
        getOrganizationNames(domainsToPreload).catch((error) => {
          console.warn("Failed to preload organization names:", error);
        });
      }

      // Force floating UI to recalculate positioning with double RAF for better positioning
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          floating.update();
        });
      });

      // Auto-scroll to highlighted source after tooltip is rendered
      if (highlightNumber) {
        setTimeout(() => {
          scrollToHighlightedSource(highlightNumber);
        }, 50);
      }
    }
  }

  // Handle mouse leave from sources
  export function handleSourceLeave(event: Event) {
    if (isMobile) return;

    const relatedTarget = (event as MouseEvent).relatedTarget as Node;
    const tooltip = floating.elements.floating;
    const referenceEl = activeReferenceElement;

    // If moving to the tooltip itself, don't hide it
    if (tooltip && relatedTarget && tooltip.contains(relatedTarget)) {
      return;
    }

    // If we're moving to the same wrapper or another citation number, don't hide
    if (relatedTarget && relatedTarget instanceof Element) {
      if (relatedTarget.closest(".citation-number")) {
        return;
      }
      const targetWrapper =
        relatedTarget.closest(".section-favicon") ||
        relatedTarget.closest(".favicon-wrapper") ||
        relatedTarget.closest(".section-sources") ||
        relatedTarget.closest(".citation-sources") ||
        relatedTarget.closest(".source-item");
      if (targetWrapper && referenceEl && targetWrapper === referenceEl) {
        return;
      }
    }

    hideTimeout = window.setTimeout(() => {
      hideTooltip();
    }, 100);
  }

  // Handle tooltip mouse leave
  function handleTooltipLeave(event: MouseEvent) {
    if (isMobile) return;

    const relatedTarget = event.relatedTarget as Node;
    const referenceEl = activeReferenceElement;

    // If moving back to the sources, don't hide
    if (relatedTarget && relatedTarget instanceof Element) {
      const targetWrapper =
        relatedTarget.closest(".section-favicon") ||
        relatedTarget.closest(".favicon-wrapper") ||
        relatedTarget.closest(".section-sources") ||
        relatedTarget.closest(".citation-sources") ||
        relatedTarget.closest(".source-item");
      if (targetWrapper && referenceEl && targetWrapper === referenceEl) {
        return;
      }
    }

    hideTimeout = window.setTimeout(() => {
      hideTooltip();
    }, 100);
  }

  // Handle tooltip mouse enter (cancel hide timeout)
  function handleTooltipEnter() {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
  }

  // Check for tooltip overlap with reference element
  function checkForOverlap() {
    if (
      !showTooltip ||
      !floating.elements.floating ||
      !floating.elements.reference
    )
      return;

    const tooltipRect = floating.elements.floating.getBoundingClientRect();
    const referenceRect = floating.elements.reference.getBoundingClientRect();

    // Check if tooltip overlaps with reference element
    const overlaps = !(
      tooltipRect.right < referenceRect.left ||
      tooltipRect.left > referenceRect.right ||
      tooltipRect.bottom < referenceRect.top ||
      tooltipRect.top > referenceRect.bottom
    );

    if (overlaps) {
      // Force tooltip to a safe position
      const tooltip = floating.elements.floating;
      const isInlineCitation = referenceRect.height < 30;

      if (isInlineCitation) {
        // For inline citations, position well below or above
        const spaceBelow = window.innerHeight - referenceRect.bottom;
        const spaceAbove = referenceRect.top;

        if (spaceBelow > 200) {
          // Position below with large gap
          tooltip.style.top = `${referenceRect.bottom + 50}px`;
        } else if (spaceAbove > 200) {
          // Position above with large gap
          tooltip.style.top = `${referenceRect.top - tooltipRect.height - 50}px`;
        }
      }
    }
  }

  // Hide tooltip
  function hideTooltip() {
    showTooltip = false;
    currentTooltipId = "";
    highlightedNumber = undefined;
    displayItems = [];
    tooltipTitle = "Sources"; // Reset to default title
  }

  // Force hide tooltip (public method)
  export function forceHide() {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
    hideTooltip();
  }

  // Scroll to highlighted source in tooltip
  function scrollToHighlightedSource(citationNumber: number) {
    if (!tooltipScrollbars?.osInstance || !showTooltip) return;

    // Find the highlighted citation element by its actual citation number
    const highlightedElement = floating.elements.floating?.querySelector(
      `[data-citation-number="${citationNumber}"]`,
    );

    if (highlightedElement) {
      // Scroll the highlighted element into view within the tooltip viewport only
      highlightedElement.scrollIntoView({
        behavior: "auto",
        block: "nearest",
        inline: "nearest",
      });

      // Also update the OverlayScrollbars instance
      setTimeout(() => {
        tooltipScrollbars.osInstance()?.update(true);
      }, 25);
    }
  }

  // Close mobile modal
  function closeMobileModal() {
    hideTooltip();
  }

  // Lock/unlock page scroll for mobile
  $effect(() => {
    if (isMobile && showTooltip) {
      scrollLock.lock();
      return () => {
        scrollLock.unlock();
      };
    } else {
      scrollLock.unlock();
    }
  });

  // Update scrollbars when tooltip shows to fix alignment issues
  $effect(() => {
    if (showTooltip && tooltipScrollbars?.osInstance) {
      // Reset scroll position and update scrollbars
      tooltipScrollbars.osInstance()?.scroll({ y: 0 }, true);
      setTimeout(() => {
        tooltipScrollbars.osInstance()?.update(true);
      }, 50);
    }
  });

  // Update tooltip title when display items change
  $effect(() => {
    if (showTooltip && displayItems.length > 0) {
      updateTooltipTitle();
    }
  });

  // Update floating UI positioning when tooltip visibility changes
  $effect(() => {
    if (showTooltip && floating.elements.reference && !isMobile) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        floating.update();
      }, 10);
    }
  });

  // Check for overlaps after tooltip is positioned
  $effect(() => {
    if (showTooltip && floating.isPositioned) {
      // Small delay to ensure positioning is complete
      setTimeout(() => {
        checkForOverlap();
      }, 50);
    }
  });

  // Hide tooltip on scroll (desktop only)
  function hideTooltipOnScroll() {
    if (!isMobile && showTooltip) {
      hideTooltip();
    }
  }

  // Handle viewport resize - recalculate positioning
  let resizeTimeout: number | null = null;
  function handleResize() {
    // Debounce resize events
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }

    resizeTimeout = window.setTimeout(() => {
      if (
        showTooltip &&
        floating.elements.reference &&
        floating.elements.floating
      ) {
        // Update mobile detection
        const wasMobile = isMobile;
        isMobile = detectMobile();

        // If switching between mobile/desktop, hide tooltip to avoid positioning issues
        if (wasMobile !== isMobile) {
          hideTooltip();
          return;
        }

        // For desktop, recalculate positioning
        if (!isMobile) {
          floating.update();
        }
      }
      resizeTimeout = null;
    }, 100);
  }

  // Get unique display items for rendering
  function getUniqueDisplayItems() {
    // Separate common knowledge items from articles
    const commonItems = displayItems.filter((item) => item.isCommon);
    const articleItems = displayItems.filter((item) => item.article);

    // Smart deduplicate articles
    const articles = articleItems.map((item) => item.article!);
    const uniqueArticles = smartDeduplicateArticles(articles);

    // Rebuild items with unique articles, preserving citation info
    const uniqueArticleItems = uniqueArticles.map((article) => {
      // Find the original item for this article to preserve citation number and status
      const originalItem = articleItems.find(
        (item) =>
          item.article &&
          getEnhancedArticleKey(item.article) ===
            getEnhancedArticleKey(article),
      );
      return (
        originalItem || {
          article,
          number: -1,
          isCommon: false,
          isCited: false,
        }
      );
    });

    // Combine and deduplicate common knowledge
    const uniqueCommon = commonItems.length > 0 ? [commonItems[0]] : [];
    const allUnique = [...uniqueArticleItems, ...uniqueCommon];

    // Sort: cited articles first (by number), then non-cited (alphabetically)
    return allUnique.sort((a, b) => {
      if (a.isCommon && !b.isCommon) return 1;
      if (!a.isCommon && b.isCommon) return -1;
      if (a.isCommon && b.isCommon) return 0;
      if (a.isCited && !b.isCited) return -1;
      if (!a.isCited && b.isCited) return 1;
      if (a.isCited && b.isCited) return (a.number || 0) - (b.number || 0);
      return a.article!.title.localeCompare(b.article!.title);
    });
  }

  // Calculate the highest citation number in current display items
  const maxCitationNumber = $derived.by(() => {
    let maxNum = 0;
    for (const item of displayItems) {
      if (item.number && item.number > maxNum && item.number > 0) {
        maxNum = item.number;
      }
    }
    return maxNum;
  });

  // Function to decode HTML entities
  function decodeHtmlEntities(text: string): string {
    if (typeof document === "undefined") return text;
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    return textarea.value;
  }

  // Update tooltip title based on display items
  async function updateTooltipTitle() {
    // If showing articles from a single domain, show organization-specific title
    const uniqueDomains = Array.from(
      new Set(
        displayItems.filter((i) => i.article).map((i) => i.article!.domain),
      ),
    );
    if (uniqueDomains.length === 1) {
      const domain = uniqueDomains[0];
      try {
        const organizationName = await getOrganizationName(domain);
        tooltipTitle = `${decodeHtmlEntities(organizationName)} Sources`;
      } catch (error) {
        console.warn(
          "Failed to get organization name for tooltip title:",
          error,
        );
        tooltipTitle = `${domain} Sources`;
      }
    } else {
      tooltipTitle = "Sources";
    }
  }

  // Setup scroll listener
  onMount(() => {
    if (browser) {
      window.addEventListener("scroll", hideTooltipOnScroll, { passive: true });
      window.addEventListener("resize", handleResize, { passive: true });
    }
    // Global guards: hide if pointer leaves both reference and tooltip
    function isInside(el: Node | null): boolean {
      const tooltip = floating.elements.floating as HTMLElement | undefined;
      const referenceEl = activeReferenceElement as HTMLElement | null;
      if (!el || !(el instanceof Element)) return false;

      // Directly inside the tooltip or the active reference element
      if ((tooltip && tooltip.contains(el)) || (referenceEl && referenceEl.contains(el))) {
        return true;
      }

      // Allow moving between citation numbers without hiding
      if (el.closest(".citation-number")) return true;

      // Otherwise, treat as outside to ensure the tooltip can dismiss when moving away
      return false;
    }
    function handleGlobalPointerMove(e: PointerEvent) {
      if (isMobile || !showTooltip) return;
      if (!isInside(e.target as Node)) {
        if (!hideTimeout)
          hideTimeout = window.setTimeout(() => hideTooltip(), 180);
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
      }
    });
  });

  onDestroy(() => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    if (browser) {
      window.removeEventListener("scroll", hideTooltipOnScroll);
      window.removeEventListener("resize", handleResize);
    }
    // Make sure scroll is unlocked
    if (showTooltip) {
      scrollLock.unlock();
    }
  });

  function adjustViewportToElement(el: HTMLElement) {
    try {
      const os = tooltipScrollbars?.osInstance?.();
      const viewport = os?.elements().viewport as HTMLElement | undefined;
      const root =
        viewport ?? (floating.elements.floating as HTMLElement | undefined);
      if (!root) return;

      // Compute positions relative to root scroll
      const rootRect = root.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const elTop = elRect.top - rootRect.top + root.scrollTop;
      const elBottom = elTop + el.offsetHeight;
      const viewTop = root.scrollTop;
      const viewBottom = viewTop + root.clientHeight;
      const margin = 10;

      if (elTop < viewTop + margin) {
        root.scrollTop = Math.max(0, elTop - margin);
      } else if (elBottom > viewBottom - margin) {
        root.scrollTop = Math.max(0, elBottom - root.clientHeight + margin);
      }
      os?.update(true);
    } catch {}
  }

  $effect(() => {
    if (!showTooltip || highlightedNumber == null) return;
    const os = tooltipScrollbars?.osInstance?.();
    const viewport = os?.elements().viewport as HTMLElement | undefined;
    const root =
      viewport ?? (floating.elements.floating as HTMLElement | undefined);
    if (!root) return;
    const el = root.querySelector(
      `[data-citation-number="${highlightedNumber}"]`,
    ) as HTMLElement | null;
    if (!el) return;
    adjustViewportToElement(el);
  });

  // Remove older center-scrolling effect to avoid sudden jumps
</script>

{#if showTooltip}
  {#if !isMobile}
    <!-- Desktop Tooltip -->
    <Portal>
      <div
        bind:this={floating.elements.floating}
        class="absolute top-0 left-0 z-[2000] w-96 max-w-[min(420px,calc(100vw-32px))] min-w-[280px] rounded-lg border border-gray-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700 {floating.isPositioned
          ? 'opacity-100'
          : 'invisible opacity-0'}"
        style={floating.floatingStyles}
        onmouseenter={handleTooltipEnter}
        onmouseleave={handleTooltipLeave}
        role="tooltip"
      >
        <!-- Content -->
        <OverlayScrollbarsComponent
          bind:this={tooltipScrollbars}
          class="w-full overflow-hidden rounded-lg transition-[max-height] duration-200"
          style="max-height: {tooltipMaxHeight}px"
          defer
          options={{
            overflow: {
              x: "hidden",
              y: needsScrollbar ? "scroll" : "hidden",
            },
            scrollbars: {
              visibility: needsScrollbar ? "auto" : "hidden",
              autoHide: needsScrollbar ? "leave" : "never",
              autoHideDelay: 300,
            },
          }}
        >
          <div class="p-3">
            {#if displayItems.length > 0}
              <div class="mb-2 flex items-center -space-x-3">
                {#each Array.from(new Set(displayItems
                      .filter((i) => i.article)
                      .map((i) => i.article.domain))).slice(0, 6) as dom}
                  <SmartImage
                    domain={dom}
                    alt={dom}
                    class="h-4 w-4 rounded-full overflow-hidden"
                    size={16}
                    loading="eager"
                    preferIconify={experimental.preferIconifyIcons}
                    addBackground={true}
                    backgroundMode="transparent-only"
                  />
                {/each}
              </div>
            {/if}
            <h4 class="mb-3 font-semibold text-gray-800 dark:text-gray-200">
              {tooltipTitle}
            </h4>

            <div
              class="citation-list {maxCitationNumber >= 10
                ? 'double-digit'
                : ''} space-y-0"
            >
              {#if displayItems.length > 0}
                {#each getUniqueDisplayItems() as item}
                  <CitationItem
                    {item}
                    {highlightedNumber}
                    showCitationNumber={item.isCited}
                    {maxCitationNumber}
                    allArticles={combinedArticles}
                  />
                {/each}
              {:else}
                <div class="text-sm text-gray-500 dark:text-gray-400">
                  No sources available
                </div>
              {/if}
            </div>
          </div>
        </OverlayScrollbarsComponent>
      </div>
    </Portal>
  {:else}
    <!-- Mobile Modal -->
    <Portal>
      <div
        class="fixed inset-0 z-[1500] flex items-center justify-center bg-black/60 dark:bg-black/80"
        onclick={closeMobileModal}
        onkeydown={(e) => e.key === "Escape" && closeMobileModal()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sources-modal-title"
        tabindex="-1"
      >
        <div
          class="flex h-full w-full flex-col bg-white shadow-xl dark:bg-gray-800"
          onclick={(e) => e.stopPropagation()}
          onkeydown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <!-- Header -->
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
              id="sources-modal-title"
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
                y: needsScrollbar ? "scroll" : "hidden",
              },
              scrollbars: {
                visibility: needsScrollbar ? "auto" : "hidden",
                autoHide: needsScrollbar ? "leave" : "never",
                autoHideDelay: 300,
              },
            }}
          >
            <div class="p-4">
              <h4
                class="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-200"
              >
                {tooltipTitle}
              </h4>

              <div
                class="citation-list {maxCitationNumber >= 10
                  ? 'double-digit'
                  : ''} space-y-1"
              >
                {#if displayItems.length > 0}
                  {#each getUniqueDisplayItems() as item}
                    <CitationItem
                      {item}
                      {highlightedNumber}
                      isMobile={true}
                      showCitationNumber={item.isCited}
                      {maxCitationNumber}
                      allArticles={combinedArticles}
                    />
                  {/each}
                {:else}
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    No sources available
                  </div>
                {/if}
              </div>
            </div>
          </OverlayScrollbarsComponent>
        </div>
      </div>
    </Portal>
  {/if}
{/if}
