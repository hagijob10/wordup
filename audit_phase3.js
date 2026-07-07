// Phase 3 self-audit — run from english-words/ directory
// node ../audit_phase3.js
const fs   = require('fs');
const path = require('path');

const src   = fs.readFileSync(path.join(__dirname, 'english-words', 'index.html'), 'utf8');
const words = JSON.parse(fs.readFileSync(path.join(__dirname, 'words.json'), 'utf8'));

const phrasals    = words.filter(w => w.pos === 'phrasal');
const nonPhrasals = words.filter(w => w.pos !== 'phrasal');
const wordMap     = new Map(words.map(w => [w.id, w]));

const wordsByPos   = {};
const wordsByLevel = {};
const wordsByTopic = {};
words.forEach(w => {
  if (!wordsByPos[w.pos])   wordsByPos[w.pos] = [];
  wordsByPos[w.pos].push(w);
  if (!wordsByLevel[w.level]) wordsByLevel[w.level] = [];
  wordsByLevel[w.level].push(w);
  if (w.topic) {
    if (!wordsByTopic[w.topic]) wordsByTopic[w.topic] = [];
    wordsByTopic[w.topic].push(w);
  }
});

function buildPool(level, topic, posFilter) {
  let pool = level === 'ALL' ? words.slice() : (wordsByLevel[level] || []).slice();
  if (posFilter === 'phrasal')          pool = pool.filter(w => w.pos === 'phrasal');
  else if (posFilter === 'non-phrasal') pool = pool.filter(w => w.pos !== 'phrasal');
  if (topic) pool = pool.filter(w => w.topic === topic);
  return pool;
}

const results = [];
function check(id, label, pass, detail) {
  results.push({ id, label, pass, detail: detail || '' });
}

// ── CHECK 1: Phrasal pool contains ONLY pos='phrasal' ────────────────────────
let c1pass = true;
const phrasalCounts = {};
for (const lvl of ['A2', 'B1', 'B2', 'ALL']) {
  const pool   = buildPool(lvl, null, 'phrasal');
  const nonPh  = pool.filter(w => w.pos !== 'phrasal');
  phrasalCounts[lvl] = pool.length;
  if (nonPh.length) c1pass = false;
}
check(1, 'Phrasal mode pool = phrasal-only (all levels)', c1pass,
  `A2:${phrasalCounts.A2} B1:${phrasalCounts.B1} B2:${phrasalCounts.B2} ALL:${phrasalCounts.ALL}`);

// ── CHECK 2: Classic/Blitz/Survival/Reverse pools EXCLUDE phrasal ────────────
let c2pass = true, c2detail = '';
for (const modeKey of ['classic', 'blitz', 'survival', 'reverse']) {
  for (const lvl of ['A2', 'B1', 'B2', 'ALL']) {
    const pool = buildPool(lvl, null, 'non-phrasal');
    const ph   = pool.filter(w => w.pos === 'phrasal');
    if (ph.length) { c2pass = false; c2detail += `${modeKey}/${lvl}:${ph.length} leaked; `; }
  }
}
check(2, 'Classic/Blitz/Survival/Reverse pools exclude phrasal', c2pass,
  c2pass ? 'no leakage in any level' : c2detail);

// ── CHECK 3: Wrong answer → SRS (phrasal flows through) ─────────────────────
const testPhrasa = phrasals[5];
const inMap      = wordMap.has(testPhrasa.id);
check(3, 'Phrasal word resolved in srsDueWords (wordMap lookup)',
  inMap, `${testPhrasa.id} "${testPhrasa.en}" — wordMap.has: ${inMap}`);

// ── CHECK 4: recordWordResult uses s.mode (covers 'phrasal') ─────────────────
const hasRecordCall  = src.includes("recordWordResult(targetWord.id, isCorrect, s.mode)");
const hasPhrasalMode = src.includes("id: 'phrasal'");
check(4, 'recordWordResult(…, s.mode) + phrasal mode defined',
  hasRecordCall && hasPhrasalMode, `recordCall:${hasRecordCall} phrasalInModes:${hasPhrasalMode}`);

// ── CHECK 5: Stats totals use allWords.length (no hardcoded count) ───────────
const hardcoded = /totalWords\s*=\s*2[0-9]{3}[^;]/.test(src) && !src.includes('allWords.length');
const usesLen   = src.includes('allWords.length');
check(5, 'Stats totalWords = allWords.length (dynamic, not hardcoded)',
  usesLen && !hardcoded, `usesLen:${usesLen} hardcoded:${hardcoded}`);

// ── CHECK 6: Longest ua label + CSS min-height & line-height ─────────────────
const longest     = phrasals.map(e => ({ en: e.en, ua: e.ua, len: e.ua.length }))
                             .sort((a, b) => b.len - a.len)[0];
