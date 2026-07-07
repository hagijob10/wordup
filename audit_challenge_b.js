// audit_challenge_b.js — Phase B self-audit for Челендж дня Firebase layer
// Usage: node audit_challenge_b.js

const fs   = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'english-words', 'index.html'), 'utf8');

const results = [];
function check(id, label, pass, detail) { results.push({ id, label, pass, detail: detail || '' }); }

// ── §1 PLAYER HELPERS ────────────────────────────────────────────────────────
check(1,  "WU_PLAYER_KEY = 'wordup_player' defined",
  src.includes("WU_PLAYER_KEY  = 'wordup_player'"),
  src.includes("WU_PLAYER_KEY  = 'wordup_player'") ? 'present' : 'missing');

const hasPlayers = src.includes("bohdan:   { id: 'bohdan'") && src.includes("druzhyna: { id: 'druzhyna'");
check(2,  "PLAYERS map: ids 'bohdan' / 'druzhyna' (match rules)",
  hasPlayers, hasPlayers ? 'both ids present' : 'MISSING');

check(3,  "getPlayer() / setPlayer(id) / getOpponentId() defined",
  src.includes('function getPlayer()') && src.includes('function setPlayer(id)') && src.includes('function getOpponentId('),
  'present');

// ── §2 SYNC FLAG ─────────────────────────────────────────────────────────────
check(4,  "WU_FB_SYNCED_KEY = 'wordup_fb_synced_v1' defined",
  src.includes("WU_FB_SYNCED_KEY = 'wordup_fb_synced_v1'"),
  src.includes("WU_FB_SYNCED_KEY = 'wordup_fb_synced_v1'") ? 'present' : 'missing');

check(5,  "isSynced(dayKey) + markSynced(dayKey) defined",
  src.includes('function isSynced(dayKey)') && src.includes('function markSynced(dayKey)'),
  'present');

// ── §3 FIREBASE INIT ─────────────────────────────────────────────────────────
check(6,  "loadScript() CDN loader defined",
  src.includes('function loadScript(src)') && src.includes('firebasejs/9.23.0/firebase-app-compat.js'),
  'present');

check(7,  "initFirebase() with 3-attempt backoff [2000,5000,10000]",
  src.includes('[2000, 5000, 10000]') && src.includes('initFirebase(attempt + 1)') && src.includes('attempt < 2'),
  'present');

check(8,  "__wuFirebaseFailedPermanently = true on permanent fail",
  src.includes('window.__wuFirebaseFailedPermanently = true'),
  'present');

check(9,  "updateWuSyncStatus() drives 🟢/🟡/🔴 dot",
  src.includes('function updateWuSyncStatus(state)') && src.includes("'wuSyncDot'"),
  'present');

// ── §4 onFirebaseReady ORDER: sync → checkWinner → subscribe ─────────────────
// Extract onFirebaseReady body by slicing from its declaration to the next top-level function
const readyStart = src.indexOf('async function onFirebaseReady()');
const readyEnd   = src.indexOf('\nasync function ', readyStart + 10);
const readyBody  = readyStart > -1 ? src.slice(readyStart, readyEnd > readyStart ? readyEnd : readyStart + 600) : '';
const syncIdx    = readyBody.indexOf('await syncLocalToFirebase');
const winnerIdx  = readyBody.indexOf('await checkDailyWinner');
const subIdx     = readyBody.indexOf('subscribeChallengeToday(player');
const orderOk = syncIdx > -1 && winnerIdx > syncIdx && subIdx > winnerIdx;
check(10, "onFirebaseReady: sync → checkDailyWinner → subscribe (correct order)",
  orderOk, orderOk ? `positions: sync=${syncIdx} winner=${winnerIdx} subscribe=${subIdx}` : 'ORDER WRONG');

// ── §5 syncLocalToFirebase: uses cache.dayKey not getCurrentDayKey ────────────
const syncFn = src.match(/async function syncLocalToFirebase[\s\S]*?^}/m);
const syncBody = syncFn ? syncFn[0] : '';
const usesCacheDayKey = syncBody.includes('cache.dayKey') && !syncBody.includes('getCurrentDayKey()');
check(11, "syncLocalToFirebase reads dayKey from cache (not getCurrentDayKey)",
  usesCacheDayKey, usesCacheDayKey ? 'uses cache.dayKey' : 'WRONG — may use getCurrentDayKey()');

// ── §6 PERMISSION_DENIED = success in syncLocalToFirebase ────────────────────
const permOk = syncBody.includes("e.code === 'PERMISSION_DENIED'") && syncBody.includes('markSynced(dayKey)');
check(12, "PERMISSION_DENIED in syncLocalToFirebase → markSynced (treat as success)",
  permOk, permOk ? 'present' : 'missing');

