import { batchService } from './batchService';

/**
 * Service for Chaos Index functionality
 */
class ChaosIndexService {
	private baseUrl = '/api';

	/**
	 * Load chaos index data
	 */
	async loadChaosIndex(language: string = "en"): Promise<{
		chaosIndex: number;
		chaosDescription: string;
		chaosLastUpdated: string | null;
	} | null> {
		try {
			const currentBatchId = batchService.getCurrentBatchId();
			const endpoint = currentBatchId
				? `${this.baseUrl}/batches/${currentBatchId}/chaos?lang=${language}`
				: `${this.baseUrl}/batches/latest/chaos?lang=${language}`;

			const response = await fetch(endpoint);
			if (!response.ok) {
				if (response.status === 404) {
					// Chaos index not available for this batch - this is normal
					if (import.meta.env.DEV) {
						console.log(`ℹ️ Chaos index not available for batch ${currentBatchId || 'latest'}`);
					}
					return null;
				}
				throw new Error(`Failed to load chaos index: ${response.statusText}`);
			}

			return await response.json();
		} catch (error) {
			// Don't log 404s as errors since they're expected for some batches
			if (error instanceof Error && error.message.includes('404')) {
				return null;
			}
			if (import.meta.env.DEV) {
				console.error("Error loading chaos index:", error);
			}
			throw error;
		}
	}

	/**
	 * Get historical chaos index data
	 */
	async getChaosIndexHistory(
		language: string = "en",
		days: number = 30
	): Promise<Array<{ date: string; score: number; summary: string }>> {
		try {
			const response = await fetch(
				`${this.baseUrl}/chaos/history?lang=${language}&days=${days}`
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch chaos history: ${response.statusText}`);
			}

			return await response.json();
		} catch (error) {
			if (import.meta.env.DEV) {
				console.error("Error fetching chaos history:", error);
			}
			return [];
		}
	}
}

// Export singleton instance
export const chaosIndexService = new ChaosIndexService();