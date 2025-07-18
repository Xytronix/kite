// Advanced topic extraction using TF-IDF and other algorithms
export interface TopicCandidate {
	term: string;
	score: number;
	frequency: number;
	type: 'entity' | 'concept' | 'location' | 'organization' | 'event';
	confidence: number;
}

export class TopicExtractor {
	private stopWords = new Set([
		// Minimal essential stop words only
		'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
		'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'will', 'would', 'could',
		'this', 'that', 'these', 'those', 'said', 'says', 'new', 'news', 'report', 'today'
	]);

	/**
	 * Extract topics using TF-IDF algorithm
	 */
	extractTopicsWithTFIDF(documents: string[], maxTopics = 20): TopicCandidate[] {
		const termFreq = new Map<string, Map<number, number>>();
		const docFreq = new Map<string, number>();
		const totalDocs = documents.length;

		// Calculate term frequencies and document frequencies
		documents.forEach((doc, docIndex) => {
			const terms = this.tokenize(doc);
			const uniqueTerms = new Set(terms);

			terms.forEach(term => {
				if (!termFreq.has(term)) {
					termFreq.set(term, new Map());
				}
				const docTermFreq = termFreq.get(term)!;
				docTermFreq.set(docIndex, (docTermFreq.get(docIndex) || 0) + 1);
			});

			uniqueTerms.forEach(term => {
				docFreq.set(term, (docFreq.get(term) || 0) + 1);
			});
		});

		// Calculate TF-IDF scores
		const tfidfScores = new Map<string, number>();
		
		termFreq.forEach((docFreqs, term) => {
			let totalTFIDF = 0;
			const df = docFreq.get(term) || 1;
			const idf = Math.log(totalDocs / df);

			docFreqs.forEach((tf, docIndex) => {
				const tfidf = tf * idf;
				totalTFIDF += tfidf;
			});

			tfidfScores.set(term, totalTFIDF);
		});

		// Convert to candidates and sort
		const candidates: TopicCandidate[] = [];
		tfidfScores.forEach((score, term) => {
			const frequency = Array.from(termFreq.get(term)!.values()).reduce((a, b) => a + b, 0);
			
			candidates.push({
				term: this.capitalizeWords(term),
				score,
				frequency,
				type: this.classifyTerm(term),
				confidence: this.calculateConfidence(term, frequency, totalDocs)
			});
		});

		return candidates
			.sort((a, b) => b.score - a.score)
			.slice(0, maxTopics);
	}

	/**
	 * Extract topics using Named Entity Recognition patterns
	 */
	extractNamedEntities(text: string): TopicCandidate[] {
		const entities: TopicCandidate[] = [];
		
		// Proper nouns (capitalized words/phrases)
		const properNounRegex = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
		const matches = text.match(properNounRegex) || [];
		
		const entityCounts = new Map<string, number>();
		matches.forEach(match => {
			if (match.length > 2 && !this.stopWords.has(match.toLowerCase())) {
				entityCounts.set(match, (entityCounts.get(match) || 0) + 1);
			}
		});

		entityCounts.forEach((count, entity) => {
			entities.push({
				term: entity,
				score: count * 2, // Higher weight for named entities
				frequency: count,
				type: this.classifyNamedEntity(entity),
				confidence: Math.min(count / 10, 1) // Confidence based on frequency
			});
		});

		return entities.sort((a, b) => b.score - a.score);
	}

	/**
	 * Extract trending topics using burst detection
	 */
	detectBurstingTopics(timeSeriesData: Array<{text: string, timestamp: Date}>): TopicCandidate[] {
		const timeWindows = this.createTimeWindows(timeSeriesData, 24); // 24-hour windows
		const termTrends = new Map<string, number[]>();

		// Count terms in each time window
		timeWindows.forEach((window, index) => {
			const windowTerms = new Map<string, number>();
			
			window.forEach(item => {
				const terms = this.tokenize(item.text);
				terms.forEach(term => {
					windowTerms.set(term, (windowTerms.get(term) || 0) + 1);
				});
			});

			windowTerms.forEach((count, term) => {
				if (!termTrends.has(term)) {
					termTrends.set(term, new Array(timeWindows.length).fill(0));
				}
				termTrends.get(term)![index] = count;
			});
		});

		// Calculate burst scores
		const burstingTopics: TopicCandidate[] = [];
		termTrends.forEach((counts, term) => {
			const burstScore = this.calculateBurstScore(counts);
			const totalFreq = counts.reduce((a, b) => a + b, 0);
			
			if (burstScore > 1.5 && totalFreq > 3) { // Threshold for significance
				burstingTopics.push({
					term: this.capitalizeWords(term),
					score: burstScore,
					frequency: totalFreq,
					type: this.classifyTerm(term),
					confidence: Math.min(burstScore / 5, 1)
				});
			}
		});

		return burstingTopics.sort((a, b) => b.score - a.score);
	}

