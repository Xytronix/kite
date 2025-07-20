import fs from 'node:fs';

const FEEDS_FILE = 'kite_feeds.json';

type CategoryType = 'country' | 'region' | 'city' | 'topic' | string;

interface CategoryData {
  category_type?: CategoryType;
  source_language?: string;
  display_names?: Record<string, string>;
  feeds: string[];
  [k: string]: unknown;
}

interface FeedsJson {
  [categoryName: string]: CategoryData;
}

// Desired order of types
const CATEGORY_TYPE_ORDER: CategoryType[] = ['country', 'region', 'city', 'topic'];

function getCategoryType(cat: CategoryData): CategoryType {
  return cat.category_type ?? 'topic';
}

function typeRank(type: CategoryType): number {
  const idx = CATEGORY_TYPE_ORDER.indexOf(type);
  return idx === -1 ? CATEGORY_TYPE_ORDER.length : idx;
}

function sortCategories(data: FeedsJson): [string, CategoryData][] {
  return Object.entries(data).sort(([aName, aData], [bName, bData]) => {
    const rankDiff = typeRank(getCategoryType(aData)) - typeRank(getCategoryType(bData));
    if (rankDiff !== 0) return rankDiff;
    return aName.localeCompare(bName);
  });
}

function dedupeAndSort(urls: string[]): string[] {
  return [...new Set(urls)].sort((a, b) => a.localeCompare(b));
}

function main() {
  console.log('📄 Reading', FEEDS_FILE);
  const raw = fs.readFileSync(FEEDS_FILE, 'utf-8');
  const json: FeedsJson = JSON.parse(raw);

  const out: FeedsJson = {};
  let totalDupes = 0;

  const sortedCats = sortCategories(json);
  for (const [name, cat] of sortedCats) {
    const original = cat.feeds.length;
    const feeds = dedupeAndSort(cat.feeds);
    const dupes = original - feeds.length;
    totalDupes += dupes;
    if (dupes) console.log(`  🔹 ${name}: removed ${dupes} duplicate feed(s)`);
    out[name] = { ...cat, feeds };
  }

  const newRaw = JSON.stringify(out, null, 2) + '\n';
  if (newRaw !== raw) {
    fs.writeFileSync(FEEDS_FILE, newRaw, 'utf-8');
    console.log('✅', FEEDS_FILE, 'sorted. Duplicates removed:', totalDupes);
  } else {
    console.log('⚖️  No changes – already sorted');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (e: any) {
    console.error('❌ Error:', e?.message || e);
    process.exit(1);
  }
} 