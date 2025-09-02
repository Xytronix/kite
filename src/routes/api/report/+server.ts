import type { RequestHandler } from '@sveltejs/kit';

const GITHUB_REPO_OWNER = 'kagisearch';
const GITHUB_REPO_NAME = 'kite-public';

interface ReportPayload {
  storyId: string;
  storyTitle?: string;
  storySummary?: string;
  storyQuote?: string;
  storyPerspectives?: string;
  storyTimeline?: string;
  storyTalkingPoints?: string;
  storySources?: string[];
  reason: string;
  url?: string;
  details?: string;
  source?: string; // backward compatibility
  sources?: string[]; // new multi-select support
}

const REASON_LABELS: Record<string, string[]> = {
  'misinformation': ['bug', 'content-quality'],
  'bad_categorization': ['bug', 'categorization'],
  'bad_image': ['bug', 'content-quality'],
  'uncredible_sources': ['enhancement', 'sources'],
  'missing_parallelism': ['enhancement', 'content-quality'],
  'plagiarism': ['bug', 'content-quality'],
  'privacy': ['bug', 'privacy'],
  'other': ['feedback']
};

export const POST: RequestHandler = async ({ request }) => {
  let data: ReportPayload;
  try {
    data = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), { status: 400 });
  }

  // Build issue title and body for GitHub
  const reasonFormatted = data.reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const titlePart = data.storyTitle ? ` | ${data.storyTitle}` : '';
  const title = `Report: ${reasonFormatted}${titlePart} (#${data.storyId})`;
  
  const bodyLines: string[] = [
    `## Story Report`,
    ``,
    `**Story ID:** ${data.storyId}`,
    data.storyTitle ? `**Title:** ${data.storyTitle}` : '',
    `**Reason:** ${data.reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
  ].filter(Boolean);
  
  if (data.url) bodyLines.push(`**Story URL:** ${data.url}`);

  // Consolidate story content in a single spoiler section
  const storyContentSections = [];
  
  if (data.storySources && data.storySources.length) {
    storyContentSections.push(`**Sources (${data.storySources.length}):**\n${data.storySources.map(src => `- ${src}`).join('\n')}`);
  }
  
  if (data.storySummary) {
    storyContentSections.push(`**Summary:**\n${data.storySummary}`);
  }

  if (data.storyQuote) {
    storyContentSections.push(`**Quote:**\n> ${data.storyQuote}`);
  }

  if (data.storyTalkingPoints) {
    storyContentSections.push(`**Talking Points:**\n- ${data.storyTalkingPoints}`);
  }

  if (data.storyPerspectives) {
    storyContentSections.push(`**Perspectives:**\n${data.storyPerspectives}`);
  }

  if (data.storyTimeline && data.storyTimeline.trim() && !data.storyTimeline.includes('Date unknown: ')) {
    storyContentSections.push(`**Timeline:**\n${data.storyTimeline}`);
  }

  if (storyContentSections.length > 0) {
    bodyLines.push(`**Story Content:**`);
    bodyLines.push('<details><summary>Click to expand story details</summary>');
    bodyLines.push('');
    bodyLines.push(storyContentSections.join('\n\n'));
    bodyLines.push('');
    bodyLines.push('</details>');
  }

  if (data.sources && data.sources.length) {
    bodyLines.push(`**Problematic Sources:**`);
    data.sources.forEach(source => bodyLines.push(`- ${source}`));
  } else if (data.source) {
    bodyLines.push(`**Problematic Source:** ${data.source}`);
  }
  
  if (data.details) {
    bodyLines.push(``, `**Additional Details:**`, data.details);
  }
  
  bodyLines.push(
    ``,
    `---`,
    `*This issue was created from a user report.*`
  );

  const body = bodyLines.join('\n');
  const labels = REASON_LABELS[data.reason] || ['feedback'];

  // Create GitHub issue URL with pre-filled data
  const githubUrl = new URL(`https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/issues/new`);
  githubUrl.searchParams.set('title', title);
  githubUrl.searchParams.set('body', body);
  githubUrl.searchParams.set('labels', labels.join(','));

  return new Response(JSON.stringify({ 
    success: true, 
    githubUrl: githubUrl.toString()
  }), { 
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}; 