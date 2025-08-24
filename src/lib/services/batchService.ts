import type { Category } from '$lib/types';
import { fetchWithRetry } from '$lib/utils/fetchWithRetry.js';
import { timeTravelBatch } from '$lib/stores/timeTravelBatch.svelte';

/**
 * Service for managing batch data and time travel functionality
 */
class BatchService {
	private baseUrl = '/api';
	private directApiUrl = 'https://kite.kagi.com/api';

	/**
	 * Set a specific batch ID for time travel
	 */
	setTimeTravelBatch(batchId: string | null) {
		timeTravelBatch.set(batchId);
		console.log(`⏰ Time travel mode ${batchId ? 'enabled' : 'disabled'}, batch: ${batchId}`);
	}

	/**
	 * Check if we're in time travel mode
	 */
	isTimeTravelMode(): boolean {
		return timeTravelBatch.isTimeTravelMode();
	}

	/**
	 * Get the current batch ID (for time travel)
	 */
	getCurrentBatchId(): string | null {
		return timeTravelBatch.get();
	}

	/**
	 * Load all data for initial page load
	 */
	async loadInitialData(language: string = "en", providedBatchInfo?: { id: string; createdAt: string; totalReadCount?: number }): Promise<{
		batchId: string;
		categories: Category[];
		categoryMap: Record<string, string>;
		timestamp: number;
		hasOnThisDay: boolean;
		totalReadCount: number;
		chaosIndex?: number;
		chaosDescription?: string;
		chaosLastUpdated?: string;
	}> {
		try {
			let batchId: string;
			let batchCreatedAt: string;

			// Step 1: Get the batch (either time travel or latest)
			const currentBatchId = this.getCurrentBatchId();

			// If we already have batch info provided, use it to avoid duplicate API call
			if (providedBatchInfo && providedBatchInfo.id === currentBatchId) {
				console.log('🚀 Using provided batch info, skipping API call');
				batchId = providedBatchInfo.id;
				batchCreatedAt = providedBatchInfo.createdAt;
			} else if (currentBatchId) {
				// Time travel mode - validate the batch exists before using it
				console.log(`🕰️ Validating time travel batch: ${currentBatchId}`);
				try {
					const batchResponse = await fetchWithRetry(
						`${this.baseUrl}/batches/${currentBatchId}`,
						{
							timeout: 25000,
							retries: 2, // Reduced retries for validation
							retryDelay: 1000
						}
					);
					
					if (!batchResponse.ok) {
						if (batchResponse.status === 404) {
							console.warn(`⚠️ Time travel batch ${currentBatchId} not found (404) - clearing time travel mode and falling back to latest`);
							this.setTimeTravelBatch(null); // Clear invalid batch
							throw new Error('FALLBACK_TO_LATEST'); // Special error to trigger latest batch loading
						} else if (batchResponse.status >= 500) {
							console.warn(`⚠️ Server error (${batchResponse.status}) validating batch ${currentBatchId} - clearing time travel mode and falling back to latest`);
							this.setTimeTravelBatch(null); // Clear problematic batch
							throw new Error('FALLBACK_TO_LATEST'); // Special error to trigger latest batch loading
						} else {
							throw new Error(`Failed to validate batch ${currentBatchId}: ${batchResponse.statusText}`);
						}
					}
					
					const batch = await batchResponse.json();
					batchId = batch.id;
					batchCreatedAt = batch.createdAt;
					console.log(`✅ Time travel batch validated: ${batchId}`);
				} catch (error) {
					if (error instanceof Error && error.message === 'FALLBACK_TO_LATEST') {
						// Fall back to loading latest batch
						console.log(`🔄 Falling back to latest batch after clearing invalid time travel batch`);
						// The logic below will handle loading the latest batch
					} else {
						console.error(`❌ Error validating time travel batch ${currentBatchId}:`, error);
						console.warn(`🔄 Clearing invalid time travel batch and falling back to latest`);
						this.setTimeTravelBatch(null); // Clear problematic batch
					}
					
					// Set flags to load latest batch instead
					batchId = '';
					batchCreatedAt = '';
				}
			}
			
			// If we don't have batch info yet (either no time travel batch or fallback from invalid batch)
			if (!batchId || !batchCreatedAt) {
				// Live mode - get latest batch
				console.log(`🔄 Fetching latest batch from ${this.baseUrl}/batches/latest?lang=${language}`);
				
				try {
					const batchResponse = await fetchWithRetry(
						`${this.baseUrl}/batches/latest?lang=${language}`,
						{
							timeout: 30000,
							retries: 5,
							retryDelay: 1500,
							maxRetryDelay: 15000,
							headers: {
								'Accept': 'application/json',
								'Content-Type': 'application/json'
							}
						}
					);
					
					if (!batchResponse.ok) {
						console.error(`❌ Failed to get latest batch: ${batchResponse.status} ${batchResponse.statusText}`);
						// Try to get error details
						try {
							const errorText = await batchResponse.text();
							console.error(`Error details: ${errorText}`);
						} catch (e) {
							console.error('Could not read error response');
						}
						
						// If it's a 500 error, it might be temporary - throw to trigger retry
						if (batchResponse.status >= 500) {
							throw new Error(`Server error (${batchResponse.status}): ${batchResponse.statusText}`);
						}
						
						throw new Error(`Failed to get latest batch: ${batchResponse.statusText}`);
					}
					
					const batch = await batchResponse.json();
					console.log(`✅ Successfully fetched latest batch: ${batch.id}`);
					batchId = batch.id;
					batchCreatedAt = batch.createdAt;
				} catch (fetchError) {
					console.error('❌ Network error fetching latest batch via proxy:', fetchError);
					
					// Check if this is a 500/502 error that should be handled gracefully
					if (fetchError instanceof Error && (
						fetchError.message.includes('500') || 
						fetchError.message.includes('502') || 
						fetchError.message.includes('503')
					)) {
						console.warn('⚠️ API server error detected, attempting graceful degradation...');
						// Don't try direct API for server errors, just propagate the error
						throw new Error('Service temporarily unavailable. Please try again in a few moments.');
					}
					
					// Try direct API access as fallback for other errors
					console.log('🔄 Attempting direct API access as fallback...');
					try {
						const directResponse = await fetchWithRetry(
							`${this.directApiUrl}/batches/latest?lang=${language}`,
							{
								timeout: 45000,
								retries: 3,
								retryDelay: 2000,
								headers: {
									'Accept': 'application/json',
									'Content-Type': 'application/json'
								}
							}
						);
						
						if (!directResponse.ok) {
							// Handle server errors gracefully
							if (directResponse.status >= 500) {
								throw new Error('Service temporarily unavailable. Please try again in a few moments.');
							}
							throw new Error(`Direct API failed: ${directResponse.status} ${directResponse.statusText}`);
						}
						
						const batch = await directResponse.json();
						console.log(`✅ Successfully fetched latest batch via direct API: ${batch.id}`);
						batchId = batch.id;
						batchCreatedAt = batch.createdAt;
					} catch (directError) {
						console.error('❌ Direct API access also failed:', directError);
						
						// Check if this is a network connectivity issue
						if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
							throw new Error('Network connection failed. Please check your internet connection.');
						}
						
						// For server errors, provide a user-friendly message
						if (directError instanceof Error && directError.message.includes('Service temporarily unavailable')) {
							throw directError;
						}
						
						// Re-throw the original proxy error
						throw fetchError;
					}
				}
			}

			// Step 2: Get categories for that batch with language parameter
			const response = await fetchWithRetry(
				`${this.baseUrl}/batches/${batchId}/categories?lang=${language}`,
				{
					timeout: 25000,
					retries: 4,
					retryDelay: 1000
				}
			);
			if (!response.ok) {
				throw new Error(`Failed to load categories: ${response.statusText}`);
			}
			const data = await response.json();

			// Create a mapping of categoryId to UUID
			const categoryMap: Record<string, string> = {};

			// Transform the response to match the expected Category interface
			const categories: Category[] = data.categories.map((cat: any) => {
				categoryMap[cat.categoryId] = cat.id; // Store the UUID mapping
				return {
					id: cat.categoryId,
					name: cat.categoryName,
				};
			});

			// Add OnThisDay as a special category if available
			if (data.hasOnThisDay) {
				categories.push({
					id: 'onthisday',
					name: 'On This Day',
				});
				// Note: OnThisDay doesn't need a UUID mapping as it uses a different endpoint
			}

			// Step 3: Load chaos index for this batch
			let chaosData = null;
			try {
				// Use regular fetch for chaos index to avoid retries on 404s
				const chaosResponse = await fetch(`${this.baseUrl}/batches/${batchId}/chaos?lang=${language}`);
				if (chaosResponse.ok) {
					chaosData = await chaosResponse.json();
				} else if (chaosResponse.status === 404) {
					console.log(`ℹ️ Chaos index not available for batch ${batchId}`);
					// This is expected for some batches, don't treat as error
				} else {
					console.warn(`Failed to load chaos index: ${chaosResponse.status} ${chaosResponse.statusText}`);
				}
			} catch (error) {
				console.warn('Failed to load chaos index:', error);
				// Continue without chaos index
			}

			const result =  {
				batchId,
				categories,
				categoryMap,
				timestamp: new Date(batchCreatedAt).getTime() / 1000,
				hasOnThisDay: data.hasOnThisDay || false,
				totalReadCount: providedBatchInfo?.totalReadCount ?? 0,
				chaosIndex: chaosData?.chaosIndex,
				chaosDescription: chaosData?.chaosDescription,
				chaosLastUpdated: chaosData?.chaosLastUpdated,
			};

			return result;
		} catch (error) {
			console.error("Error loading initial data:", error);
			throw error;
		}
	}
}

// Export singleton instance
export const batchService = new BatchService();