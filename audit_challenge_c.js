// audit_challenge_c.js — Phase C self-audit for Челендж дня (entry states, result panel, history)
// Usage: node audit_challenge_c.js

const fs   = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'english-words', 'index.html'), 'utf8');

const results = [];
function check(id, label, pass, detail) { results.push({ id, label, pass, detail: detail || '' }); }

// ────────────────────────────────────────────────────────────────────────────
// CHECK 1 — Four-state matrix: spoiler gate, labels, button text
// ────────────────────────────────────────────────────────────────────────────

// 1a. buildChallengeState: opponent score gated on hasPlayed
const bcsIdx = src.indexOf('function buildChallengeState(myEntry)');
const bcsEnd = src.indexOf('\nfunction ', bcsIdx + 10);
const bcsBody = bcsIdx > -1 ? src.slice(bcsIdx, bcsEnd) : '';
const spoilerGate = bcsBody.includes('!hasPlayed && oppScore !== null') &&
                    bcsBody.includes("oppLbl = 'вже зіграв'");
check(1, 'Spoiler gate: opp score hidden until myEntry present',
  spoilerGate, spoilerGate ? 'guard present' : 'MISSING or wrong condition');

// 1b. oppScoreText only set when hasPlayed && oppScore !== null
const oppScoreSet = bcsBody.includes('hasPlayed && oppScore !== null') &&
                    bcsBody.includes("oppScoreText  = oppScore + '/20'");
check(2, 'oppScoreText populated only in hasPlayed+oppScore branch',
  oppScoreSet, oppScoreSet ? 'present' : 'MISSING');

// 1c. Button label "Зіграно сьогодні" (not "Вже зіграно")
const rceIdx  = src.indexOf('function renderChallengeEntry()');
const rceEnd  = src.indexOf('\nfunction ', rceIdx + 10);
const rceBody = rceIdx > -1 ? src.slice(rceIdx, rceEnd) : '';
const btnLabel = rceBody.includes("'Зіграно сьогодні'") && !rceBody.includes("'Вже зіграно'");
check(3, 'Button label "Зіграно сьогодні" (old label absent)',
  btnLabel, btnLabel ? 'correct' : rceBody.includes("'Вже зіграно'") ? 'old label still present' : 'label missing');

// 1d. cecVerdict element exists in HTML
const verdictHtml = src.includes('id="cecVerdict"');
check(4, 'cecVerdict element in HTML',
  verdictHtml, verdictHtml ? 'present' : 'MISSING');

// 1e. verdictEl.innerHTML assigned in renderChallengeEntry
const verdictAssign = rceBody.includes('verdictEl.innerHTML') && rceBody.includes("el('cecVerdict')");
check(5, 'renderChallengeEntry assigns verdictEl.innerHTML',
  verdictAssign, verdictAssign ? 'present' : 'MISSING');

// ────────────────────────────────────────────────────────────────────────────
// CHECK 2 — Tie-break rounding
// ────────────────────────────────────────────────────────────────────────────

// Extract buildChallengeState body for tie-break check
const hasTieBreak = bcsBody.includes('Швидше на') && bcsBody.includes('.toFixed(1)');
check(6, 'Tie-break: diffSec via toFixed(1) + "Швидше на" text',
  hasTieBreak, hasTieBreak ? 'present' : 'MISSING — check diffSec rounding');

// ────────────────────────────────────────────────────────────────────────────
// CHECK 3 — Mismatch & tally
// ────────────────────────────────────────────────────────────────────────────

// 3a. Mismatch detection in buildChallengeState uses myEntry.datasetSize (not COMP_WU.mySize)
const mismatchSrc = bcsBody.includes('myEntry.datasetSize') &&
                    !bcsBody.includes('COMP_WU.mySize') &&
                    bcsBody.includes('день поза заліком');
check(7, 'Mismatch reads myEntry.datasetSize (not COMP_WU.mySize)',
  mismatchSrc, mismatchSrc ? 'correct source' : 'WRONG — check mismatch logic');

// 3b. renderChallengeHistorySection: mismatch days do NOT increment wins/losses/ties
const histFnIdx  = src.indexOf('function renderChallengeHistorySection(');
const histFnEnd  = src.indexOf('\nfunction ', histFnIdx + 10);
const histBody   = histFnIdx > -1 ? src.slice(histFnIdx, histFnEnd) : '';
const tallySkip  = histBody.includes("isMismatch") &&
                   histBody.includes("resultClass = 'mismatch'") &&
                   !histBody.match(/isMismatch[\s\S]{0,20}wins\+\+/);
check(8, 'Tally skips mismatch days (no wins++ when isMismatch)',
  tallySkip, tallySkip ? 'skip confirmed' : 'FAIL — mismatch may count in tally');

// 3c. Walkover: winner === myId → counted as win (no special exclusion)
const walkoverCountsAsWin = histBody.includes("winner === myId") &&
                            histBody.includes('wins++') &&
                            !histBody.includes('isWalkover && wins');
check(9, 'Walkover entry: winner===myId counted as win in tally',
  walkoverCountsAsWin, walkoverCountsAsWin ? 'wins++ unconditional on winner===myId' : 'FAIL');

// ────────────────────────────────────────────────────────────────────────────
// CHECK 4 — Listener hygiene (detach paths)
// ────────────────────────────────────────────────────────────────────────────

// 4a. wuHistoryOff module-level variable
const hasHistOff = src.includes('let wuHistoryOff = null;');
check(10, 'wuHistoryOff module-level variable',
  hasHistOff, hasHistOff ? 'present' : 'MISSING');

