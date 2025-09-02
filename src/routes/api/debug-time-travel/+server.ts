import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
    try {
        if (process.env.NODE_ENV === 'development') {
            console.log('[DEBUG] Time travel state check requested');
        }
        
        // Return basic info about server state
        return json({ 
            message: 'Time travel debug endpoint - check browser console and terminal for detailed logs',
            timestamp: new Date().toISOString(),
            instructions: 'This endpoint helps debug time travel batch issues. Check the browser sessionStorage for "kite-time-travel-batch" and the terminal logs for batch validation messages.'
        });
    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error('Debug endpoint error:', error);
        }
        return json({ error: String(error) }, { status: 500 });
    }
};

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { action } = await request.json();
        
        if (action === 'clear-time-travel') {
            if (process.env.NODE_ENV === 'development') {
                console.log('[DEBUG] Manual time travel clear requested');
            }
            return json({ 
                message: 'Time travel clear logged - this clears client-side state via browser',
                timestamp: new Date().toISOString()
            });
        }
        
        return json({ error: 'Unknown action' }, { status: 400 });
    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error('Debug endpoint error:', error);
        }
        return json({ error: String(error) }, { status: 500 });
    }
}; 