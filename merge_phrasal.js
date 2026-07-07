// merge_phrasal.js — Stage 2 merge script
// 1. Backup words.json → words.json.bak
// 2. Re-tag 4 entries to pos "phrasal"
// 3. Append 180 entries from phrasal_batch.json
// 4. Write merged words.json

const fs = require('fs');

const RETAG_IDS = new Set(['w0022','w0375','w0376','w1472']);

let words, batch;
try { words = JSON.parse(fs.readFileSync('words.json','utf8')); }
catch(e) { console.error('Cannot read words.json:', e.message); process.exit(1); }
try { batch = JSON.parse(fs.readFileSync('phrasal_batch.json','utf8')); }
catch(e) { console.error('Cannot read phrasal_batch.json:', e.message); process.exit(1); }

// Step 1 — backup
fs.copyFileSync('words.json', 'words.json.bak');
console.log('Backup written: words.json.bak');

// Step 2 — re-tag
let retagged = 0;
const merged = words.map(entry => {
  if (RETAG_IDS.has(entry.id)) {
    retagged++;
    return { ...entry, pos: 'phrasal' };
  }
  return entry;
});
if (retagged !== 4) {
  console.error(`Expected to re-tag 4 entries, but re-tagged ${retagged}. Aborting.`);
  process.exit(1);
}
console.log(`Re-tagged: ${retagged} entries`);

// Step 3 — append batch
const final = merged.concat(batch);
console.log(`Merged total: ${final.length} entries`);

// Step 4 — write
fs.writeFileSync('words.json', JSON.stringify(final, null, 2), 'utf8');
console.log('words.json written successfully.');