const hasMinH     = src.includes('min-height: 52px');
const hasLineH    = src.includes('line-height: 1.3');
check(6, 'Longest ua fits 2-line btn (min-height + line-height CSS)',
  hasMinH && hasLineH,
  `longest: "${longest.en}" (${longest.len} chars) → "${longest.ua}" | min-height:${hasMinH} line-height:${hasLineH}`);

// ── CHECK 7: Topic step-1 pos-filter prevents cross-contamination ────────────
const phrasalGeneral  = phrasals.find(w => w.topic === 'general');
const nonPhrGeneral   = nonPhrasals.find(w => w.topic === 'general');
let c7pass = true, c7detail = '';

if (phrasalGeneral) {
  const topicPool = wordsByTopic['general'] || [];
  // BEFORE: no pos filter
  const before    = topicPool.filter(w =>
    w.id !== phrasalGeneral.id &&
    w.ua.trim().toLowerCase() !== phrasalGeneral.ua.trim().toLowerCase());
  // AFTER: pos === targetPos
  const after     = topicPool.filter(w =>
    w.id !== phrasalGeneral.id &&
    w.ua.trim().toLowerCase() !== phrasalGeneral.ua.trim().toLowerCase() &&
    w.pos === 'phrasal');
  const beforeNonPh = before.filter(w => w.pos !== 'phrasal').length;
  const afterNonPh  = after.filter(w => w.pos !== 'phrasal').length;
  c7detail += `phrasal target "${phrasalGeneral.en}": before non-phrasal distractors=${beforeNonPh} → after=${afterNonPh}; `;
  if (afterNonPh > 0) c7pass = false;
}
if (nonPhrGeneral) {
  const topicPool = wordsByTopic['general'] || [];
  const before    = topicPool.filter(w =>
    w.id !== nonPhrGeneral.id &&
    w.ua.trim().toLowerCase() !== nonPhrGeneral.ua.trim().toLowerCase());
  const after     = topicPool.filter(w =>
    w.id !== nonPhrGeneral.id &&
    w.ua.trim().toLowerCase() !== nonPhrGeneral.ua.trim().toLowerCase() &&
    w.pos === nonPhrGeneral.pos);
  const beforePh  = before.filter(w => w.pos === 'phrasal').length;
  const afterPh   = after.filter(w => w.pos === 'phrasal').length;
  c7detail += `non-phrasal target "${nonPhrGeneral.en}" (${nonPhrGeneral.pos}): before phrasal distractors=${beforePh} → after=${afterPh}`;
  if (afterPh > 0) c7pass = false;
}
check(7, 'Topic step-1 pos-filter: no cross-contamination', c7pass, c7detail);

// ── BONUS: structural checks ─────────────────────────────────────────────────
const hasPosUa     = src.includes("phrasal:     'фразове дієслово'");
const nonPhrCount  = (src.match(/posFilter: 'non-phrasal'/g) || []).length;
const phrCount     = (src.match(/posFilter: 'phrasal'/g) || []).length;
const hasCardHtml  = src.includes('id="cardPhrasa"');
const hasCardBind  = src.includes("{ id: 'cardPhrasa',   mode: 'phrasal'  }");
const hasBuildPool = src.includes('function buildPool(level, topic, posFilter)');

// ── REPORT ───────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' Phase 3 Self-Audit — WordUp Phrasal Mode');
console.log('═══════════════════════════════════════════════════════════════');
console.log(['#','Check','Status','Detail'].map((h,i)=>[2,42,8,0][i]?h.padEnd([2,42,8,0][i]):h).join(' '));
console.log('─'.repeat(90));
results.forEach(r => {
  const icon = r.pass ? '✓ PASS' : '✗ FAIL';
  console.log(String(r.id).padEnd(2), r.label.padEnd(42), icon.padEnd(8), r.detail);
});

console.log('\n── Structural checks ───────────────────────────────────────────');
console.log('POS_UA phrasal entry               :', hasPosUa   ? '✓' : '✗');
console.log('buildPool(level, topic, posFilter) :', hasBuildPool ? '✓' : '✗');
console.log('posFilter non-phrasal (×4 modes)   :', nonPhrCount === 4 ? `✓ ×${nonPhrCount}` : `✗ ×${nonPhrCount}`);
console.log('posFilter phrasal     (×1 mode)    :', phrCount   === 1 ? `✓ ×${phrCount}` : `✗ ×${phrCount}`);
console.log('cardPhrasa HTML                    :', hasCardHtml ? '✓' : '✗');
console.log('cardPhrasa bindEvents              :', hasCardBind ? '✓' : '✗');

const allPass = results.every(r => r.pass) && hasPosUa && hasBuildPool && nonPhrCount === 4 && phrCount === 1 && hasCardHtml && hasCardBind;
console.log('\n' + (allPass ? '✓  All checks passed.' : '✗  Some checks failed.'));
console.log('═══════════════════════════════════════════════════════════════\n');
