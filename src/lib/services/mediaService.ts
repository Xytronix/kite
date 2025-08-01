import type { MediaInfo, LoadMediaDataResponse } from '$lib/types';

/**
 * Service for media/source information
 */
class MediaService {
	private baseUrl = '/api';
	
	// Cache for full media data
	private mediaDataCache: MediaInfo[] | null = null;
	private mediaDataPromise: Promise<MediaInfo[]> | null = null;
	
	// Cache for individual host lookups
	private hostCache = new Map<string, MediaInfo | null>();
	private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
	private cacheTimestamp = 0;

	/**
	 * Load media data for source information (cached)
	 */
	async loadMediaData(language: string = "en"): Promise<MediaInfo[]> {
		// Check cache validity
		const now = Date.now();
		if (this.mediaDataCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
			return this.mediaDataCache;
		}
		
		// Return existing promise if already loading
		if (this.mediaDataPromise) {
			return this.mediaDataPromise;
		}
		
		// Load fresh data
		this.mediaDataPromise = this._fetchMediaData(language);
		return this.mediaDataPromise;
	}
	
	/**
	 * Internal method to fetch media data
	 */
	private async _fetchMediaData(language: string): Promise<MediaInfo[]> {
		try {
			const response = await fetch(`${this.baseUrl}/media?lang=${language}`);
			if (!response.ok) {
				throw new Error(`Failed to load media data: ${response.statusText}`);
			}
			const data: LoadMediaDataResponse = await response.json();
			
			// Update cache
			this.mediaDataCache = data.mediaData;
			this.cacheTimestamp = Date.now();
			this.mediaDataPromise = null;
			
			// Clear host cache when full data is refreshed
			this.hostCache.clear();
			
			return data.mediaData;
		} catch (error) {
			console.error("Error loading media data:", error);
			this.mediaDataPromise = null;
			throw error;
		}
	}

	/**
	 * Get media info for a specific domain
	 */
	async getMediaInfoForDomain(
		domain: string,
		language: string = "en",
	): Promise<MediaInfo | null> {
		try {
			const mediaData = await this.loadMediaData(language);
			return mediaData.find((info) => info.domains.includes(domain)) || null;
		} catch (error) {
			console.error("Error getting media info for domain:", error);
			return null;
		}
	}

	/**
	 * Load media data for a specific host (cached with fallback to API)
	 */
	async loadMediaDataForHost(
		host: string,
		language: string = "en",
	): Promise<MediaInfo | null> {
		// Check host cache first
		const cacheKey = `${host}:${language}`;
		if (this.hostCache.has(cacheKey)) {
			return this.hostCache.get(cacheKey)!;
		}
		
		try {
			// First try to find in full cached media data (fastest)
			if (this.mediaDataCache && (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION) {
				const found = this.mediaDataCache.find((info) => 
					info.domains.some(domain => domain === host || domain.endsWith(`.${host}`) || host.endsWith(`.${domain}`))
				);
				this.hostCache.set(cacheKey, found || null);
				if (found) {
					console.log('⚡ Media data cache hit for:', host);
				}
				return found || null;
			}
			
			// If no cache, try to load full data first (better for multiple lookups)
			try {
				const allData = await this.loadMediaData(language);
				const found = allData.find((info) => 
					info.domains.some(domain => domain === host || domain.endsWith(`.${host}`) || host.endsWith(`.${domain}`))
				);
				this.hostCache.set(cacheKey, found || null);
				if (found) {
					console.log('✅ Media data found in full cache for:', host);
				}
				return found || null;
			} catch (cacheError) {
				console.warn('Failed to load from cache, falling back to API:', cacheError);
			}
			
			// Final fallback: use the host-specific API endpoint
			const response = await fetch(
				`${this.baseUrl}/media/${host}?lang=${language}`,
			);
			if (!response.ok) {
				if (response.status === 404) {
					this.hostCache.set(cacheKey, null);
					return null; // No media info found for this host
				}
				throw new Error(
					`Failed to load media data for host: ${response.statusText}`,
				);
			}
			const data = await response.json();
			this.hostCache.set(cacheKey, data.mediaInfo);
			console.log('🌐 Media data loaded from API for:', host);
			return data.mediaInfo;
		} catch (error) {
			console.error("Error loading media data for host:", error);
			this.hostCache.set(cacheKey, null);
			return null;
		}
	}
	
	/**
	 * Preload media data to improve performance
	 * Call this during splash screen to cache all media data
	 */
	async preloadMediaData(language: string = "en"): Promise<void> {
		try {
			console.log('🚀 Preloading media data...');
			await this.loadMediaData(language);
			console.log('✅ Media data preloaded successfully');
		} catch (error) {
			console.warn('Failed to preload media data:', error);
		}
	}
}

// Export singleton instance
export const mediaService = new MediaService();