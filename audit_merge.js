// audit_merge.js — Full Stage 2 audit of merged words.json
// Usage: node audit_merge.js

const fs = require('fs');

const VALID_TOPICS = new Set([
  'general','school','health','business','technology','work','emotions','food',
  'nature','hobby','money','travel','communication','time','home','daily life',
  'sport','family','animals','shopping','transport','weather','body','clothing',
  'numbers','colors','places'
]);
const VALID_LEVELS      = new Set(['A2','B1','B2']);
const REQUIRED_FIELDS   = ['id','en','ua','pos','level','topic','freqRank','example'];
const RETAG_IDS         = new Set(['w0022','w0375','w0376','w1472']);
const EXPECTED_TOTAL    = 2686;
const EXPECTED_PHRASAL  = 184;

let merged, backup;
try { merged = JSON.parse(fs.readFileSync('words.json','utf8')); }
catch(e) { console.error('Cannot read words.json:', e.message); process.exit(1); }
try { backup = JSON.parse(fs.readFileSync('words.json.bak','utf8')); }
catch(e) { console.error('Cannot read words.json.bak:', e.message); process.exit(1); }

const phrasals    = merged.filter(e => e.pos === 'phrasal');
const nonPhrasals = merged.filter(e => e.pos !== 'phrasal');

// ── STRUCTURAL CHECKS ────────────────────────────────────────────────────────

const structChecks = {
  totalCount:      { label: `Total entries == ${EXPECTED_TOTAL}`,    pass: false, detail: '' },
  phrasalCount:    { label: `Phrasal entries == ${EXPECTED_PHRASAL}`,pass: false, detail: '' },
  idUnique:        { label: 'All IDs unique',                         pass: false, detail: '' },
  idRange:         { label: 'IDs w0001–w2686, no gaps',              pass: false, detail: '' },
  rankUnique:      { label: 'freqRank unique 1–2686, no gaps',       pass: false, detail: '' },
};

// Total count
structChecks.totalCount.pass = (merged.length === EXPECTED_TOTAL);
structChecks.totalCount.detail = `actual: ${merged.length}`;

// Phrasal count
structChecks.phrasalCount.pass = (phrasals.length === EXPECTED_PHRASAL);
structChecks.phrasalCount.detail = `actual: ${phrasals.length}`;

// ID uniqueness
const allIds = merged.map(e => e.id);
const idSet  = new Set(allIds);
const dupIds = allIds.filter((id,i) => allIds.indexOf(id) !== i);
structChecks.idUnique.pass = (idSet.size === merged.length);
structChecks.idUnique.detail = dupIds.length ? `duplicates: ${dupIds.slice(0,5).join(', ')}` : 'no duplicates';

// ID range w0001–w2686, no gaps
const idNums = [...idSet].map(id => parseInt(id.slice(1), 10)).sort((a,b)=>a-b);
const idGaps = [];
for (let i = 1; i <= EXPECTED_TOTAL; i++) { if (!idSet.has('w'+String(i).padStart(4,'0'))) idGaps.push(i); }
structChecks.idRange.pass = (idGaps.length === 0 && idNums[0] === 1 && idNums[idNums.length-1] === EXPECTED_TOTAL);
structChecks.idRange.detail = idGaps.length ? `${idGaps.length} gap(s): first=${idGaps[0]}` : `min=w${String(idNums[0]).padStart(4,'0')} max=w${String(idNums[idNums.length-1]).padStart(4,'0')}`;

// freqRank uniqueness + range 1–2686, no gaps
const allRanks   = merged.map(e => e.freqRank);
const rankSet    = new Set(allRanks);
const rankGaps   = [];
for (let i = 1; i <= EXPECTED_TOTAL; i++) { if (!rankSet.has(i)) rankGaps.push(i); }
const dupRanks   = allRanks.filter((r,i) => allRanks.indexOf(r) !== i);
const rankMin    = Math.min(...allRanks);
const rankMax    = Math.max(...allRanks);
structChecks.rankUnique.pass = (rankGaps.length === 0 && rankSet.size === EXPECTED_TOTAL && rankMin === 1 && rankMax === EXPECTED_TOTAL);
structChecks.rankUnique.detail = rankGaps.length
  ? `${rankGaps.length} gap(s): first=${rankGaps[0]}; dups=${dupRanks.slice(0,3).join(',')}`
  : `min=${rankMin} max=${rankMax} unique=${rankSet.size}`;

