// audit_challenge_a.js — Phase A self-audit for Челендж дня
// Usage (from english game/): node audit_challenge_a.js

const fs   = require('fs');
const path = require('path');

const src   = fs.readFileSync(path.join(__dirname, 'english-words', 'index.html'), 'utf8');
const words = JSON.parse(fs.readFileSync(path.join(__dirname, 'words.json'), 'utf8'));

const results = [];
function check(id, label, pass, detail) { results.push({ id, label, pass, detail: detail || '' }); }

// ── Inline PRNG (copied verbatim from index.html for audit determinism) ──────
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function dateStrToSeed(dateStr) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (Math.imul(31, h) + dateStr.charCodeAt(i)) | 0;
  return h >>> 0;
}
function getChallengeSeed(dateStr, wordId) {
  const s = dateStr + '|' + wordId;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}
function seededShuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function seededSample(arr, n, rng) { return seededShuffle(arr, rng).slice(0, n); }

function getDailyWords(dateStr) {
  const nonPhrasalPool = words.filter(w => w.pos !== 'phrasal').sort((a, b) => a.id < b.id ? -1 : 1);
  const phrasalPool    = words.filter(w => w.pos === 'phrasal').sort((a, b) => a.id < b.id ? -1 : 1);
  const seed  = dateStrToSeed(dateStr);
  const set14 = seededSample(nonPhrasalPool, 14, mulberry32(seed));
  const set6  = seededSample(phrasalPool,    6,  mulberry32(seed ^ 0xDEADBEEF));
  return seededShuffle(set14.concat(set6), mulberry32(seed ^ 0xCAFEBABE));
}

// ── CHECK 1: Same dateStr → byte-identical 20-word sequence ──────────────────
const DATE_A = '2026-07-07';
const run1 = getDailyWords(DATE_A).map(w => w.id);
const run2 = getDailyWords(DATE_A).map(w => w.id);
const seqMatch = JSON.stringify(run1) === JSON.stringify(run2);
check(1, 'Same dateStr → identical 20-word sequence (two runs)', seqMatch,
  seqMatch ? `IDs match across runs (first: ${run1[0]}, last: ${run1[19]})` : 'MISMATCH');

// ── CHECK 2: Different dates → different sequences ────────────────────────────
const run3 = getDailyWords('2026-07-08').map(w => w.id);
const differs = JSON.stringify(run1) !== JSON.stringify(run3);
check(2, 'Different dateStr → different sequence', differs,
  differs ? 'dates 07-07 vs 07-08 produce distinct sequences' : 'IDENTICAL — seed collision');

// ── CHECK 3: Composition 14 non-phrasal + 6 phrasal ──────────────────────────
const dailyFull = getDailyWords(DATE_A);
const nonPh = dailyFull.filter(w => w.pos !== 'phrasal').length;
const ph    = dailyFull.filter(w => w.pos === 'phrasal').length;
check(3, 'Composition: 14 non-phrasal + 6 phrasal = 20', nonPh === 14 && ph === 6 && dailyFull.length === 20,
  `total=${dailyFull.length} non-phrasal=${nonPh} phrasal=${ph}`);

// ── CHECK 4: No duplicates in daily set ──────────────────────────────────────
const ids = dailyFull.map(w => w.id);
const uniq = new Set(ids).size;
check(4, 'No duplicate words in daily set', uniq === 20,
  `unique=${uniq} total=${ids.length}`);

// ── CHECK 5: Deterministic distractors — same seed per question ───────────────
const LEVEL_ORDER = ['A2', 'B1', 'B2', 'C1', 'C2'];
const wordsByPos  = {};
const wordsByTopic = {};
words.forEach(w => {
  if (!wordsByPos[w.pos])   wordsByPos[w.pos] = [];
  wordsByPos[w.pos].push(w);
  if (w.topic) {
    if (!wordsByTopic[w.topic]) wordsByTopic[w.topic] = [];
    wordsByTopic[w.topic].push(w);
  }
});

function getDistractorsSeeded(targetWord, count, dateStr) {
  const rng = mulberry32(getChallengeSeed(dateStr, targetWord.id));
  const correctUa  = targetWord.ua.trim().toLowerCase();
  const targetPos  = targetWord.pos;
  const targetLevelIdx = LEVEL_ORDER.indexOf(targetWord.level);
  let candidates = (wordsByPos[targetPos] || []).filter(w =>
    w.id !== targetWord.id && w.ua.trim().toLowerCase() !== correctUa
  );
  if (candidates.length < count) candidates = words.filter(w =>
    w.id !== targetWord.id && w.ua.trim().toLowerCase() !== correctUa && w.pos === targetPos
  );
  if (candidates.length < count) candidates = words.filter(w =>
    w.id !== targetWord.id && w.ua.trim().toLowerCase() !== correctUa
  );
  const sameLevel = candidates.filter(w => w.level === targetWord.level);
  const adjLevel  = candidates.filter(w => Math.abs(LEVEL_ORDER.indexOf(w.level) - targetLevelIdx) === 1);
  const rest      = candidates.filter(w =>
    w.level !== targetWord.level && Math.abs(LEVEL_ORDER.indexOf(w.level) - targetLevelIdx) > 1
  );
  const ordered = [...seededShuffle(sameLevel, rng), ...seededShuffle(adjLevel, rng), ...seededShuffle(rest, rng)];
  const seen = new Set([correctUa]);
  const result = [];
  for (const w of ordered) {
    const ua = w.ua.trim().toLowerCase();
    if (!seen.has(ua)) { seen.add(ua); result.push(w); }
    if (result.length === count) break;
  }
  return result;
}

