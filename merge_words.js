'use strict';
const fs = require('fs');

const existing = JSON.parse(fs.readFileSync('./words.json',       'utf8'));
const b2       = JSON.parse(fs.readFileSync('./new_batch2.json',  'utf8'));
const b3       = JSON.parse(fs.readFileSync('./new_batch3.json',  'utf8'));
const b4       = JSON.parse(fs.readFileSync('./new_batch4.json',  'utf8'));

// Deduplicate new batches against existing AND against each other
const existSet = new Set(existing.map(w => w.en.toLowerCase()));
const merged   = [];
const seenNew  = new Set();

for (const w of [...b2, ...b3, ...b4]) {
  const key = w.en.toLowerCase().trim();
  if (existSet.has(key) || seenNew.has(key)) continue;
  seenNew.add(key);
  merged.push(w);
}

// Assign ids and freqRanks sequentially
const startId   = existing.length + 1; // 1501
const newEntries = merged.map((w, i) => ({
  id:       `w${String(startId + i).padStart(4, '0')}`,
  en:       w.en,
  ua:       w.ua,
  pos:      w.pos,
  level:    w.level,
  topic:    w.topic,
  freqRank: startId + i,
}));

const combined = [...existing, ...newEntries];

// Validation report
const byLevel = {}, byPos = {};
newEntries.forEach(w => {
  byLevel[w.level] = (byLevel[w.level] || 0) + 1;
  byPos[w.pos]     = (byPos[w.pos]     || 0) + 1;
});

const allEn = combined.map(w => w.en.toLowerCase());
const uniqueEn = new Set(allEn);

// UA collision check (same ua within same pos+level)
const uaMap = {};
let uaCollisions = 0;
for (const w of combined) {
  const k = `${w.pos}|${w.level}|${w.ua.toLowerCase().trim()}`;
  if (uaMap[k]) { uaCollisions++; }
  else uaMap[k] = w.en;
}

console.log('=== MERGE REPORT ===');
console.log(`Original entries : ${existing.length}`);
console.log(`New entries added: ${newEntries.length}`);
console.log(`Total entries    : ${combined.length}`);
console.log(`Unique EN values : ${uniqueEn.size}`);
console.log(`UA collisions    : ${uaCollisions}`);
console.log('New by level:', byLevel);
console.log('New by pos  :', byPos);

// Write
const out = JSON.stringify(combined, null, 2);
fs.writeFileSync('./words.json', out);
const kb = Buffer.byteLength(out, 'utf8') / 1024;
console.log(`\nWrote words.json — ${(kb).toFixed(1)} KB`);
