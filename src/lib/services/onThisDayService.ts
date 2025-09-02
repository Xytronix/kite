import type { OnThisDayEvent, LoadOnThisDayResponse } from '$lib/types';
import { batchService } from './batchService';
import { fetchWithRetry } from '$lib/utils/fetchWithRetry.js';

/**
 * Service for OnThisDay functionality
 */
class OnThisDayService {
	private baseUrl = '/api';

	/**
	 * Load OnThisDay events
	 */
	async loadOnThisDayEvents(
		language: string = "en",
	): Promise<OnThisDayEvent[]> {
		try {
			// If we have a specific batch ID (time travel), use it
			// Otherwise, use the latest batch endpoint
			const currentBatchId = batchService.getCurrentBatchId();
			const endpoint = currentBatchId 
				? `${this.baseUrl}/batches/${currentBatchId}/onthisday`
				: `${this.baseUrl}/batches/latest/onthisday?lang=${language}`;
				
			const response = await fetchWithRetry(endpoint, {
				timeout: 25000,
				retries: 4,
				retryDelay: 1200,
				retryOnStatus: [500, 502, 503, 504]
			});
			if (!response.ok) {
				if (response.status === 404) {
					// OnThisDay data not available for this batch
					return [];
				}
				if (response.status === 502 || response.status === 503) {
					// Server temporarily unavailable
					if (import.meta.env.DEV) {
						console.warn(`OnThisDay service temporarily unavailable (${response.status})`);
					}
					return [];
				}
				throw new Error(
					`Failed to load OnThisDay events: ${response.statusText}`,
				);
			}
			const data: LoadOnThisDayResponse = await response.json();
			return data.events || [];
		} catch (error) {
			if (import.meta.env.DEV) {
				console.error("Error loading OnThisDay events:", error);
			}
			// Return empty array instead of throwing to prevent UI breakage
			if (error instanceof TypeError && error.message.includes('fetch')) {
				if (import.meta.env.DEV) {
					console.warn("Network error loading OnThisDay events, returning empty array");
				}
				return [];
			}
			throw error;
		}
	}
}

// Export singleton instance
export const onThisDayService = new OnThisDayService();