// 4b. attachChallengeHistoryListener calls detach first (guard pattern)
const attachFnIdx = src.indexOf('function attachChallengeHistoryListener()');
const attachFnEnd = src.indexOf('\nfunction ', attachFnIdx + 10);
const attachBody  = attachFnIdx > -1 ? src.slice(attachFnIdx, attachFnEnd) : '';
const guardFirst  = attachBody.indexOf('detachChallengeHistoryListener()') <
                    attachBody.indexOf('ref.orderByKey()');
check(11, 'attachChallengeHistoryListener: detach called unconditionally before new attach',
  guardFirst && attachBody.includes('detachChallengeHistoryListener()'),
  guardFirst ? 'guard first ✓' : 'WRONG ORDER');

// 4c. Back-button handler calls detachChallengeHistoryListener
const initStatsIdx = src.indexOf('function initStats()');
const initStatsEnd = src.indexOf('\nfunction ', initStatsIdx + 10);
const initStatsBody = initStatsIdx > -1 ? src.slice(initStatsIdx, initStatsEnd) : '';
const backBtnDetach = initStatsBody.includes('detachChallengeHistoryListener()');
check(12, 'btnBackFromStats handler calls detachChallengeHistoryListener',
  backBtnDetach, backBtnDetach ? 'present' : 'MISSING');

// 4d. showScreen detaches when exiting screenStats
const showScreenIdx = src.indexOf('function showScreen(id)');
const showScreenEnd = src.indexOf('\nfunction ', showScreenIdx + 10);
const showBody      = showScreenIdx > -1 ? src.slice(showScreenIdx, showScreenEnd) : '';
const showDetach    = showBody.includes("currentScreen.id === 'screenStats'") &&
                      showBody.includes('detachChallengeHistoryListener()');
check(13, 'showScreen detaches history listener when exiting screenStats',
  showDetach, showDetach ? 'present' : 'MISSING — any-navigation detach not wired');

// ────────────────────────────────────────────────────────────────────────────
// CHECK 5 — Live transition: listener updates only challengeHistorySection
// ────────────────────────────────────────────────────────────────────────────

// Listener callback calls renderChallengeHistorySection (not renderStatsScreen)
const listenerCallsSection = attachBody.includes('renderChallengeHistorySection(') &&
                             !attachBody.includes('renderStatsScreen()');
check(14, 'History listener callback updates only challengeHistorySection (not full re-render)',
  listenerCallsSection, listenerCallsSection ? 'isolated ✓' : 'FAIL — may call renderStatsScreen');

// challengeHistorySection is a stable container id appended by renderStatsScreen
const stableContainer = src.includes("sec6.id = 'challengeHistorySection'");
check(15, "challengeHistorySection stable container created by renderStatsScreen",
  stableContainer, stableContainer ? 'present' : 'MISSING');

// ────────────────────────────────────────────────────────────────────────────
// CHECK 6 — Offline regression
// ────────────────────────────────────────────────────────────────────────────

// 6a. attachChallengeHistoryListener handles wuFbDb === null (offline fallback)
const offlineFallback = attachBody.includes('!wuFbDb') &&
                        attachBody.includes('renderChallengeHistorySection({},');
check(16, 'attachChallengeHistoryListener: offline fallback renders empty section',
  offlineFallback, offlineFallback ? 'present' : 'MISSING — crashes when wuFbDb null');

// 6b. challengeCompPanel visible only when myEntry and player set (no error when offline)
const compFnIdx  = src.indexOf('function renderChallengeCompPanel()');
const compFnEnd  = src.indexOf('\nfunction ', compFnIdx + 10);
const compBody   = compFnIdx > -1 ? src.slice(compFnIdx, compFnEnd) : '';
const compGuard  = compBody.includes("panel.style.display = 'none'") &&
                   compBody.includes('!myEntry') &&
                   compBody.includes('!player');
check(17, 'renderChallengeCompPanel: guards for no entry / no player',
  compGuard, compGuard ? 'guards present' : 'MISSING');

// 6c. renderChallengeCompPanel called in finishSession challenge branch
const finishIdx  = src.indexOf('} else if (s.mode === \'challenge\')');
const finishEnd  = src.indexOf('} else {', finishIdx + 10);
const finishBody = finishIdx > -1 ? src.slice(finishIdx, finishEnd) : '';
const compCalled = finishBody.includes('renderChallengeCompPanel()');
check(18, 'renderChallengeCompPanel called in finishSession challenge branch',
  compCalled, compCalled ? 'present' : 'MISSING');

// ────────────────────────────────────────────────────────────────────────────
// REPORT
// ────────────────────────────────────────────────────────────────────────────
const W = 62;
console.log('\n══════════════════════════════════════════════════════════════════════════');
console.log(' Phase C Self-Audit — Entry states, result panel, history tally');
console.log('══════════════════════════════════════════════════════════════════════════');
console.log(['#'.padEnd(4), 'Check'.padEnd(W), 'Status'].join(''));
console.log('─'.repeat(80));
results.forEach(r => {
  console.log(String(r.id).padEnd(4), r.label.padEnd(W), r.pass ? '✓ PASS' : '✗ FAIL');
  if (r.detail) console.log('    ', r.detail);
});
const allPass = results.every(r => r.pass);
console.log('\n' + (allPass ? '✓  All checks passed.' : '✗  Some checks FAILED — see above.'));
console.log('══════════════════════════════════════════════════════════════════════════\n');
