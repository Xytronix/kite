import { ENGLISH_STOP_WORDS } from './stopWords';

export interface ContentScore {
	relevance: number;
	quality: number;
	sentiment: number;
	category: string;
	shouldFilter: boolean;
	reasons: string[];
}

export class SmartContentFilter {
	private toxicPatterns = [
		/\b(kill|murder|death|suicide|shooting|bomb|terror|attack)\b/i,
		/\b(hate|racist|nazi|genocide|massacre)\b/i
	];

	private lowQualityPatterns = [
		/\b(click here|amazing|shocking|you won't believe|won't believe)\b/i,
		/\b(celebrities?|gossip|scandal|drama)\b/i,
		/\$\d+|\d+%\s*(off|discount)/i, // Promotional content
		/\b(this.*trick|doctors hate|one weird trick)\b/i,
		/\b(blow your mind|will amaze you)\b/i
	];

	private politicalPatterns = [
		// Core political terms
		/\b(trump|biden|harris|election|democrat|republican|congress|senate)\b/i,
		/\b(minister|government|politician|parliament|policy|politics|political)\b/i,
		/\b(president|presidential|vice president|governor|mayor|senator|representative)\b/i,
		/\b(house|supreme court|justice|scotus|federal|state legislature|campaign)\b/i,
		
		// Political figures and parties
		/\b(desantis|newsom|abbott|whitmer|mcconnell|schumer|pelosi|mccarthy)\b/i,
		/\b(gop|dnc|libertarian|green party|progressive|conservative|liberal)\b/i,
		/\b(trump administration|biden administration|white house|capitol|congress)\b/i,
		
		// Political processes and events
		/\b(voting|ballot|primary|caucus|inauguration|impeachment|filibuster)\b/i,
		/\b(debate|rally|town hall|fundraiser|donor|pac|super pac)\b/i,
		/\b(poll|polling|swing state|battleground|electoral college|gerrymandering)\b/i,
		
		// International politics
		/\b(putin|xi jinping|erdogan|modi|macron|trudeau|zelensky)\b/i,
		/\b(nato|un|g7|g20|summit|sanctions|diplomacy|treaty)\b/i,
		/\b(china|russia|ukraine|israel|palestine|iran|north korea)\b/i,
		
		// Political issues
		/\b(abortion|immigration|healthcare|climate policy|gun control|border)\b/i,
		/\b(tax reform|budget|deficit|infrastructure|medicare|social security)\b/i,
		/\b(partisan|bipartisan|gridlock|shutdown|debt ceiling)\b/i
	];

	// New pattern categories for expanded filtering
	private celebrityPatterns = [
		// General celebrity terms
		/\b(celebrity|celeb|star|famous|hollywood|red carpet)\b/i,
		/\b(divorce|marriage|breakup|dating|pregnant|baby)\b/i,
		
		// A-List Celebrities and Politicians (most searched globally)
		/\b(trump|donald trump|taylor swift|sydney sweeney|elon musk|kamala harris)\b/i,
		/\b(cristiano ronaldo|liam payne|kate middleton|messi|lionel messi|sabrina carpenter)\b/i,
		/\b(mbappe|jannik sinner|mike tyson|blake lively|ariana grande|billie eilish)\b/i,
		/\b(justin bieber|joe biden|diddy|lebron james|michael jackson|neymar)\b/i,
		/\b(ryan reynolds|megan fox|anne hathaway|zendaya|eminem|jenna ortega)\b/i,
		/\b(brad pitt|carlos alcaraz|scarlett johansson|tom cruise|lamine yamal|drake)\b/i,
		/\b(selena gomez|novak djokovic|jennifer lopez|millie bobby brown|angelina jolie)\b/i,
		/\b(travis kelce|ryan gosling|dua lipa|simone biles|bruce willis|leonardo dicaprio)\b/i,
		/\b(margot robbie|britney spears|zac efron|kim kardashian|putin|caitlin clark)\b/i,
		/\b(jd vance|kendrick lamar|olivia rodrigo|jennifer aniston|rihanna|cillian murphy)\b/i,
		/\b(lady gaga|glen powell|ben affleck|beyonce|jennifer lawrence|jake paul)\b/i,
		/\b(tom holland|ana de armas|johnny depp|kylie jenner|madonna|keanu reeves)\b/i,
		/\b(travis scott|adam sandler|clint eastwood|jake gyllenhaal|jude bellingham)\b/i,
		/\b(melania trump|katy perry|arnold schwarzenegger|kanye west|meghan markle)\b/i,
		/\b(lola beltran|pink|pedro pascal|chris evans|marilyn monroe|will smith)\b/i,
		/\b(timothee chalamet|barry keoghan|toby keith|matthew mcconaughey|mark wahlberg)\b/i,
		/\b(ice spice|austin butler|george clooney|anthony edwards|casimir funk|bronny james)\b/i,
		/\b(matt damon|gal gadot|tom brady|halle berry)\b/i,
		
		// Additional US-specific celebrities
		/\b(aaron rodgers|shohei ohtani|barron trump|tulsi gabbard|jayson tatum|jelly roll)\b/i,
		/\b(post malone|tiger woods|tyreek hill|cardi b|dolly parton|joe burrow)\b/i,
		/\b(kevin durant|kobe bryant|kyrie irving|emerson romero|meena alexander)\b/i,
		/\b(angel reese|patrick mahomes|tim walz)\b/i,
		
		// Classic celebrities and entertainment terms  
		/\b(kardashian|bieber|swift|beyonce|oprah)\b/i,
		/\b(movie star|pop star|actress|actor|singer|musician|rapper)\b/i,
		/\b(oscar|emmy|grammy|golden globe|award|nomination|winner)\b/i,
		
		// Entertainment industry terms
		/\b(paparazzi|tabloid|gossip|scandal|rumor|exclusive|insider)\b/i,
		/\b(red carpet|premiere|gala|after party|fashion|outfit)\b/i,
		/\b(relationship|romance|engagement|wedding|honeymoon|anniversary)\b/i,
		/\b(pregnancy|baby bump|birth|children|family|personal life)\b/i,
		/\b(feud|rivalry|beef|drama|controversy|apology|statement)\b/i,
		
		// Social media celebrity culture
		/\b(influencer|content creator|youtuber|tiktoker|instagrammer)\b/i,
		/\b(follower count|likes|views|viral|trending|hashtag)\b/i,
		/\b(brand deal|sponsorship|endorsement|collaboration)\b/i,
		
		// Music industry specific
		/\b(album|single|tour|concert|festival|billboard|streaming)\b/i,
		/\b(grammy|vma|ama|brit awards|golden globe|peoples choice)\b/i,
		
		// Film/TV industry specific  
		/\b(netflix|disney|marvel|hbo|casting|audition|role)\b/i,
		/\b(box office|premiere|screening|critic|review|rating)\b/i,
		
		// Sports celebrities
		/\b(athlete|championship|mvp|record|contract|trade|retirement)\b/i,
		/\b(super bowl|world cup|olympics|wimbledon|masters)\b/i
	];

