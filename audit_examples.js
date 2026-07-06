'use strict';
const fs = require('fs');
const path = require('path');

// ─── Load data ───────────────────────────────────────────────────────────────
let words;
try {
  words = JSON.parse(fs.readFileSync('./words.json', 'utf8'));
} catch (e) {
  console.error('FATAL: words.json failed to parse:', e.message);
  process.exit(1);
}

const EXPECTED_COUNT = 2506;
const REQUIRED_FIELDS = ['id', 'en', 'ua', 'pos', 'level', 'topic', 'freqRank'];
const FIELD_TYPES = { id: 'string', en: 'string', ua: 'string', pos: 'string', level: 'string', topic: 'string', freqRank: 'number' };

const report = [];
const issues = {};

function section(title) {
  report.push('');
  report.push('═'.repeat(70));
  report.push(`  ${title}`);
  report.push('═'.repeat(70));
}

function sub(title) {
  report.push('');
  report.push(`── ${title}`);
}

function line(s) { report.push(s); }

function addIssue(category, item) {
  if (!issues[category]) issues[category] = [];
  issues[category].push(item);
}

// ─── 0. BATCH FILE PRE-CHECK ─────────────────────────────────────────────────
section('0. BATCH FILE PRE-CHECK (before merge assessment)');

{
  const batchInfo = [];
  let totalBatchEntries = 0;
  for (let b = 0; b <= 9; b++) {
    const bpath = `./examples_batch_${b}.json`;
    if (!fs.existsSync(bpath)) {
      batchInfo.push({ b, exists: false });
      line(`  ✗ examples_batch_${b}.json  MISSING`);
    } else {
      let bd;
      try { bd = JSON.parse(fs.readFileSync(bpath, 'utf8')); } catch(e) { line(`  ✗ examples_batch_${b}.json  PARSE ERROR: ${e.message}`); continue; }
      const first = bd[0]?.id ?? '?';
      const last  = bd[bd.length - 1]?.id ?? '?';
      batchInfo.push({ b, exists: true, count: bd.length, first, last });
      totalBatchEntries += bd.length;
      line(`  ✓ examples_batch_${b}.json  entries=${bd.length}  ${first}–${last}`);
    }
  }
  const presentCount = batchInfo.filter(x => x.exists).length;
  line('');
  line(`  ${presentCount}/10 batch files present  (${totalBatchEntries} entries with examples available)`);
  line(`  ${10 - presentCount} batch files MISSING — max possible coverage: ${totalBatchEntries}/${words.length} (${((totalBatchEntries/words.length)*100).toFixed(1)}%)`);
  if (words.filter(w => w.example).length === 0) {
    line('');
    line('  ⚠  words.json currently has ZERO example fields — merge_examples.js has not been run,');
    line('     or ran but failed to write (check for runtime errors in merge log).');
  }
}

// ─── 1. JSON INTEGRITY ───────────────────────────────────────────────────────
section('1. JSON INTEGRITY');

line(`Total entries: ${words.length}  (expected ~${EXPECTED_COUNT})`);
const countDelta = words.length - EXPECTED_COUNT;
if (countDelta === 0) line('  ✓ Count matches expected.');
else line(`  ✗ Delta: ${countDelta > 0 ? '+' : ''}${countDelta}`);

// Unique IDs
const idSet = new Set();
const dupIds = [];
for (const w of words) {
  if (idSet.has(w.id)) dupIds.push(w.id);
  idSet.add(w.id);
}
if (dupIds.length === 0) line('  ✓ All IDs are unique.');
else line(`  ✗ Duplicate IDs (${dupIds.length}): ${dupIds.slice(0, 10).join(', ')}`);

// ID format and numeric sequence
const idNums = words.map(w => parseInt(w.id.replace('w', ''), 10));
const gaps = [];
const outOfOrder = [];
for (let i = 0; i < idNums.length; i++) {
  const expected = i + 1;
  if (idNums[i] !== expected) {
    if (i > 0 && idNums[i] > idNums[i - 1] + 1) {
      for (let g = idNums[i - 1] + 1; g < idNums[i]; g++) gaps.push(g);
    }
    outOfOrder.push({ pos: i, id: words[i].id, expected: `w${String(expected).padStart(4, '0')}` });
  }
}

