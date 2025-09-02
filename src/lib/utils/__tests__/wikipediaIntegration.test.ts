import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { wikipediaTooltipManager } from '../wikipediaTooltipManager.js';

// Mock DOM environment
const mockElement = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  querySelectorAll: vi.fn(() => []),
  hasAttribute: vi.fn(() => false),
  getAttribute: vi.fn(() => null)
};

// Mock handlers
const mockHandlers = {
  handleWikipediaInteraction: vi.fn(),
  handleWikipediaLeave: vi.fn()
};

describe('Wikipedia Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the manager
    wikipediaTooltipManager.cleanup();
  });

  afterEach(() => {
    wikipediaTooltipManager.cleanup();
  });

  describe('WikipediaTooltipManager', () => {
    it('should initialize with tooltip instance and handlers', () => {
      const tooltipInstance = {};
      
      wikipediaTooltipManager.initialize(tooltipInstance, mockHandlers);
      
      // Should not throw and should be ready to attach tooltips
      expect(() => {
        wikipediaTooltipManager.attachTooltipsToContainer(mockElement as any);
      }).not.toThrow();
    });

    it('should attach event handlers to Wikipedia elements', () => {
      const mockWikiElement = {
        ...mockElement,
        hasAttribute: vi.fn(() => true),
        getAttribute: vi.fn(() => 'Albert_Einstein')
      };

      mockElement.querySelectorAll = vi.fn(() => [mockWikiElement]);
      
      wikipediaTooltipManager.initialize({}, mockHandlers);
      wikipediaTooltipManager.attachTooltipsToContainer(mockElement as any);

      // Should have attached event listeners
      expect(mockWikiElement.addEventListener).toHaveBeenCalled();
    });

    it('should handle mobile vs desktop event attachment', () => {
      const mockWikiElement = {
        ...mockElement,
        hasAttribute: vi.fn(() => true),
        getAttribute: vi.fn(() => 'Albert_Einstein')
      };

      mockElement.querySelectorAll = vi.fn(() => [mockWikiElement]);
      
      // Mock mobile detection
      Object.defineProperty(window, 'innerWidth', { value: 500, writable: true });
      
      wikipediaTooltipManager.initialize({}, mockHandlers);
      wikipediaTooltipManager.attachTooltipsToContainer(mockElement as any);

      // Should attach click events for mobile
      expect(mockWikiElement.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should not attach duplicate handlers', () => {
      const mockWikiElement = {
        ...mockElement,
        hasAttribute: vi.fn(() => true),
        getAttribute: vi.fn(() => 'Albert_Einstein')
      };

      mockElement.querySelectorAll = vi.fn(() => [mockWikiElement]);
      
      wikipediaTooltipManager.initialize({}, mockHandlers);
      
      // Attach twice
      wikipediaTooltipManager.attachTooltipsToContainer(mockElement as any);
      wikipediaTooltipManager.attachTooltipsToContainer(mockElement as any);

      // Should only attach once (due to WeakSet tracking)
      const callCount = mockWikiElement.addEventListener.mock.calls.length;
      wikipediaTooltipManager.attachTooltipsToContainer(mockElement as any);
      
      // Call count should not increase
      expect(mockWikiElement.addEventListener.mock.calls.length).toBe(callCount);
    });

    it('should clean up properly', () => {
      wikipediaTooltipManager.initialize({}, mockHandlers);
      wikipediaTooltipManager.cleanup();
      
      // Should not throw when trying to attach after cleanup
      expect(() => {
        wikipediaTooltipManager.attachTooltipsToContainer(mockElement as any);
      }).not.toThrow();
    });
  });
});