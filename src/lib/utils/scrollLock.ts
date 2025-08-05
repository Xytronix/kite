import { OverlayScrollbars } from "overlayscrollbars";

/**
 * Scroll lock utility that works with OverlayScrollbars and preserves scroll position
 */
class ScrollLock {
  private isLocked = false;
  private lockCount = 0;
  private mainScrollbarInstance: OverlayScrollbars | null = null;
  private savedScrollPosition: { x: number; y: number } | null = null;
  private prevBodyOverflow: string | null = null;
  private prevHtmlOverflow: string | null = null;
  private prevBodyPaddingRight: string | null = null;
  private usingCssFallback = false;
  private scrollbarCompensationApplied = false;

  lock() {
    this.lockCount++;

    if (this.isLocked) return;

    // Save current scroll position
    this.savedScrollPosition = {
      x: window.pageXOffset || document.documentElement.scrollLeft,
      y: window.pageYOffset || document.documentElement.scrollTop
    };

    // Try OverlayScrollbars first
    try {
      const instance = OverlayScrollbars(document.body);
      this.mainScrollbarInstance = instance || null;

      if (this.mainScrollbarInstance) {
        // Disable the main scrollbars via OverlayScrollbars options
        this.mainScrollbarInstance.options({
          scrollbars: {
            visibility: "hidden", // completely hide scrollbars while modal is open
          },
          overflow: {
            x: "hidden",
            y: "hidden",
          },
        });
      }
    } catch (error) {
      console.warn('OverlayScrollbars failed, using CSS fallback only:', error);
      this.mainScrollbarInstance = null;
    }

    // Always apply the CSS fallback as an extra safeguard. We guard against
    // re-applying the styles by checking `usingCssFallback` so they are only
    // set once per `lock()` call sequence.
    if (!this.usingCssFallback) {
      this.prevBodyOverflow = document.body.style.overflow;
      this.prevHtmlOverflow = document.documentElement.style.overflow;
      // Store original padding-right
      this.prevBodyPaddingRight = document.body.style.paddingRight;

      // Apply styles to both body and html to ensure complete scroll lock
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${this.savedScrollPosition?.y || 0}px`;
      document.body.style.left = `-${this.savedScrollPosition?.x || 0}px`;
      document.body.style.right = '0';
      document.body.style.bottom = '0';
      document.documentElement.style.overflow = 'hidden';

      // Calculate scrollbar width and compensate to prevent layout shift
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
        this.scrollbarCompensationApplied = true;
      }

      // Prevent touch scrolling on mobile
      const preventTouch = (e: TouchEvent) => {
        e.preventDefault();
      };
      document.addEventListener('touchmove', preventTouch, { passive: false });
      (document.body as any)._preventTouch = preventTouch;

      this.usingCssFallback = true;
    }

    this.isLocked = true;
  }

  unlock() {
    this.lockCount--;

    if (this.lockCount > 0) return;

    if (!this.isLocked) return;

    // Always restore the CSS fallback first if it was applied
    if (this.usingCssFallback) {
      // Remove touch event listener if it was added
      const preventTouch = (document.body as any)._preventTouch;
      if (preventTouch) {
        document.removeEventListener('touchmove', preventTouch);
        delete (document.body as any)._preventTouch;
      }

      // Restore original styles
      document.body.style.overflow = this.prevBodyOverflow ?? '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.bottom = '';
      document.documentElement.style.overflow = this.prevHtmlOverflow ?? '';

      // Restore scroll position
      if (this.savedScrollPosition) {
        window.scrollTo(this.savedScrollPosition.x, this.savedScrollPosition.y);
      }

      // Restore padding-right if we applied compensation
      if (this.scrollbarCompensationApplied) {
        document.body.style.paddingRight = this.prevBodyPaddingRight ?? '';
        this.prevBodyPaddingRight = null;
        this.scrollbarCompensationApplied = false;
      }

      this.prevBodyOverflow = null;
      this.prevHtmlOverflow = null;
      this.usingCssFallback = false;
    }

    if (this.mainScrollbarInstance) {
      // Re-enable the main scrollbars
      this.mainScrollbarInstance.options({
        scrollbars: {
          autoHide: "leave",
          autoHideDelay: 100,
          visibility: "auto",
        },
        overflow: {
          x: "visible",
          y: "scroll",
        },
      });
    }

    // Clear saved position without restoring to prevent unwanted scroll jumps
    this.savedScrollPosition = null;
    this.isLocked = false;
    this.lockCount = 0;
  }
}

// Export singleton instance
export const scrollLock = new ScrollLock();

/**
 * Enhanced scroll position utilities for preventing layout shifts
 */

// Type for comprehensive scroll position
type ScrollPosition = {
  x: number;
  y: number;
  timestamp: number;
};

let savedScrollPosition: ScrollPosition | null = null;

// Legacy simple utilities (kept for backwards compatibility)
export function saveScroll(): number {
  return window.pageYOffset || document.documentElement.scrollTop || 0;
}

export function restoreScroll(position: number, smooth = false): void {
  window.scrollTo({
    top: position,
    behavior: smooth ? 'smooth' : 'auto'
  });
}

// Enhanced scroll preservation utilities
/**
 * Save the current scroll position with timestamp
 * @returns The saved scroll position
 */
export function saveScrollPosition(): ScrollPosition | null {
  if (typeof window === 'undefined') return null;
  
  const position: ScrollPosition = {
    x: window.scrollX || window.pageXOffset || 0,
    y: window.scrollY || window.pageYOffset || 0,
    timestamp: Date.now()
  };
  
  savedScrollPosition = position;
  return position;
}

/**
 * Restore the previously saved scroll position
 * @param position Optional position to restore (uses saved position if not provided)
 * @param smooth Whether to use smooth scrolling
 */
export function restoreScrollPosition(position?: ScrollPosition | null, smooth: boolean = false): void {
  if (typeof window === 'undefined') return;
  
  const pos = position || savedScrollPosition;
  if (!pos) return;
  
  // Only restore if the position is recent (within 5 seconds) to avoid stale restores
  const isRecent = Date.now() - pos.timestamp < 5000;
  if (!isRecent) return;
  
  if (smooth) {
    window.scrollTo({
      left: pos.x,
      top: pos.y,
      behavior: 'smooth'
    });
  } else {
    window.scrollTo(pos.x, pos.y);
  }
}

/**
 * Clear the saved scroll position
 */
export function clearSavedScrollPosition(): void {
  savedScrollPosition = null;
}

/**
 * Wrap a function with scroll position preservation
 * Saves scroll position before executing the function and restores it after DOM updates
 * @param fn The function to wrap
 * @param restoreDelay Optional delay before restoring scroll (defaults to next tick)
 * @returns A wrapped function that preserves scroll position
 */
export function withScrollPreservation<T extends (...args: any[]) => any>(
  fn: T,
  restoreDelay: number = 0
): T {
  return ((...args: Parameters<T>) => {
    if (typeof window === 'undefined') {
      return fn(...args);
    }
    
    // Save current scroll position
    const position = saveScrollPosition();
    
    // Execute the function
    const result = fn(...args);
    
    // Schedule scroll restoration after DOM updates
    if (restoreDelay > 0) {
      setTimeout(() => restoreScrollPosition(position), restoreDelay);
    } else {
      // Use requestAnimationFrame for next frame restoration
      requestAnimationFrame(() => restoreScrollPosition(position));
    }
    
    return result;
  }) as T;
}

/**
 * Async version of withScrollPreservation that works with promises and Svelte's tick()
 * @param fn The async function to wrap
 * @param useTick Whether to wait for Svelte's tick() before restoring scroll
 * @returns A wrapped async function that preserves scroll position
 */
export function withScrollPreservationAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  useTick: boolean = true
): T {
  return (async (...args: Parameters<T>) => {
    if (typeof window === 'undefined') {
      return await fn(...args);
    }
    
    // Save current scroll position
    const position = saveScrollPosition();
    
    try {
      // Execute the async function
      const result = await fn(...args);
      
      // Wait for DOM updates
      if (useTick) {
        const { tick } = await import('svelte');
        await tick();
      }
      
      // Restore scroll position
      restoreScrollPosition(position);
      
      return result;
    } catch (error) {
      // Still try to restore scroll position on error
      restoreScrollPosition(position);
      throw error;
    }
  }) as T;
}

/**
 * Create a safe action wrapper that preserves scroll position for UI state changes
 * This is specifically designed for handling filter toggles, banners, and other UI mutations
 * @param action The action function to wrap
 * @returns A wrapped action that preserves scroll position
 */
export function createSafeAction<T extends (...args: any[]) => any>(action: T): T {
  return withScrollPreservation((...args: Parameters<T>) => {
    // Initial save of the scroll position
    const prevPosition = saveScrollPosition();

    // Perform the action
    const result = action(...args);

    // Attempt to detect and restore scroll position relative to potential new banners or UI changes
    setTimeout(() => {
      if (prevPosition) restoreScrollPosition(prevPosition, false);
    }, 50); // Slightly longer delay for more complex UI updates

    return result;
  }, 16) as T; // 16ms = 1 frame delay
}

/**
 * Create a safe async action wrapper that preserves scroll position for async UI state changes
 * @param action The async action function to wrap
 * @returns A wrapped async action that preserves scroll position
 */
export function createSafeAsyncAction<T extends (...args: any[]) => Promise<any>>(action: T): T {
  return withScrollPreservationAsync(action, true) as T;
}
