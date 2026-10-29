(() => {
'use strict';
const $ = id => document.getElementById(id);
const COUNT = 5, MAX_ROLLS = 3;
let target = 100, mode = 'cpu', level = 'balanced';
const DICE_API = 'https://dice-duel-server.heyboernathan.workers.dev';
let onlineState = null, onlineRoomCode = '', onlineSecret = '', pollTimer = null, onlineBusy = false;
let score = [0, 0], names = ['You', 'Computer'];
let dice = Array(COUNT).fill(1), locked = Array(COUNT).fill(false);
let rolls = 0, active = false, busy = false, round = 0, turn = 0, soundOn = false;
const today = new Date().toISOString().slice(0, 10);
const defaults = { played: 0, wins: 0, losses: 0, ties: 0, best: 0, streak: 0, bestStreak: 0, totalPoints: 0, bigTurns: 0, sixes: 0, missions: {} };
let stats = { ...defaults };
try { stats = { ...defaults, ...JSON.parse(localStorage.getItem('diceDuelStats.v2') || '{}') }; } catch {}
const history = (() => { try { return JSON.parse(localStorage.getItem('diceDuelHistory.v1') || '[]').slice(0, 8); } catch { return []; } })();
const dieFace = n => ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][n];
const randomDie = () => 1 + Math.floor(Math.random() * 6);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const sum = arr => arr.reduce((a, b) => a + b, 0);
function save() {
  try { localStorage.setItem('diceDuelStats.v2', JSON.stringify(stats)); localStorage.setItem('diceDuelHistory.v1', JSON.stringify(history.slice(0, 8))); } catch {}
}
function sound(freq = 520, duration = .08) {
  if (!soundOn) return;
  try { const Ctx = window.AudioContext || window.webkitAudioContext; const ctx = new Ctx(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = freq; o.type = 'sine'; g.gain.value = .055; o.connect(g); g.connect(ctx.destination); o.start(); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration); o.stop(ctx.currentTime + duration); o.onended = () => ctx.close(); } catch {}
}
function setStatus(text) { $('status').textContent = text; }
function renderDice() {
  const box = $('dice'); box.replaceChildren();
  dice.forEach((n, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'die' + (locked[i] ? ' locked' : '');
    b.textContent = dieFace(n); b.setAttribute('aria-label', 'Die ' + (i + 1) + ', ' + n + (locked[i] ? ', locked' : '') + '. Tap to ' + (locked[i] ? 'unlock' : 'lock'));
    b.setAttribute('aria-pressed', String(locked[i])); b.disabled = mode === 'online' ? (!onlineState || onlineState.status !== 'playing' || onlineState.me !== onlineState.turn || onlineBusy || onlineState.rolls === 0 || onlineState.rolls >= MAX_ROLLS) : (!active || busy || rolls === 0 || rolls >= MAX_ROLLS);
    b.addEventListener('click', () => { if (mode === 'online') { onlineAction('lock', { index: i }); return; } locked[i] = !locked[i]; sound(locked[i] ? 740 : 420); renderDice(); $('hint').textContent = locked.filter(Boolean).length + ' of 5 dice locked. Tap again to unlock.'; });
    box.appendChild(b);
  });
}
function render() {
  if (mode === 'online' && onlineState) { score = onlineState.score.slice(); dice = onlineState.dice.slice(); locked = onlineState.locked.slice(); rolls = onlineState.rolls; target = onlineState.target; names = onlineState.players.map((n,i) => n || (i === 0 ? 'Player 1' : 'Waiting…')); active = onlineState.status === 'playing' && onlineState.me === onlineState.turn; }
  $('player-score').textContent = score[0]; $('cpu-score').textContent = score[1];
  $('player-last').textContent = score[0] >= target ? 'Target reached!' : (mode === 'local' ? 'Player 1' : 'Your total');
  $('cpu-last').textContent = score[1] >= target ? 'Target reached!' : names[1];
  const scoreLabels = document.querySelectorAll('.score small');
  if (scoreLabels[0]) scoreLabels[0].textContent = names[0].toUpperCase();
  if (scoreLabels[1]) scoreLabels[1].textContent = names[1].toUpperCase();
  renderDice();
  $('roll').disabled = !active || busy || rolls >= MAX_ROLLS;
  $('bank').disabled = !active || busy || rolls === 0;
  $('roll').textContent = rolls === 0 ? '🎲 Roll dice' : rolls >= MAX_ROLLS ? 'Roll limit reached' : '🎲 Reroll (' + (MAX_ROLLS - rolls) + ' left)';
  $('bank').textContent = mode === 'local' ? '✓ Bank points & pass turn' : '✓ Bank points';
}
function start() {
  target = Number($('target-score').value) || 100; mode = $('game-mode').value; level = $('ai-level').value;
  $('online-panel').hidden = mode !== 'online';
  if (mode === 'online') { active = false; busy = false; if (onlineState) { render(); } else { score=[0,0]; dice=Array(COUNT).fill(1); locked=Array(COUNT).fill(false); rolls=0; names=['You','Opponent']; setStatus('Create a room or join a friend with a code.'); $('round-result').textContent='Online multiplayer · target '+target+' points'; render(); } return; }
  onlineState = null;
  names = mode === 'local' ? ['Player 1', 'Player 2'] : ['You', 'Computer'];
  score = [0, 0]; dice = Array(COUNT).fill(1); locked = Array(COUNT).fill(false); rolls = 0; active = true; busy = false; round = 0; turn = 0;
  setStatus(names[turn] + "'s turn. Roll all five dice to begin.");
  $('hint').textContent = 'After your first roll, tap dice to lock them. Bank when you are ready.';
  $('round-result').textContent = 'Race to ' + target + ' points. You get up to three rolls per turn.';
  render();
}
async function roll() {
  if (mode === 'online') { await onlineAction('roll'); return; }
  if (!active || busy || rolls >= MAX_ROLLS) return;
  busy = true; $('roll').disabled = true; $('bank').disabled = true;
  const next = dice.map((v, i) => locked[i] ? v : randomDie());
  for (let k = 0; k < 7; k++) { dice = dice.map((v, i) => locked[i] ? v : randomDie()); renderDice(); sound(240 + Math.random() * 260, .035); await wait(55); }
  dice = next; rolls++; busy = false; render();
  const total = sum(dice);
  if (dice.includes(6)) stats.sixes++;
  $('status').textContent = names[turn] + ' rolled ' + total + ' · Roll ' + rolls + ' of ' + MAX_ROLLS;
  $('hint').textContent = rolls < MAX_ROLLS ? 'Lock dice you want to keep, reroll, or bank your points.' : 'Last roll complete. Bank your points to finish this turn.';
  $('round-result').innerHTML = 'Current turn: <strong>' + total + ' points</strong> · ' + (MAX_ROLLS - rolls) + ' reroll' + (MAX_ROLLS - rolls === 1 ? '' : 's') + ' left';
  
}
async function cpuTurn() {
  busy = true; active = false; render(); setStatus('Computer is rolling…'); await wait(350);
  let cd = Array.from({ length: COUNT }, randomDie), rollsUsed = 1;
  for (let r = 1; r < MAX_ROLLS; r++) {
    const total = sum(cd);
    const threshold = level === 'casual' ? 16 : level === 'tactical' ? 23 : 20;
    if (total >= threshold) break;
    cd = cd.map(v => v >= (level === 'tactical' ? 4 : 5) ? v : randomDie()); rollsUsed++;
    setStatus('Computer reroll ' + (r + 1) + '…'); await wait(450);
  }
  const earned = sum(cd); score[1] += earned; stats.totalPoints += earned;
  $('cpu-last').textContent = '+' + earned + ' this turn'; sound(330, .13);
  endTurn();
}
async function bank() {
  if (mode === 'online') { await onlineAction('bank'); return; }
  if (!active || busy || rolls === 0) return;
  const earned = sum(dice); score[turn] += earned; stats.totalPoints += earned; round++;
  $('round-result').innerHTML = names[turn] + ' banked <strong>+' + earned + ' points</strong>.';
  sound(earned >= 25 ? 880 : 620, .12);
  if (earned >= 25) { stats.bigTurns++; stats.missions[today] = true; updateDaily(); }
  if (mode === 'cpu' && turn === 0 && score[0] < target) {
    active = false; busy = true; $('player-last').textContent = '+' + earned + ' this turn'; render();
    await wait(400); await cpuTurn(); return;
  }
  endTurn();
}
function endTurn() {
  busy = false;
  if (score[0] >= target || score[1] >= target) { finishMatch(); return; }
  if (mode === 'local') turn = 1 - turn;
  else turn = 0;
  dice = Array(COUNT).fill(1); locked = Array(COUNT).fill(false); rolls = 0; active = true;
  setStatus(names[turn] + "'s turn. Pass the device if needed, then roll.");
  $('hint').textContent = 'Tap dice to lock them after the first roll. Bank to end your turn.';
  render();
}
function finishMatch() {
  active = false; busy = false; stats.played++;
  let outcome;
  if (score[0] === score[1]) { stats.ties++; outcome = 'TIE'; stats.streak = 0; setStatus('🤝 Draw! Both players reached the target together.'); }
  else if (score[0] > score[1]) { outcome = 'WIN'; stats.wins++; stats.streak++; stats.bestStreak = Math.max(stats.bestStreak, stats.streak); stats.best = Math.max(stats.best, score[0]); setStatus(mode === 'local' ? '🏆 Player 1 wins!' : '🏆 You win the Dice Duel!'); sound(920, .35); }
  else { outcome = 'LOSS'; stats.losses++; stats.streak = 0; setStatus(mode === 'local' ? '🏆 Player 2 wins!' : 'Computer wins this duel. Rematch?'); }
  history.unshift({ date: new Date().toLocaleDateString(), mode: mode === 'local' ? '2 Players' : 'Computer', result: outcome, score: score[0] + '–' + score[1] });
  history.splice(8); save(); updateStats(); render();
  $('round-result').innerHTML = names[0] + ': <strong>' + score[0] + '</strong> · ' + names[1] + ': <strong>' + score[1] + '</strong> · ' + outcome;
}

async function diceApi(path, body) {
  const res = await fetch(DICE_API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Online multiplayer is unavailable right now.');
  return data;
}
function saveOnlineRoom(code, key) {
  onlineRoomCode = code; onlineSecret = key;
  try { sessionStorage.setItem('diceRoomCode', code); sessionStorage.setItem('diceRoomSecret', key); } catch {}
  $('online-room-label').textContent = 'Room: ' + code + ' · Share this code with your friend.';
  $('copy-room').disabled = false;
}
async function createOnlineRoom() {
  try {
    $('online-status').textContent = 'Creating room…';
    const data = await diceApi('/room/create', { name: $('online-name').value.trim() || 'Player 1', target: Number($('target-score').value) || 100 });
    saveOnlineRoom(data.roomCode, data.secret); onlineState = data; $('online-status').textContent = 'Room created. Waiting for a friend to join…'; startPolling(); render();
  } catch (e) { $('online-status').textContent = e.message; }
}
async function joinOnlineRoom() {
  try {
    const roomCode = $('join-code').value.trim().toUpperCase();
    if (!roomCode) { $('online-status').textContent = 'Enter your friend’s room code first.'; return; }
    $('online-status').textContent = 'Joining room…';
    const data = await diceApi('/room/join', { roomCode, name: $('online-name').value.trim() || 'Player 2' });
    saveOnlineRoom(roomCode, data.secret); onlineState = data; $('online-status').textContent = 'Joined! You are Player 2.'; startPolling(); render();
  } catch (e) { $('online-status').textContent = e.message; }
}
async function onlineAction(action, extra = {}) {
  if (!onlineRoomCode || !onlineSecret || onlineBusy) return;
  onlineBusy = true; render();
  try { onlineState = await diceApi('/room/action', { roomCode: onlineRoomCode, secret: onlineSecret, action, ...extra }); sound(action === 'roll' ? 500 : 700); }
  catch (e) { $('online-status').textContent = e.message; }
  finally { onlineBusy = false; await refreshOnlineRoom(); }
}
async function refreshOnlineRoom() {
  if (!onlineRoomCode || !onlineSecret) return;
  try {
    const s = await diceApi('/room/state', { roomCode: onlineRoomCode, secret: onlineSecret });
    onlineState = s;
    $('online-status').textContent = s.status === 'waiting' ? 'Waiting for your friend to join…' : s.status === 'finished' ? (s.winner === s.me ? '🏆 You won the online duel!' : 'Match finished. Your friend won this round.') : s.turn === s.me ? 'Your turn! Roll the dice.' : 'Waiting for ' + s.players[s.turn] + ' to take their turn…';
    $('online-room-label').textContent = 'Room: ' + s.roomCode + ' · ' + (s.players[0] || 'Player 1') + ' vs ' + (s.players[1] || 'Waiting…');
    $('round-result').textContent = s.last || 'Online match in progress.';
    $('hint').textContent = s.status !== 'playing' ? 'Share your room code to start.' : s.turn === s.me ? 'Roll up to three times. Lock dice after rolling, then bank points.' : 'Your dice controls are paused until your turn.';
    render();
  } catch (e) { $('online-status').textContent = e.message; }
}
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  refreshOnlineRoom(); pollTimer = setInterval(refreshOnlineRoom, 1600);
}
try { onlineRoomCode = sessionStorage.getItem('diceRoomCode') || ''; onlineSecret = sessionStorage.getItem('diceRoomSecret') || ''; } catch {}
if (onlineRoomCode && onlineSecret) { $('game-mode').value = 'online'; mode = 'online'; $('online-panel').hidden = false; $('join-code').value = onlineRoomCode; $('online-room-label').textContent = 'Reconnecting to room ' + onlineRoomCode + '…'; startPolling(); }
$('create-room').addEventListener('click', createOnlineRoom);
$('join-room').addEventListener('click', joinOnlineRoom);
$('copy-room').addEventListener('click', async () => { try { await navigator.clipboard.writeText(onlineRoomCode); $('online-status').textContent = 'Room code copied! Send it to your friend.'; } catch { $('online-status').textContent = 'Your room code is ' + onlineRoomCode + '. Copy it manually.'; } });

function updateStats() {
  $('stats-summary').textContent = 'Matches ' + stats.played + ' · Wins ' + stats.wins + ' · Losses ' + stats.losses + ' · Draws ' + stats.ties + ' · Win streak ' + stats.streak + ' · Best score ' + stats.best + ' · Sixes rolled ' + stats.sixes;
  const badges = [];
  if (stats.played >= 1) badges.push('🎲 First Roll — played a match');
  if (stats.wins >= 1) badges.push('🏆 First Victory — win a match');
  if (stats.wins >= 5) badges.push('🔥 Hot Streak — win 5 matches');
  if (stats.best >= 100) badges.push('💯 Century — score 100+ in a match');
  if (stats.bigTurns >= 3) badges.push('⚡ Big Roller — bank 25+ points three times');
  if (stats.sixes >= 25) badges.push('🎯 Six Shooter — roll 25 sixes');
  $('achievement-list').textContent = badges.length ? badges.join(' · ') : 'Play matches to unlock achievements.';
  const list = $('match-history'); list.replaceChildren();
  if (!history.length) { const li = document.createElement('li'); li.textContent = 'No matches yet.'; list.append(li); }
  history.forEach(m => { const li = document.createElement('li'); li.textContent = m.date + ' · ' + m.mode + ' · ' + m.result + ' · ' + m.score; list.append(li); });
}
function updateDaily() {
  const complete = !!stats.missions[today];
  $('daily-mission').textContent = 'Roll 25 or more points in a single turn. Bonus: mission badge progress.';
  $('daily-progress').textContent = complete ? '✅ Complete! Come back tomorrow for a new mission.' : 'Progress: 0 / 1 · Bank 25+ points in one turn.';
}
$('roll').addEventListener('click', roll);
$('bank').addEventListener('click', bank);
$('reset').addEventListener('click', start);
$('new-game-top').addEventListener('click', start);
$('game-mode').addEventListener('change', start);
$('target-score').addEventListener('change', start);
$('ai-level').addEventListener('change', start);
$('sound-toggle').addEventListener('click', () => { soundOn = !soundOn; $('sound-toggle').textContent = soundOn ? '🔊 Sound on' : '🔇 Sound off'; $('sound-toggle').setAttribute('aria-pressed', String(soundOn)); sound(700); });
$('stats-toggle').addEventListener('click', () => { $('stats-panel').hidden = !$('stats-panel').hidden; updateStats(); });
$('daily-toggle').addEventListener('click', () => { $('daily-panel').hidden = !$('daily-panel').hidden; updateDaily(); });
updateStats(); updateDaily(); start();
})();