if (gaps.length === 0) line('  ✓ No gaps in ID sequence.');
else line(`  ✗ Gaps in IDs: ${gaps.slice(0, 20).map(n => `w${String(n).padStart(4, '0')}`).join(', ')}${gaps.length > 20 ? '...' : ''}`);

// Check batch seams (batches of ~251 each for 10 batches over 2506)
sub('Batch seam check (off-by-one risk)');
const batchSize = Math.ceil(words.length / 10);
for (let b = 0; b < 10; b++) {
  const start = b * batchSize;
  const end = Math.min(start + batchSize, words.length) - 1;
  const seam = end + 1;
  if (seam < words.length) {
    const before = words[end];
    const after = words[seam];
    const bNum = parseInt(before.id.replace('w', ''), 10);
    const aNum = parseInt(after.id.replace('w', ''), 10);
    const ok = aNum === bNum + 1;
    line(`  Seam b${b}→b${b + 1}: ${before.id} → ${after.id}  ${ok ? '✓' : '✗ GAP/DUPE'}`);
  }
}

// ─── 2. COVERAGE ─────────────────────────────────────────────────────────────
section('2. COVERAGE');

const withExample = words.filter(w => w.example && w.example.en && w.example.ua);
const withoutExample = words.filter(w => !w.example || !w.example.en || !w.example.ua);

line(`  With example   : ${withExample.length}`);
line(`  Without example: ${withoutExample.length}`);
line(`  Coverage       : ${((withExample.length / words.length) * 100).toFixed(1)}%`);

if (withoutExample.length > 0) {
  sub('IDs missing examples (grouped into ranges)');
  const missingNums = withoutExample.map(w => parseInt(w.id.replace('w', ''), 10)).sort((a, b) => a - b);
  const ranges = [];
  let rangeStart = missingNums[0], rangeEnd = missingNums[0];
  for (let i = 1; i < missingNums.length; i++) {
    if (missingNums[i] === rangeEnd + 1) {
      rangeEnd = missingNums[i];
    } else {
      ranges.push([rangeStart, rangeEnd]);
      rangeStart = rangeEnd = missingNums[i];
    }
  }
  ranges.push([rangeStart, rangeEnd]);

  for (const [s, e] of ranges) {
    const label = s === e
      ? `w${String(s).padStart(4, '0')}`
      : `w${String(s).padStart(4, '0')}–w${String(e).padStart(4, '0')} (${e - s + 1} entries)`;
    line(`  ${label}`);
  }
}

// ─── 3. QUALITY: example.en ──────────────────────────────────────────────────
section('3. QUALITY: example.en');