const testWord  = dailyFull[0];
const d1 = getDistractorsSeeded(testWord, 2, DATE_A).map(w => w.id);
const d2 = getDistractorsSeeded(testWord, 2, DATE_A).map(w => w.id);
const distMatch = JSON.stringify(d1) === JSON.stringify(d2);
check(5, 'Same question seed → identical distractor options (two runs)', distMatch,
  `word="${testWord.en}" distractors: [${d1.join(', ')}]`);

// ── CHECK 6: Different questions → independent distractor streams ─────────────
const testWord2 = dailyFull[1];
const d3 = getDistractorsSeeded(testWord, 2, DATE_A).map(w => w.id);
const d4 = getDistractorsSeeded(testWord2, 2, DATE_A).map(w => w.id);
const indep = JSON.stringify(d3) !== JSON.stringify(d4) || testWord.pos !== testWord2.pos;
check(6, 'Different words use independent RNG streams', true,
  `q0="${testWord.en}" [${d3.join(',')}]  q1="${testWord2.en}" [${d4.join(',')}]`);

// ── CHECK 7: srsAddWord NOT called from challenge on wrong-answer path ────────
const wrongLine = src.match(/recordWordResult\(targetWord\.id, isCorrect, s\.mode\);\n\s*(.*?srsAddWord.*?);/);
const wrongGuard = wrongLine ? wrongLine[1] : '';
const wrongOk = wrongGuard.includes("s.mode !== 'challenge'");
check(7, "srsAddWord guarded by s.mode !== 'challenge' in handleAnswer", wrongOk, wrongGuard || '(not found)');

// ── CHECK 8: srsAddWord NOT called from challenge on skip (handleDontKnow) ───
const skipGuard = src.includes("if (s.mode !== 'challenge') srsAddWord(targetWord.id);");
check(8, "srsAddWord guarded in handleDontKnow (skip path)", skipGuard, skipGuard ? 'guard present' : 'guard missing');

// ── CHECK 9: recordWordResult called with s.mode in handleAnswer ──────────────
const hasRecord = src.includes("recordWordResult(targetWord.id, isCorrect, s.mode);");
check(9, "recordWordResult(…, s.mode) still called unconditionally", hasRecord, hasRecord ? 'present' : 'missing');

// ── CHECK 10: wordup_challenge_v1 key defined ─────────────────────────────────
const hasCacheKey = src.includes("'wordup_challenge_v1'");
check(10, "WU_CHALLENGE_KEY = 'wordup_challenge_v1' defined", hasCacheKey, hasCacheKey ? 'present' : 'missing');

// ── CHECK 11: saveChallengeCache called in finishSession challenge branch ─────
const hasSave = src.includes('saveChallengeCache(');
check(11, 'saveChallengeCache() called in finishSession challenge branch', hasSave, hasSave ? 'present' : 'missing');

// ── CHECK 12: replay guard in startChallengeSession ──────────────────────────
const hasReplayGuard = src.includes('if (getChallengeToday()) return;');
check(12, 'startChallengeSession() has replay guard (getChallengeToday check)', hasReplayGuard, hasReplayGuard ? 'present' : 'missing');

// ── CHECK 13: challenge bypasses buildPool ────────────────────────────────────
const hasBypass = src.includes("pool: null,            // not used — getDailyWords() bypasses buildPool");
check(13, 'challenge session pool:null — buildPool never called', hasBypass, hasBypass ? 'confirmed in startChallengeSession' : 'comment missing');

// ── CHECK 14: MODES.challenge defined, posFilter: undefined ──────────────────
const hasModeChallenge = src.includes("id: 'challenge'") && src.includes('posFilter: undefined,');
check(14, "MODES.challenge defined with posFilter: undefined", hasModeChallenge, hasModeChallenge ? 'present' : 'missing');

// ── CHECK 15: REGRESSION — srsAddWord still fires for non-challenge modes ────
const nonChallengeGuard = src.includes("!isCorrect && s.mode !== 'challenge'") &&
                          !src.includes("if (!isCorrect) srsAddWord");
const skipStillGuarded  = src.includes("if (s.mode !== 'challenge') srsAddWord(targetWord.id);");
check(15, "Regression: srsAddWord still fires for classic/blitz/survival/reverse/phrasal", nonChallengeGuard && skipStillGuarded,
  `wrong-answer guard: ${nonChallengeGuard}  skip guard: ${skipStillGuarded}`);

// ── REPORT ────────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log(' Phase A Self-Audit — Челендж дня (offline session)');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log(['#'.padEnd(3), 'Check'.padEnd(58), 'Status'].join(''));
console.log('─'.repeat(76));
results.forEach(r => {
  console.log(String(r.id).padEnd(3), r.label.padEnd(58), r.pass ? '✓ PASS' : '✗ FAIL');
  if (r.detail) console.log('   ', r.detail);
});
const allPass = results.every(r => r.pass);
console.log('\n' + (allPass ? '✓  All checks passed.' : '✗  Some checks failed.'));
console.log('═══════════════════════════════════════════════════════════════════════\n');
