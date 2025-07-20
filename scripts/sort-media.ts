import fs from 'node:fs';

const FILE = 'media_data.json';

interface Entry {
  country: string;
  organization: string;
  domains: string[];
  description: string;
  owner: string;
  typology: string;
  [k: string]: unknown;
}

function sortAndUnique(arr: string[]) {
  return [...new Set(arr.map((d) => d.toLowerCase()))].sort();
}

function main() {
  const raw = fs.readFileSync(FILE, 'utf8');
  const data: Entry[] = JSON.parse(raw);

  // process entries
  const processed = data.map((e) => ({
    ...e,
    domains: sortAndUnique(e.domains || []),
  }));

  processed.sort((a, b) => {
    const c = a.country.localeCompare(b.country);
    if (c !== 0) return c;
    return a.organization.localeCompare(b.organization);
  });

  const newRaw = JSON.stringify(processed, null, 2) + '\n';
  if (newRaw !== raw) {
    fs.writeFileSync(FILE, newRaw, 'utf8');
    console.log('media_data.json sorted and deduplicated');
  } else {
    console.log('media_data.json already sorted');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (e: any) {
    console.error(e?.message || e);
    process.exit(1);
  }
} 