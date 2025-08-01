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

function detectDuplicateKeys(raw: string): string[] {
  const duplicates: string[] = [];
  const keyPattern = /"([^"]+)":\s*{/g;
  const keys: string[] = [];
  let match;
  
  while ((match = keyPattern.exec(raw)) !== null) {
    const key = match[1];
    if (keys.includes(key)) {
      if (!duplicates.includes(key)) {
        duplicates.push(key);
      }
    } else {
      keys.push(key);
    }
  }
  
  return duplicates;
}

function removeDuplicateKeys(raw: string): string {
  const duplicates = detectDuplicateKeys(raw);
  if (duplicates.length === 0) {
    return raw;
  }
  
  let result = raw;
  
  for (const duplicateKey of duplicates) {
    // Escape special regex characters in the key
    const escapedKey = duplicateKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // More robust pattern to match complete JSON entries
    // This pattern matches: "key": { ... } including nested objects and proper comma handling
    const keyPattern = new RegExp(
      `"${escapedKey}":\\s*{(?:[^{}]*(?:{[^{}]*}[^{}]*)*)*}(?=\\s*[,}])`,
      'g'
    );
    
    const matches = [...result.matchAll(keyPattern)];
    
    if (matches.length > 1) {
      // Sort matches by their position (reverse order to avoid index shifting issues)
      matches.sort((a, b) => (b.index || 0) - (a.index || 0));
      
      // Keep only the last occurrence (remove all but the last)
      for (let i = 1; i < matches.length; i++) {
        const match = matches[i];
        if (match.index !== undefined) {
          let startIndex = match.index;
          let endIndex = match.index + match[0].length;
          
          // Handle comma removal - check if we need to remove a comma before or after
          const beforeComma = result.slice(Math.max(0, startIndex - 10), startIndex).match(/,\s*$/);
          const afterComma = result.slice(endIndex, endIndex + 10).match(/^\s*,/);
          
          if (beforeComma && !afterComma) {
            // Remove comma before
            startIndex -= beforeComma[0].length;
          } else if (afterComma) {
            // Remove comma after
            endIndex += afterComma[0].length;
          }
          
          result = result.slice(0, startIndex) + result.slice(endIndex);
        }
      }
    }
  }
  
  return result;
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
    let raw = fs.readFileSync(full, 'utf-8');
    
    // Check for and remove duplicate keys
    const duplicates = detectDuplicateKeys(raw);
    if (duplicates.length > 0) {
      console.warn(`${file}: found duplicate keys -> ${duplicates.join(', ')}`);
      raw = removeDuplicateKeys(raw);
      console.log(`${file}: removed duplicate keys`);
    }
    
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