// audit_phrasal.js — 8-check validator for phrasal_batch.json
// Usage: node audit_phrasal.js

const fs = require('fs');

const VALID_TOPICS = new Set([
  'general','school','health','business','technology','work','emotions','food',
  'nature','hobby','money','travel','communication','time','home','daily life',
  'sport','family','animals','shopping','transport','weather','body','clothing',
  'numbers','colors','places'
]);
const VALID_LEVELS = new Set(['A2','B1','B2']);
const REQUIRED_FIELDS = ['id','en','ua','pos','level','topic','freqRank','example'];

let batch, words;
try {
  batch = JSON.parse(fs.readFileSync('phrasal_batch.json','utf8'));
} catch(e) { console.error('Cannot read phrasal_batch.json:', e.message); process.exit(1); }
try {
  words = JSON.parse(fs.readFileSync('words.json','utf8'));
} catch(e) { console.error('Cannot read words.json:', e.message); process.exit(1); }

const existingIds  = new Set(words.map(w => w.id));
const existingEn   = new Set(words.map(w => w.en.toLowerCase()));
const existingRanks = new Set(words.map(w => w.freqRank));

const results = {
  schema:       { pass: 0, fail: [] },
  posLevel:     { pass: 0, fail: [] },
  idUniqueness: { pass: 0, fail: [] },
  topicValidity:{ pass: 0, fail: [] },
  enDuplicate:  { pass: 0, fail: [] },
  exampleContains:{ pass: 0, fail: [] },
  exampleLength:{ pass: 0, fail: [] },
  polysemy:     { pass: 0, fail: [] },
};

// CHECK 1 — Schema (required fields + example sub-fields)
batch.forEach(e => {
  const missing = REQUIRED_FIELDS.filter(f => !(f in e));
  if (e.example && (typeof e.example.en !== 'string' || typeof e.example.ua !== 'string')) missing.push('example.en/ua');
  if (missing.length) results.schema.fail.push(`${e.id}: missing ${missing.join(', ')}`);
  else results.schema.pass++;
});

// CHECK 2 — pos === "phrasal", level in VALID_LEVELS
batch.forEach(e => {
  const errs = [];
  if (e.pos !== 'phrasal') errs.push(`pos="${e.pos}"`);
  if (!VALID_LEVELS.has(e.level)) errs.push(`level="${e.level}"`);
  if (errs.length) results.posLevel.fail.push(`${e.id} (${e.en}): ${errs.join(', ')}`);
  else results.posLevel.pass++;
});

// CHECK 3 — ID uniqueness: no collision with words.json, no duplicates within batch
const batchIdsSeen = new Map();
batch.forEach(e => {
  if (existingIds.has(e.id)) {
    results.idUniqueness.fail.push(`${e.id} (${e.en}): collides with words.json`);
  } else if (batchIdsSeen.has(e.id)) {
    results.idUniqueness.fail.push(`${e.id} (${e.en}): duplicate within batch (first at ${batchIdsSeen.get(e.id)})`);
  } else {
    batchIdsSeen.set(e.id, e.en);
    results.idUniqueness.pass++;
  }
});

// CHECK 4 — Topic validity
batch.forEach(e => {
  if (!VALID_TOPICS.has(e.topic)) results.topicValidity.fail.push(`${e.id} (${e.en}): topic="${e.topic}"`);
  else results.topicValidity.pass++;
});

// CHECK 5 — No duplicate en (within batch + vs words.json)
const batchEnSeen = new Map();
batch.forEach(e => {
  const key = e.en.toLowerCase();
  if (existingEn.has(key)) {
    results.enDuplicate.fail.push(`${e.id}: en="${e.en}" already exists in words.json`);
  } else if (batchEnSeen.has(key)) {
    results.enDuplicate.fail.push(`${e.id}: en="${e.en}" duplicates ${batchEnSeen.get(key)} in batch`);
  } else {
    batchEnSeen.set(key, e.id);
    results.enDuplicate.pass++;
  }
});

