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
