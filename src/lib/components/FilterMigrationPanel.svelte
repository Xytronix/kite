<script lang="ts">
	let currentStep = 1;
	let isAnimating = false;
	let showComparison = false;
	
	interface Step {
		title: string;
		description: string;
		details: string[];
		color: 'red' | 'blue' | 'purple' | 'green';
	}

	const migrationSteps: Step[] = [
		{
			title: "Current State: Keyword-Based Filtering",
			description: "Your current system relies on extensive keyword lists",
			details: [
				"1600+ lines of keyword definitions",
				"High maintenance overhead",
				"Frequent false positives",
				"Blocks legitimate news content",
				"Manual updates required for new topics"
			],
			color: "red"
		},
		{
			title: "Analysis: Smart Algorithm Benefits",
			description: "See how algorithmic filtering improves your content quality",
			details: [
				"Context-aware content analysis",
				"Quality and credibility scoring",
				"Automatic topic detection",
				"Sentiment and bias analysis",
				"Self-learning and adaptation"
			],
			color: "blue"
		},
		{
			title: "Migration: Gradual Implementation",
			description: "Seamless transition with parallel testing",
			details: [
				"A/B testing with current system",
				"Gradual rollout by content category",
				"Real-time performance monitoring",
				"Fallback to keywords if needed",
				"Training period with your content"
			],
			color: "purple"
		},
		{
			title: "Result: Intelligent Content Filtering",
			description: "Achieve better filtering with less maintenance",
			details: [
				"90% reduction in false positives",
				"80% less manual keyword maintenance",
				"Real-time topic trend detection",
				"Improved content quality scores",
				"Automated filter optimization"
			],
			color: "green"
		}
	];
	
	function nextStep() {
		if (currentStep < migrationSteps.length) {
			isAnimating = true;
			setTimeout(() => {
				currentStep++;
				isAnimating = false;
			}, 300);
		}
	}
	
	function prevStep() {
		if (currentStep > 1) {
			isAnimating = true;
			setTimeout(() => {
				currentStep--;
				isAnimating = false;
			}, 300);
		}
	}
	
	function toggleComparison() {
		showComparison = !showComparison;
	}
	
	function getStepColor(step: Step) {
		const colors = {
			red: "from-red-500 to-red-600",
			blue: "from-blue-500 to-blue-600",
			purple: "from-purple-500 to-purple-600",
			green: "from-green-500 to-green-600"
		};
		return colors[step.color as keyof typeof colors];
	}
	
	function getStepBorderColor(step: Step) {
		const colors = {
			red: "border-red-200 dark:border-red-800",
			blue: "border-blue-200 dark:border-blue-800",
			purple: "border-purple-200 dark:border-purple-800",
			green: "border-green-200 dark:border-green-800"
		};
		return colors[step.color as keyof typeof colors];
	}
</script>

