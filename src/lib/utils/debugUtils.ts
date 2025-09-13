import { dev } from '$app/environment';

export function debugInfo(namespace: string, message: string, data?: unknown): void {
  // Only log in development to keep production clean
  if (!dev) return;

  const formattedMessage = `[${namespace}] ${message}`;
  if (data !== undefined) {
    // Use console.debug for lightweight client-side logging
    // eslint-disable-next-line no-console
    console.debug(formattedMessage, data);
  } else {
    // eslint-disable-next-line no-console
    console.debug(formattedMessage);
  }
}