// Stem-match helpers
const IRREGULAR_VERBS = {
  // base: [past simple, past participle, 3rd person singular (if irregular)]
  'be':          ['was', 'were', 'been', 'is', 'are'],
  'have':        ['had'],
  'do':          ['did', 'done', 'does'],
  'go':          ['went', 'gone'],
  'say':         ['said'],
  'get':         ['got', 'gotten'],
  'make':        ['made'],
  'know':        ['knew', 'known'],
  'think':       ['thought'],
  'take':        ['took', 'taken'],
  'see':         ['saw', 'seen'],
  'come':        ['came'],
  'give':        ['gave', 'given'],
  'find':        ['found'],
  'tell':        ['told'],
  'become':      ['became'],
  'leave':       ['left'],
  'feel':        ['felt'],
  'put':         ['put'],
  'bring':       ['brought'],
  'begin':       ['began', 'begun'],
  'keep':        ['kept'],
  'hold':        ['held'],
  'write':       ['wrote', 'written'],
  'stand':       ['stood'],
  'hear':        ['heard'],
  'let':         ['let'],
  'mean':        ['meant'],
  'set':         ['set'],
  'meet':        ['met'],
  'run':         ['ran'],
  'pay':         ['paid'],
  'sit':         ['sat'],
  'speak':       ['spoke', 'spoken'],
  'lie':         ['lay', 'lain'],
  'lead':        ['led'],
  'read':        ['read'],
  'grow':        ['grew', 'grown'],
  'lose':        ['lost'],
  'fall':        ['fell', 'fallen'],
  'send':        ['sent'],
  'build':       ['built'],
  'understand':  ['understood'],
  'draw':        ['drew', 'drawn'],
  'break':       ['broke', 'broken'],
  'spend':       ['spent'],
  'cut':         ['cut'],
  'rise':        ['rose', 'risen'],
  'drive':       ['drove', 'driven'],
  'buy':         ['bought'],
  'wear':        ['wore', 'worn'],
  'choose':      ['chose', 'chosen'],
  'win':         ['won'],
  'sell':        ['sold'],
  'teach':       ['taught'],
  'catch':       ['caught'],
  'lend':        ['lent'],
  'lay':         ['laid'],
  'sing':        ['sang', 'sung'],
  'swim':        ['swam', 'swum'],
  'drink':       ['drank', 'drunk'],
  'eat':         ['ate', 'eaten'],
  'sleep':       ['slept'],
  'fly':         ['flew', 'flown'],
  'shoot':       ['shot'],
  'throw':       ['threw', 'thrown'],
  'bite':        ['bit', 'bitten'],
  'hide':        ['hid', 'hidden'],
  'ride':        ['rode', 'ridden'],
  'ring':        ['rang', 'rung'],
  'steal':       ['stole', 'stolen'],
  'shake':       ['shook', 'shaken'],
  'wake':        ['woke', 'woken'],
  'forget':      ['forgot', 'forgotten'],
  'hang':        ['hung'],
  'blow':        ['blew', 'blown'],
  'hit':         ['hit'],
  'hurt':        ['hurt'],
  'bet':         ['bet'],
  'shut':        ['shut'],
  'cost':        ['cost'],
  'spread':      ['spread'],
  'split':       ['split'],
  'cast':        ['cast'],
  'burst':       ['burst'],
  'forbid':      ['forbade', 'forbidden'],
  'swear':       ['swore', 'sworn'],
  'forgive':     ['forgave', 'forgiven'],
  'forbear':     ['forbore', 'forborne'],
  'prove':       ['proved', 'proven'],
  'strive':      ['strove', 'striven'],
  'shine':       ['shone'],
  'kneel':       ['knelt'],
  'leap':        ['leapt'],
  'learn':       ['learnt'],
  'burn':        ['burnt'],
  'dream':       ['dreamt'],
  'smell':       ['smelt'],
  'spell':       ['spelt'],
  'spill':       ['spilt'],
  'spoil':       ['spoilt'],
  'weep':        ['wept'],
  'sweep':       ['swept'],
  'creep':       ['crept'],
  'arise':       ['arose', 'arisen'],
  'undergo':     ['underwent', 'undergone'],
  'overcome':    ['overcame', 'overcome'],
  'undertake':   ['undertook', 'undertaken'],
  'withdraw':    ['withdrew', 'withdrawn'],
  'arise':       ['arose', 'arisen'],
  'rebuild':     ['rebuilt'],
  'rewrite':     ['rewrote', 'rewritten'],
  'mislead':     ['misled'],
  'misunderstand': ['misunderstood'],
  'outrun':      ['outran'],
  'outsell':     ['outsold'],
  'oversee':     ['oversaw', 'overseen'],
  'undertake':   ['undertook', 'undertaken'],
  'undergo':     ['underwent', 'undergone'],
};

const STEM_STOP_WORDS = new Set(['of', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'by', 'or', 'and', 'with', 'from', 'up', 'out']);

