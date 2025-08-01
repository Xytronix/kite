import type { Story } from '$lib/types';
import { fetchWithRetry } from '$lib/utils/fetchWithRetry.js';

/**
 * Service for loading story data
 */
class StoriesService {
	private baseUrl = '/api';

	/**
	 * Load stories for a specific category from a batch
	 */
	async loadStories(
		batchId: string,
		categoryUuid: string,
		limit: number = 12, // Max 12 stories per category from UI
		language: string = "en",
	): Promise<{ stories: Story[]; readCount: number; timestamp: number; isApiFailure?: boolean }> {
		// Persistent logging function
		const persistentLog = (message: string, data?: any) => {
			if (typeof window === 'undefined') return;
			
			const timestamp = new Date().toISOString();
			const logEntry = { timestamp, message: `[STORIES] ${message}`, data, url: window.location.href };
			
			try {
				const logs = JSON.parse(localStorage.getItem('kite-debug-logs') || '[]');
				logs.push(logEntry);
				if (logs.length > 50) logs.splice(0, logs.length - 50);
				localStorage.setItem('kite-debug-logs', JSON.stringify(logs));
			} catch (e) {
				console.warn('Failed to save persistent log:', e);
			}
			
			console.log(`[PERSISTENT STORIES] ${message}`, data || '');
		};
		
		try {
			persistentLog('🚀 loadStories called', { 
				batchId: batchId.substring(0, 8), 
				categoryUuid, 
				limit, 
				language 
			});
			
			// Load stories for this category with language parameter
			persistentLog('🌐 About to call fetchWithRetry', { 
				url: `${this.baseUrl}/batches/${batchId}/categories/${categoryUuid}/stories` 
			});
			
			const response = await fetchWithRetry(
				`${this.baseUrl}/batches/${batchId}/categories/${categoryUuid}/stories?limit=${limit}&lang=${language}`,
				{
					timeout: 30000,
					retries: 4,
					retryDelay: 1500,
					maxRetryDelay: 12000,
					retryOnStatus: [500, 502, 503, 504]
				}
			);
			
			persistentLog('📡 fetchWithRetry completed', { 
				status: response.status, 
				ok: response.ok,
				statusText: response.statusText
			});
			
			if (!response.ok) {
				// Handle specific error cases gracefully to prevent page refresh
				if (response.status === 500) {
					console.warn(`⚠️ Server error loading stories (500), returning empty result: batch=${batchId}, category=${categoryUuid}`);
					return { stories: [], readCount: 0, timestamp: Date.now() / 1000, isApiFailure: true };
				}
				if (response.status === 502 || response.status === 503) {
					console.warn(`⚠️ Service temporarily unavailable (${response.status}), returning empty result: batch=${batchId}, category=${categoryUuid}`);
					return { stories: [], readCount: 0, timestamp: Date.now() / 1000, isApiFailure: true };
				}
				if (response.status === 404) {
					console.warn(`⚠️ Stories not found (404), returning empty result: batch=${batchId}, category=${categoryUuid}`);
					return { stories: [], readCount: 0, timestamp: Date.now() / 1000 };
				}
				
				// For other errors, still throw to maintain error handling
				throw new Error(`Failed to load stories (${response.status}): ${response.statusText}`);
			}
			
			persistentLog('📄 About to parse JSON response');
			const data = await response.json();
			
			persistentLog('✅ JSON parsed successfully', {
				storiesCount: data.stories?.length || 0,
				readCount: data.readCount || 0
			});
			
			const result = {
				stories: data.stories || [],
				readCount: data.readCount || 0,
				timestamp: data.timestamp || Date.now() / 1000
			};
			
			persistentLog('🎯 Returning result', {
				storiesCount: result.stories.length,
				readCount: result.readCount
			});
			
			return result;
		} catch (error) {
			persistentLog('💥 Error caught in loadStories', {
				errorType: error?.constructor?.name,
				errorMessage: error instanceof Error ? error.message : String(error),
				errorStack: error instanceof Error ? error.stack : undefined,
				batchId: batchId.substring(0, 8),
				categoryUuid,
				url: `${this.baseUrl}/batches/${batchId}/categories/${categoryUuid}/stories`
			});
			
			console.error("Error loading stories:", error);
			
			// AGGRESSIVE ERROR HANDLING: Never throw errors that might cause page refresh
			// Return empty results for ALL errors to prevent navigation issues
			
			if (error instanceof TypeError && error.message.includes('fetch')) {
				persistentLog('🌐 Network/fetch error - returning empty result to prevent navigation');
				console.warn("Network error loading stories, returning empty result to prevent page refresh");
			} else if (error instanceof Error && (
				error.message.includes('Server error') ||
				error.message.includes('Service temporarily unavailable') ||
				error.message.includes('timeout') ||
				error.message.includes('500') ||
				error.message.includes('502') ||
				error.message.includes('503') ||
				error.message.includes('504') ||
				error.message.includes('Navigation triggered during fetch') ||
				error.message.includes('aborted')
			)) {
				persistentLog('⚠️ Server/API error - returning empty result to prevent navigation', {
					errorMessage: error.message
				});
			} else {
				persistentLog('🚨 Unknown error - returning empty result to prevent potential navigation', {
					errorMessage: error instanceof Error ? error.message : String(error)
				});
			}
			
			// ALWAYS return empty result instead of throwing - this prevents page refreshes
			return { stories: [], readCount: 0, timestamp: Date.now() / 1000, isApiFailure: true };
		}
	}
}

// Export singleton instance
export const storiesService = new StoriesService();