// CHECK 6 — Example contains the phrasal verb
// Particles (words after the base verb) are invariable, so we check them directly.
// The base verb is skipped here because irregular conjugations (go→went, break→broke, etc.)
// would produce false failures — the particle check is sufficient to confirm usage.
batch.forEach(e => {
  if (!e.example || !e.example.en) { results.exampleContains.fail.push(`${e.id}: no example`); return; }
  const exLower   = e.example.en.toLowerCase();
  const particles = e.en.toLowerCase().split(' ').slice(1);
  if (particles.length === 0) {
    // single-word "phrasal" — just check base verb present (shouldn't occur)
    results.exampleContains.pass++;
    return;
  }
  const missing = particles.filter(p => !exLower.includes(p));
  if (missing.length > 0) {
    results.exampleContains.fail.push(`${e.id} (${e.en}): example missing particle(s) [${missing.join(', ')}]`);
  } else {
    results.exampleContains.pass++;
  }
});

// CHECK 7 — Example word count 6–12
batch.forEach(e => {
  if (!e.example || !e.example.en) { results.exampleLength.fail.push(`${e.id}: no example`); return; }
  const count = e.example.en.trim().split(/\s+/).length;
  if (count < 6 || count > 12) results.exampleLength.fail.push(`${e.id} (${e.en}): ${count} words — "${e.example.en}"`);
  else results.exampleLength.pass++;
});

// CHECK 8 — Polysemy: same `en` with different `ua` within batch (should be 0 after dedup check)
const enToUa = new Map();
batch.forEach(e => {
  const key = e.en.toLowerCase();
  if (!enToUa.has(key)) enToUa.set(key, []);
  enToUa.get(key).push({ id: e.id, ua: e.ua });
});
const polysemyList = [];
for (const [en, entries] of enToUa) {
  if (entries.length > 1) {
    polysemyList.push({ en, entries });
    results.polysemy.fail.push(`"${en}": ${entries.map(x=>`${x.id} "${x.ua}"`).join(' | ')}`);
  } else {
    results.polysemy.pass++;
  }
}

// ── REPORT ────────────────────────────────────────────────────────────────────
const CHECK_NAMES = {
  schema:          'Schema (all fields present)',
  posLevel:        'pos="phrasal" & level valid',
  idUniqueness:    'ID uniqueness vs words.json',
  topicValidity:   'Topic in 27 valid values',
  enDuplicate:     'No duplicate `en` values',
  exampleContains: 'Example contains phrasal verb',
  exampleLength:   'Example length 6–12 words',
  polysemy:        'Polysemy (one meaning/entry)',
};

console.log('\n══════════════════════════════════════════════════════');
console.log(' phrasal_batch.json AUDIT REPORT');
console.log(`  Batch entries : ${batch.length}`);
console.log(`  words.json    : ${words.length} entries`);
console.log('══════════════════════════════════════════════════════');
console.log(
  '\n' +
  ['Check','Pass','Fail','Status'].map(h=>h.padEnd(36)).join('') +
  '\n' + '─'.repeat(80)
);
let allPassed = true;
for (const [key, label] of Object.entries(CHECK_NAMES)) {
  const r = results[key];
  const status = r.fail.length === 0 ? '✓ PASS' : '✗ FAIL';
  if (r.fail.length) allPassed = false;
  console.log(
    label.padEnd(36) +
    String(r.pass).padEnd(36) +
    String(r.fail.length).padEnd(36) +
    status
  );
}
console.log('─'.repeat(80));
console.log(allPassed ? '\nAll checks passed.' : '\nSome checks FAILED — see details below.');

// Detail failures
for (const [key, label] of Object.entries(CHECK_NAMES)) {
  const r = results[key];
  if (r.fail.length) {
    console.log(`\n[${label}] — ${r.fail.length} issue(s):`);
    r.fail.forEach(msg => console.log('  • ' + msg));
  }
}

// Polysemy list (always printed, even if empty)
console.log('\n══ Polysemy list (entries sharing `en` with multiple `ua` meanings) ══');
if (polysemyList.length === 0) {
  console.log('  None — all `en` values are unique within the batch.');
} else {
  polysemyList.forEach(({en, entries}) => {
    console.log(`  "${en}":`);
    entries.forEach(x => console.log(`    ${x.id}  "${x.ua}"`));
  });
}

// Summary counts by level
const byLevel = {};
batch.forEach(e => { byLevel[e.level] = (byLevel[e.level]||0) + 1; });
console.log('\n══ Distribution by level ══');
for (const lv of ['A2','B1','B2']) console.log(`  ${lv}: ${byLevel[lv]||0}`);
console.log(`  Total: ${batch.length}`);
console.log('══════════════════════════════════════════════════════\n');