// ── PHRASAL-ENTRY CHECKS (checks 1–8 from Stage 1) ──────────────────────────

const phChecks = {
  schema:          { pass: 0, fail: [] },
  posLevel:        { pass: 0, fail: [] },
  topicValidity:   { pass: 0, fail: [] },
  enDuplicate:     { pass: 0, fail: [] },
  exampleContains: { pass: 0, fail: [] },
  exampleLength:   { pass: 0, fail: [] },
};

// Schema
phrasals.forEach(e => {
  const missing = REQUIRED_FIELDS.filter(f => !(f in e));
  if (e.example && (typeof e.example.en !== 'string' || typeof e.example.ua !== 'string')) missing.push('example.en/ua');
  if (missing.length) phChecks.schema.fail.push(`${e.id}: missing ${missing.join(', ')}`);
  else phChecks.schema.pass++;
});

// pos / level
phrasals.forEach(e => {
  const errs = [];
  if (e.pos !== 'phrasal') errs.push(`pos="${e.pos}"`);
  if (!VALID_LEVELS.has(e.level)) errs.push(`level="${e.level}"`);
  if (errs.length) phChecks.posLevel.fail.push(`${e.id} (${e.en}): ${errs.join(', ')}`);
  else phChecks.posLevel.pass++;
});

// Topic validity
phrasals.forEach(e => {
  if (!VALID_TOPICS.has(e.topic)) phChecks.topicValidity.fail.push(`${e.id} (${e.en}): topic="${e.topic}"`);
  else phChecks.topicValidity.pass++;
});

// No duplicate en among phrasals
const phEnSeen = new Map();
phrasals.forEach(e => {
  const key = e.en.toLowerCase();
  if (phEnSeen.has(key)) phChecks.enDuplicate.fail.push(`${e.id}: en="${e.en}" dup of ${phEnSeen.get(key)}`);
  else { phEnSeen.set(key, e.id); phChecks.enDuplicate.pass++; }
});

// Example contains particles
phrasals.forEach(e => {
  if (!e.example || !e.example.en) { phChecks.exampleContains.fail.push(`${e.id}: no example`); return; }
  const exLower   = e.example.en.toLowerCase();
  const particles = e.en.toLowerCase().split(' ').slice(1);
  if (particles.length === 0) { phChecks.exampleContains.pass++; return; }
  const missing = particles.filter(p => !exLower.includes(p));
  if (missing.length > 0) phChecks.exampleContains.fail.push(`${e.id} (${e.en}): missing [${missing.join(', ')}]`);
  else phChecks.exampleContains.pass++;
});

// Example word count 6–12
phrasals.forEach(e => {
  if (!e.example || !e.example.en) { phChecks.exampleLength.fail.push(`${e.id}: no example`); return; }
  const count = e.example.en.trim().split(/\s+/).length;
  if (count < 6 || count > 12) phChecks.exampleLength.fail.push(`${e.id} (${e.en}): ${count} words`);
  else phChecks.exampleLength.pass++;
});

// ── NON-PHRASAL INTEGRITY CHECK ──────────────────────────────────────────────

const integrityFails = [];
const bakMap = new Map(backup.map(e => [e.id, e]));
nonPhrasals.forEach(e => {
  const orig = bakMap.get(e.id);
  if (!orig) { integrityFails.push(`${e.id}: not found in backup`); return; }
  const curr = JSON.stringify(e);
  const bak  = JSON.stringify(orig);
  if (curr !== bak) integrityFails.push(`${e.id} (${e.en}): modified vs backup`);
});
// Also verify the 4 re-tagged entries changed ONLY pos
RETAG_IDS.forEach(id => {
  const curr = merged.find(e => e.id === id);
  const orig = bakMap.get(id);
  if (!curr || !orig) { integrityFails.push(`${id}: missing from merged or backup`); return; }
  const currCopy = { ...curr, pos: orig.pos };
  if (JSON.stringify(currCopy) !== JSON.stringify(orig)) {
    integrityFails.push(`${id} (${curr.en}): re-tagged but other fields changed`);
  } else if (curr.pos !== 'phrasal') {
    integrityFails.push(`${id} (${curr.en}): re-tag missing — pos still "${curr.pos}"`);
  }
});

