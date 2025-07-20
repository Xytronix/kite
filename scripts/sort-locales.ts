import fs from 'node:fs';
import path from 'node:path';

const LOCALE_DIR = 'src/lib/locales';
const BASE = 'en.json';

function sortObject<T extends Record<string, unknown>>(obj: T): T {
  return Object.keys(obj)
    .sort((a, b) => a.localeCompare(b))
    .reduce((acc, key) => {
      // @ts-expect-error index
      acc[key] = obj[key];
      return acc;
    }, {} as T);
}

function main() {
  const basePath = path.join(LOCALE_DIR, BASE);
  if (!fs.existsSync(basePath)) {
    console.error('Base locale en.json not found');
    return;
  }
  const baseKeys = Object.keys(JSON.parse(fs.readFileSync(basePath, 'utf-8')));

  const files = fs.readdirSync(LOCALE_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const full = path.join(LOCALE_DIR, file);
    const raw = fs.readFileSync(full, 'utf-8');
    const data = JSON.parse(raw);

    // collect diagnostics
    const keys = Object.keys(data);
    const missing = baseKeys.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !baseKeys.includes(k));
    if (missing.length) {
      console.warn(`${file}: missing keys -> ${missing.slice(0,5).join(', ')}${missing.length>5?'…':''}`);
    }
    if (extra.length) {
      console.warn(`${file}: extra keys -> ${extra.slice(0,5).join(', ')}${extra.length>5?'…':''}`);
    }

    const sorted = sortObject(data);
    const newRaw = JSON.stringify(sorted, null, 2) + '\n';
    if (newRaw !== raw) {
      fs.writeFileSync(full, newRaw, 'utf-8');
      console.log(`${file} sorted`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { main(); } catch (e: any) { console.error(e?.message || e); process.exit(1);} } 