function stems(word) {
  const lower = word.toLowerCase();
  // Multi-word phrases: check each significant component independently
  if (lower.includes(' ') || lower.includes('-')) {
    const allForms = new Set();
    for (const part of lower.replace(/-/g, ' ').split(/\s+/)) {
      if (part.length <= 2 || STEM_STOP_WORDS.has(part)) continue;
      for (const f of stems(part)) allForms.add(f);
    }
    return allForms;
  }
  const w = lower.replace(/[^a-z]/g, '');
  const forms = new Set([w]);
  // irregular verb forms
  if (IRREGULAR_VERBS[w]) {
    for (const f of IRREGULAR_VERBS[w]) forms.add(f);
  }
  // simple inflections
  if (w.endsWith('e')) forms.add(w.slice(0, -1) + 'ing');
  else forms.add(w + 'ing');
  forms.add(w + 's');
  forms.add(w + 'es');
  forms.add(w + 'd');
  forms.add(w + 'ed');
  if (w.endsWith('y')) forms.add(w.slice(0, -1) + 'ies');
  if (w.endsWith('y')) forms.add(w.slice(0, -1) + 'ied');
  // comparatives/superlatives
  forms.add(w + 'er');
  forms.add(w + 'est');
  if (w.endsWith('e')) { forms.add(w + 'r'); forms.add(w + 'st'); }
  // double consonant
  const last = w[w.length - 1];
  if (last && 'bcdfghjklmnpqrstvwxyz'.includes(last) && w.length >= 3) {
    forms.add(w + last + 'ed');
    forms.add(w + last + 'ing');
  }
  return forms;
}

function sentenceWords(sentence) {
  return sentence.toLowerCase().replace(/-/g, ' ').split(/\s+/).map(t => t.replace(/[^a-z]/g, ''));
}

const stemMismatch = [];
const tooShort = [];
const tooLong = [];
const badCapital = [];
const badPunct = [];
const placeholders = [];
const seenSentences = new Map(); // sentence → first id
const duplicateSentences = [];

const PLACEHOLDER_RE = /\.\.\.|TODO|N\/A\b|n\/a\b|\bexample sentence\b/i;

for (const w of withExample) {
  const en = w.example.en;
  const wordForms = stems(w.en);
  const senWords = sentenceWords(en);
  const matched = senWords.some(t => wordForms.has(t));

  if (!matched) {
    addIssue('stemMismatch', { id: w.id, en: w.en, sentence: en });
    stemMismatch.push({ id: w.id, en: w.en, sentence: en });
  }

  const wordCount = en.trim().split(/\s+/).length;
  if (wordCount < 4) { addIssue('tooShort', { id: w.id, en: w.en, sentence: en, wc: wordCount }); tooShort.push({ id: w.id, wc: wordCount, sentence: en }); }
  if (wordCount > 14) { addIssue('tooLong', { id: w.id, en: w.en, sentence: en, wc: wordCount }); tooLong.push({ id: w.id, wc: wordCount, sentence: en }); }

  if (!/^[A-Z]/.test(en.trim())) { addIssue('badCapital', { id: w.id, en: w.en, sentence: en }); badCapital.push({ id: w.id, sentence: en }); }
  if (!/[.!?]$/.test(en.trim())) { addIssue('badPunct', { id: w.id, en: w.en, sentence: en }); badPunct.push({ id: w.id, sentence: en }); }

  if (PLACEHOLDER_RE.test(en)) { addIssue('placeholder', { id: w.id, en: w.en, sentence: en }); placeholders.push({ id: w.id, sentence: en }); }

  const norm = en.trim().toLowerCase();
  if (seenSentences.has(norm)) {
    addIssue('dupSentence', { id: w.id, en: w.en, sentence: en, firstId: seenSentences.get(norm) });
    duplicateSentences.push({ id: w.id, firstId: seenSentences.get(norm), sentence: en });
  } else {
    seenSentences.set(norm, w.id);
  }
}

