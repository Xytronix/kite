import { batchService } from './batchService';
import { storiesService } from './storiesService';
import { chaosIndexService } from './chaosIndexService';
import { mediaService } from './mediaService';
import { onThisDayService } from './onThisDayService';
import { topicService } from './topicService';

// Global reload event handlers
let reloadCallbacks: (() => Promise<void>)[] = [];

export const dataReloadService = {
	// Register a callback to be called on reload
	onReload(callback: () => Promise<void>) {
		reloadCallbacks.push(callback);
		console.log("🔧 Reload callback registered");
	},

	// Trigger all reload callbacks
	async reloadData() {
		console.log("🔄 Reloading data...");
		// Call all registered callbacks
		await Promise.all(reloadCallbacks.map(cb => cb()));
	},
};

/**
 * Main data service facade
 * Delegates to specialized services for different domains
 */
class DataService {
	/**
	 * Batch & Time Travel functionality
	 */
	setTimeTravelBatch(batchId: string | null) {
		return batchService.setTimeTravelBatch(batchId);
	}

	isTimeTravelMode(): boolean {
		return batchService.isTimeTravelMode();
	}

	async loadInitialData(language: string = "en", providedBatchInfo?: { id: string; createdAt: string }) {
		return batchService.loadInitialData(language, providedBatchInfo);
	}

	/**
	 * Stories functionality
	 */
	async loadStories(
		batchId: string,
		categoryUuid: string,
		limit: number = 12,
		language: string = "en",
	) {
		return storiesService.loadStories(batchId, categoryUuid, limit, language);
	}

	/**
	 * OnThisDay functionality
	 */
	async loadOnThisDayEvents(language: string = "en") {
		return onThisDayService.loadOnThisDayEvents(language);
	}

	/**
	 * Media/Source functionality
	 */
	async loadMediaData(language: string = "en") {
		return mediaService.loadMediaData(language);
	}

	async getMediaInfoForDomain(domain: string, language: string = "en") {
		return mediaService.getMediaInfoForDomain(domain, language);
	}

	async loadMediaDataForHost(host: string, language: string = "en") {
		return mediaService.loadMediaDataForHost(host, language);
	}

	/**
	 * Chaos Index functionality
	 */
	async loadChaosIndex(language: string = "en") {
		return chaosIndexService.loadChaosIndex(language);
	}

	async getChaosIndexHistory(language: string = "en", days: number = 30) {
		return chaosIndexService.getChaosIndexHistory(language, days);
	}

	/**
	 * Topic functionality
	 */
	async getTopics(language: string = "en") {
		return topicService.getTopics(language);
	}

	async getTopicFeed(topicId: string, limit: number = 50, language: string = "en") {
		return topicService.getTopicFeed(topicId, limit, language);
	}

	async searchTopics(query: string, language: string = "en") {
		return topicService.searchTopics(query, language);
	}

	async getTrendingTopics(limit: number = 10, language: string = "en") {
		return topicService.getTrendingTopics(limit, language);
	}
}

// Export singleton instance
export const dataService = new DataService();