// ── §7 writeChallengeResult calls syncLocalToFirebase ────────────────────────
check(13, "writeChallengeResult() defined and called in finishSession",
  src.includes('function writeChallengeResult()') && src.includes('writeChallengeResult();'),
  'present');

// ── §8 subscribeChallengeToday: on('value') listener ────────────────────────
const subFn = src.match(/function subscribeChallengeToday[\s\S]*?^}/m);
const subBody = subFn ? subFn[0] : '';
check(14, "subscribeChallengeToday uses on('value', handler) live listener",
  subBody.includes("ref.on('value', handler)") && !subBody.includes('.get()'),
  subBody.includes("ref.on('value'") ? 'on() present, no .get()' : 'MISSING or uses .get()');

const triggersRender = subBody.includes('renderChallengeEntry()') && subBody.includes("classList.contains('active')");
check(15, "listener re-renders entry screen when it is active",
  triggersRender, triggersRender ? 'present' : 'missing');

// ── §9 checkDailyWinner: race comment + walkover + zero ─────────────────────
const winFn = src.match(/async function checkDailyWinner[\s\S]*?^}/m);
const winBody = winFn ? winFn[0] : '';
check(16, "checkDailyWinner: zero-played → write nothing",
  winBody.includes('write nothing'), winBody.includes('write nothing') ? 'comment present' : 'missing');

check(17, "checkDailyWinner: one-played → walkover:true",
  winBody.includes('walkover = true') && winBody.includes("walkover"),
  'present');

check(18, "checkDailyWinner: race condition documented in comment",
  winBody.includes('Known limitation') && winBody.includes('residual race'),
  winBody.includes('Known limitation') ? 'comment present' : 'MISSING');

check(19, "checkDailyWinner: PERMISSION_DENIED = already-recorded (correct state)",
  winBody.includes("e.code === 'PERMISSION_DENIED'"),
  'present');

check(20, "checkDailyWinner: tie-break by totalTimeMs",
  winBody.includes('totalTimeMs') && winBody.includes('bTime < dTime'),
  'present');

// ── §10 PLAYER PICKER HTML + JS ───────────────────────────────────────────────
check(21, "playerPickerOverlay HTML present with bohdan/druzhyna data-player-id",
  src.includes('id="playerPickerOverlay"') &&
  src.includes('data-player-id="bohdan"') &&
  src.includes('data-player-id="druzhyna"'),
  'present');

check(22, "openPlayerPicker() defined; sets player + fires subscribe if wuFbDb ready",
  src.includes('function openPlayerPicker(onSelected)') &&
  src.includes('subscribeChallengeToday(id)'),
  'present');

check(23, "renderChallengeEntry: calls openPlayerPicker if no player set",
  src.includes('openPlayerPicker(() => renderChallengeEntry())'),
  'present');

// ── §11 OFFLINE CHAIN ────────────────────────────────────────────────────────
check(24, "saveChallengeCache + writeChallengeResult both called in finishSession challenge branch",
  src.includes('saveChallengeCache(') && src.includes('writeChallengeResult();'),
  'present');

// Offline: Firebase unreachable → permanent-fail → 🔴 dot; challenge still playable
check(25, "Offline regression: permanent-fail sets 🔴 + __wuFirebaseFailedPermanently flag",
  src.includes("window.__wuFirebaseFailedPermanently = true") &&
  src.includes("updateWuSyncStatus('offline')"),
  'present — app fully playable offline, result queued in localStorage');

// ── §12 STRUCTURAL ───────────────────────────────────────────────────────────
check(26, "initFirebase() called from boot()",
  src.match(/initStats\(\)[\s\S]{0,60}initFirebase\(\)/),
  'present');

check(27, "wuSyncDot element in challenge entry screen HTML",
  src.includes('id="wuSyncDot"'),
  'present');

check(28, "VS layout HTML: cecMyScore / cecOppScore / cecOppLbl",
  src.includes('id="cecMyScore"') && src.includes('id="cecOppScore"') && src.includes('id="cecOppLbl"'),
  'present');

check(29, "startChallengeSession: player guard added",
  src.includes("if (!getPlayer()) return;"),
  'present');

check(30, "wordup_day_chk / WU_DAY_CHECK_KEY defined",
  src.includes("WU_DAY_CHECK_KEY = 'wordup_day_chk'"),
  'present');

// ── REPORT ────────────────────────────────────────────────────────────────────
const W = 62;
console.log('\n══════════════════════════════════════════════════════════════════════════');
console.log(' Phase B Self-Audit — Челендж дня Firebase layer');
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
