import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { message, data, timestamp } = await request.json();
        
        // Output to terminal with timestamp
        const logMessage = `[DEBUG ${timestamp}] ${message}`;
        
        if (data) {
            if (process.env.NODE_ENV === 'development') {
                console.log(logMessage, JSON.stringify(data, null, 2));
            }
        } else {
            if (process.env.NODE_ENV === 'development') {
                console.log(logMessage);
            }
        }
        
        return json({ success: true });
    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error('Debug log error:', error);
        }
        return json({ success: false, error: String(error) });
    }
}; 