	/**
	 * Combine multiple extraction methods for best results
	 */
	extractTopics(documents: string[], timeSeriesData?: Array<{text: string, timestamp: Date}>): TopicCandidate[] {
		const tfidfTopics = this.extractTopicsWithTFIDF(documents, 15);
		const entityTopics = this.extractNamedEntities(documents.join(' '));
		const burstingTopics = timeSeriesData ? this.detectBurstingTopics(timeSeriesData) : [];

		// Merge and deduplicate
		const allTopics = new Map<string, TopicCandidate>();
		
		[...tfidfTopics, ...entityTopics, ...burstingTopics].forEach(topic => {
			const key = topic.term.toLowerCase();
			if (allTopics.has(key)) {
				const existing = allTopics.get(key)!;
				// Combine scores with weighted average
				existing.score = (existing.score + topic.score) / 2;
				existing.frequency = Math.max(existing.frequency, topic.frequency);
				existing.confidence = Math.max(existing.confidence, topic.confidence);
			} else {
				allTopics.set(key, topic);
			}
		});

		return Array.from(allTopics.values())
			.filter(topic => topic.confidence > 0.3) // Filter low-confidence topics
			.sort((a, b) => b.score - a.score)
			.slice(0, 20);
	}

	private tokenize(text: string): string[] {
		return text.toLowerCase()
			.replace(/[^\w\s]/g, ' ')
			.split(/\s+/)
			.filter(word => 
				word.length > 2 && 
				!this.stopWords.has(word) &&
				!/^\d+$/.test(word)
			);
	}

	private classifyTerm(term: string): TopicCandidate['type'] {
		const lower = term.toLowerCase();
		
		// Location indicators
		if (/\b(city|country|state|province|region|county|district)\b/.test(lower) ||
			/\b(north|south|east|west|central)\b.*\b(africa|asia|europe|america)\b/.test(lower)) {
			return 'location';
		}
		
		// Organization indicators
		if (/\b(company|corp|inc|ltd|organization|agency|department|ministry)\b/.test(lower)) {
			return 'organization';
		}
		
		// Event indicators
		if (/\b(summit|conference|meeting|election|vote|trial|hearing|ceremony)\b/.test(lower)) {
			return 'event';
		}
		
		return 'concept';
	}

	private classifyNamedEntity(entity: string): TopicCandidate['type'] {
		// Geographic patterns
		if (/^(North|South|East|West|Central)\s/.test(entity) ||
			/\b(City|County|State|Province|Region)$/.test(entity)) {
			return 'location';
		}
		
		// Organization patterns
		if (/\b(Corp|Inc|Ltd|LLC|Company|Organization|Agency|Department|Ministry)\b/.test(entity)) {
			return 'organization';
		}
		
		// Assume proper nouns are entities by default
		return 'entity';
	}

	private calculateConfidence(term: string, frequency: number, totalDocs: number): number {
		const lengthScore = Math.min(term.length / 10, 1);
		const frequencyScore = Math.min(frequency / totalDocs, 1);
		const meaningScore = this.stopWords.has(term.toLowerCase()) ? 0 : 1;
		
		return (lengthScore + frequencyScore + meaningScore) / 3;
	}

	private createTimeWindows(data: Array<{text: string, timestamp: Date}>, windowHours: number) {
		const windows: Array<Array<{text: string, timestamp: Date}>> = [];
		const sortedData = data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
		
		if (sortedData.length === 0) return windows;
		
		const windowMs = windowHours * 60 * 60 * 1000;
		let currentWindow: Array<{text: string, timestamp: Date}> = [];
		let windowStart = sortedData[0].timestamp.getTime();
		
		sortedData.forEach(item => {
			if (item.timestamp.getTime() - windowStart > windowMs) {
				if (currentWindow.length > 0) {
					windows.push(currentWindow);
				}
				currentWindow = [item];
				windowStart = item.timestamp.getTime();
			} else {
				currentWindow.push(item);
			}
		});
		
		if (currentWindow.length > 0) {
			windows.push(currentWindow);
		}
		
		return windows;
	}

	private calculateBurstScore(counts: number[]): number {
		if (counts.length < 2) return 0;
		
		const recent = counts.slice(-3); // Last 3 time periods
		const historical = counts.slice(0, -3);
		
		const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
		const historicalAvg = historical.length > 0 ? 
			historical.reduce((a, b) => a + b, 0) / historical.length : 0;
		
		return historicalAvg > 0 ? recentAvg / historicalAvg : recentAvg;
	}

	private capitalizeWords(text: string): string {
		return text.split(' ')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}
}