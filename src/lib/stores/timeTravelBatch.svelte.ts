/**
 * Store for tracking the current time travel batch ID
 */
class TimeTravelBatchStore {
	batchId = $state<string | null>(null);
	private lastValidated = $state<number>(0);
	
	set(id: string | null) {
		this.batchId = id;
		this.lastValidated = id ? Date.now() : 0;
		console.log(`⏰ Time travel batch ${id ? 'set to' : 'cleared'}: ${id}`);
		
		// Store in sessionStorage to persist across page reloads but clear on new session
		if (typeof window !== 'undefined') {
			if (id) {
				sessionStorage.setItem('kite-time-travel-batch', JSON.stringify({
					batchId: id,
					timestamp: this.lastValidated
				}));
			} else {
				sessionStorage.removeItem('kite-time-travel-batch');
			}
		}
	}
	
	get() {
		return this.batchId;
	}
	
	isTimeTravelMode() {
		return this.batchId !== null;
	}
	
	/**
	 * Check if the current time travel batch might be stale (older than 24 hours)
	 */
	isStale(): boolean {
		if (!this.batchId || !this.lastValidated) return false;
		
		const maxAge = 24 * 60 * 60 * 1000; // 24 hours
		return (Date.now() - this.lastValidated) > maxAge;
	}
	
	/**
	 * Initialize from sessionStorage on app start
	 */
	init() {
		if (typeof window === 'undefined') return;
		
		try {
			const stored = sessionStorage.getItem('kite-time-travel-batch');
			if (stored) {
				const { batchId, timestamp } = JSON.parse(stored);
				
				// Check if stored batch is too old (more than 24 hours)
				const maxAge = 24 * 60 * 60 * 1000;
				if (timestamp && (Date.now() - timestamp) < maxAge) {
					this.batchId = batchId;
					this.lastValidated = timestamp;
					console.log(`🕰️ Restored time travel batch from session: ${batchId}`);
				} else {
					console.log(`🗑️ Clearing stale time travel batch from session (${batchId})`);
					sessionStorage.removeItem('kite-time-travel-batch');
				}
			}
		} catch (error) {
			console.warn('Failed to restore time travel batch from session:', error);
			sessionStorage.removeItem('kite-time-travel-batch');
		}
	}
}

export const timeTravelBatch = new TimeTravelBatchStore();