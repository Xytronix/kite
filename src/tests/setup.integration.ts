// Test setup for integration tests
import { vi } from 'vitest';
import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

// Ensure global window object exists for Node environment
if (typeof window === 'undefined') {
  // @ts-ignore
  global.window = {} as any;
}

// Mock browser environment
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ----------------------------------------------------------------------------
// Smart fetch stub — emulates the subset of the backend needed by integration
// tests. Each endpoint returns minimal but structurally-valid JSON so the
// assertions pass without requiring a live API server.
// ----------------------------------------------------------------------------

interface MockResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  json: () => Promise<any>;
}

function createResponse(data: any, status = 200): MockResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input.toString();

  // ---------------------------------
  // BATCH ENDPOINTS
  // ---------------------------------
  if (/\/api\/batches\/latest\?/.test(url)) {
    return createResponse({ id: 'latest-batch', createdAt: '2024-01-01T12:00:00Z' });
  }
  if (/\/api\/batches\/latest\/chaos/.test(url)) {
    return createResponse({ chaosIndex: 42, chaosDescription: 'Moderate turbulence', chaosLastUpdated: '2024-01-01T12:00:00Z' });
  }
  const batchMatch = url.match(/\/api\/batches\/([^\/\?]+)(?:\/|\?|$)/);
  if (batchMatch) {
    const batchId = batchMatch[1];
    // Specific batch fetch – STORIES must come before generic /categories check
    if (/\/stories/.test(url)) {
      const sampleStory = {
        title: 'Mock Story',
        short_summary: 'This is a mock story for tests.',
        articles: [
          {
            title: 'Mock Article',
            link: 'https://example.com/article',
            domain: 'example.com',
            date: '2024-01-01T00:00:00Z',
          },
        ],
        category: 'world',
      };
      return createResponse({ stories: [sampleStory], readCount: 1, timestamp: Date.now() / 1000 });
    }
    if (/\/categories/.test(url)) {
      return createResponse({
        categories: [
          { id: '123e4567-e89b-12d3-a456-426614174000', categoryId: 'world', categoryName: 'World' },
          { id: '123e4567-e89b-12d3-a456-426614174001', categoryId: 'tech', categoryName: 'Technology' },
        ],
        hasOnThisDay: true,
      });
    }
    if (/\/chaos\?/.test(url)) {
      return createResponse({ chaosIndex: 42, chaosDescription: 'Moderate turbulence', chaosLastUpdated: '2024-01-01T12:00:00Z' });
    }
    if (/\/onthisday/.test(url)) {
      return createResponse({ events: [] });
    }
    // Base batch data
    return createResponse({ id: batchId, createdAt: '2024-01-01T12:00:00Z' });
  }

  // ---------------------------------
  // MEDIA ENDPOINTS
  // ---------------------------------
  if (/\/api\/media\?/.test(url)) {
    return createResponse({
      mediaData: [
        {
          country: 'US',
          organization: 'Example News',
          domains: ['example.com'],
          description: 'A mock news organisation',
          owner: 'Example Inc.',
          typology: 'Newspaper',
        },
      ],
    });
  }

  const mediaHostMatch = url.match(/\/api\/media\/([^\?]+)\?/);
  if (mediaHostMatch) {
    const host = mediaHostMatch[1];
    if (host === 'example.com') {
      return createResponse({
        mediaInfo: {
          country: 'US',
          organization: 'Example News',
          domains: [host],
          description: 'A mock news organisation',
          owner: 'Example Inc.',
          typology: 'Newspaper',
        },
      });
    }
    return createResponse({}, 404);
  }

  // ---------------------------------
  // CHAOS HISTORY
  // ---------------------------------
  if (/\/api\/chaos\/history/.test(url)) {
    const today = new Date();
    const entries = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      return { date: date.toISOString(), score: 40 + i, summary: 'Stable' };
    });
    return createResponse(entries);
  }

  // ---------------------------------
  // STORIES ENDPOINT
  // ---------------------------------
  if (/\/stories\?/.test(url)) {
    const sampleStory = {
      title: 'Mock Story',
      short_summary: 'This is a mock story for tests.',
      articles: [
        {
          title: 'Mock Article',
          link: 'https://example.com/article',
          domain: 'example.com',
          date: '2024-01-01T00:00:00Z',
        },
      ],
      category: 'world',
    };
    return createResponse({ stories: [sampleStory], readCount: 0, timestamp: Date.now() / 1000 });
  }

  // Fallback: 404 Not Found
  return createResponse({ message: 'Not found' }, 404);
});

// @ts-ignore
global.fetch = fetchMock;

// Basic localStorage stub (some libraries expect it).
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
// @ts-ignore
global.localStorage = localStorageMock as unknown as Storage;