<div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
	<!-- Header -->
	<div class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
		<h3 class="text-xl font-bold mb-2 flex items-center gap-3">
			🔄 Filter Migration Path
			<span class="px-3 py-1 bg-white/20 text-sm font-medium rounded-full">
				Interactive Demo
			</span>
		</h3>
		<p class="text-indigo-100">
			Discover how to transition from keyword-based filtering to intelligent algorithms
		</p>
	</div>
	
	<!-- Progress Bar -->
	<div class="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
		<div class="flex items-center justify-between mb-2">
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Migration Progress</span>
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">{currentStep} of {migrationSteps.length}</span>
		</div>
		<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
			<div 
				class="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-500 ease-out"
				style="width: {(currentStep / migrationSteps.length) * 100}%"
			></div>
		</div>
	</div>
	
	<!-- Main Content -->
	<div class="p-6">
		<div class="min-h-[300px]">
			{#each migrationSteps as step, index}
				{#if index + 1 === currentStep}
					<div 
						class="transition-all duration-300 {isAnimating ? 'opacity-0 transform translate-y-4' : 'opacity-100 transform translate-y-0'}"
					>
						<!-- Step Header -->
						<div class="mb-6">
							<div class="inline-flex items-center gap-3 mb-3">
								<div class="w-8 h-8 bg-gradient-to-r {getStepColor(step)} rounded-full flex items-center justify-center text-white font-bold text-sm">
									{index + 1}
								</div>
								<h4 class="text-lg font-semibold text-gray-900 dark:text-white">
									{step.title}
								</h4>
							</div>
							<p class="text-gray-600 dark:text-gray-400 ml-11">
								{step.description}
							</p>
						</div>
						
						<!-- Step Content -->
						<div class="ml-11 space-y-4">
							<div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border {getStepBorderColor(step)}">
								<ul class="space-y-2">
									{#each step.details as detail}
										<li class="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
											<div class="w-1.5 h-1.5 bg-gradient-to-r {getStepColor(step)} rounded-full mt-2 flex-shrink-0"></div>
											{detail}
										</li>
									{/each}
								</ul>
							</div>
							
							{#if index === 0}
								<!-- Show keyword complexity visualization for first step -->
								<div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
									<div class="text-xs text-red-800 dark:text-red-200 font-mono leading-relaxed">
										keywords_politics = ["trump", "biden", "election", "vote", "campaign", "democrat", "republican", "congress", "senate", "house", "political", "policy", "government", "administration", "politician", "electoral", "ballot", "candidate", "nomination", "primary", "caucus", "debate", "rally", "speech", "interview", "poll", "survey", "approval", "rating", "scandal", "controversy", "investigation", "impeachment", "resignation", "appointment", "confirmation", "legislation", "bill", "law", "regulation", "executive", "judicial", "legislative", "federal", "state", "local", "mayor", "governor", "senator", "representative", "justice", "court", "supreme", "district", "appeals", "ruling", "decision", "verdict", "case", "lawsuit", "litigation", "settlement", "fine", "penalty", "sanction", "embargo", "tariff", "trade", "economic", "fiscal", "monetary", "budget", "spending", "deficit", "surplus", "debt", "taxation", "revenue", "inflation", "recession", "recovery", "stimulus", "bailout", "subsidy", "grant", "funding", "appropriation", "allocation", "investment", "infrastructure", "healthcare", "education", "welfare", "social", "security", "medicare", "medicaid", "immigration", "border", "visa", "citizenship", "deportation", "refugee", "asylum", "sanctuary", "wall", "fence", "barrier", "patrol", "enforcement", "detention", "camp", "facility", "center", "processing", "screening", "background", "check", "verification", "documentation", "paperwork", "application", "petition", "appeal", "hearing", "testimony", "witness", "evidence", "proof", "record", "database", "system", "technology", "digital", "cyber", "security", "privacy", "surveillance", "monitoring", "tracking", "data", "information", "intelligence", "analysis", "report", "briefing", "meeting", "conference", "summit", "negotiation", "agreement", "treaty", "accord", "pact", "alliance", "partnership", "cooperation", "collaboration", "coordination", "communication", "dialogue", "discussion", "conversation", "talk", "statement", "announcement", "declaration", "proclamation", "order", "directive", "mandate", "requirement", "obligation", "responsibility", "duty", "accountability", "transparency", "oversight", "review", "audit", "evaluation", "assessment", "examination", "inspection", "investigation", "inquiry", "probe", "study", "research", "analysis", "survey", "poll", "census", "count", "tally", "vote", "ballot", "election", "primary", "general", "special", "recall", "referendum", "initiative", "proposition", "measure", "amendment", "constitution", "charter", "ordinance", "statute", "code", "rule", "regulation", "policy", "procedure", "protocol", "guideline", "standard", "criterion", "benchmark", "metric", "indicator", "measure", "gauge", "scale", "index", "rating", "score", "rank", "position", "status", "level", "grade", "class", "category", "type", "kind", "sort", "variety", "version", "edition", "revision", "update", "change", "modification", "alteration", "adjustment", "adaptation", "transformation", "conversion", "transition", "shift", "move", "transfer", "relocation", "displacement", "migration", "movement", "flow", "stream", "current", "trend", "pattern", "cycle", "phase", "stage", "step", "process", "procedure", "method", "approach", "strategy", "tactic", "technique", "tool", "instrument", "device", "mechanism", "system", "structure", "framework", "model", "design", "plan", "scheme", "program", "project", "initiative", "campaign", "effort", "endeavor", "undertaking", "venture", "enterprise", "operation", "activity", "action", "task", "job", "work", "labor", "service", "function", "role", "position", "office", "post", "appointment", "assignment", "responsibility", "duty", "obligation", "commitment", "promise", "pledge", "vow", "oath", "covenant", "contract", "agreement", "deal", "arrangement", "understanding", "accord", "settlement", "resolution", "solution", "answer", "response", "reply", "reaction", "feedback", "input", "output", "result", "outcome", "consequence", "effect", "impact", "influence", "power", "authority", "control", "command", "leadership", "management", "administration", "governance", "rule", "reign", "dominion", "sovereignty", "independence", "freedom", "liberty", "rights", "privileges", "benefits", "advantages", "opportunities", "chances", "possibilities", "options", "alternatives", "choices", "decisions", "judgments", "opinions", "views", "perspectives", "positions", "stances", "attitudes", "beliefs", "values", "principles", "ideals", "goals", "objectives", "aims", "purposes", "intentions", "plans", "strategies", "tactics", "methods", "approaches", "ways", "means", "resources", "assets", "capital", "funds", "money", "finance", "budget", "cost", "expense", "price", "fee", "charge", "rate", "amount", "sum", "total", "number", "quantity", "volume", "size", "scale", "scope", "extent", "range", "span", "duration", "period", "time", "date", "year", "month", "week", "day", "hour", "minute", "second", "moment", "instant", "occurrence", "event", "incident", "episode", "situation", "circumstance", "condition", "state", "status", "position", "location", "place", "site", "venue", "facility", "building", "structure", "office", "headquarters", "center", "hub", "base", "station", "post", "point", "spot", "area", "region", "zone", "district", "sector", "division", "department", "unit", "group", "team", "crew", "staff", "personnel", "workforce", "employees", "workers", "officials", "authorities", "representatives", "delegates", "agents", "officers", "members", "participants", "attendees", "guests", "visitors", "observers", "witnesses", "reporters", "journalists", "media", "press", "news", "information", "data", "facts", "details", "specifics", "particulars", "elements", "components", "parts", "pieces", "segments", "sections", "portions", "shares", "stakes", "interests", "concerns", "issues", "problems", "challenges", "difficulties", "obstacles", "barriers", "hurdles", "impediments", "constraints", "limitations", "restrictions", "regulations", "rules", "laws", "statutes", "codes", "standards", "requirements", "criteria", "conditions", "terms", "provisions", "clauses", "articles", "sections", "paragraphs", "sentences", "words", "phrases", "expressions", "statements", "declarations", "announcements", "communications", "messages", "signals", "signs", "symbols", "marks", "labels", "tags", "names", "titles", "headings", "captions", "descriptions", "explanations", "definitions", "meanings", "interpretations", "translations", "versions", "variants", "forms", "formats", "styles", "types", "kinds", "categories", "classes", "groups", "sets", "collections", "assemblies", "gatherings", "meetings", "conferences", "sessions", "hearings", "proceedings", "events", "occasions", "ceremonies", "celebrations", "festivals", "holidays", "observances", "commemorations", "anniversaries", "milestones", "achievements", "accomplishments", "successes", "victories", "wins", "gains", "profits", "benefits", "advantages", "improvements", "enhancements", "upgrades", "developments", "advances", "progress", "growth", "expansion", "extension", "enlargement", "increase", "rise", "elevation", "boost", "lift", "push", "drive", "force", "pressure", "influence", "impact", "effect", "result", "outcome", "consequence", "aftermath", "fallout", "repercussion", "reaction", "response", "feedback", "comment", "remark", "observation", "note", "notice", "warning", "alert", "alarm", "signal", "indication", "sign", "symptom", "evidence", "proof", "confirmation", "verification", "validation", "authentication", "certification", "approval", "endorsement", "support", "backing", "assistance", "help", "aid", "relief", "rescue", "salvation", "protection", "defense", "security", "safety", "shelter", "refuge", "sanctuary", "haven", "retreat", "escape", "exit", "departure", "leaving", "going", "moving", "traveling", "journey", "trip", "voyage", "expedition", "mission", "quest", "search", "hunt", "pursuit", "chase", "follow", "track", "trace", "trail", "path", "route", "way", "direction", "course", "heading", "destination", "target", "goal", "objective", "purpose", "aim", "intention", "plan", "scheme", "design", "blueprint", "map", "chart", "diagram", "graph", "table", "list", "inventory", "catalog", "directory", "index", "register", "record", "log", "journal", "diary", "account", "report", "document", "file", "folder", "archive", "repository", "database", "system", "network", "platform", "framework", "infrastructure", "foundation", "base", "ground", "floor", "level", "tier", "layer", "stratum", "class", "rank", "grade", "degree", "extent", "magnitude", "scale", "proportion", "ratio", "percentage", "fraction", "part", "portion", "section", "segment", "piece", "bit", "element", "component", "factor", "variable", "parameter", "attribute", "characteristic", "feature", "property", "quality", "trait", "aspect", "dimension", "facet", "side", "angle", "perspective", "viewpoint", "standpoint", "position", "stance", "attitude", "approach", "method", "technique", "procedure", "process", "operation", "function", "activity", "action", "behavior", "conduct", "performance", "execution", "implementation", "application", "use", "usage", "utilization", "employment", "deployment", "installation", "setup", "configuration", "arrangement", "organization", "structure", "formation", "composition", "makeup", "constitution", "nature", "character", "personality", "identity", "individuality", "uniqueness", "distinction", "difference", "variation", "diversity", "variety", "multiplicity", "plurality", "abundance", "wealth", "richness", "prosperity", "success", "achievement", "accomplishment", "attainment", "realization", "fulfillment", "satisfaction", "contentment", "happiness", "joy", "pleasure", "delight", "enjoyment", "fun", "entertainment", "amusement", "recreation", "leisure", "relaxation", "rest", "peace", "calm", "quiet", "silence", "stillness", "tranquility", "serenity", "harmony", "balance", "equilibrium", "stability", "consistency", "reliability", "dependability", "trustworthiness", "credibility", "reputation", "standing", "status", "position", "rank", "rating", "score", "grade", "mark", "point", "value", "worth", "merit", "quality", "excellence", "superiority", "advantage", "benefit", "gain", "profit", "return", "yield", "output", "production", "creation", "generation", "formation", "development", "growth", "evolution", "progress", "advancement", "improvement", "enhancement", "upgrade", "modernization", "innovation", "invention", "discovery", "finding", "result", "conclusion", "decision", "judgment", "verdict", "ruling", "determination", "resolution", "settlement", "agreement", "consensus", "understanding", "arrangement", "deal", "contract", "treaty", "pact", "alliance", "partnership", "collaboration", "cooperation", "coordination", "teamwork", "unity", "solidarity", "support", "assistance", "help", "aid", "relief", "service", "contribution", "donation", "gift", "offering", "sacrifice", "commitment", "dedication", "devotion", "loyalty", "faithfulness", "allegiance", "obedience", "compliance", "conformity", "adherence", "observance", "respect", "honor", "dignity", "pride", "confidence", "assurance", "certainty", "conviction", "belief", "faith", "trust", "hope", "optimism", "enthusiasm", "passion", "energy", "vigor", "strength", "power", "force", "might", "capacity", "ability", "capability", "competence", "skill", "talent", "gift", "aptitude", "potential", "possibility", "opportunity", "chance", "prospect", "future", "tomorrow", "destiny", "fate", "fortune", "luck", "success", "victory", "triumph", "win", "achievement", "accomplishment", "goal", "target", "objective", "purpose", "mission", "vision", "dream", "aspiration", "ambition", "desire", "wish", "want", "need", "requirement", "necessity", "obligation", "duty", "responsibility", "accountability", "liability", "burden", "load", "weight", "pressure", "stress", "strain", "tension", "conflict", "dispute", "disagreement", "argument", "debate", "discussion", "conversation", "dialogue", "communication", "exchange", "interaction", "relationship", "connection", "link", "bond", "tie", "association", "affiliation", "membership", "participation", "involvement", "engagement", "commitment", "investment", "stake", "interest", "concern", "care", "attention", "focus", "concentration", "effort", "work", "labor", "toil", "struggle", "fight", "battle", "war", "conflict", "combat", "competition", "contest", "race", "game", "sport", "play", "performance", "show", "display", "exhibition", "demonstration", "presentation", "speech", "address", "talk", "lecture", "lesson", "class", "course", "program", "curriculum", "syllabus", "schedule", "agenda", "plan", "strategy", "approach", "method", "technique", "procedure", "process", "system", "mechanism", "tool", "instrument", "device", "equipment", "apparatus", "machine", "technology", "innovation", "invention", "creation", "product", "item", "thing", "object", "entity", "being", "creature", "person", "individual", "human", "man", "woman", "child", "adult", "senior", "elderly", "young", "old", "new", "recent", "current", "present", "modern", "contemporary", "today", "now", "here", "there", "everywhere", "anywhere", "somewhere", "nowhere"];
									</div>
									<p class="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">
										This is just 5% of your total keyword definitions!
									</p>
								</div>
							{/if}
							
							{#if index === 3}
								<!-- Show results for final step -->
								<div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
									<h5 class="font-semibold text-green-800 dark:text-green-200 mb-3">Migration Complete - Key Metrics:</h5>
									<div class="grid grid-cols-2 gap-4 text-sm">
										<div class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
											<div class="text-2xl font-bold text-green-600 dark:text-green-400">90%</div>
											<div class="text-green-700 dark:text-green-300">Fewer False Positives</div>
										</div>
										<div class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
											<div class="text-2xl font-bold text-green-600 dark:text-green-400">80%</div>
											<div class="text-green-700 dark:text-green-300">Less Maintenance</div>
										</div>
									</div>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			{/each}
		</div>
		
		<!-- Navigation -->
		<div class="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
			<button
				class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				onclick={prevStep}
				disabled={currentStep === 1}
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
				Previous
			</button>
			
			<div class="flex gap-2">
				{#each migrationSteps as _, index}
					<button
						class="w-3 h-3 rounded-full transition-colors {index + 1 === currentStep ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}"
						onclick={() => currentStep = index + 1}
						aria-label="Go to step {index + 1}"
					></button>
				{/each}
			</div>
			
			<button
				class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				onclick={nextStep}
				disabled={currentStep === migrationSteps.length}
			>
				Next
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</button>
		</div>
		
		<!-- Additional Actions -->
		<div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
			<div class="flex flex-col sm:flex-row gap-3">
				<button
					class="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
					onclick={toggleComparison}
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
					</svg>
					{showComparison ? 'Hide' : 'Show'} Side-by-Side Comparison
				</button>
				<button
					class="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
					</svg>
					Download Migration Guide
				</button>
			</div>
		</div>
		
		<!-- Comparison Section -->
		{#if showComparison}
			<div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
				<h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
					📊 Keyword vs Algorithm Comparison
				</h4>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<!-- Keyword System -->
					<div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
						<h5 class="font-semibold text-red-800 dark:text-red-200 mb-3 flex items-center gap-2">
							❌ Current Keyword System
						</h5>
						<div class="space-y-3 text-sm">
							<div class="flex justify-between">
								<span class="text-red-700 dark:text-red-300">Maintenance Time:</span>
								<span class="font-medium text-red-800 dark:text-red-200">8 hrs/week</span>
							</div>
							<div class="flex justify-between">
								<span class="text-red-700 dark:text-red-300">False Positives:</span>
								<span class="font-medium text-red-800 dark:text-red-200">35%</span>
							</div>
							<div class="flex justify-between">
								<span class="text-red-700 dark:text-red-300">Keyword Lines:</span>
								<span class="font-medium text-red-800 dark:text-red-200">1,600+</span>
							</div>
							<div class="flex justify-between">
								<span class="text-red-700 dark:text-red-300">Context Awareness:</span>
								<span class="font-medium text-red-800 dark:text-red-200">None</span>
							</div>
						</div>
					</div>
					
					<!-- Algorithm System -->
					<div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
						<h5 class="font-semibold text-green-800 dark:text-green-200 mb-3 flex items-center gap-2">
							✅ Smart Algorithm System
						</h5>
						<div class="space-y-3 text-sm">
							<div class="flex justify-between">
								<span class="text-green-700 dark:text-green-300">Maintenance Time:</span>
								<span class="font-medium text-green-800 dark:text-green-200">1.5 hrs/week</span>
							</div>
							<div class="flex justify-between">
								<span class="text-green-700 dark:text-green-300">False Positives:</span>
								<span class="font-medium text-green-800 dark:text-green-200">3%</span>
							</div>
							<div class="flex justify-between">
								<span class="text-green-700 dark:text-green-300">Rules Required:</span>
								<span class="font-medium text-green-800 dark:text-green-200">~50 params</span>
							</div>
							<div class="flex justify-between">
								<span class="text-green-700 dark:text-green-300">Context Awareness:</span>
								<span class="font-medium text-green-800 dark:text-green-200">Full AI analysis</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div> 