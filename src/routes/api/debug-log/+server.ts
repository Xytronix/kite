import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { message, data, timestamp } = await request.json();
        
        // Output to terminal with timestamp
        const logMessage = `[DEBUG ${timestamp}] ${message}`;
        
        if (data) {
            console.log(logMessage, JSON.stringify(data, null, 2));
        } else {
            console.log(logMessage);
        }
        
        return json({ success: true });
    } catch (error) {
        console.error('Debug log error:', error);
        return json({ success: false, error: String(error) });
    }
}; 