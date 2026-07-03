'use strict';
const fs = require('fs');

const raw = fs.readFileSync('./words.json', 'utf8');
const words = JSON.parse(raw);

console.log(`\n=== 1. ENTRY COUNT ===`);
console.log(`Total entries: ${words.length}`);

// ── ID uniqueness ──────────────────────────────────────────────────────────
console.log(`\n=== 2. ID VALIDATION ===`);
const ids = words.map(w => w.id);
const idSet = new Set(ids);
const nums = ids.map(id => parseInt(id.slice(1)));
console.log(`Unique ids    : ${idSet.size}`);
console.log(`Min id        : ${ids[nums.indexOf(Math.min(...nums))]}`);
console.log(`Max id        : ${ids[nums.indexOf(Math.max(...nums))]}`);
if (idSet.size !== words.length) {
  const seen = new Set();
  ids.forEach(id => { if (seen.has(id)) console.log('  DUPLICATE:', id); else seen.add(id); });
}

// ── freqRank uniqueness ────────────────────────────────────────────────────
console.log(`\n=== 3. FREQRANK VALIDATION ===`);
const ranks = words.map(w => w.freqRank);
const rankSet = new Set(ranks);
console.log(`Unique freqRanks: ${rankSet.size}`);
console.log(`Min freqRank    : ${Math.min(...ranks)}`);
console.log(`Max freqRank    : ${Math.max(...ranks)}`);
if (rankSet.size !== words.length) {
  const seen = new Set();
  ranks.forEach((r,i) => { if (seen.has(r)) console.log('  DUPLICATE rank:', r, 'at', words[i].id); else seen.add(r); });
}

// ── Schema validation ──────────────────────────────────────────────────────
console.log(`\n=== 4. SCHEMA VALIDATION ===`);
const VALID_LEVELS = new Set(['A2','B1','B2']);
const VALID_POS    = new Set(['noun','verb','adjective','adverb','number','conjunction','preposition']);
const FIELDS       = ['id','en','ua','pos','level','topic','freqRank'];
let schemaErrors = 0;
words.forEach(w => {
  const missing = FIELDS.filter(f => w[f] === undefined || w[f] === null || w[f] === '');
  if (missing.length)      { console.log(`  MISSING fields [${missing}] at ${w.id}`); schemaErrors++; }
  if (typeof w.id       !== 'string')  { console.log(`  BAD id type at`, w.id); schemaErrors++; }
  if (typeof w.en       !== 'string')  { console.log(`  BAD en type at`, w.id); schemaErrors++; }
  if (typeof w.ua       !== 'string')  { console.log(`  BAD ua type at`, w.id); schemaErrors++; }
  if (typeof w.pos      !== 'string')  { console.log(`  BAD pos type at`, w.id); schemaErrors++; }
  if (typeof w.level    !== 'string')  { console.log(`  BAD level type at`, w.id); schemaErrors++; }
  if (typeof w.topic    !== 'string')  { console.log(`  BAD topic type at`, w.id); schemaErrors++; }
  if (typeof w.freqRank !== 'number')  { console.log(`  BAD freqRank type at`, w.id); schemaErrors++; }
  if (!VALID_LEVELS.has(w.level))      { console.log(`  BAD level "${w.level}" at ${w.id}`); schemaErrors++; }
  if (!VALID_POS.has(w.pos))           { console.log(`  BAD pos "${w.pos}" at ${w.id}`); schemaErrors++; }
});
console.log(schemaErrors === 0 ? 'All entries pass schema validation.' : `Schema errors: ${schemaErrors}`);

// ── Level / pos distribution ───────────────────────────────────────────────
console.log(`\n=== 5. DISTRIBUTION (new entries id>w1500) ===`);
const newW = words.filter(w => parseInt(w.id.slice(1)) > 1500);
const byLP = {};
newW.forEach(w => {
  const k = `${w.level}|${w.pos}`;
  byLP[k] = (byLP[k]||0)+1;
});
const levels = ['A2','B1','B2'];
const poses  = ['noun','verb','adjective','adverb'];
const header = 'level      ' + poses.map(p=>p.padEnd(12)).join('') + 'total';
console.log(header);
levels.forEach(lv => {
  let row = lv.padEnd(11);
  let tot = 0;
  poses.forEach(p => { const n=byLP[`${lv}|${p}`]||0; row+=String(n).padEnd(12); tot+=n; });
  // any other pos
  const otherP = Object.keys(byLP).filter(k=>k.startsWith(lv+'|') && !poses.includes(k.split('|')[1]));
  otherP.forEach(k=>tot+=byLP[k]||0);
  console.log(row + tot);
});

// ── Random sample of 35 new entries ───────────────────────────────────────
console.log(`\n=== 6. RANDOM SAMPLE — 35 NEW ENTRIES ===`);
const shuffled = [...newW].sort(() => Math.random() - 0.5).slice(0, 35);
shuffled.sort((a,b) => a.level.localeCompare(b.level) || a.pos.localeCompare(b.pos));
shuffled.forEach(w => {
  console.log(`  ${w.id}  ${w.en.padEnd(30)} — ${w.ua.padEnd(35)} (${w.pos}, ${w.level})`);
});
