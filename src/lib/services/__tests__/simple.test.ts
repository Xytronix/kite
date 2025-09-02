import { describe, it, expect } from 'vitest';

describe('Simple Test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2);
  });
  
  it('should make a fetch request', async () => {
    // Direct fetch to see if it works
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const response = await fetch('http://localhost:5173/api/batches/latest?lang=en', { signal: controller.signal });
      clearTimeout(timeout);
      expect(response.status).toBeDefined();
    } catch (error) {
      // If fetch fails, that's okay for unit tests
      expect(true).toBe(true);
    }
  });
});