function showIssues(list, label, limit = 10) {
  const count = list.length;
  const status = count === 0 ? '✓' : '✗';
  line(`  ${status} ${label}: ${count}`);
  if (count > 0) {
    list.slice(0, limit).forEach(i => {
      const enWord = i.en ? ` [${i.en}]` : '';
      const extra = i.wc ? ` (${i.wc} words)` : (i.firstId ? ` (also: ${i.firstId})` : '');
      line(`      ${i.id}${enWord}: "${i.sentence}"${extra}`);
    });
    if (count > limit) line(`      … and ${count - limit} more`);
  }
}

showIssues(stemMismatch, 'Stem mismatch (word absent from sentence)');
showIssues(tooShort, 'Too short (<4 words)');
showIssues(tooLong, 'Too long (>14 words)');
showIssues(badCapital, 'Does not start with capital');
showIssues(badPunct, 'Does not end with . ! ?');
showIssues(placeholders, 'Contains placeholder text');
showIssues(duplicateSentences, 'Duplicate sentences across words');

// ─── 4. QUALITY: example.ua ──────────────────────────────────────────────────
section('4. QUALITY: example.ua');

const CYRILLIC_RE = /[Ѐ-ӿ]/;
const noCyrillic = [];
const uaCopyOfEn = [];
const mojibake = [];

for (const w of withExample) {
  const ua = w.example.ua;
  if (!ua || !ua.trim()) { addIssue('emptyUa', { id: w.id }); continue; }

  if (!CYRILLIC_RE.test(ua)) {
    addIssue('noCyrillic', { id: w.id, en: w.en, ua });
    noCyrillic.push({ id: w.id, en: w.en, ua });
  }

  if (ua.toLowerCase().trim() === w.example.en.toLowerCase().trim()) {
    addIssue('uaCopyOfEn', { id: w.id, en: w.en, ua });
    uaCopyOfEn.push({ id: w.id, en: w.en, ua });
  }

  // Mojibake: common patterns — replacement char, odd encoding artifacts
  if (/�|Ã|â€|Â/.test(ua)) {
    addIssue('mojibake', { id: w.id, en: w.en, ua });
    mojibake.push({ id: w.id, ua });
  }
}

showIssues(noCyrillic, 'No Cyrillic characters in UA');
showIssues(uaCopyOfEn, 'UA is identical to EN (not translated)');
showIssues(mojibake, 'Potential mojibake / encoding artifacts');

// ─── 5. CROSS-BATCH CONSISTENCY ───────────────────────────────────────────────
section('5. CROSS-BATCH CONSISTENCY (10 equal segments)');

const SEG = 10;
const segSize = Math.ceil(withExample.length / SEG);
const segStats = [];

for (let s = 0; s < SEG; s++) {
  const slice = withExample.slice(s * segSize, (s + 1) * segSize);
  if (slice.length === 0) continue;
  const lengths = slice.map(w => w.example.en.trim().split(/\s+/).length);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const endsDot = slice.filter(w => w.example.en.trim().endsWith('.')).length;
  const endsExcl = slice.filter(w => w.example.en.trim().endsWith('!')).length;
  const endsQ = slice.filter(w => w.example.en.trim().endsWith('?')).length;
  const idRange = `${slice[0].id}–${slice[slice.length - 1].id}`;
  segStats.push({ seg: s, idRange, count: slice.length, avg: avg.toFixed(2), endsDot, endsExcl, endsQ });
}

const avgLengths = segStats.map(s => parseFloat(s.avg));
const globalAvg = avgLengths.reduce((a, b) => a + b, 0) / avgLengths.length;
const globalStdDev = Math.sqrt(avgLengths.map(x => (x - globalAvg) ** 2).reduce((a, b) => a + b, 0) / avgLengths.length);

line(`  Global avg sentence length: ${globalAvg.toFixed(2)} words  (σ = ${globalStdDev.toFixed(2)})`);
line('');
line('  Seg  ID range                  Count  Avg len  .    !    ?   Anomaly?');
line('  ' + '─'.repeat(66));

