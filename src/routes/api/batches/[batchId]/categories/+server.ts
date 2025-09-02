import type { RequestHandler } from '@sveltejs/kit';

// Upstream API base – keep in sync with $lib/server/proxy
const KITE_API_BASE = 'https://kite.kagi.com/api';

/**
 * GET /api/batches/[batchId]/categories
 *
 * Proxies the request to the upstream Kite API but filters out categories that have
 * no content (clusterCount === 0). This prevents front-end navigation to categories
 * that would otherwise appear empty.
 */
export const GET: RequestHandler = async ({ params, url, request }) => {
  const { batchId } = params as { batchId: string };

  // Reconstruct upstream URL, preserving query parameters (e.g. lang)
  const upstreamUrl = new URL(`${KITE_API_BASE}/batches/${batchId}/categories`);
  url.searchParams.forEach((value, key) => upstreamUrl.searchParams.append(key, value));

  // Forward the original Accept header only – no need to forward cookies, etc.
  const headers = new Headers();
  const accept = request.headers.get('accept');
  if (accept) headers.set('accept', accept);

  const upstreamResponse = await fetch(upstreamUrl, { headers });

  if (!upstreamResponse.ok) {
    // Pass through error status/text unchanged
    return new Response(await upstreamResponse.text(), {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: { 'content-type': upstreamResponse.headers.get('content-type') ?? 'application/json' }
    });
  }

  const data = await upstreamResponse.json();

  if (!data?.categories || !Array.isArray(data.categories)) {
    // Malformed – return as-is to avoid hiding potential issues
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }

  // Filter out categories with zero clusters/feed items
  data.categories = data.categories.filter((cat: any) => {
    const readCount = typeof cat.readCount === 'string' ? parseInt(cat.readCount, 10) : cat.readCount;
    return Number.isFinite(readCount) ? readCount > 0 : true;
  });

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
};