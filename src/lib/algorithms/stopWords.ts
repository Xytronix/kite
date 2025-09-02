export const ENGLISH_STOP_WORDS = new Set<string>([
	// Core pronouns
	'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
	'you', 'your', 'yours', 'yourself', 'yourselves',
	'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
	'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',

	// Determiners & conjunctions
	'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while',
	'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through',
	'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
	'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once',

	// Question words & adverbs
	'what', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how',
	'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
	'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',

	// Auxiliary / modal verbs
	'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
	'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
	'can', 'could', 'should', 'would', 'shall', 'will', 'may', 'might', 'must',

	// Misc
	'just', 'don', 'doesn', 'didn', 'won', 'wouldn', 'shouldn', 'couldn', 'isn', 'aren', 'wasn', 'weren', 'hadn', 'hasn', 'haven', 'mightn', 'mustn',

	// Time related
	'year', 'years', 'month', 'months', 'week', 'weeks', 'day', 'days', 'today', 'yesterday', 'tomorrow',

	// Months & weekdays
	'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
	'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',

	// Common website/domain fragments
	'com', 'net', 'org', 'www',

	// Generic / ambiguous nouns & ordinals to avoid as topics
	'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
	'that', 'this', 'these', 'those', 'another', 'other', 'others',
	'million', 'billion', 'percent', 'percentage',
	'agent', 'police', 'company', 'official', 'officials', 'government', 'city', 'cities',
	'country', 'state', 'states', 'people', 'person', 'man', 'woman', 'men', 'women', 'child', 'children',
	'story', 'stories', 'week', 'weeks', 'month', 'months', 'year', 'years',
	'market', 'markets', 'economy', 'economies', 'pilot', 'trade', 'federal',
	'industry', 'industries', 'business', 'businesses', 'company', 'companies',
	'government', 'union', 'party', 'minister', 'court', 'justice', 'judge',
	'police', 'agency', 'agencies', 'department', 'official', 'officials',
	'update', 'media', 'article', 'articles', 'report', 'reports',
]);

// --- Additional minimal stop-word lists ---
const SPANISH_STOP_WORDS = new Set<string>([
    'de','la','que','el','en','y','a','los','del','se','las','por','un','para','con','no','una','su','al','lo','como','más','pero','sus','le','ya','o','este','sí','porque','esta','entre','cuando','muy','sin','sobre','también','me','hasta','hay','donde','quien','desde','todo','nos','durante','todos','uno','les','ni','contra','otros','ese','eso','ante','ellos','e','esto','mí','antes','algunos','qué','unos','yo','otro','otras','otra','él'
]);

const FRENCH_STOP_WORDS = new Set<string>([
    'le','de','un','à','et','les','des','en','du','une','que','qui','dans','la','pour','pas','plus','par','sur','au','se','ce','ne','ses','avec','il','elle','ils','elles','nous','vous','comme','mais','ou','si','leur','lui','tout','tous','sans','cette','ces','été','être','son','sa','est','sont','été','avait','avait','avant','après','aussi'
]);

const GERMAN_STOP_WORDS = new Set<string>([
    'der','die','und','in','den','von','zu','mit','das','auf','sich','des','im','für','ist','dem','nicht','ein','eine','als','auch','es','an','werden','aus','er','hat','dass','sie','nach','wird','bei','einer','um','am','sind','noch','wie','einen','so','zum','war','aber','wir','oder','vor','zur','bis','mehr','durch'
]);

const ITALIAN_STOP_WORDS = new Set<string>([
    'di','e','a','da','in','che','il','la','per','un','del','le','della','con','una','i','dei','si','su','più','non','ma','come','ha','ho','sono','al','dell','gli','anche','delle','tra','suo','dei','dai','dal'
]);

const PORTUGUESE_STOP_WORDS = new Set<string>([
    'de','a','o','que','e','do','da','em','um','para','é','com','não','uma','os','no','se','na','por','mais','as','dos','como','mas','foi','ao','ele','das','tem','à','seu','sua','ou','ser','quando','muito','há','nos','já','está','eu','também','só','pelo','pela','até','isso','ela','entre'
]);

// Map for lookup
export const STOP_WORDS_BY_LANG: Record<string, Set<string>> = {
    en: ENGLISH_STOP_WORDS,
    es: SPANISH_STOP_WORDS,
    fr: FRENCH_STOP_WORDS,
    de: GERMAN_STOP_WORDS,
    it: ITALIAN_STOP_WORDS,
    pt: PORTUGUESE_STOP_WORDS,
};

// Helper to retrieve set for requested language, falling back to English
export function getStopWords(lang: string = 'en'): Set<string> {
    return STOP_WORDS_BY_LANG[lang] ?? ENGLISH_STOP_WORDS;
} 