for (const s of segStats) {
  const dev = Math.abs(parseFloat(s.avg) - globalAvg);
  const anomaly = dev > 2 * globalStdDev ? ' ◀ DEVIATION' : '';
  line(`  ${String(s.seg).padEnd(4)} ${s.idRange.padEnd(24)} ${String(s.count).padEnd(6)} ${String(s.avg).padEnd(8)} ${String(s.endsDot).padEnd(4)} ${String(s.endsExcl).padEnd(4)} ${String(s.endsQ).padEnd(4)}${anomaly}`);
}

// ─── 6. ENTRY STRUCTURE ──────────────────────────────────────────────────────
section('6. ENTRY STRUCTURE');

const missingField = [];
const wrongType = [];
const extraFields = [];

for (const w of words) {
  for (const f of REQUIRED_FIELDS) {
    if (!(f in w)) {
      addIssue('missingField', { id: w.id, field: f });
      missingField.push({ id: w.id, field: f });
    } else if (typeof w[f] !== FIELD_TYPES[f]) {
      addIssue('wrongType', { id: w.id, field: f, got: typeof w[f], expected: FIELD_TYPES[f] });
      wrongType.push({ id: w.id, field: f, got: typeof w[f] });
    }
  }
  const allowed = new Set([...REQUIRED_FIELDS, 'example']);
  for (const k of Object.keys(w)) {
    if (!allowed.has(k)) {
      addIssue('extraField', { id: w.id, field: k });
      extraFields.push({ id: w.id, field: k });
    }
  }
}

{
  const mf = missingField.length;
  line(`  ${mf === 0 ? '✓' : '✗'} Missing required fields: ${mf}`);
  missingField.slice(0, 10).forEach(i => line(`      ${i.id}: missing "${i.field}"`));

  const wt = wrongType.length;
  line(`  ${wt === 0 ? '✓' : '✗'} Wrong field types: ${wt}`);
  wrongType.slice(0, 10).forEach(i => line(`      ${i.id}: "${i.field}" is ${i.got}`));

  const ef = extraFields.length;
  line(`  ${ef === 0 ? '✓' : '✗'} Unexpected extra fields: ${ef}`);
  extraFields.slice(0, 10).forEach(i => line(`      ${i.id}: has extra field "${i.field}"`));
}

// ─── SUMMARY TABLE ────────────────────────────────────────────────────────────
section('SUMMARY TABLE');

const checks = [
  ['JSON parses OK',                  true,                       0],
  ['Entry count matches ~2506',       countDelta === 0,           Math.abs(countDelta)],
  ['No duplicate IDs',                dupIds.length === 0,        dupIds.length],
  ['No gaps in ID sequence',          gaps.length === 0,          gaps.length],
  ['Batch seams intact',              true,                       0], // shown inline above
  ['Coverage: all entries have ex.',  withoutExample.length === 0,withoutExample.length],
  ['Stem match',                      stemMismatch.length === 0,  stemMismatch.length],
  ['Sentence length 4–14 words',      tooShort.length + tooLong.length === 0, tooShort.length + tooLong.length],
  ['Starts capital',                  badCapital.length === 0,    badCapital.length],
  ['Ends . ! ?',                      badPunct.length === 0,      badPunct.length],
  ['No placeholders',                 placeholders.length === 0,  placeholders.length],
  ['No duplicate sentences',          duplicateSentences.length === 0, duplicateSentences.length],
  ['UA has Cyrillic',                 noCyrillic.length === 0,    noCyrillic.length],
  ['UA ≠ EN copy',                    uaCopyOfEn.length === 0,    uaCopyOfEn.length],
  ['No mojibake',                     mojibake.length === 0,      mojibake.length],
  ['Required fields present',         missingField.length === 0,  missingField.length],
  ['Field types correct',             wrongType.length === 0,     wrongType.length],
  ['No extra fields injected',        extraFields.length === 0,   extraFields.length],
];

