import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
    // Return current server time in ISO format
    const currentTime = new Date().toISOString();
    
    return json({
        currentTime,
        timestamp: Date.now()
    });
};