// ── PRINT REPORT ─────────────────────────────────────────────────────────────

const W1 = 44, W2 = 12, W3 = 12, W4 = 10;
const row = (label, detail, status) =>
  label.padEnd(W1) + detail.padEnd(W2+W3) + status;

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log(' words.json MERGE AUDIT REPORT — Stage 2');
console.log('═══════════════════════════════════════════════════════════════════');

console.log('\n── Structural checks ──────────────────────────────────────────────');
console.log(row('Check','Detail','Status'));
console.log('─'.repeat(W1+W2+W3+W4));
for (const c of Object.values(structChecks)) {
  console.log(row(c.label, c.detail, c.pass ? '✓ PASS' : '✗ FAIL'));
}

console.log('\n── Phrasal-entry checks (all 184 phrasals) ────────────────────────');
const PH_LABELS = {
  schema:          'Schema (required fields)',
  posLevel:        'pos="phrasal" & level valid',
  topicValidity:   'Topic in 27 valid values',
  enDuplicate:     'No duplicate `en` among phrasals',
  exampleContains: 'Example contains particles',
  exampleLength:   'Example length 6–12 words',
};
console.log(['Check'.padEnd(W1),'Pass'.padEnd(W2),'Fail'.padEnd(W3),'Status'].join(''));
console.log('─'.repeat(W1+W2+W3+W4));
for (const [key, label] of Object.entries(PH_LABELS)) {
  const r = phChecks[key];
  console.log(label.padEnd(W1)+String(r.pass).padEnd(W2)+String(r.fail.length).padEnd(W3)+(r.fail.length?'✗ FAIL':'✓ PASS'));
}

console.log('\n── Non-phrasal integrity (2502 entries unchanged) ─────────────────');
const integrityOk = integrityFails.length === 0;
console.log(row('All non-phrasal entries byte-identical to backup',
  integrityOk ? `${nonPhrasals.length} checked` : `${integrityFails.length} diffs`,
  integrityOk ? '✓ PASS' : '✗ FAIL'));
console.log(row('4 re-tagged entries: only pos changed',
  'w0022,w0375,w0376,w1472',
  integrityFails.filter(m=>RETAG_IDS.has(m.slice(0,5))).length===0 ? '✓ PASS':'✗ FAIL'));

// Failures detail
let anyFail = false;
for (const c of Object.values(structChecks)) if (!c.pass) anyFail = true;
for (const r of Object.values(phChecks)) if (r.fail.length) anyFail = true;
if (integrityFails.length) anyFail = true;

if (anyFail) {
  console.log('\n── Failure details ─────────────────────────────────────────────────');
  for (const [key, label] of Object.entries(PH_LABELS)) {
    const r = phChecks[key];
    if (r.fail.length) { console.log(`\n[${label}]:`); r.fail.forEach(m => console.log('  • '+m)); }
  }
  if (integrityFails.length) {
    console.log('\n[Non-phrasal integrity]:');
    integrityFails.forEach(m => console.log('  • '+m));
  }
}

// Re-tagged entries verification
console.log('\n── Re-tagged entries ───────────────────────────────────────────────');
RETAG_IDS.forEach(id => {
  const e = merged.find(x => x.id === id);
  const o = bakMap.get(id);
  if (e && o) console.log(`  ${id}  "${e.en}"  pos: "${o.pos}" → "${e.pos}"`);
});

// Distribution
const byLevel = {};
phrasals.forEach(e => { byLevel[e.level] = (byLevel[e.level]||0)+1; });
console.log('\n── Phrasal distribution by level ───────────────────────────────────');
for (const lv of ['A2','B1','B2','C1','C2']) if (byLevel[lv]) console.log(`  ${lv}: ${byLevel[lv]}`);
console.log(`  Total phrasal: ${phrasals.length}`);

console.log('\n' + (anyFail ? '✗  Audit FAILED — review details above.' : '✓  All checks passed. Merge is clean.'));
console.log('═══════════════════════════════════════════════════════════════════\n');