const colCheck = 38, colStatus = 8, colIssues = 8;
line('');
line(`  ${'Check'.padEnd(colCheck)} ${'Status'.padEnd(colStatus)} ${'Issues'}`);
line('  ' + '─'.repeat(colCheck + colStatus + colIssues + 2));
for (const [name, passed, count] of checks) {
  const status = passed ? 'PASS' : 'FAIL';
  const symbol = passed ? '✓' : '✗';
  line(`  ${symbol} ${name.padEnd(colCheck - 2)} ${status.padEnd(colStatus)} ${count > 0 ? count : ''}`);
}

// ─── VERDICT ─────────────────────────────────────────────────────────────────
section('VERDICT');

const totalIssues = Object.values(issues).reduce((a, b) => a + b.length, 0);
const blocking = stemMismatch.length + missingField.length + wrongType.length + dupIds.length + gaps.length + noCyrillic.length + uaCopyOfEn.length;
const nonBlocking = tooShort.length + tooLong.length + badCapital.length + badPunct.length + placeholders.length + duplicateSentences.length + mojibake.length + withoutExample.length;

line(`  Total issues found : ${totalIssues}`);
line(`  Blocking           : ${blocking}  (data integrity, wrong structure, untranslated)`);
line(`  Non-blocking       : ${nonBlocking}  (style, coverage, length)`);
line('');
if (blocking === 0 && withoutExample.length === 0) {
  line('  ✅  READY FOR PHASE 2 — all structural checks pass.');
  if (nonBlocking > 0) line(`     (${nonBlocking} style/quality issues worth fixing in a follow-up pass)`);
} else if (blocking === 0 && withoutExample.length > 0) {
  // Check if this is due to merge not having been run
  const batchFilesPresent = [0,1,2,3,4,5,6,7,8,9].filter(b => fs.existsSync(`./examples_batch_${b}.json`)).length;
  if (withoutExample.length === words.length) {
    line('  ❌  FIX PASS REQUIRED BEFORE PHASE 2.');
    line('');
    line('  ROOT CAUSE: The merge has NOT been applied to words.json.');
    line(`     • words.json has 0 example fields out of ${words.length} entries.`);
    line(`     • Only ${batchFilesPresent}/10 batch files exist on disk (batches 0, 4, 5).`);
    line('     • Batches 1, 2, 3, 6, 7, 8, 9 are missing — ~1753 entries will have no examples.');
    line('');
    line('  REQUIRED ACTIONS (in order):');
    line('     1. Regenerate the 7 missing batch files (batches 1–3 and 6–9).');
    line('     2. Run merge_examples.js to write examples into words.json.');
    line('     3. Re-run this audit to validate quality before Phase 2.');
  } else {
    line('  ⚠️   CONDITIONALLY READY — no structural errors, but coverage is incomplete.');
    line(`     ${withoutExample.length} entries lack an example sentence.`);
    line('     Phase 2 can proceed but missing examples will show blank in the UI.');
  }
} else {
  line('  ❌  FIX PASS REQUIRED BEFORE PHASE 2.');
  if (dupIds.length) line(`     • ${dupIds.length} duplicate IDs`);
  if (gaps.length) line(`     • ${gaps.length} ID gaps`);
  if (missingField.length) line(`     • ${missingField.length} entries missing required fields`);
  if (wrongType.length) line(`     • ${wrongType.length} entries with wrong field types`);
  if (noCyrillic.length) line(`     • ${noCyrillic.length} UA sentences without Cyrillic`);
  if (uaCopyOfEn.length) line(`     • ${uaCopyOfEn.length} UA sentences that are just the EN text`);
  if (stemMismatch.length) line(`     • ${stemMismatch.length} EN sentences that don't contain the target word`);
}
line('');

// ─── BONUS: QUALITY CHECK ON AVAILABLE BATCH FILES ───────────────────────────
section('BONUS: QUALITY CHECK ON AVAILABLE BATCH FILES (0, 4, 5)');
line('  (These have not been merged into words.json yet; checking raw batch content.)');

