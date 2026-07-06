'use strict';
const fs = require('fs');

const words = JSON.parse(fs.readFileSync('./words.json', 'utf8'));
const MIN_WORDS = 4, MAX_WORDS = 14;

let missing = 0, badLen = 0, noMatch = 0, ok = 0;
const failures = [];

for (const w of words) {
  if (!w.example || !w.example.en || !w.example.ua) {
    missing++;
    failures.push({ id: w.id, en: w.en, issue: 'missing example' });
    continue;
  }
  const sentWords = w.example.en.trim().split(/\s+/).length;
  if (sentWords < MIN_WORDS || sentWords > MAX_WORDS) {
    badLen++;
    failures.push({ id: w.id, en: w.en, issue: `bad length ${sentWords} words`, sentence: w.example.en });
    continue;
  }
  // Stem match: check if sentence contains the target word or its inflected form
  const target = w.en.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stem   = w.en.length > 4
    ? w.en.slice(0, Math.max(4, Math.floor(w.en.length * 0.7))).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    : target;
  const pattern = new RegExp(`\\b(${target}|${stem})\\w*`, 'i');
  if (!pattern.test(w.example.en)) {
    noMatch++;
    failures.push({ id: w.id, en: w.en, issue: 'word not found in sentence', sentence: w.example.en });
    continue;
  }
  ok++;
}

const total = words.length;
console.log(`\n=== EXAMPLE VALIDATION ===`);
console.log(`Total entries : ${total}`);
console.log(`OK            : ${ok}`);
console.log(`Missing       : ${missing}`);
console.log(`Bad length    : ${badLen}`);
console.log(`No word match : ${noMatch}`);
console.log(`Pass rate     : ${(ok/total*100).toFixed(1)}%`);

if (failures.length > 0) {
  console.log(`\nFirst 20 failures:`);
  failures.slice(0, 20).forEach(f => console.log(`  ${f.id} [${f.en}] — ${f.issue}` + (f.sentence ? ` | "${f.sentence}"` : '')));
}

process.exit(failures.length === 0 ? 0 : 1);
