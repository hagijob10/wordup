'use strict';
const fs = require('fs');

const words    = JSON.parse(fs.readFileSync('./words.json', 'utf8'));
const idMap    = new Map(words.map((w, i) => [w.id, i]));

let merged = 0, skipped = 0;

for (let b = 0; b <= 9; b++) {
  const path = `./examples_batch_${b}.json`;
  if (!fs.existsSync(path)) { console.log(`MISSING: ${path}`); continue; }
  let batch;
  try {
    batch = JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch(e) {
    console.error(`JSON parse error in ${path}: ${e.message}`);
    continue;
  }
  for (const item of batch) {
    const idx = idMap.get(item.id);
    if (idx === undefined) { skipped++; continue; }
    if (!item.example || !item.example.en || !item.example.ua) { skipped++; continue; }
    words[idx].example = { en: item.example.en, ua: item.example.ua };
    merged++;
  }
}

console.log(`Merged: ${merged}, Skipped: ${skipped}`);
fs.writeFileSync('./words.json', JSON.stringify(words, null, 2));
console.log('words.json updated.');
