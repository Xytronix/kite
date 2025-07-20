import type { RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const DISCORD_WEBHOOK_URL: string | undefined = env.DISCORD_WEBHOOK_URL;

interface ReportPayload {
  storyId: string;
  reason: string;
  url?: string;
  details?: string;
  source?: string; // backward compatibility
  sources?: string[]; // new multi-select support
}

export const POST: RequestHandler = async ({ request }) => {
  if (!DISCORD_WEBHOOK_URL) {
    console.error('Discord webhook URL not configured');
    return new Response(JSON.stringify({ success: false, error: 'Webhook not configured' }), { status: 500 });
  }

  let data: ReportPayload;
  try {
    data = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), { status: 400 });
  }

  // Build Discord message
  const contentLines: string[] = [
    `**Story ID:** ${data.storyId}`,
    `**Reason:** ${data.reason}`
  ];
  if (data.url) contentLines.push(`**Link:** ${data.url}`);
  if (data.sources && data.sources.length) {
    contentLines.push(`**Sources:** ${data.sources.join(', ')}`);
  } else if (data.source) {
    // legacy single-source field
    contentLines.push(`**Source:** ${data.source}`);
  }
  if (data.details) contentLines.push(`**Details:** ${data.details}`);

  const discordBody = {
    content: contentLines.join('\n')
  };

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordBody)
    });
  } catch (err) {
    console.error('Failed to send discord webhook', err);
    return new Response(JSON.stringify({ success: false, error: 'Failed to send notification' }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}; 