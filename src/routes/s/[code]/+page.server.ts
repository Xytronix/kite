import { redirect } from '@sveltejs/kit';
import { getShortUrl } from '$lib/utils/urlShortener';
import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const code = params.code;
  
  // If no database configured, redirect to home
  if (!env.DATABASE_URL) {
    throw redirect(302, '/');
  }
  
  try {
    // Look up the short code in the database
    const fullUrl = await getShortUrl(code);
    
    if (!fullUrl) {
      // Short URL not found, redirect to home
      throw redirect(302, '/');
    }
    
    // Redirect to the full URL
    throw redirect(301, fullUrl);
  } catch (error) {
    // If not a redirect error, log it
    if (!(error instanceof Error && 'status' in error)) {
      console.error('Error resolving short URL:', error);
    }
    // Re-throw redirect errors
    throw error;
  }
};