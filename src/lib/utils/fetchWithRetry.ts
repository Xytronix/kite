interface FetchWithRetryOptions {
	timeout?: number;
	retries?: number;
	retryDelay?: number;
	maxRetryDelay?: number;
	retryOnStatus?: number[];
	backoffMultiplier?: number;
	onRetry?: (attempt: number, error: Error) => void;
}

interface FetchTimeoutOptions extends RequestInit {
	timeout?: number;
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(url: string, options: FetchTimeoutOptions = {}): Promise<Response> {
	// Persistent logging function
	const persistentLog = (message: string, data?: any) => {
		if (typeof window === 'undefined') return;
		
		const timestamp = new Date().toISOString();
		const logEntry = { timestamp, message: `[FETCH-TIMEOUT] ${message}`, data, url: window.location.href };
		
		try {
			const logs = JSON.parse(localStorage.getItem('kite-debug-logs') || '[]');
			logs.push(logEntry);
			if (logs.length > 50) logs.splice(0, logs.length - 50);
			localStorage.setItem('kite-debug-logs', JSON.stringify(logs));
		} catch (e) {
			console.warn('Failed to save persistent log:', e);
		}
		
		console.log(`[PERSISTENT FETCH-TIMEOUT] ${message}`, data || '');
	};

	const { timeout = 30000, ...fetchOptions } = options;
	
	persistentLog('🔧 Starting fetchWithTimeout', { 
		url: url.replace(/\/api\/batches\/[^\/]+/, '/api/batches/[ID]'),
		timeout 
	});
	
	persistentLog('🔧 Creating AbortController');
	const controller = new AbortController();
	
	persistentLog('🔧 Setting timeout');
	const timeoutId = setTimeout(() => {
		persistentLog('⏰ Timeout triggered - aborting request');
		controller.abort();
	}, timeout);
	
	try {
		persistentLog('🔧 About to call fetch()', { 
			url: url.substring(0, 100) + (url.length > 100 ? '...' : ''),
			method: fetchOptions.method || 'GET',
			hasSignal: !!controller.signal
		});
		
		// Wrap fetch in additional try-catch to catch ANY issues
		let response: Response;
		try {
			persistentLog('🔧 Calling fetch() NOW');
			const fetchStartTime = performance.now();
			
			// Use regular fetch
			let fetchPromise = fetch(url, {
				...fetchOptions,
				signal: controller.signal
			});
			
			fetchPromise = fetchPromise.then(response => {
				const fetchEndTime = performance.now();
				persistentLog('⏱️ Request completed', {
					method: 'fetch',
					duration: Math.round(fetchEndTime - fetchStartTime) + 'ms',
					status: response.status
				});
				return response;
			}).catch(error => {
				const fetchEndTime = performance.now();
				persistentLog('⏱️ Request failed', {
					method: 'fetch',
					duration: Math.round(fetchEndTime - fetchStartTime) + 'ms',
					error: error.message
				});
				throw error;
			});
			
			// Enhanced navigation detection with multiple event types
			const navigationDetector = new Promise<never>((_, reject) => {
				let detectorCleanedUp = false;
				
				const cleanup = () => {
					if (detectorCleanedUp) return;
					detectorCleanedUp = true;
					window.removeEventListener('beforeunload', handleBeforeUnload);
					window.removeEventListener('unload', handleUnload);
					window.removeEventListener('pagehide', handlePageHide);
				};
				
				const handleBeforeUnload = (e: BeforeUnloadEvent) => {
					persistentLog('🚨 BEFOREUNLOAD detected during fetch - navigation triggered!', {
						type: 'beforeunload',
						returnValue: e.returnValue
					});
					cleanup();
					reject(new Error('Navigation triggered during fetch - beforeunload'));
				};
				
				const handleUnload = (e: Event) => {
					persistentLog('🚨 UNLOAD detected during fetch - navigation triggered!', {
						type: 'unload'
					});
					cleanup();
					reject(new Error('Navigation triggered during fetch - unload'));
				};
				
				const handlePageHide = (e: PageTransitionEvent) => {
					persistentLog('🚨 PAGEHIDE detected during fetch - navigation triggered!', {
						type: 'pagehide',
						persisted: e.persisted
					});
					cleanup();
					reject(new Error('Navigation triggered during fetch - pagehide'));
				};
				
				// Listen to multiple navigation events
				window.addEventListener('beforeunload', handleBeforeUnload, { once: true });
				window.addEventListener('unload', handleUnload, { once: true });
				window.addEventListener('pagehide', handlePageHide, { once: true });
				
				// Clean up listeners after timeout if no navigation
				setTimeout(cleanup, 2000);
			});
			
			response = await Promise.race([fetchPromise, navigationDetector]);
			
			persistentLog('🔧 fetch() returned response object', { 
				responseExists: !!response,
				responseType: typeof response
			});
		} catch (fetchError) {
			persistentLog('💥 fetch() itself threw error', { 
				errorType: fetchError?.constructor?.name,
				errorMessage: fetchError instanceof Error ? fetchError.message : String(fetchError),
				errorName: fetchError instanceof Error ? fetchError.name : undefined
			});
			throw fetchError;
		}
		
		persistentLog('🔧 About to check response status', {
			status: response.status,
			statusText: response.statusText,
			ok: response.ok,
			type: response.type,
			redirected: response.redirected,
			url: response.url
		});
		
		// Check for redirects that might cause navigation
		if (response.redirected) {
			persistentLog('🚨 Response was redirected!', {
				originalUrl: url,
				finalUrl: response.url,
				status: response.status
			});
		}
		
		// Check for specific status codes that might cause issues
		if ([301, 302, 307, 308].includes(response.status)) {
			persistentLog('🚨 Redirect status code detected!', {
				status: response.status,
				statusText: response.statusText,
				location: response.headers.get('location')
			});
		}
		
		persistentLog('✅ fetch() completed successfully', { 
			status: response.status,
			ok: response.ok,
			statusText: response.statusText
		});
		clearTimeout(timeoutId);
		return response;
	} catch (error) {
		persistentLog('💥 fetch() threw error', {
			errorType: error?.constructor?.name,
			errorMessage: error instanceof Error ? error.message : String(error),
			errorName: error instanceof Error ? error.name : undefined
		});
		clearTimeout(timeoutId);
		if (error instanceof Error && error.name === 'AbortError') {
			persistentLog('⏰ Converting AbortError to timeout error');
			throw new Error(`Request timeout after ${timeout}ms`);
		}
		persistentLog('🚨 Rethrowing original error');
		throw error;
	}
}

/**
 * Check if an error should trigger a retry
 */
function shouldRetry(error: Error, status?: number, retryOnStatus: number[] = [500, 502, 503, 504]): boolean {
	// Network errors
	if (error instanceof TypeError && error.message.includes('fetch')) {
		return true;
	}
	
	// Timeout errors
	if (error.message.includes('timeout') || error.message.includes('aborted')) {
		return true;
	}
	
	// Server errors
	if (error.message.includes('Internal Server Error') || 
		error.message.includes('Server error') ||
		error.message.includes('Network connection failed') ||
		error.message.includes('Failed to get latest batch')) {
		return true;
	}
	
	// HTTP status codes that indicate temporary issues
	if (status && retryOnStatus.includes(status)) {
		return true;
	}
	
	return false;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with automatic retry logic and exponential backoff
 */
export async function fetchWithRetry(
	url: string, 
	options: FetchWithRetryOptions & RequestInit = {}
): Promise<Response> {
	// Persistent logging function
	const persistentLog = (message: string, data?: any) => {
		if (typeof window === 'undefined') return;
		
		const timestamp = new Date().toISOString();
		const logEntry = { timestamp, message: `[FETCH] ${message}`, data, url: window.location.href };
		
		try {
			const logs = JSON.parse(localStorage.getItem('kite-debug-logs') || '[]');
			logs.push(logEntry);
			if (logs.length > 50) logs.splice(0, logs.length - 50);
			localStorage.setItem('kite-debug-logs', JSON.stringify(logs));
		} catch (e) {
			console.warn('Failed to save persistent log:', e);
		}
		
		console.log(`[PERSISTENT FETCH] ${message}`, data || '');
	};
	
	const {
		timeout = 30000,
		retries = 5,
		retryDelay = 1000,
		maxRetryDelay = 15000,
		retryOnStatus = [500, 502, 503, 504],
		backoffMultiplier = 1.5,
		onRetry,
		...fetchOptions
	} = options;
	
	persistentLog('🚀 fetchWithRetry called', { 
		url: url.replace(/\/api\/batches\/[^\/]+/, '/api/batches/[ID]'), // Sanitize URL for logging
		timeout,
		retries 
	});

	let lastError: Error;
	
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			persistentLog(`🔄 Fetch attempt ${attempt + 1}/${retries + 1}`, { 
				attempt: attempt + 1,
				adjustedTimeout: timeout + (attempt * 5000)
			});
			
			const response = await fetchWithTimeout(url, { 
				...fetchOptions, 
				timeout: timeout + (attempt * 5000) // Increase timeout on retries
			});
			
			persistentLog('📡 Fetch response received', {
				status: response.status,
				ok: response.ok,
				statusText: response.statusText,
				attempt: attempt + 1
			});
			
			// Check if response status should trigger a retry
			if (!response.ok && retryOnStatus.includes(response.status) && attempt < retries) {
				persistentLog('🔄 Response not ok - will retry', {
					status: response.status,
					statusText: response.statusText,
					willRetry: true,
					attempt: attempt + 1
				});
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			
			persistentLog('✅ Fetch successful', { 
				status: response.status,
				attempt: attempt + 1 
			});
			return response;
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			lastError = err;
			
			persistentLog('💥 Fetch attempt failed', {
				attempt: attempt + 1,
				errorType: err.constructor.name,
				errorMessage: err.message,
				isLastAttempt: attempt === retries
			});
			
			// Don't retry on the last attempt
			if (attempt === retries) {
				persistentLog('🛑 Last attempt failed - will not retry');
				break;
			}
			
			// Check if we should retry this error
			const status = err.message.match(/HTTP (\d+):/)?.[1];
			const statusCode = status ? parseInt(status) : undefined;
			
			if (!shouldRetry(err, statusCode, retryOnStatus)) {
				persistentLog('🚫 Error not retryable - throwing immediately', {
					errorMessage: err.message,
					statusCode
				});
				throw err;
			}
			
			// Calculate delay with exponential backoff and jitter
			const baseDelay = Math.min(retryDelay * Math.pow(backoffMultiplier, attempt), maxRetryDelay);
			const jitter = Math.random() * 0.3 * baseDelay; // Add up to 30% jitter
			const delay = baseDelay + jitter;
			
			persistentLog('⏱️ Will retry after delay', {
				attempt: attempt + 1,
				delayMs: Math.round(delay),
				baseDelay,
				jitter
			});
			
			console.warn(`🔄 Fetch attempt ${attempt + 1}/${retries + 1} failed: ${err.message}. Retrying in ${Math.round(delay)}ms...`);
			
			if (onRetry) {
				onRetry(attempt + 1, err);
			}
			
			await sleep(delay);
			
			persistentLog('⏰ Retry delay completed', { attempt: attempt + 1 });
		}
	}
	
	persistentLog('💀 All retries failed - throwing final error', {
		totalAttempts: retries + 1,
		finalError: lastError?.message
	});
	throw lastError;
}

/**
 * Test connection quality by measuring response time
 */
export async function testConnectionQuality(): Promise<{ 
	responseTime: number;
	quality: 'excellent' | 'good' | 'fair' | 'poor';
	recommendedTimeout: number;
}> {
	const startTime = performance.now();
	
	try {
		// Use a lightweight endpoint to test connection
		await fetchWithTimeout('/api/time', { timeout: 10000 });
		const responseTime = performance.now() - startTime;
		
		let quality: 'excellent' | 'good' | 'fair' | 'poor';
		let recommendedTimeout: number;
		
		if (responseTime < 500) {
			quality = 'excellent';
			recommendedTimeout = 15000;
		} else if (responseTime < 1500) {
			quality = 'good';
			recommendedTimeout = 25000;
		} else if (responseTime < 3000) {
			quality = 'fair';
			recommendedTimeout = 40000;
		} else {
			quality = 'poor';
			recommendedTimeout = 60000;
		}
		
		return { responseTime, quality, recommendedTimeout };
	} catch (error) {
		// If test fails, assume poor connection
		return { 
			responseTime: 10000, 
			quality: 'poor', 
			recommendedTimeout: 60000 
		};
	}
} 