	private sportsPatterns = [
		// Major Sports
		/\b(football|soccer|basketball|baseball|tennis|golf|hockey|cricket|rugby|volleyball)\b/i,
		/\b(swimming|athletics|track and field|gymnastics|boxing|wrestling|martial arts|cycling)\b/i,
		/\b(skiing|snowboarding|ice skating|figure skating|speed skating|bobsled|luge)\b/i,
		/\b(surfing|sailing|rowing|canoeing|kayaking|diving|water polo|synchronized swimming)\b/i,
		/\b(badminton|table tennis|ping pong|squash|racquetball|handball|lacrosse|field hockey)\b/i,
		
		// Team Sports & Leagues
		/\b(nfl|nba|mlb|nhl|mls|fifa|uefa|premier league|champions league|world cup)\b/i,
		/\b(super bowl|world series|stanley cup|march madness|ncaa|olympics|paralympics)\b/i,
		/\b(la liga|bundesliga|serie a|ligue 1|epl|arsenal|manchester|liverpool|barcelona)\b/i,
		/\b(real madrid|chelsea|tottenham|juventus|ac milan|bayern munich|psg|dortmund)\b/i,
		/\b(yankees|red sox|dodgers|giants|cubs|cardinals|astros|braves|phillies|mets)\b/i,
		/\b(lakers|warriors|celtics|heat|bulls|knicks|spurs|nets|clippers|nuggets)\b/i,
		/\b(cowboys|patriots|packers|steelers|49ers|chiefs|ravens|eagles|saints|rams)\b/i,
		
		// Individual Sports & Events
		/\b(marathon|triathlon|ironman|ultra marathon|5k|10k|half marathon|sprinting)\b/i,
		/\b(pole vault|high jump|long jump|shot put|discus|javelin|hammer throw|hurdles)\b/i,
		/\b(weightlifting|powerlifting|bodybuilding|crossfit|strongman|deadlift|squat|bench press)\b/i,
		/\b(Formula 1|f1|nascar|motogp|rally|drag racing|indy 500|le mans|monaco gp)\b/i,
		/\b(tour de france|giro d'italia|vuelta|cycling|road cycling|mountain biking|bmx)\b/i,
		/\b(wimbledon|us open|french open|australian open|grand slam|atp|wta|davis cup)\b/i,
		/\b(masters|pga tour|european tour|ryder cup|fedex cup|major championship)\b/i,
		
		// Sports Equipment & Gear
		/\b(ball|bat|racket|club|stick|helmet|pads|cleats|spikes|jersey|uniform)\b/i,
		/\b(goal|net|hoop|basket|field|court|stadium|arena|track|pool|rink|pitch)\b/i,
		/\b(whistle|referee|umpire|coach|trainer|athletic|fitness|workout|training)\b/i,
		/\b(sneakers|running shoes|sports shoes|athletic wear|sportswear|activewear)\b/i,
		
		// Sports Terminology
		/\b(score|points|goals|assists|rebounds|tackles|yards|innings|rounds|sets)\b/i,
		/\b(win|loss|tie|draw|victory|defeat|champion|championship|tournament|playoff)\b/i,
		/\b(season|game|match|competition|league|division|conference|bracket|seeding)\b/i,
		/\b(trade|signing|contract|salary cap|free agent|rookie|mvp)\b/i,
		/\b(penalty|foul|yellow card|red card|)\b/i,
		/\b(injury|recovery|rehabilitation|fitness|conditioning|endurance|strength)\b/i,
		
		// Combat Sports
		/\b(ufc|mma|mixed martial arts|boxing|kickboxing|muay thai|jiu jitsu|judo|karate)\b/i,
		/\b(taekwondo|wrestling|grappling|submission|knockout|ko|tko|decision|round)\b/i,
		/\b(heavyweight|middleweight|lightweight|featherweight|bantamweight|flyweight)\b/i,
		
		// Extreme & Action Sports
		/\b(skateboarding|snowboarding|surfing|wakeboarding|kitesurfing|windsurfing)\b/i,
		/\b(rock climbing|mountaineering|bungee jumping|skydiving|paragliding|base jumping)\b/i,
		/\b(motocross|bmx|freestyle|halfpipe|x games|extreme sports|action sports)\b/i,
		
		// Winter Sports
		/\b(alpine skiing|cross country skiing|ski jumping|biathlon|curling|bobsled)\b/i,
		/\b(winter olympics|ice hockey|figure skating|speed skating|freestyle skiing)\b/i,
		
		// Esports & Gaming
		/\b(esports|gaming|twitch|streaming|league of legends|dota|csgo|fortnite|valorant)\b/i,
		/\b(overwatch|call of duty|fifa esports|madden|nba 2k|gaming tournament)\b/i,
		
		// Global Sports Events
		/\b(olympics|paralympics|commonwealth games|asian games|world championships)\b/i,
		/\b(euro 2024|copa america|africa cup|world athletics|world aquatics)\b/i,
		
		// Sports Media & Broadcasting
		/\b(espn|fox sports|nbc sports|cbs sports|sky sports|bbc sport|sports center)\b/i,
		/\b(sports news|highlights|replay|live broadcast|sports commentary|analysis)\b/i,
		
		// Fitness & Recreation
		/\b(gym|fitness|workout|exercise|cardio|strength training|yoga|pilates|crossfit)\b/i,
		/\b(running|jogging|cycling|swimming|hiking|climbing|dancing|aerobics)\b/i,
		/\b(personal trainer|fitness coach|athletic performance|sports medicine)\b/i,
		
		// College Sports
		/\b(college football|college basketball|ncaa tournament|bowl games|march madness)\b/i,
		/\b(scholarship|recruit|commit|transfer portal|college athletics|student athlete)\b/i,
		
		// Sports Business
		/\b(sports betting|fantasy sports|draft kings|fanduel|sports gambling|odds)\b/i,
		/\b(sponsorship|endorsement|nike|adidas|under armour|sports marketing)\b/i,
		/\b(ticket sales|season tickets|sports merchandise|jersey sales|stadium naming)\b/i
	];

	private financialPatterns = [
		/\b(stock|market|trading|investment|economy|finance)\b/i,
		/\b(wall street|nasdaq|dow|earnings|profit|revenue)\b/i,
		/\b(bank|loan|mortgage|credit|debt|inflation)\b/i
	];

	private technologyPatterns = [
		// Core tech terms
		/\b(tech|technology|digital|software|app|smartphone|gadget)\b/i,
		/\b(innovation|startup|silicon valley|venture capital|vc|ipo)\b/i,
		/\b(platform|algorithm|data|privacy|security|hack|breach)\b/i,
		
		// Major tech companies
		/\b(apple|google|microsoft|amazon|meta|twitter|x\.com)\b/i,
		/\b(tesla|spacex|netflix|uber|airbnb|zoom|slack)\b/i,
		/\b(nvidia|intel|amd|salesforce|oracle|adobe|ibm)\b/i,
		/\b(tiktok|bytedance|alibaba|tencent|baidu|huawei)\b/i,
		
		// Emerging tech
		/\b(ai|artificial intelligence|machine learning|deep learning)\b/i,
		/\b(chatgpt|openai|anthropic|claude|gemini|deepmind|mistral|deepseek|grok|qwen|xai|copilot|llm|gpt)\b/i,
		/\b(crypto|cryptocurrency|bitcoin|ethereum|blockchain|nft)\b/i,
		/\b(vr|virtual reality|ar|augmented reality|metaverse)\b/i,
		/\b(quantum|computing|cloud|aws|azure|gcp)\b/i,
		
		// Tech products and services
		/\b(iphone|android|windows|mac|ios|pixel|galaxy)\b/i,
		/\b(streaming|subscription|saas|api|sdk|open source)\b/i,
		/\b(5g|6g|wifi|internet|broadband|fiber|satellite)\b/i,
		
		// Tech culture and issues
		/\b(big tech|regulation|antitrust|monopoly|privacy|surveillance)\b/i,
		/\b(tech worker|layoff|hiring|remote work|wfh|return to office)\b/i,
		/\b(developer|programmer|engineer|coding|github|stack overflow)\b/i
	];

	private entertainmentPatterns = [
		// Film and TV
		/\b(movie|film|tv|television|netflix|streaming|hulu|disney\+|hbo)\b/i,
		/\b(cinema|theater|premiere|box office|blockbuster|indie|documentary)\b/i,
		/\b(series|season|episode|finale|pilot|reboot|sequel|prequel)\b/i,
		/\b(actor|actress|director|producer|writer|cinematographer|cast)\b/i,
		
		// Music industry  
		/\b(music|album|single|song|artist|musician|singer|rapper|band)\b/i,
		/\b(concert|tour|festival|venue|stage|performance|live|recording)\b/i,
		/\b(billboard|charts|streaming|spotify|apple music|youtube music)\b/i,
		/\b(record label|producer|songwriter|composer|lyrics|melody)\b/i,
		
		// Awards and recognition
		/\b(oscar|academy award|emmy|grammy|golden globe|sag|bafta)\b/i,
		/\b(cannes|sundance|venice|toronto|tribeca|film festival)\b/i,
		/\b(nomination|winner|nominee|ceremony|red carpet|acceptance speech)\b/i,
		
		// Gaming and digital entertainment
		/\b(video game|gaming|console|pc|mobile|esports|streamer)\b/i,
		/\b(playstation|xbox|nintendo|steam|twitch|youtube|tiktok)\b/i,
		
		// Publishing and media
		/\b(book|novel|author|publisher|bestseller|adaptation)\b/i,
		/\b(magazine|newspaper|journalist|media|press|interview)\b/i,
		
		// Entertainment business
		/\b(box office|ratings|revenue|profit|studio|production|distribution)\b/i,
		/\b(contract|deal|casting|audition|agent|manager|publicist)\b/i
	];

	private weatherPatterns = [
		/\b(weather|temperature|rain|snow|storm|hurricane)\b/i,
		/\b(forecast|climate|sunny|cloudy|windy|tornado)\b/i,
		/\b(degrees|celsius|fahrenheit|precipitation)\b/i
	];

	private breakingNewsPatterns = [
		/\b(breaking|urgent|alert|developing|live|just in)\b/i,
		/\b(update|latest|now|immediate|emergency)\b/i
	];

	private localNewsPatterns = [
		/\b(local|city|town|county|municipal|neighborhood)\b/i,
		/\b(mayor|council|parking|traffic|road work)\b/i,
		/\b(school district|community|residents|zoning)\b/i
	];

	private internationalPatterns = [
		/\b(international|global|worldwide|foreign|overseas)\b/i,
		/\b(united nations|un|nato|eu|europe|asia|africa)\b/i,
		/\b(embassy|diplomat|trade war|sanctions)\b/i
	];

	private anxietyPatterns = [
		/\b(disaster|catastrophe|crisis|emergency|panic)\b/i,
		/\b(collapse|crash|failure|doom|apocalypse)\b/i,
		/\b(fear|terror|anxiety|worry|danger|risk)\b/i
	];

	private economicPessimismPatterns = [
		/\b(recession|depression|crash|bubble|inflation)\b/i,
		/\b(unemployment|layoffs|bankruptcy|debt crisis)\b/i,
		/\b(market crash|economic downturn|financial crisis)\b/i
	];

	private socialMediaDramaPatterns = [
		// Major Social Media Platforms
		/\b(facebook|instagram|twitter|x\.com|tiktok|youtube|snapchat|linkedin|pinterest)\b/i,
		/\b(discord|telegram|whatsapp|reddit|tumblr|twitch|onlyfans|clubhouse|threads)\b/i,
		/\b(bluesky|mastodon|truth social|parler|gettr|rumble|gab|bitchute|minds)\b/i,
		/\b(vine|periscope|mixer|google plus|myspace|friendster|orkut|bebo)\b/i,
		
		// Meta/Facebook Products
		/\b(meta|facebook|instagram|whatsapp|messenger|threads|reels|stories|igtv)\b/i,
		/\b(facebook live|instagram live|facebook marketplace|facebook groups)\b/i,
		/\b(mark zuckerberg|meta verse|oculus|reality labs|facebook dating)\b/i,
		
		// X (Twitter) Related
		/\b(twitter|x\.com|tweet|retweet|quote tweet|twitter spaces|fleets)\b/i,
		/\b(elon musk|twitter blue|x premium|blue checkmark|verified|trending)\b/i,
		/\b(twitter files|twitter takeover|bird app|ratio|subtweet|tweet storm)\b/i,
		
		// TikTok & Short-Form Video
		/\b(tiktok|fyp|for you page|duet|stitch|tiktok live|tiktok shop)\b/i,
		/\b(youtube shorts|instagram reels|snapchat spotlight|viral video)\b/i,
		/\b(trending sound|tiktok dance|challenge|viral trend|algorithm)\b/i,
		
		// YouTube & Content Creation
		/\b(youtube|youtuber|subscriber|monetization|demonetized|copyright strike)\b/i,
		/\b(youtube premium|youtube tv|shorts|community tab|super chat|membership)\b/i,
		/\b(content creator|influencer|vlogger|gaming channel|reaction video)\b/i,
		
		// Social Media Drama & Conflicts
		/\b(cancel culture|cancelled|call out|dragged|exposed|receipts|tea)\b/i,
		/\b(beef|feud|drama|controversy|scandal|allegations|accusations)\b/i,
		/\b(apology video|damage control|pr disaster|social media manager)\b/i,
		/\b(ratio|quote tweet|subtweet|shade|throwing shade|clap back)\b/i,
		/\b(hate comments|trolling|harassment|bullying|toxic|problematic)\b/i,
		/\b(fake news|misinformation|fact check|censorship|shadowban)\b/i,
		
		// Influencer Culture & Economy
		/\b(influencer|content creator|nano influencer|micro influencer|macro influencer)\b/i,
		/\b(brand deal|sponsorship|affiliate link|pr package|gifted|ad|sponsored)\b/i,
		/\b(follower count|engagement rate|fake followers|bot followers|bought followers)\b/i,
		/\b(creator fund|monetization|super thanks|patreon|onlyfans|fansly)\b/i,
		/\b(beauty guru|lifestyle blogger|family vlogger|gaming streamer)\b/i,
		
		// Social Media Features & Terminology
		/\b(story|stories|highlights|live stream|going live|premiere)\b/i,
		/\b(dm|direct message|sliding into dms|group chat|private message)\b/i,
		/\b(like|heart|thumbs up|reaction|comment|share|repost|save)\b/i,
		/\b(follow|unfollow|block|mute|restrict|report|flag)\b/i,
		/\b(hashtag|trending|viral|algorithm|reach|impressions|engagement)\b/i,
		/\b(bio|link in bio|profile picture|pfp|header|cover photo)\b/i,
		/\b(verified|blue checkmark|verified badge|authentication)\b/i,
		
		// Internet Slang & Memes
		/\b(stan|stanning|simp|simping|cringe|based|woke|toxic)\b/i,
		/\b(salty|pressed|triggered|slaps|hits different|no cap|periodt)\b/i,
		/\b(main character|side character|npc|pick me|karen|chad|incel)\b/i,
		/\b(gaslight|gatekeep|girlboss|delulu|slay|serve|periodt|purr)\b/i,
		/\b(it's giving|understood the assignment|tell me without telling me)\b/i,
		/\b(not me|the way|pov|when|nobody|literally nobody|bestie)\b/i,
		
		// Platform-Specific Drama
		/\b(tiktok ban|tiktok hearing|data privacy|chinese app|bytedance)\b/i,
		/\b(instagram down|facebook outage|twitter suspended|account banned)\b/i,
		/\b(youtube demonetized|age restricted|community guidelines|strike)\b/i,
		/\b(shadow banned|algorithm change|reach decreased|engagement down)\b/i,
		
		// Controversy Types
		/\b(racism|sexism|homophobia|transphobia|ableism|cultural appropriation)\b/i,
		/\b(grooming|predator|inappropriate|minor|underage|age gap)\b/i,
		/\b(scam|pyramid scheme|mlm|crypto scam|nft drama|rug pull)\b/i,
		/\b(plagiarism|stolen content|copyright|fair use|dmca)\b/i,
		/\b(doxxing|leaked|private info|address leaked|phone number)\b/i,
		
		// Social Media Trends & Challenges
		/\b(ice bucket challenge|mannequin challenge|bottle flip|tidepod)\b/i,
		/\b(devious licks|benadryl challenge|milk crate|skull breaker)\b/i,
		/\b(charlie damelio|addison rae|james charles|jeffree star|shane dawson)\b/i,
		/\b(logan paul|jake paul|david dobrik|pewdiepie|mr beast)\b/i,
		
		// Platform Updates & Changes
		/\b(algorithm update|new feature|beta test|rollout|ui change)\b/i,
		/\b(privacy policy|terms of service|community guidelines|content policy)\b/i,
		/\b(data breach|hack|security|two factor|2fa|login issues)\b/i,
		
		// Streaming & Live Content
		/\b(twitch|stream|streaming|chat|donation|bits|subscriber)\b/i,
		/\b(raid|host|mod|moderator|timeout|ban|emote|poggers)\b/i,
		/\b(irl streaming|just chatting|gaming stream|hot tub stream)\b/i,
		
		// Social Media Marketing & Business
		/\b(social media marketing|smm|content strategy|engagement pod)\b/i,
		/\b(growth hacking|follower growth|vanity metrics|kpi|roi)\b/i,
		/\b(user generated content|ugc|brand ambassador|affiliate)\b/i,
		/\b(social listening|sentiment analysis|brand monitoring)\b/i,
		
		// Digital Drama Categories
		/\b(twitter beef|instagram drama|tiktok controversy|youtube drama)\b/i,
		/\b(reddit drama|discord leak|snapchat scandal|onlyfans leak)\b/i,
		/\b(influencer drama|creator beef|collab house|team 1000)\b/i,
		
		// Acronyms & Abbreviations
		/\b(dm|dms|ig|fb|yt|tt|sc|lol|omg|wtf|smh|tbh|imo|imho)\b/i,
		/\b(fomo|yolo|ootd|tbt|fbf|mcm|wcw|bff|idc|idgaf|ngl)\b/i,
		/\b(pov|fyp|grwm|ootd|asmr|mukbang|vlog|haul|storytime)\b/i,
		
		// Meme Culture & Viral Content
		/\b(meme|viral|trending|going viral|blow up|overnight sensation)\b/i,
		/\b(karen|florida man|stonks|doge|pepe|wojak|chad|virgin)\b/i,
		/\b(rickroll|rickrolled|never gonna give you up|among us|sus)\b/i,
		
		// Social Justice & Activism
		/\b(social justice warrior|sjw|woke|activism|hashtag activism)\b/i,
		/\b(performative activism|virtue signaling|slacktivism|awareness)\b/i,
		/\b(black lives matter|metoo|climate change|lgbtq|pride month)\b/i
	];

	private promotionalPatterns = [
		/\b(sponsored|advertisement|promotion|deal|offer)\b/i,
		/\b(sale|discount|coupon|buy now|limited time)\b/i,
		/\b(press release|announces|launches|unveils)\b/i
	];

	private repetitivePatterns = [
		/\b(again|another|yet another|more|still|continues)\b/i,
		/\b(update|follow.up|latest|new development)\b/i
	];

	// Pattern cache for performance optimization
	private patternCache = new Map<string, RegExp[]>();
	
	/**
	 * Get cached or compile patterns for better performance
	 */
	private getCachedPatterns(patternKey: string, patterns: RegExp[]): RegExp[] {
		if (!this.patternCache.has(patternKey)) {
			this.patternCache.set(patternKey, patterns);
		}
		return this.patternCache.get(patternKey)!;
	}

	/**
	 * Score content using multiple algorithms
	 */
	scoreContent(title: string, content: string, source: string): ContentScore {
		const text = `${title} ${content}`.toLowerCase();
		
		const relevanceScore = this.calculateRelevance(text);
		const qualityScore = this.calculateQuality(text, source);
		const sentimentScore = this.calculateSentiment(text);
		const category = this.categorizeContent(text);
		
		const shouldFilter = this.shouldFilterContent(relevanceScore, qualityScore, sentimentScore);
		const reasons = this.getFilterReasons(text, relevanceScore, qualityScore, sentimentScore);

		return {
			relevance: relevanceScore,
			quality: qualityScore,
			sentiment: sentimentScore,
			category,
			shouldFilter,
			reasons
		};
	}

	/**
	 * Calculate relevance based on information density and uniqueness
	 */
	private calculateRelevance(text: string): number {
		let score = 0.5; // Base score
		
		// Information density (unique words vs total words)
		const words = text
			.split(/\s+/)
			.map(w => w.toLowerCase())
			.filter(w => w && !ENGLISH_STOP_WORDS.has(w));

		const uniqueWords = new Set(words);

		// Avoid division by zero when text contains only stop words
		const densityRatio = words.length > 0 ? uniqueWords.size / words.length : 0;
		score += densityRatio * 0.3;
		
		// Presence of specific information (numbers, dates, names)
		const hasNumbers = /\d+/.test(text);
		const hasProperNouns = /\b[A-Z][a-z]+/.test(text);
		const hasSpecificTerms = /\b(announced|reported|confirmed|according to)\b/.test(text);
		
		if (hasNumbers) score += 0.1;
		if (hasProperNouns) score += 0.1;
		if (hasSpecificTerms) score += 0.1;
		
		// Penalize clickbait patterns
		if (this.lowQualityPatterns.some(pattern => pattern.test(text))) {
			score -= 0.3;
		}
		
		return Math.max(0, Math.min(1, score));
	}

	/**
	 * Calculate quality based on source credibility and content structure
	 */
	private calculateQuality(text: string, source: string): number {
		let score = 0.5; // Base score
		
		// Source credibility (simple heuristic)
		const trustedDomains = ['reuters.com', 'ap.org', 'bbc.com', 'npr.org'];
		const tabloidDomains = ['dailymail.co.uk', 'tmz.com', 'pagesix.com'];
		
		if (trustedDomains.some(domain => source.includes(domain))) {
			score += 0.3;
		} else if (tabloidDomains.some(domain => source.includes(domain))) {
			score -= 0.3;
		}
		
		// Content structure quality
		const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
		const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
		
		// Optimal sentence length is around 15-25 words
		if (avgSentenceLength > 50 && avgSentenceLength < 200) {
			score += 0.1;
		}
		
		// Check for proper grammar indicators
		const hasProperCapitalization = /^[A-Z]/.test(text.trim());
		const hasProperPunctuation = /[.!?]$/.test(text.trim());
		
		if (hasProperCapitalization) score += 0.05;
		if (hasProperPunctuation) score += 0.05;
		
		return Math.max(0, Math.min(1, score));
	}

	/**
	 * Calculate sentiment to filter overly negative content
	 */
	private calculateSentiment(text: string): number {
		const positiveWords = ['good', 'great', 'excellent', 'positive', 'success', 'win', 'improve', 'growth'];
		const negativeWords = ['bad', 'terrible', 'awful', 'negative', 'fail', 'lose', 'decline', 'crisis'];
		const veryNegativeWords = ['death', 'kill', 'murder', 'disaster', 'catastrophe', 'tragedy'];
		
		let score = 0.5; // Neutral
		
		const words = text.toLowerCase().split(/\s+/);
		
		words.forEach(word => {
			if (positiveWords.includes(word)) score += 0.02;
			if (negativeWords.includes(word)) score -= 0.02;
			if (veryNegativeWords.includes(word)) score -= 0.05;
		});
		
		// Check for toxic patterns
		if (this.toxicPatterns.some(pattern => pattern.test(text))) {
			score -= 0.3;
		}
		
		return Math.max(0, Math.min(1, score));
	}

	/**
	 * Categorize content automatically
	 */
	private categorizeContent(text: string): string {
		const categories = {
			politics: this.politicalPatterns,
			technology: [/\b(ai|tech|digital|cyber|software|app|internet)\b/i],
			business: [/\b(company|business|market|stock|economy|finance)\b/i],
			health: [/\b(health|medical|doctor|hospital|disease|vaccine)\b/i],
			sports: [/\b(sport|game|team|player|match|championship)\b/i],
			science: [/\b(research|study|scientist|discovery|experiment)\b/i]
		};
		
		for (const [category, patterns] of Object.entries(categories)) {
			if (patterns.some(pattern => pattern.test(text))) {
				return category;
			}
		}
		
		return 'general';
	}

	/**
	 * Determine if content should be filtered
	 */
	private shouldFilterContent(relevance: number, quality: number, sentiment: number): boolean {
		// Don't apply hardcoded thresholds - let user preferences control all filtering
		// This prevents false filtering when all user filters are disabled
		return false;
	}

	/**
	 * Get reasons for filtering
	 */
	private getFilterReasons(text: string, relevance: number, quality: number, sentiment: number): string[] {
		const reasons: string[] = [];
		
		if (relevance < 0.3) reasons.push('Low information value');
		if (quality < 0.2) reasons.push('Poor content quality');
		if (sentiment < 0.2) reasons.push('Overly negative content');
		
		if (this.lowQualityPatterns.some(pattern => pattern.test(text))) {
			reasons.push('Clickbait detected');
		}
		
		if (this.toxicPatterns.some(pattern => pattern.test(text))) {
			reasons.push('Toxic content detected');
		}
		
		return reasons;
	}

	/**
	 * Get user preferences for filtering
	 */
	applyUserPreferences(score: ContentScore, userPreferences: any): ContentScore {
		const newScore = { ...score };
		const text = ''; // This would be passed separately in a real implementation
		
		// Category-based filtering
		if (userPreferences.filterPolitics && score.category === 'politics') {
			newScore.shouldFilter = true;
			newScore.reasons.push('Politics filtered by user preference');
		}
		
		// Sentiment-based filtering
		if (userPreferences.filterNegativeNews && score.sentiment < 0.4) {
			newScore.shouldFilter = true;
			newScore.reasons.push('Negative news filtered by user preference');
		}
		
		if (userPreferences.filterViolence && this.toxicPatterns.some(pattern => pattern.test(text))) {
			newScore.shouldFilter = true;
			newScore.reasons.push('Violent content filtered');
		}
		
		if (userPreferences.filterAnxietyInducing && this.anxietyPatterns.some(pattern => pattern.test(text))) {
			newScore.shouldFilter = true;
			newScore.reasons.push('Anxiety-inducing content filtered');
		}
		
		if (userPreferences.filterEconomicPessimism && this.economicPessimismPatterns.some(pattern => pattern.test(text))) {
			newScore.shouldFilter = true;
			newScore.reasons.push('Economic pessimism filtered');
		}
		
		// Quality-based filtering
		if (userPreferences.filterLowQuality && score.quality < 0.5) {
			newScore.shouldFilter = true;
			newScore.reasons.push('Low quality filtered by user preference');
		}
		
		// Threshold-based filtering
		if (userPreferences.minimumRelevance && score.relevance < userPreferences.minimumRelevance) {
			newScore.shouldFilter = true;
			newScore.reasons.push('Below minimum relevance threshold');
		}
		
		if (userPreferences.minimumQuality && score.quality < userPreferences.minimumQuality) {
			newScore.shouldFilter = true;
			newScore.reasons.push('Below minimum quality threshold');
		}
		
		if (userPreferences.minimumSentiment && score.sentiment < userPreferences.minimumSentiment) {
			newScore.shouldFilter = true;
			newScore.reasons.push('Below minimum sentiment threshold');
		}
		
		return newScore;
	}

	/**
	 * Check if content matches specific filter patterns with cautious scoring
	 */
	checkContentFilters(title: string, content: string, userPreferences: any): { shouldFilter: boolean; reasons: string[] } {
		const text = `${title} ${content}`.toLowerCase();
		const titleText = title.toLowerCase();
		const reasons: string[] = [];
		let shouldFilter = false;

		// Get sensitivity setting with per-category overrides (supports custom values)
		const getSensitivityForCategory = (category: string): 'strict' | 'balanced' | 'loose' | number => {
			const globalSensitivity = userPreferences.filterSensitivity || 'balanced';
			const overrides = userPreferences.categoryOverrides;
			
			if (!overrides) return globalSensitivity;
			
			// Map filter categories to override keys
			const categoryMap: Record<string, keyof typeof overrides> = {
				filterPolitics: 'politics',
				filterCelebrity: 'celebrity', 
				filterSports: 'sports',
				filterFinancial: 'financial',
				filterTechnology: 'technology',
				filterEntertainment: 'entertainment',
				filterSocialMediaDrama: 'socialMediaDrama'
			};
			
			const overrideKey = categoryMap[category];
			return overrides[overrideKey] || globalSensitivity;
		};
		


		// Define confidence thresholds for different categories
		const categoryConfidence = this.calculateCategoryConfidence(text, titleText, userPreferences, getSensitivityForCategory);

		// More cautious filtering - require higher confidence or multiple indicators
		for (const [category, confidence] of Object.entries(categoryConfidence)) {
			if (confidence.shouldFilter) {
			shouldFilter = true;
				reasons.push(confidence.reason);
			}
		}

		return { shouldFilter, reasons };
	}

	/**
	 * Convert sensitivity to threshold logic with true granular control
	 */
	private getSensitivityThresholds(sensitivity: 'strict' | 'balanced' | 'loose' | number) {
		if (typeof sensitivity === 'number') {
			// True granular numeric control (0-100)
			const normalizedSensitivity = Math.max(0, Math.min(100, sensitivity)) / 100; // 0.0 to 1.0
			
			// Calculate dynamic thresholds based on exact numeric value
			const minIndicators = Math.max(1, Math.ceil(1 + (normalizedSensitivity * 4))); // 1-5 indicators
			const titleWeight = 0.3 + (normalizedSensitivity * 0.4); // 0.3-0.7 title importance
			const contextWeight = 0.2 + (normalizedSensitivity * 0.5); // 0.2-0.7 context importance
			
			return {
				requireStrongAndTitle: normalizedSensitivity > 0.8, // Only very strict requires both
				minIndicators,
				allowTitleOnly: normalizedSensitivity < 0.4, // Only loose allows title-only
				titleWeight,
				contextWeight,
				exactSensitivity: normalizedSensitivity
			};
		}
		
		// Predefined levels (backwards compatibility)
		switch (sensitivity) {
			case 'strict':
				return { requireStrongAndTitle: true, minIndicators: 4, allowTitleOnly: false, titleWeight: 0.7, contextWeight: 0.7, exactSensitivity: 0.85 };
			case 'loose':
				return { requireStrongAndTitle: false, minIndicators: 1, allowTitleOnly: true, titleWeight: 0.3, contextWeight: 0.2, exactSensitivity: 0.15 };
			case 'balanced':
			default:
				return { requireStrongAndTitle: false, minIndicators: 2, allowTitleOnly: true, titleWeight: 0.5, contextWeight: 0.45, exactSensitivity: 0.5 };
		}
	}

	/**
	 * Calculate confidence scores for each category with cautious thresholds
	 */
	private calculateCategoryConfidence(text: string, titleText: string, userPreferences: any, getSensitivity: (category: string) => 'strict' | 'balanced' | 'loose' | number): Record<string, { shouldFilter: boolean; reason: string; confidence: number }> {
		const results: Record<string, { shouldFilter: boolean; reason: string; confidence: number }> = {};

		// Politics - require multiple indicators or high-confidence terms
		if (userPreferences.filterPolitics) {
			const politicsScore = this.calculatePatternConfidence(text, titleText, this.politicalPatterns);
			const strongPoliticsTerms = [
				/\b(trump|biden|harris|congress|senate|election|president|governor)\b/i,
				/\b(republican|democrat|gop|dnc|white house|capitol)\b/i,
				/\b(voting|ballot|campaign|debate|policy|politics|political)\b/i
			];
			const hasStrongTerms = strongPoliticsTerms.some(pattern => pattern.test(text));
			const sensitivity = getSensitivity('filterPolitics');
			const thresholds = this.getSensitivityThresholds(sensitivity);
			
			// Apply granular threshold-based filtering with global weights
			let shouldFilter = false;
			
			// Get category-specific weights or fallback to global weights
			const categoryWeights = userPreferences.categoryWeightOverrides?.politics || {};
			const titleWeight = categoryWeights.titleImportance ?? userPreferences.globalTitleImportance ?? 60;
			const contentWeight = categoryWeights.contentImportance ?? userPreferences.globalContentImportance ?? 25;
			const contextWeight = categoryWeights.contextEvidence ?? userPreferences.globalContextEvidence ?? 15;
			
			// Normalize weights to sum to 1.0
			const totalWeight = titleWeight + contentWeight + contextWeight;
			const normalizedTitleWeight = totalWeight > 0 ? titleWeight / totalWeight : 0;
			const normalizedContentWeight = totalWeight > 0 ? contentWeight / totalWeight : 0;
			const normalizedContextWeight = totalWeight > 0 ? contextWeight / totalWeight : 0;
			
			// Calculate weighted confidence score (0.0 to 1.0)
			const titleConfidence = politicsScore.titleMatches * normalizedTitleWeight;
			const bodyConfidence = politicsScore.matchCount > 1 ? normalizedContentWeight : 0; // Body content evidence
			const contextConfidence = hasStrongTerms ? normalizedContextWeight : 0;
			const totalConfidence = titleConfidence + bodyConfidence + contextConfidence;
			
			// Dynamic filtering based on exact sensitivity level
			if (thresholds.requireStrongAndTitle) {
				// Ultra-strict mode (80%+): Require strong evidence
				shouldFilter = (hasStrongTerms && politicsScore.titleMatches >= 1 && politicsScore.matchCount >= 2) ||
							   totalConfidence > thresholds.exactSensitivity;
			} else if (thresholds.allowTitleOnly) {
				// Loose mode (0-40%): Allow title-only or low-confidence matches
				shouldFilter = totalConfidence > (thresholds.exactSensitivity * 0.6) ||
							   (politicsScore.titleMatches >= 1 && thresholds.exactSensitivity < 0.3);
			} else {
				// Balanced mode (40-80%): Weighted confidence scoring
				shouldFilter = totalConfidence > thresholds.exactSensitivity ||
							   politicsScore.matchCount >= thresholds.minIndicators;
			}
			
			results.politics = {
				shouldFilter,
				reason: `Political content (${politicsScore.matchCount} indicators, title: ${politicsScore.titleMatches > 0}, sensitivity: ${sensitivity})`,
				confidence: politicsScore.confidence
			};
		}

		// Celebrity - require multiple indicators or very clear celebrity content
		if (userPreferences.filterCelebrity) {
			const celebrityScore = this.calculatePatternConfidence(text, titleText, this.celebrityPatterns);
			const strongCelebrityTerms = [
				/\b(celebrity|hollywood|red carpet|paparazzi|tabloid)\b/i,
				/\b(kardashian|swift|beyonce|bieber|oprah)\b/i,
				/\b(marriage|divorce|pregnancy|scandal|feud)\b/i
			];
			const hasStrongTerms = strongCelebrityTerms.some(pattern => pattern.test(text));
			const sensitivity = getSensitivity('filterCelebrity');
			const thresholds = this.getSensitivityThresholds(sensitivity);
			
			// Apply threshold-based filtering with global weights
			let shouldFilter = false;
			
			// Get category-specific weights or fallback to global weights
			const categoryWeights = userPreferences.categoryWeightOverrides?.celebrity || {};
			const titleWeight = categoryWeights.titleImportance ?? userPreferences.globalTitleImportance ?? 60;
			const contentWeight = categoryWeights.contentImportance ?? userPreferences.globalContentImportance ?? 25;
			const contextWeight = categoryWeights.contextEvidence ?? userPreferences.globalContextEvidence ?? 15;
			
			// Normalize weights to sum to 1.0
			const totalWeight = titleWeight + contentWeight + contextWeight;
			const normalizedTitleWeight = totalWeight > 0 ? titleWeight / totalWeight : 0;
			const normalizedContentWeight = totalWeight > 0 ? contentWeight / totalWeight : 0;
			const normalizedContextWeight = totalWeight > 0 ? contextWeight / totalWeight : 0;
			
			// Calculate weighted confidence score (0.0 to 1.0)
			const titleConfidence = celebrityScore.titleMatches * normalizedTitleWeight;
			const bodyConfidence = celebrityScore.matchCount > 1 ? normalizedContentWeight : 0;
			const contextConfidence = hasStrongTerms ? normalizedContextWeight : 0;
			const totalConfidence = titleConfidence + bodyConfidence + contextConfidence;
			
			// Dynamic filtering based on sensitivity and weighted confidence
			if (thresholds.requireStrongAndTitle) {
				// Strict: Require high confidence or multiple strong signals
				shouldFilter = totalConfidence > thresholds.exactSensitivity ||
							   (hasStrongTerms && celebrityScore.titleMatches >= 1 && celebrityScore.matchCount >= 2);
			} else if (thresholds.allowTitleOnly) {
				// Loose: Lower confidence threshold
				shouldFilter = totalConfidence > (thresholds.exactSensitivity * 0.6) ||
							   (celebrityScore.titleMatches >= 1 && thresholds.exactSensitivity < 0.3);
			} else {
				// Balanced: Standard confidence threshold
				shouldFilter = totalConfidence > thresholds.exactSensitivity ||
							   celebrityScore.matchCount >= thresholds.minIndicators;
			}
			
			results.celebrity = {
				shouldFilter,
				reason: `Celebrity content (${celebrityScore.matchCount} indicators, strong terms: ${hasStrongTerms}, sensitivity: ${sensitivity})`,
				confidence: celebrityScore.confidence
			};
		}

		// Sports - optimized with sport-specific context detection
		if (userPreferences.filterSports) {
			const sportsScore = this.calculatePatternConfidence(text, titleText, this.sportsPatterns);
			
			// Enhanced strong sports terms with hierarchical importance
			const majorSportsTerms = [
				/\b(nfl|nba|mlb|nhl|fifa|uefa|olympics|world cup|super bowl|world series|stanley cup)\b/i,
				/\b(football|basketball|baseball|soccer|tennis|golf|hockey|cricket|rugby)\b/i
			];
			const sportsEventTerms = [
				/\b(game|match|championship|tournament|playoff|season|league|draft|trade)\b/i,
				/\b(goal|touchdown|home run|penalty|foul|score|points|win|loss|victory)\b/i
			];
			const sportsPersonnelTerms = [
				/\b(player|athlete|coach|manager|referee|umpire|team|roster|mvp|rookie)\b/i,
				/\b(contract|salary|signing|injury|transfer|retirement|suspended)\b/i
			];
			
			const hasMajorSportsTerms = majorSportsTerms.some(pattern => pattern.test(text));
			const hasSportsEventTerms = sportsEventTerms.some(pattern => pattern.test(text));
			const hasSportsPersonnelTerms = sportsPersonnelTerms.some(pattern => pattern.test(text));
			
			// Calculate sport context strength (0.0 to 1.0)
			let contextStrength = 0;
			if (hasMajorSportsTerms) contextStrength += 0.5;
			if (hasSportsEventTerms) contextStrength += 0.3;
			if (hasSportsPersonnelTerms) contextStrength += 0.2;
			
			const sensitivity = getSensitivity('filterSports');
			const thresholds = this.getSensitivityThresholds(sensitivity);
			
			// Apply adaptive sensitivity based on content characteristics
			const adaptiveSensitivity = this.adjustSensitivityForContent(
				sensitivity, 
				'sports', 
				contextStrength, 
				sportsScore.titleMatches, 
				sportsScore.uniqueMatches
			);
			const adaptiveThresholds = this.getSensitivityThresholds(adaptiveSensitivity * 100);
			
			// Apply granular threshold-based filtering with global weights
			let shouldFilter = false;
			
			// Get category-specific weights or fallback to global weights
			const categoryWeights = userPreferences.categoryWeightOverrides?.sports || {};
			const titleWeight = categoryWeights.titleImportance ?? userPreferences.globalTitleImportance ?? 60;
			const contentWeight = categoryWeights.contentImportance ?? userPreferences.globalContentImportance ?? 25;
			const contextWeight = categoryWeights.contextEvidence ?? userPreferences.globalContextEvidence ?? 15;
			
			// Normalize weights to sum to 1.0
			const totalWeight = titleWeight + contentWeight + contextWeight;
			const normalizedTitleWeight = totalWeight > 0 ? titleWeight / totalWeight : 0;
			const normalizedContentWeight = totalWeight > 0 ? contentWeight / totalWeight : 0;
			const normalizedContextWeight = totalWeight > 0 ? contextWeight / totalWeight : 0;
			
			// Enhanced confidence calculation with context strength multiplier
			const titleConfidence = sportsScore.titleMatches * normalizedTitleWeight;
			const bodyConfidence = (sportsScore.matchCount > 1 ? normalizedContentWeight : 0) * (1 + contextStrength);
			const contextConfidence = contextStrength * normalizedContextWeight;
			const totalConfidence = titleConfidence + bodyConfidence + contextConfidence;
			
			// Sports-specific filtering logic with context awareness
			if (adaptiveThresholds.requireStrongAndTitle) {
				// Ultra-strict mode: Require major sports terms + title match
				shouldFilter = (hasMajorSportsTerms && sportsScore.titleMatches >= 1) ||
							   (contextStrength >= 0.8 && totalConfidence > adaptiveThresholds.exactSensitivity);
			} else if (adaptiveThresholds.allowTitleOnly) {
				// Loose mode: Allow single strong indicator or moderate context
				shouldFilter = totalConfidence > (adaptiveThresholds.exactSensitivity * 0.5) ||
							   (contextStrength >= 0.3 && sportsScore.titleMatches >= 1) ||
							   (hasMajorSportsTerms && adaptiveThresholds.exactSensitivity < 0.3);
			} else {
				// Balanced mode: Require decent context + indicators
				shouldFilter = (totalConfidence > adaptiveThresholds.exactSensitivity) ||
							   (contextStrength >= 0.5 && sportsScore.matchCount >= adaptiveThresholds.minIndicators) ||
							   (hasMajorSportsTerms && sportsScore.matchCount >= 2);
			}
			
			results.sports = {
				shouldFilter,
				reason: `Sports content (${sportsScore.matchCount} indicators, context: ${Math.round(contextStrength * 100)}%, title: ${sportsScore.titleMatches > 0}, sensitivity: ${sensitivity})`,
				confidence: Math.min(sportsScore.confidence + contextStrength * 0.3, 1.0)
			};
		}

		// Technology - require clear tech context
		if (userPreferences.filterTechnology) {
			const techScore = this.calculatePatternConfidence(text, titleText, this.technologyPatterns);
			const strongTechTerms = [
				/\b(tech|technology|software|app|ai|artificial intelligence)\b/i,
				/\b(apple|google|microsoft|amazon|meta|openai)\b/i,
				/\b(startup|innovation|silicon valley|crypto|blockchain)\b/i
			];
			const hasStrongTerms = strongTechTerms.some(pattern => pattern.test(text));
			const sensitivity = getSensitivity('filterTechnology');
			const thresholds = this.getSensitivityThresholds(sensitivity);
			
			// Apply granular threshold-based filtering with global weights
			let shouldFilter = false;
			
			// Get category-specific weights or fallback to global weights
			const categoryWeights = userPreferences.categoryWeightOverrides?.technology || {};
			const titleWeight = categoryWeights.titleImportance ?? userPreferences.globalTitleImportance ?? 60;
			const contentWeight = categoryWeights.contentImportance ?? userPreferences.globalContentImportance ?? 25;
			const contextWeight = categoryWeights.contextEvidence ?? userPreferences.globalContextEvidence ?? 15;
			
			// Normalize weights to sum to 1.0
			const totalWeight = titleWeight + contentWeight + contextWeight;
			const normalizedTitleWeight = totalWeight > 0 ? titleWeight / totalWeight : 0;
			const normalizedContentWeight = totalWeight > 0 ? contentWeight / totalWeight : 0;
			const normalizedContextWeight = totalWeight > 0 ? contextWeight / totalWeight : 0;
			
			// Calculate weighted confidence score (0.0 to 1.0)
			const titleConfidence = techScore.titleMatches * normalizedTitleWeight;
			const bodyConfidence = techScore.matchCount > 1 ? normalizedContentWeight : 0; // Body content evidence
			const contextConfidence = hasStrongTerms ? normalizedContextWeight : 0;
			const totalConfidence = titleConfidence + bodyConfidence + contextConfidence;
			
			// Dynamic filtering based on exact sensitivity level
			if (thresholds.requireStrongAndTitle) {
				// Ultra-strict mode (80%+): Require strong evidence
				shouldFilter = (hasStrongTerms && techScore.titleMatches >= 1 && techScore.matchCount >= 2) ||
							   totalConfidence > thresholds.exactSensitivity;
			} else if (thresholds.allowTitleOnly) {
				// Loose mode (0-40%): Allow title-only or low-confidence matches
				shouldFilter = totalConfidence > (thresholds.exactSensitivity * 0.6) ||
							   (techScore.titleMatches >= 1 && thresholds.exactSensitivity < 0.3);
			} else {
				// Balanced mode (40-80%): Weighted confidence scoring
				shouldFilter = totalConfidence > thresholds.exactSensitivity ||
							   techScore.matchCount >= thresholds.minIndicators;
			}
			
			results.technology = {
				shouldFilter,
				reason: `Technology content (${techScore.matchCount} indicators, title: ${techScore.titleMatches > 0}, sensitivity: ${sensitivity})`,
				confidence: techScore.confidence
			};
		}

		// Entertainment - require clear entertainment context
		if (userPreferences.filterEntertainment) {
			const entertainmentScore = this.calculatePatternConfidence(text, titleText, this.entertainmentPatterns);
			const strongEntertainmentTerms = [
				/\b(movie|film|tv|television|netflix|streaming)\b/i,
				/\b(music|album|concert|tour|artist|musician)\b/i,
				/\b(oscar|emmy|grammy|award|entertainment)\b/i
			];
			const hasStrongTerms = strongEntertainmentTerms.some(pattern => pattern.test(text));
			const sensitivity = getSensitivity('filterEntertainment');
			const thresholds = this.getSensitivityThresholds(sensitivity);
			
			// Apply granular threshold-based filtering with global weights
			let shouldFilter = false;
			
			// Get category-specific weights or fallback to global weights
			const categoryWeights = userPreferences.categoryWeightOverrides?.entertainment || {};
			const titleWeight = categoryWeights.titleImportance ?? userPreferences.globalTitleImportance ?? 60;
			const contentWeight = categoryWeights.contentImportance ?? userPreferences.globalContentImportance ?? 25;
			const contextWeight = categoryWeights.contextEvidence ?? userPreferences.globalContextEvidence ?? 15;
			
			// Normalize weights to sum to 1.0
			const totalWeight = titleWeight + contentWeight + contextWeight;
			const normalizedTitleWeight = totalWeight > 0 ? titleWeight / totalWeight : 0;
			const normalizedContentWeight = totalWeight > 0 ? contentWeight / totalWeight : 0;
			const normalizedContextWeight = totalWeight > 0 ? contextWeight / totalWeight : 0;
			
			// Calculate weighted confidence score (0.0 to 1.0)
			const titleConfidence = entertainmentScore.titleMatches * normalizedTitleWeight;
			const bodyConfidence = entertainmentScore.matchCount > 1 ? normalizedContentWeight : 0; // Body content evidence
			const contextConfidence = hasStrongTerms ? normalizedContextWeight : 0;
			const totalConfidence = titleConfidence + bodyConfidence + contextConfidence;
			
			// Dynamic filtering based on exact sensitivity level
			if (thresholds.requireStrongAndTitle) {
				// Ultra-strict mode (80%+): Require strong evidence
				shouldFilter = (hasStrongTerms && entertainmentScore.titleMatches >= 1 && entertainmentScore.matchCount >= 2) ||
							   totalConfidence > thresholds.exactSensitivity;
			} else if (thresholds.allowTitleOnly) {
				// Loose mode (0-40%): Allow title-only or low-confidence matches
				shouldFilter = totalConfidence > (thresholds.exactSensitivity * 0.6) ||
							   (entertainmentScore.titleMatches >= 1 && thresholds.exactSensitivity < 0.3);
			} else {
				// Balanced mode (40-80%): Weighted confidence scoring
				shouldFilter = totalConfidence > thresholds.exactSensitivity ||
							   entertainmentScore.matchCount >= thresholds.minIndicators;
			}
			
			results.entertainment = {
				shouldFilter,
				reason: `Entertainment content (${entertainmentScore.matchCount} indicators, title: ${entertainmentScore.titleMatches > 0}, sensitivity: ${sensitivity})`,
				confidence: entertainmentScore.confidence
			};
		}

		// Financial - require clear financial context
		if (userPreferences.filterFinancial) {
			const financialScore = this.calculatePatternConfidence(text, titleText, this.financialPatterns);
			const shouldFilter = financialScore.matchCount >= 2 || 
								 (financialScore.titleMatches >= 1 && financialScore.matchCount >= 1);
			
			results.financial = {
				shouldFilter,
				reason: `Financial content (${financialScore.matchCount} indicators)`,
				confidence: financialScore.confidence
			};
		}

		// Social Media Drama - optimized with platform-specific detection and drama intensity
		if (userPreferences.filterSocialMediaDrama) {
			const socialScore = this.calculatePatternConfidence(text, titleText, this.socialMediaDramaPatterns);
			
			// Platform-specific terms with weighted importance
			const majorPlatformTerms = [
				/\b(twitter|x\.com|facebook|instagram|tiktok|youtube|discord|reddit)\b/i,
				/\b(meta|elon musk|mark zuckerberg|content creator|influencer)\b/i
			];
			const dramaIntensityTerms = [
				/\b(controversy|scandal|backlash|outrage|feud|beef|drama|toxic|hate)\b/i,
				/\b(cancelled|canceled|trending|viral|expose|callout|problematic)\b/i,
				/\b(blocked|banned|suspended|deleted|removed|censored|demonetized)\b/i
			];
			const socialEngagementTerms = [
				/\b(followers|likes|shares|retweets|comments|subscribers|views|viral)\b/i,
				/\b(post|tweet|video|story|reel|thread|livestream|stream|upload)\b/i,
				/\b(algorithm|shadow ban|engagement|reach|monetization|creator fund)\b/i
			];
			const conflictTerms = [
				/\b(fight|argue|attack|defend|response|clap back|call out|expose)\b/i,
				/\b(fan war|stan|hater|troll|harassment|bullying|doxxing|leak)\b/i
			];
			
			const hasMajorPlatforms = majorPlatformTerms.some(pattern => pattern.test(text));
			const hasDramaIntensity = dramaIntensityTerms.some(pattern => pattern.test(text));
			const hasSocialEngagement = socialEngagementTerms.some(pattern => pattern.test(text));
			const hasConflictTerms = conflictTerms.some(pattern => pattern.test(text));
			
			// Calculate drama intensity score (0.0 to 1.0)
			let dramaIntensity = 0;
			if (hasMajorPlatforms) dramaIntensity += 0.3;
			if (hasDramaIntensity) dramaIntensity += 0.4; // High weight for drama terms
			if (hasSocialEngagement) dramaIntensity += 0.2;
			if (hasConflictTerms) dramaIntensity += 0.3;
			
			// Boost intensity if multiple drama indicators present
			const dramaIndicatorCount = [hasDramaIntensity, hasConflictTerms, hasMajorPlatforms].filter(Boolean).length;
			if (dramaIndicatorCount >= 2) dramaIntensity *= 1.2;
			
			dramaIntensity = Math.min(dramaIntensity, 1.0); // Cap at 1.0
			
			const sensitivity = getSensitivity('filterSocialMediaDrama');
			const thresholds = this.getSensitivityThresholds(sensitivity);
			
			// Apply adaptive sensitivity based on content characteristics  
			const adaptiveSensitivity = this.adjustSensitivityForContent(
				sensitivity,
				'socialMediaDrama', 
				dramaIntensity, 
				socialScore.titleMatches, 
				socialScore.uniqueMatches
			);
			const adaptiveThresholds = this.getSensitivityThresholds(adaptiveSensitivity * 100);
			
			// Apply granular threshold-based filtering with global weights
			let shouldFilter = false;
			
			// Get category-specific weights or fallback to global weights
			const categoryWeights = userPreferences.categoryWeightOverrides?.socialMediaDrama || {};
			const titleWeight = categoryWeights.titleImportance ?? userPreferences.globalTitleImportance ?? 60;
			const contentWeight = categoryWeights.contentImportance ?? userPreferences.globalContentImportance ?? 25;
			const contextWeight = categoryWeights.contextEvidence ?? userPreferences.globalContextEvidence ?? 15;
			
			// Normalize weights to sum to 1.0
			const totalWeight = titleWeight + contentWeight + contextWeight;
			const normalizedTitleWeight = totalWeight > 0 ? titleWeight / totalWeight : 0;
			const normalizedContentWeight = totalWeight > 0 ? contentWeight / totalWeight : 0;
			const normalizedContextWeight = totalWeight > 0 ? contextWeight / totalWeight : 0;
			
			// Enhanced confidence calculation with drama intensity multiplier
			const titleConfidence = socialScore.titleMatches * normalizedTitleWeight * (1 + dramaIntensity * 0.5);
			const bodyConfidence = (socialScore.matchCount > 1 ? normalizedContentWeight : 0) * (1 + dramaIntensity);
			const contextConfidence = dramaIntensity * normalizedContextWeight;
			const totalConfidence = titleConfidence + bodyConfidence + contextConfidence;
			
			// Social media drama-specific filtering logic with intensity awareness
			if (adaptiveThresholds.requireStrongAndTitle) {
				// Ultra-strict mode: Require high drama intensity + clear platform context
				shouldFilter = (dramaIntensity >= 0.7 && socialScore.titleMatches >= 1) ||
							   (hasDramaIntensity && hasMajorPlatforms && socialScore.matchCount >= 2) ||
							   (dramaIntensity >= 0.9 && totalConfidence > adaptiveThresholds.exactSensitivity);
			} else if (adaptiveThresholds.allowTitleOnly) {
				// Loose mode: Allow moderate drama or single strong indicator
				shouldFilter = totalConfidence > (adaptiveThresholds.exactSensitivity * 0.4) ||
							   (dramaIntensity >= 0.3 && socialScore.titleMatches >= 1) ||
							   (hasDramaIntensity && hasMajorPlatforms && adaptiveThresholds.exactSensitivity < 0.4) ||
							   (dramaIntensity >= 0.6); // High drama intensity alone
			} else {
				// Balanced mode: Require moderate intensity + indicators
				shouldFilter = (totalConfidence > adaptiveThresholds.exactSensitivity) ||
							   (dramaIntensity >= 0.5 && socialScore.matchCount >= adaptiveThresholds.minIndicators) ||
							   (hasDramaIntensity && hasMajorPlatforms && socialScore.matchCount >= 2) ||
							   (dramaIntensity >= 0.8 && socialScore.matchCount >= 1); // Very high intensity
			}
			
			results.socialMediaDrama = {
				shouldFilter,
				reason: `Social media drama (${socialScore.matchCount} indicators, drama: ${Math.round(dramaIntensity * 100)}%, title: ${socialScore.titleMatches > 0}, sensitivity: ${sensitivity})`,
				confidence: Math.min(socialScore.confidence + dramaIntensity * 0.4, 1.0)
			};
		}

		// Simple categories that are more straightforward
		const simpleCategories = [
			{ key: 'filterWeather', patterns: this.weatherPatterns, name: 'Weather' },
			{ key: 'filterBreakingNews', patterns: this.breakingNewsPatterns, name: 'Breaking news' },
			{ key: 'filterLocalNews', patterns: this.localNewsPatterns, name: 'Local news' },
			{ key: 'filterInternationalNews', patterns: this.internationalPatterns, name: 'International news' },
			{ key: 'filterPromotional', patterns: this.promotionalPatterns, name: 'Promotional content' },
			{ key: 'filterRepetitive', patterns: this.repetitivePatterns, name: 'Repetitive content' }
		];

		for (const category of simpleCategories) {
			if (userPreferences[category.key]) {
				const score = this.calculatePatternConfidence(text, titleText, category.patterns);
				const shouldFilter = score.matchCount >= 1; // These can be filtered on single match
				
				results[category.key] = {
					shouldFilter,
					reason: `${category.name} (${score.matchCount} indicators)`,
					confidence: score.confidence
				};
			}
		}

		// Opinion pieces - single match is sufficient
		if (userPreferences.filterOpinions) {
			const opinionMatch = /\b(opinion|editorial|commentary|analysis|op-ed)\b/i.test(text);
			results.opinions = {
				shouldFilter: opinionMatch,
				reason: 'Opinion piece detected',
				confidence: opinionMatch ? 0.9 : 0
			};
		}

		return results;
	}

	/**
	 * Calculate pattern matching confidence with context awareness and performance optimization
	 */
	private calculatePatternConfidence(text: string, titleText: string, patterns: RegExp[]): {
		matchCount: number;
		titleMatches: number;
		confidence: number;
		matchedPatterns: string[];
		uniqueMatches: number;
	} {
		const lowerText = text.toLowerCase();
		const lowerTitle = titleText.toLowerCase();
		const matchedPatterns: string[] = [];
		const uniqueWordMatches = new Set<string>();
		let titleMatches = 0;
		let bodyMatches = 0;
		
		// Pre-compile patterns for better performance with large keyword lists
		const compiledPatterns = patterns.filter(pattern => pattern instanceof RegExp);
		
		for (const pattern of compiledPatterns) {
			try {
				// Check title matches (weighted higher)
				const titleMatch = pattern.exec(lowerTitle);
				if (titleMatch) {
					titleMatches++;
					matchedPatterns.push(titleMatch[0]);
					uniqueWordMatches.add(titleMatch[0].toLowerCase().trim());
				}
				
				// Check body content matches
				const bodyMatch = pattern.exec(lowerText);
				if (bodyMatch && !titleMatch) { // Avoid double counting
					bodyMatches++;
					matchedPatterns.push(bodyMatch[0]);
					uniqueWordMatches.add(bodyMatch[0].toLowerCase().trim());
				}
				
				// For very large texts, limit pattern matching to improve performance
				if (matchedPatterns.length > 20) break;
				
			} catch (error) {
				console.warn('Pattern matching error:', pattern, error);
				continue;
			}
		}
		
		const totalMatches = titleMatches + bodyMatches;
		const uniqueMatches = uniqueWordMatches.size;
		
		// Enhanced confidence calculation
		// Title matches are worth more, unique matches prevent keyword stuffing
		const titleScore = Math.min(titleMatches * 0.3, 0.6); // Cap title influence
		const bodyScore = Math.min(bodyMatches * 0.15, 0.4); // Cap body influence  
		const uniquenessBonus = Math.min(uniqueMatches * 0.1, 0.3); // Reward diverse matches
		const confidence = Math.min(titleScore + bodyScore + uniquenessBonus, 1.0);
		
		return {
			matchCount: totalMatches,
			titleMatches,
			confidence,
			matchedPatterns: matchedPatterns.slice(0, 10), // Limit for performance
			uniqueMatches
		};
	}

	/**
	 * Adaptive sensitivity adjustment based on content characteristics
	 */
	private adjustSensitivityForContent(
		baseSensitivity: 'strict' | 'balanced' | 'loose' | number,
		contentType: 'sports' | 'socialMediaDrama',
		contextStrength: number,
		titleMatches: number,
		uniqueMatches: number
	): number {
		let sensitivity = typeof baseSensitivity === 'number' ? baseSensitivity : 
			baseSensitivity === 'strict' ? 85 : baseSensitivity === 'loose' ? 15 : 50;
		
		// Convert to 0-1 scale for calculations
		let normalizedSensitivity = sensitivity / 100;
		
		if (contentType === 'sports') {
			// Sports content adjustments
			// Lower sensitivity for major sports events (they're newsworthy)
			if (contextStrength >= 0.7 && titleMatches >= 1) {
				normalizedSensitivity *= 0.85; // 15% more lenient
			}
			
			// Higher sensitivity for casual sports mentions
			if (contextStrength <= 0.3 && uniqueMatches <= 2) {
				normalizedSensitivity *= 1.2; // 20% stricter
			}
			
			// Boost sensitivity for repetitive sports keywords (keyword stuffing)
			if (uniqueMatches >= 5 && contextStrength <= 0.4) {
				normalizedSensitivity *= 1.3; // 30% stricter
			}
			
		} else if (contentType === 'socialMediaDrama') {
			// Social media drama adjustments
			// Higher sensitivity for high-drama content (it's often noise)
			if (contextStrength >= 0.8) {
				normalizedSensitivity *= 0.7; // 30% more aggressive filtering
			}
			
			// Lower sensitivity for platform news (business/tech news about platforms)
			if (titleMatches >= 1 && uniqueMatches <= 3 && contextStrength <= 0.4) {
				normalizedSensitivity *= 1.4; // 40% more lenient (less likely to filter)
			}
			
			// Moderate adjustment for medium drama intensity
			if (contextStrength >= 0.4 && contextStrength <= 0.7) {
				normalizedSensitivity *= 0.9; // 10% more aggressive
			}
		}
		
		// Ensure we stay within bounds
		normalizedSensitivity = Math.max(0.05, Math.min(0.95, normalizedSensitivity));
		
		return normalizedSensitivity;
	}
}