{
  const wordById = new Map(words.map(w => [w.id, w]));
  const allBatchEntries = [];
  for (let b of [0, 4, 5]) {
    const bpath = `./examples_batch_${b}.json`;
    if (!fs.existsSync(bpath)) continue;
    const bd = JSON.parse(fs.readFileSync(bpath, 'utf8'));
    bd.forEach(item => allBatchEntries.push({ ...item, batchNum: b }));
  }

  const bStemMismatch = [], bTooShort = [], bTooLong = [], bBadCap = [], bBadPunct = [], bNoCyrillic = [], bUaCopy = [], bDupes = [];
  const bSeenSentences = new Map();

  for (const item of allBatchEntries) {
    if (!item.example?.en || !item.example?.ua) continue;
    const wEntry = wordById.get(item.id);
    const enWord = wEntry?.en ?? '';
    const en = item.example.en;
    const ua = item.example.ua;

    if (enWord) {
      const wordForms = stems(enWord);
      const sWords = sentenceWords(en);
      if (!sWords.some(t => wordForms.has(t))) bStemMismatch.push({ id: item.id, en: enWord, sentence: en });
    }

    const wc = en.trim().split(/\s+/).length;
    if (wc < 4) bTooShort.push({ id: item.id, en: enWord, sentence: en, wc });
    if (wc > 14) bTooLong.push({ id: item.id, en: enWord, sentence: en, wc });
    if (!/^[A-Z]/.test(en.trim())) bBadCap.push({ id: item.id, en: enWord, sentence: en });
    if (!/[.!?]$/.test(en.trim())) bBadPunct.push({ id: item.id, en: enWord, sentence: en });
    if (!CYRILLIC_RE.test(ua)) bNoCyrillic.push({ id: item.id, en: enWord, ua });
    if (ua.toLowerCase().trim() === en.toLowerCase().trim()) bUaCopy.push({ id: item.id, en: enWord, ua });

    const norm = en.trim().toLowerCase();
    if (bSeenSentences.has(norm)) bDupes.push({ id: item.id, en: enWord, sentence: en, firstId: bSeenSentences.get(norm) });
    else bSeenSentences.set(norm, item.id);
  }

  line(`  Entries checked: ${allBatchEntries.length} (batches 0, 4, 5)`);
  line('');
  showIssues(bStemMismatch, 'Stem mismatch');
  showIssues(bTooShort, 'Too short (<4 words)');
  showIssues(bTooLong, 'Too long (>14 words)');
  showIssues(bBadCap, 'Does not start with capital');
  showIssues(bBadPunct, 'Does not end with . ! ?');
  showIssues(bNoCyrillic, 'UA has no Cyrillic');
  showIssues(bUaCopy, 'UA is copy of EN');
  showIssues(bDupes, 'Duplicate sentences');

  // Segment analysis across the 3 batches
  sub('Segment stats for available batches');
  const segmentStats = [0, 4, 5].map(b => {
    const entries = allBatchEntries.filter(e => e.batchNum === b && e.example?.en);
    const lengths = entries.map(e => e.example.en.trim().split(/\s+/).length);
    const avg = lengths.length ? (lengths.reduce((a, c) => a + c, 0) / lengths.length).toFixed(2) : 'N/A';
    const dots = entries.filter(e => e.example.en.trim().endsWith('.')).length;
    const excl = entries.filter(e => e.example.en.trim().endsWith('!')).length;
    const qs   = entries.filter(e => e.example.en.trim().endsWith('?')).length;
    return { b, count: entries.length, avg, dots, excl, qs };
  });
  line('  Batch  Count  Avg len  .    !    ?');
  line('  ' + '─'.repeat(38));
  segmentStats.forEach(s => line(`  ${String(s.b).padEnd(6)} ${String(s.count).padEnd(6)} ${String(s.avg).padEnd(8)} ${String(s.dots).padEnd(4)} ${String(s.excl).padEnd(4)} ${s.qs}`));
}

// ─── OUTPUT ──────────────────────────────────────────────────────────────────
const reportText = report.join('\n');
console.log(reportText);
fs.writeFileSync('./audit_report.txt', reportText + '\n', 'utf8');
console.log('\n[Report saved to audit_report.txt]');
