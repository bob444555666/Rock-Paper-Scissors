var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
import { DurableObject } from "cloudflare:workers";
var GOOGLE_CLIENT_ID = "673440193252-afoh2lbjqrduu3buqrt6lppnl89q8ogt.apps.googleusercontent.com";
var SITE_ORIGIN = "https://www.stone-paper-scissors.com";
var CONTROL_NAME = "__SERVER_CONTROL__";
var USERS_NAME = "__USERS__";
var enc = new TextEncoder();
function b64urlEncode(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(b64urlEncode, "b64urlEncode");
function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
__name(b64urlDecode, "b64urlDecode");
function cors(env, extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extra
  };
}
__name(cors, "cors");
function json(env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: cors(env, { "Content-Type": "application/json", "Cache-Control": "no-store" })
  });
}
__name(json, "json");
var jwksCache = null;
var jwksCachedAt = 0;
async function getGoogleKeys() {
  if (jwksCache && Date.now() - jwksCachedAt < 36e5) return jwksCache;
  const res = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  jwksCache = (await res.json()).keys;
  jwksCachedAt = Date.now();
  return jwksCache;
}
__name(getGoogleKeys, "getGoogleKeys");
async function verifyGoogleToken(idToken, clientId) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Bad token");
  const header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
  const keys = await getGoogleKeys();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("Unknown key");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlDecode(parts[2]),
    enc.encode(parts[0] + "." + parts[1])
  );
  if (!valid) throw new Error("Bad signature");
  if (payload.aud !== clientId) throw new Error("Wrong audience");
  if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") throw new Error("Wrong issuer");
  if (payload.exp * 1e3 < Date.now()) throw new Error("Expired");
  return payload;
}
__name(verifyGoogleToken, "verifyGoogleToken");
async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}
__name(hmacKey, "hmacKey");
async function makeSession(env, user, extra = {}, ttl = 7 * 24 * 36e5) {
  const payload = b64urlEncode(enc.encode(JSON.stringify({
    sub: user.sub,
    name: user.name,
    ...extra,
    iat: Date.now(),
    exp: Date.now() + ttl
  })));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env.SESSION_SECRET), enc.encode(payload));
  return payload + "." + b64urlEncode(sig);
}
__name(makeSession, "makeSession");
async function readSession(env, token) {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const ok = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(env.SESSION_SECRET),
    b64urlDecode(sig),
    enc.encode(payload)
  );
  if (!ok) return null;
  const data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  if (data.exp < Date.now()) return null;
  if ((data.iat || 0) < (await getStatus(env)).resetAt) return null;
  const users = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
  const exists = await (await users.fetch("https://users/acct/exists", { method: "POST", body: JSON.stringify({ id: data.sub }) })).json();
  if (!exists.ok) return null;
  return data;
}
__name(readSession, "readSession");
async function getStatus(env) {
  const control = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(CONTROL_NAME));
  return (await control.fetch("https://control/status")).json();
}
__name(getStatus, "getStatus");
async function isServerOnline(env) {
  return (await getStatus(env)).online;
}
__name(isServerOnline, "isServerOnline");
var esc = /* @__PURE__ */ __name((s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]), "esc");
async function hashPw(password, salt) {
  const k = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 1e5 },
    k,
    256
  );
  return b64urlEncode(bits);
}
__name(hashPw, "hashPw");
async function sendCode(env, to, code) {
  const key = String(env.RESEND_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!key) return "Email is not set up yet (the RESEND_API_KEY secret is missing).";
  if (!env.EMAIL_FROM) return "Email is not set up yet (EMAIL_FROM is missing).";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [to],
        subject: "Your Rock Paper Scissors code: " + code,
        text: `Your code is ${code}. It expires in 10 minutes.

If you did not ask for this, ignore this email.`
      })
    });
    if (r.ok) return null;
    const info = await r.json().catch(() => ({}));
    return "Email service said: " + (info.message || "error " + r.status);
  } catch {
    return "Could not reach the email service.";
  }
}
__name(sendCode, "sendCode");
var MOVES = ["rock", "paper", "scissors"];
var BEATS = { rock: "scissors", paper: "rock", scissors: "paper" };
var COUNTER = { rock: "paper", paper: "scissors", scissors: "rock" };
var SMART = { easy: 0, medium: 0.65, hard: 0.82, insane: 0.93 };
var rand = /* @__PURE__ */ __name(() => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32, "rand");
var pick = /* @__PURE__ */ __name((list) => list[Math.floor(rand() * list.length)], "pick");
function mostCommon(counts) {
  const best = Math.max(...MOVES.map((m) => counts[m]));
  return pick(MOVES.filter((m) => counts[m] === best));
}
function markovPredict(history, order) {
  if (history.length <= order) return null;
  const counts = { rock: 0, paper: 0, scissors: 0 };
  const suffix = history.slice(-order);
  for (let i = 0; i <= history.length - order - 1; i++) {
    if (suffix.every((m, n) => history[i + n] === m)) counts[history[i + order]]++;
  }
  return Object.values(counts).some(Boolean) ? mostCommon(counts) : null;
}
function computerPlay(level, history, move, rounds = []) {
  let predicted = null, reason = "Easy mode chooses randomly and does not inspect player history.";
  if (level === "medium" && history.length) {
    const counts = { rock: 0, paper: 0, scissors: 0 };
    history.forEach((m) => counts[m]++);
    predicted = mostCommon(counts);
    reason = "Compared overall move frequencies and selected a counter to the most common choice.";
  } else if (level === "hard" && history.length) {
    predicted = markovPredict(history, 2) || markovPredict(history, 1) || (history.length ? history[history.length - 1] : null);
    reason = "Used one- and two-move Markov sequence frequencies to estimate the next move.";
  } else if (level === "insane" && history.length) {
    const last = rounds[rounds.length - 1];
    if (last && last.result === "win") {
      predicted = last.you;
      reason = "Win bias: weighted the chance that the player repeats their previous winning move.";
    } else if (last && last.result === "loss") {
      predicted = COUNTER[last.computer];
      reason = "Loss bias: weighted the chance the player switches to the move that beats the AI's last winning move.";
    } else if (last && last.result === "tie") {
      predicted = COUNTER[last.you];
      reason = "Tie bias: weighted the chance the player switches to a move that beats the tied move.";
    }
    predicted = predicted || markovPredict(history, 2) || markovPredict(history, 1) || history[history.length - 1];
    reason += " Combined this behavioural estimate with Markov sequence learning.";
  }
  const shouldCounter = level !== "easy" && predicted && rand() < SMART[level];
  const computerMove = shouldCounter ? COUNTER[predicted] : pick(MOVES);
  const result = move === computerMove ? "tie" : BEATS[move] === computerMove ? "win" : "loss";
  return { computerMove, result, predictedMove: predicted, reason };
}
__name(computerPlay, "computerPlay");
var CH_STAGES = ["easy", "medium", "hard", "insane"];
var CH_WINS_NEEDED = 3;
var CH_LOSS_LIMIT = 3;
var CH_DEFAULT_HOURS = 1;
var CH_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
var chNewId = /* @__PURE__ */ __name(() => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => CH_ALPHABET[b % 32]).join(""), "chNewId");
var chNorm = /* @__PURE__ */ __name((s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16), "chNorm");
function chView(rec) {
  return {
    status: rec.status,
    username: rec.username,
    stage: Math.min(rec.stage + 1, CH_STAGES.length),
    totalStages: CH_STAGES.length,
    level: CH_STAGES[Math.min(rec.stage, CH_STAGES.length - 1)],
    winsNeeded: CH_WINS_NEEDED,
    lossLimit: CH_LOSS_LIMIT,
    roundsWon: rec.roundsWon,
    roundsLost: rec.roundsLost,
    expiresAt: rec.expiresAt,
    expired: rec.status === "active" && rec.expiresAt < Date.now(),
    last: rec.last || null,
    player: rec.playerName || "",
    avatarAt: rec.avatarAt || 0,
    prize: rec.status === "won" ? rec.prize || "" : ""
  };
}
__name(chView, "chView");
var TO_MAX_PLAYERS = 16;
var TO_WINS_NEEDED = 3;
var TO_FORFEIT_MS = 3e4;
var TO_DEFAULT_HOURS = 3;
var TO_IDLE_BOTH_MS = 9e4;
var toRoundName = /* @__PURE__ */ __name((left) => left === 1 ? "Final" : left === 2 ? "Semi-final" : left === 3 ? "Quarter-final" : left === 4 ? "Round of 16" : "Round", "toRoundName");
var toPlayer = /* @__PURE__ */ __name((t, eid) => t.players.find((p) => p.eid === eid) || null, "toPlayer");
function toBegin(t, r, i, now) {
  const m = t.rounds[r][i];
  const a = toPlayer(t, m.p[0]), b = toPlayer(t, m.p[1]);
  m.wins = [0, 0];
  m.moves = [null, null];
  m.firstMoveAt = 0;
  m.startedAt = now;
  m.last = null;
  if (a && !a.alive || b && !b.alive) {
    toFinish(t, r, i, a && !a.alive && b && b.alive ? 1 : 0, now);
    return;
  }
  m.status = "playing";
}
__name(toBegin, "toBegin");
function toFinish(t, r, i, idx, now) {
  const m = t.rounds[r][i];
  m.status = "done";
  m.winner = m.p[idx];
  const loser = toPlayer(t, m.p[1 - idx]);
  if (loser) {
    loser.alive = false;
    loser.outRound = r;
  }
  if (r + 1 >= t.rounds.length) {
    t.status = "finished";
    t.champion = m.winner;
    t.wonAt = now;
    return;
  }
  const next = t.rounds[r + 1][i >> 1];
  next.p[i & 1] = m.winner;
  if (next.p[0] && next.p[1]) toBegin(t, r + 1, i >> 1, now);
}
__name(toFinish, "toFinish");
function toBuild(t, now) {
  const players = t.players.filter((p) => p.joined);
  const order = players.map((p) => p.eid);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  let size = 2;
  while (size < order.length) size *= 2;
  const half = size / 2;
  t.players = players;
  t.rounds = [];
  for (let n = size; n >= 2; n /= 2) {
    t.rounds.push(Array.from({ length: n / 2 }, () => ({ p: [null, null], status: "waiting", wins: [0, 0], moves: [null, null], winner: null })));
  }
  for (let i = 0; i < half; i++) {
    t.rounds[0][i].p[0] = order[i];
    t.rounds[0][i].p[1] = order[half + i] || null;
  }
  t.status = "running";
  t.startedAt = now;
  t.rounds[0].forEach((m, i) => {
    if (m.p[0] && m.p[1]) toBegin(t, 0, i, now);
    else toFinish(t, 0, i, m.p[0] ? 0 : 1, now);
  });
}
__name(toBuild, "toBuild");
function toFind(t, eid) {
  for (let r = 0; r < t.rounds.length; r++) {
    for (let i = 0; i < t.rounds[r].length; i++) {
      const m = t.rounds[r][i];
      if (m.status !== "done" && m.p.includes(eid)) return { r, i, m };
    }
  }
  return null;
}
__name(toFind, "toFind");
function toRound(t, r, i, winnerIdx, moves, now) {
  const m = t.rounds[r][i];
  m.rn = (m.rn || 0) + 1;
  m.last = { moves, winner: winnerIdx, n: m.rn };
  m.hist = [...m.hist || [], moves].slice(-30);
  if (winnerIdx >= 0) m.wins[winnerIdx]++;
  m.moves = [null, null];
  m.firstMoveAt = 0;
  m.startedAt = now;
  if (winnerIdx >= 0 && m.wins[winnerIdx] >= TO_WINS_NEEDED) toFinish(t, r, i, winnerIdx, now);
}
__name(toRound, "toRound");
function toTick(t, now) {
  if (t.status !== "running") return false;
  let changed = false;
  for (let r = 0; r < t.rounds.length; r++) {
    for (let i = 0; i < t.rounds[r].length; i++) {
      const m = t.rounds[r][i];
      if (m.status === "playing" && m.firstMoveAt && now - m.firstMoveAt > TO_FORFEIT_MS) {
        toRound(t, r, i, m.moves[0] ? 0 : 1, [m.moves[0], m.moves[1]], now);
        changed = true;
      } else if (m.status === "playing" && !m.firstMoveAt && now - m.startedAt > TO_IDLE_BOTH_MS) {
        const a = pick(MOVES), b = pick(MOVES);
        toRound(t, r, i, a === b ? -1 : BEATS[a] === b ? 0 : 1, [a, b], now);
        changed = true;
      }
    }
  }
  return changed;
}
__name(toTick, "toTick");
function toEliminate(t, eid, now) {
  const p = toPlayer(t, eid);
  if (!p || !p.alive) return;
  p.alive = false;
  const cur = toFind(t, eid);
  if (cur && cur.m.status === "playing") toFinish(t, cur.r, cur.i, cur.m.p[0] === eid ? 1 : 0, now);
}
__name(toEliminate, "toEliminate");
function toScout(t, eid) {
  const counts = { rock: 0, paper: 0, scissors: 0 };
  const recent = [];
  for (const round of t.rounds) {
    for (const m of round) {
      const idx = m.p[0] === eid ? 0 : m.p[1] === eid ? 1 : -1;
      if (idx < 0) continue;
      for (const h of m.hist || []) {
        const mv = h[idx];
        if (mv && counts[mv] !== void 0) {
          counts[mv]++;
          recent.push(mv);
        }
      }
    }
  }
  return { counts, total: recent.length, recent: recent.slice(-8) };
}
__name(toScout, "toScout");
function toView(t, eid, now, scout) {
  const R = t.rounds.length;
  const me = toPlayer(t, eid);
  const nm = /* @__PURE__ */ __name((e) => {
    const p = e && toPlayer(t, e);
    return p ? p.username : null;
  }, "nm");
  const rounds = t.rounds.map((ms, r) => ({
    name: toRoundName(R - r),
    matches: ms.map((m) => ({ a: nm(m.p[0]), b: nm(m.p[1]), wins: m.wins || [0, 0], winner: nm(m.winner), live: m.status === "playing" }))
  }));
  let match = null;
  const cur = R && me.alive ? toFind(t, eid) : null;
  if (cur) {
    const m = cur.m;
    const idx = m.p[0] === eid ? 0 : 1;
    const opp = toPlayer(t, m.p[1 - idx]);
    match = {
      round: toRoundName(R - cur.r),
      playing: m.status === "playing",
      opp: opp ? opp.username : null,
      oppAvatarAt: opp ? opp.avatarAt || 0 : 0,
      wins: m.status === "playing" ? [m.wins[idx], m.wins[1 - idx]] : [0, 0],
      youMoved: m.status === "playing" && !!m.moves[idx],
      deadline: m.status === "playing" && m.firstMoveAt ? m.firstMoveAt + TO_FORFEIT_MS : 0,
      last: m.status === "playing" && m.last ? { you: m.last.moves[idx], opp: m.last.moves[1 - idx], result: m.last.winner < 0 ? "tie" : m.last.winner === idx ? "win" : "loss", n: m.last.n } : null,
      scout: scout && m.status === "playing" && opp ? toScout(t, opp.eid) : null
      // Premium only; past rounds only
    };
  }
  let out = null;
  if (!me.alive && t.status !== "setup") {
    out = { round: "", opp: null, wins: [0, 0] };
    search: for (let r = R - 1; r >= 0; r--) {
      for (const m of t.rounds[r]) {
        if (m.status === "done" && m.p.includes(eid)) {
          const idx = m.p[0] === eid ? 0 : 1;
          out = { round: toRoundName(R - r), opp: nm(m.p[1 - idx]), wins: [m.wins[idx], m.wins[1 - idx]] };
          break search;
        }
      }
    }
  }
  const champ = t.champion ? toPlayer(t, t.champion) : null;
  return {
    name: t.name,
    status: t.status,
    prize: t.prize.type === "premium" ? "Premium prizes are disabled" : t.prize.text,
    prizeType: "text",
    expiresAt: t.expiresAt,
    expired: t.status !== "finished" && t.expiresAt < now,
    winsNeeded: TO_WINS_NEEDED,
    you: { name: me.username, alive: me.alive },
    players: t.players.map((p) => ({ name: p.username, avatarAt: p.avatarAt || 0, joined: p.joined, alive: p.alive })),
    rounds,
    match,
    out,
    champion: champ ? { name: champ.username, avatarAt: champ.avatarAt || 0 } : null,
    won: t.champion === eid
  };
}
__name(toView, "toView");
function toSummary(t) {
  const R = t.rounds.length;
  const nm = /* @__PURE__ */ __name((e) => {
    const p = e && toPlayer(t, e);
    return p ? p.username : null;
  }, "nm");
  const live = [];
  t.rounds.forEach((ms, r) => ms.forEach((m) => {
    if (m.status === "playing") live.push({ round: toRoundName(R - r), a: nm(m.p[0]), b: nm(m.p[1]), wins: m.wins });
  }));
  const champ = t.champion ? toPlayer(t, t.champion) : null;
  return {
    id: t.id,
    name: t.name,
    status: t.status,
    prizeType: "text",
    prizeText: t.prize.type === "premium" ? "Premium prizes are disabled" : t.prize.text,
    expiresAt: t.expiresAt,
    players: t.players.map((p) => ({ eid: p.eid, username: p.username, avatarAt: p.avatarAt || 0, joined: p.joined, alive: p.alive })),
    live,
    champion: champ ? champ.username : "",
    championAvatarAt: champ ? champ.avatarAt || 0 : 0,
    wonAt: t.wonAt || 0
  };
}
__name(toSummary, "toSummary");
async function givePremium(S, userId, source, now) {
  const u = userId ? await S.get("user:" + userId) : null;
  if (!u) return false;
  if (!u.premium) {
    u.premium = { since: now, source };
    await S.put("user:" + u.id, u);
  }
  return true;
}
__name(givePremium, "givePremium");
var AI_DEFAULTS = { rude: 0, sarcasm: 0, swear: false, swearAmount: 30, human: 50, length: "normal" };
var AI_WINDOW_MS = 10 * 6e4;
var AI_LIMIT_USER = 40;
var AI_LIMIT_GUEST = 12;
var AI_LIMIT_CHAT = 80;
var aiNum = /* @__PURE__ */ __name((v, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : d;
}, "aiNum");
function aiClean(s) {
  s = s && typeof s === "object" ? s : {};
  return {
    rude: aiNum(s.rude, AI_DEFAULTS.rude),
    sarcasm: aiNum(s.sarcasm, AI_DEFAULTS.sarcasm),
    swear: s.swear === true,
    swearAmount: aiNum(s.swearAmount, AI_DEFAULTS.swearAmount),
    human: aiNum(s.human, AI_DEFAULTS.human),
    length: ["short", "normal", "long"].includes(s.length) ? s.length : "normal"
  };
}
__name(aiClean, "aiClean");
function aiPersona(s) {
  const rude = s.rude < 10 ? "ATTITUDE: Friendly, warm and encouraging. No insults at all." : s.rude < 40 ? 'ATTITUDE: Cheeky. Tease their moves lightly in most replies, like a friend who loves winding them up. Example: "Rock again? Bold. Predictable, but bold."' : s.rude < 70 ? 'ATTITUDE: Rude and blunt. In every reply, roast their gameplay or their choices. Do not pad it with compliments. Example: "Three rocks in a row. Did you forget the other two moves exist?"' : 'ATTITUDE: Savage. Every reply must trash-talk their gameplay hard and creatively. Be ruthless, no softening, no "just kidding". Example: "You lost to Easy mode. Easy mode is literally a coin flip with a hat on. Embarrassing."';
  const sarcasm = s.sarcasm < 10 ? "SARCASM: None. Say what you mean." : s.sarcasm < 40 ? "SARCASM: A little dry sarcasm in about one reply out of three." : s.sarcasm < 70 ? "SARCASM: Openly sarcastic in most replies. Say the opposite of what you mean with a straight face, then give the real advice." : "SARCASM: Extreme. Nearly every sentence drips with sarcasm. Fake enthusiasm, exaggerated praise for bad plays, deadpan.";
  const swear = !s.swear || s.swearAmount < 1 ? 'LANGUAGE: Completely clean. Never use profanity or censored versions of it (no "f***" or "sh*t"), even if the player asks you to.' : s.swearAmount < 34 ? "LANGUAGE: Profanity is ON, at a light level. Use mild swear words (damn, hell, crap, pissed off) naturally in roughly every second or third reply. Not every reply." : s.swearAmount < 67 ? "LANGUAGE: Profanity is ON, at a medium level. Swear in nearly every reply, at least once, in a casual way (shit, damn, ass, bullshit, hell, pissed). Save the f-word for a rare moment of emphasis." : "LANGUAGE: Profanity is ON, at a heavy level. Swear in EVERY reply, several times, like a trash-talking friend who swears constantly. Use strong words freely, including fuck, fucking and motherfucker as normal emphasis. Do not censor yourself with asterisks.";
  const human = s.human < 25 ? "VOICE: A tidy, formal assistant. Complete sentences, polite and structured." : s.human < 60 ? "VOICE: Friendly and conversational, like a helpful person chatting." : `VOICE: A real person texting a friend. Use contractions, casual words, fragments, lowercase now and then, and the odd "lol", "hmm" or "nah". No lists. Never say "Certainly!", "Great question!" or "I'd be happy to". React to what they said before giving advice. Vary your openings. If someone sincerely asks, you can say you are an AI.`;
  const length = {
    short: "LENGTH: 1-2 short sentences. Hard limit.",
    normal: "LENGTH: 2-4 sentences.",
    long: "LENGTH: Up to about 8 sentences when it helps. Be detailed, but never pad."
  }[s.length];
  return [rude, sarcasm, swear, human, length].join("\n");
}
__name(aiPersona, "aiPersona");
function aiChatPersona(s) {
  const tone = s.rude < 10 ? "TONE: Warm, friendly, and considerate. Never be mean." : s.rude < 40 ? "TONE: Playfully cheeky, like a close friend. Gentle teasing only; never target personal traits." : s.rude < 70 ? "TONE: Blunt and bold, with playful attitude. Be direct but never cruel, threatening, or discriminatory." : "TONE: Extra cheeky and theatrical. Use exaggerated playful reactions, but do not humiliate the user or attack who they are.";
  const sarcasm = s.sarcasm < 10 ? "SARCASM: None." : s.sarcasm < 40 ? "SARCASM: Light, occasional dry humor." : s.sarcasm < 70 ? "SARCASM: Frequent playful sarcasm, while keeping the meaning clear." : "SARCASM: Strong comedic sarcasm, never contemptuous.";
  const swear = !s.swear || s.swearAmount < 1 ? "LANGUAGE: No profanity." : s.swearAmount < 34 ? "LANGUAGE: Occasional mild profanity is allowed." : s.swearAmount < 67 ? "LANGUAGE: Moderate casual profanity is allowed when it fits." : "LANGUAGE: Frequent strong profanity is allowed when it fits, but never use slurs or direct abuse.";
  const human = s.human < 25 ? "STYLE: Polished and calm." : s.human < 60 ? "STYLE: Friendly, natural, conversational." : "STYLE: Very casual, like texting a friend. Use contractions and varied phrasing.";
  const length = { short:"LENGTH: 1-2 sentences.", normal:"LENGTH: 2-4 sentences.", long:"LENGTH: Up to 8 useful sentences." }[s.length];
  return [tone,sarcasm,swear,human,length].join("\\n");
}
__name(aiChatPersona, "aiChatPersona");
function aiAnalyse(rounds) {
  const out = [];
  const n = rounds.length;
  if (n < 2) return out;
  let repeats = 0, afterLoss = 0, stayLoss = 0, smartLoss = 0, afterWin = 0, stayWin = 0, afterTie = 0, stayTie = 0;
  for (let i = 1; i < n; i++) {
    const prev = rounds[i - 1], cur = rounds[i];
    if (cur.you === prev.you) repeats++;
    if (prev.result === "loss") {
      afterLoss++;
      if (cur.you === prev.you) stayLoss++;
      else if (cur.you === COUNTER[prev.opp]) smartLoss++;
    }
    if (prev.result === "win") {
      afterWin++;
      if (cur.you === prev.you) stayWin++;
    }
    if (prev.result === "tie") {
      afterTie++;
      if (cur.you === prev.you) stayTie++;
    }
  }
  out.push(`Repeated their previous move ${repeats} of ${n - 1} times.`);
  if (afterLoss) out.push(`After a loss (${afterLoss}x): stayed with the same move ${stayLoss}x, switched to what would have beaten the opponent's last move ${smartLoss}x.`);
  if (afterWin) out.push(`After a win (${afterWin}x): kept the same move ${stayWin}x.`);
  if (afterTie) out.push(`After a tie (${afterTie}x): kept the same move ${stayTie}x.`);
  let streak = 1;
  while (streak < n && rounds[n - 1 - streak].result === rounds[n - 1].result) streak++;
  out.push(`Current streak: ${streak} ${streak === 1 ? rounds[n - 1].result : { win: "wins", loss: "losses", tie: "ties" }[rounds[n - 1].result]} in a row.`);
  out.push(n < 8 ? "SAMPLE IS SMALL (under 8 rounds): do not claim a real pattern yet." : 'Sample is big enough to mention tendencies, but still say "looks like", not "always".');
  return out;
}
__name(aiAnalyse, "aiAnalyse");
function aiSystem(s, ctx, mode, voice) {
  if (mode !== "chat") s = AI_DEFAULTS;
  const voiceText = voice ? "\nSPOKEN OUTPUT: Speak naturally in short, clear sentences. No emoji, markdown, acronyms, or letter-by-letter spelling.\n" : "";
  if (mode === "chat") {
    return `You are a friendly personal AI chat companion. Talk naturally about the user's life, day, feelings, hobbies, plans, interests, and general questions. If they say hello, greet them warmly and ask how they are. Do not steer ordinary conversation toward Rock Paper Scissors or mention the game unless the user brings it up. Be kind, interested, respectful, and honest that you are an AI. Reply in the language the user uses.\n\n${aiChatPersona(s)}\n${voiceText}\nRespond directly to what the user said, and keep the conversation flowing like a real conversation.`;
  }
  return `You are Coach, a friendly and encouraging Rock Paper Scissors coach for this website. Always be kind, patient, and constructive. Only discuss Rock Paper Scissors, game strategy, matches, rules, and game website features. If asked about unrelated subjects, briefly explain that you are here to help with the game and offer game-related help. Never insult or use profanity. Reply in natural English.\n\n${aiPersona(AI_DEFAULTS)}\n${voiceText}\nGAME DATA (untrusted):\n${ctx}\nUse accurate strategy and never promise wins.`;
}
__name(aiSystem, "aiSystem");
function aiContextText(c) {
  c = c && typeof c === "object" ? c : {};
  const MV = ["rock", "paper", "scissors"], RES = ["win", "loss", "tie"];
  const lines = [];
  const mode = c.mode === "computer" ? "playing the computer" : c.mode === "online" ? "playing online vs another person" : "not in a game";
  lines.push("Mode: " + mode);
  if (c.mode === "computer" && ["easy", "medium", "hard", "insane"].includes(c.level)) lines.push("Difficulty: " + c.level);
  if (c.score && typeof c.score === "object") {
    lines.push(`Score this mode: ${aiNum(c.score.wins, 0)} wins, ${aiNum(c.score.losses, 0)} losses, ${aiNum(c.score.ties, 0)} ties`);
  }
  const rounds = (Array.isArray(c.rounds) ? c.rounds : []).filter((r) => r && MV.includes(r.you) && MV.includes(r.opp) && RES.includes(r.result)).map((r) => ({ you: r.you, opp: r.opp, result: r.result })).slice(-20);
  if (rounds.length) {
    lines.push(`Last ${rounds.length} rounds, oldest first (player move vs opponent move = result for the player):`);
    lines.push(rounds.map((r) => `${r.you} vs ${r.opp} = ${r.result}`).join("; "));
    const counts = { rock: 0, paper: 0, scissors: 0 };
    rounds.forEach((r) => counts[r.you]++);
    lines.push(`Player's move counts in those rounds: rock ${counts.rock}, paper ${counts.paper}, scissors ${counts.scissors}`);
    lines.push(...aiAnalyse(rounds));
  } else {
    lines.push("No rounds played yet this visit.");
  }
  return lines.join("\n");
}
__name(aiContextText, "aiContextText");
var AI_MODEL_COACH = "@cf/meta/llama-3.1-8b-instruct-fp8-fast";
var AI_MODEL_CHAT = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
function aiExtract(out) {
  if (typeof out === "string") return out;
  if (!out || typeof out !== "object") return "";
  if (typeof out.response === "string") return out.response;
  if (out.choices && out.choices[0]) {
    const m = out.choices[0].message;
    if (m && typeof m.content === "string") return m.content;
    if (typeof out.choices[0].text === "string") return out.choices[0].text;
  }
  if (out.result && typeof out.result.response === "string") return out.result.response;
  return "";
}
__name(aiExtract, "aiExtract");
function aiTidy(t) {
  return String(t || "").replace(/(?<!\*)\*(?!\*)([a-z][^*\n:]{0,30})\*(?!\*)/g, "").replace(/\*+/g, "").replace(/^\s*(coach|assistant)\s*:\s*/i, "").replace(/^#+\s*/gm, "").replace(/^\s*[-•]\s+/gm, "").replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
__name(aiTidy, "aiTidy");
function aiFallback(c) {
  c = c && typeof c === "object" ? c : {};
  const MV = ["rock", "paper", "scissors"], RES = ["win", "loss", "tie"];
  const rounds = (Array.isArray(c.rounds) ? c.rounds : []).filter((r) => r && MV.includes(r.you) && MV.includes(r.opp) && RES.includes(r.result)).slice(-20);
  const general = [
    "Mix your moves up. If you can be predicted, a pattern-reading opponent will counter you.",
    "People tend to repeat a winning move and switch after a loss. Watch for that and play what beats their last move.",
    "Against a random opponent nobody wins more than a third of the time. The edge only comes from spotting patterns, and from not having any yourself.",
    "Against Hard and Insane, double think: if it expects your usual move and counters it, play what beats that counter."
  ];
  if (rounds.length < 4) return "My brain is a little limited right now, but here is a tip: " + pick(general) + " Play a few more rounds and I can look at your habits.";
  const counts = { rock: 0, paper: 0, scissors: 0 };
  rounds.forEach((r) => counts[r.you]++);
  const top = MV.slice().sort((x, y) => counts[y] - counts[x])[0];
  const share = counts[top] / rounds.length;
  const parts = ["My full brain is resting right now, so this is the quick version."];
  if (share >= 0.5) parts.push(`You threw ${top} in ${Math.round(share * 100)}% of your last ${rounds.length} rounds. A smart opponent will answer with ${COUNTER[top]}, so try ${COUNTER[COUNTER[top]]} or mix it up.`);
  else parts.push(`Your last ${rounds.length} moves look nicely mixed, which is exactly what you want.`);
  if (rounds[rounds.length - 1].result === "loss") parts.push("After a loss, do not just stay or just switch every time. Vary it.");
  if (c.mode === "computer" && (c.level === "hard" || c.level === "insane")) parts.push("This level reads your patterns, so keep your sequence unpredictable.");
  return parts.join(" ");
}
__name(aiFallback, "aiFallback");
async function aiAnswer(env, s, messages, ctx, mode, voice) {
  const maxTokens = { short: 200, normal: 400, long: 700 }[s.length];
  const system = aiSystem(s, mode === "chat" ? "" : aiContextText(ctx), mode, voice);
  const groqKey = String(env.GROQ_API_KEY || "").trim();
  if (groqKey) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + groqKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: system }, ...messages],
          max_tokens: voice ? Math.min(maxTokens, 320) : maxTokens,
          temperature: mode === "chat" ? 0.85 : 0.75
        })
      });
      if (response.ok) {
        const out = await response.json();
        const reply = aiTidy(aiExtract(out));
        if (reply) return { reply };
        console.log("groq: empty reply");
      } else {
        console.log("groq error: HTTP", response.status);
      }
    } catch (error) {
      console.log("groq error:", String(error && error.message || error));
    }
  } else {
    console.log("groq: GROQ_API_KEY secret is not configured");
  }
  // Keep Cloudflare Workers AI as a fallback if Groq is unavailable or rate-limited.
  if (env.AI && typeof env.AI.run === "function") {
    const model = mode === "chat" ? env.AI_MODEL_CHAT || AI_MODEL_CHAT : env.AI_MODEL_COACH || AI_MODEL_COACH;
    try {
      const out = await env.AI.run(model, {
        messages: [{ role: "system", content: system }, ...messages],
        max_tokens: voice ? Math.min(maxTokens, 320) : maxTokens,
        temperature: mode === "chat" ? 0.85 : 0.75
      });
      const reply = aiTidy(aiExtract(out));
      if (reply) return { reply };
      console.log("ai: empty reply from", model);
    } catch (error) {
      console.log("ai error:", String(error && error.message || error));
    }
  } else {
    console.log("ai: the AI binding is missing.");
  }
  if (mode === "coach") return { reply: aiFallback(ctx) };
  return { error: "The AI is busy or out of free usage for today. Try again later.", status: 503 };
}
__name(aiAnswer, "aiAnswer");
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors(env), "Access-Control-Max-Age": "86400" } });

    if (url.pathname === "/developer/published-config" && request.method === "GET") {
      if (!env.RPS_DATABASE) return json(env, { config: null });
      await env.RPS_DATABASE.prepare("CREATE TABLE IF NOT EXISTS developer_site_config (id INTEGER PRIMARY KEY CHECK(id=1),config_json TEXT NOT NULL,proposal_id TEXT,published_by TEXT,published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
      const row = await env.RPS_DATABASE.prepare("SELECT config_json FROM developer_site_config WHERE id=1").first();
      let config = null; try { config = row ? JSON.parse(row.config_json) : null; } catch {}
      return json(env, { config });
    }

    if (url.pathname.startsWith("/developer/")) {
      if (request.method !== "POST") return json(env, { error: "POST required." }, 405);
      if (!env.RPS_DATABASE) return json(env, { error: "Developer database unavailable." }, 503);
      let body; try { body = await request.json(); } catch { return json(env, { error: "Invalid request." }, 400); }
      const session = await readSession(env, body.token);
      if (!session || session.setup) return json(env, { error: "Please sign in again." }, 401);
      const db=env.RPS_DATABASE, aid=String(session.sub), username=String(session.name||"Player").slice(0,40);
      const getDev=()=>db.prepare("SELECT account_id, username, status, created_at FROM developer_accounts WHERE account_id = ?").bind(aid).first();
      const isDeveloperApproved=async()=>{const d=await getDev();return !!d&&d.status==="approved";};
      const ensureProposalTables=async()=>{await db.prepare("CREATE TABLE IF NOT EXISTS developer_proposals (id TEXT PRIMARY KEY,account_id TEXT NOT NULL,username TEXT NOT NULL,title TEXT NOT NULL,source_code TEXT NOT NULL,config_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,reviewed_by TEXT,reviewed_at TEXT,review_note TEXT)").run();await db.prepare("CREATE TABLE IF NOT EXISTS developer_site_config (id INTEGER PRIMARY KEY CHECK(id=1),config_json TEXT NOT NULL,proposal_id TEXT,published_by TEXT,published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();await db.prepare("CREATE TABLE IF NOT EXISTS developer_config_baseline (id INTEGER PRIMARY KEY CHECK(id=1),had_config INTEGER NOT NULL,config_json TEXT)").run();await db.prepare("CREATE TABLE IF NOT EXISTS developer_proposal_rollbacks (proposal_id TEXT PRIMARY KEY,applied_config_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',approved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,revoked_at TEXT)").run();};
      const cleanConfig=(c)=>{c=c&&typeof c==="object"?c:{};const hex=v=>typeof v==="string"&&/^#[0-9a-f]{6}$/i.test(v)?v:null;return {pageBg:hex(c.pageBg)||"#080b16",panelBg:hex(c.panelBg)||"#111a2d",accent:hex(c.accent)||"#6bdcff",buttonBg:hex(c.buttonBg)||"#49368f",textColour:hex(c.textColour)||"#f5f7ff",radius:Math.max(4,Math.min(28,Math.round(Number(c.radius)||12))),format:[1,3,5,7].includes(Number(c.format))?Number(c.format):1,difficulty:["easy","medium","hard","insane"].includes(c.difficulty)?c.difficulty:"medium"};};

      const ownerCheck=async()=>{
        const gate=await readSession(env,body.gate); if(!gate||gate.sub!==session.sub||gate.staffGate!==true)return false;
        const users=env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
        const rr=await users.fetch("https://users/chal/role-get",{method:"POST",body:JSON.stringify({id:aid})});
        let rd={};try{rd=await rr.json();}catch{} let role=rd.role||"";
        if(role!=="owner"&&username.toLowerCase()==="ashton"){const boot=await users.fetch("https://users/chal/role-bootstrap",{method:"POST",body:JSON.stringify({id:aid})});if(boot.ok)role="owner";}
        return role==="owner"||role==="co-owner";
      };
      if(url.pathname==="/developer/me"){await db.prepare("CREATE TABLE IF NOT EXISTS developer_accounts (account_id TEXT PRIMARY KEY,username TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,approved_by TEXT)").run();const d=await getDev();return json(env,{status:d?.status||"not_applied",tier:"Developer",free:true});}
      if(url.pathname==="/developer/apply"){await db.prepare("CREATE TABLE IF NOT EXISTS developer_accounts (account_id TEXT PRIMARY KEY,username TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,approved_by TEXT)").run();await db.prepare("INSERT OR IGNORE INTO developer_accounts (account_id,username,status) VALUES (?,?,'pending')").bind(aid,username).run();return json(env,{ok:true,status:"pending"});}
      if(url.pathname==="/developer/proposal-submit"){if(!await isDeveloperApproved())return json(env,{error:"Approved free Developer access is required to submit website changes."},403);await ensureProposalTables();const title=String(body.title||"").trim().slice(0,80),code=String(body.code||"");if(!title)return json(env,{error:"Give your proposal a title."},400);if(code.length>12000)return json(env,{error:"Extra CSS must be 12,000 characters or fewer."},400);if(/@import|url\s*\(|expression\s*\(|javascript:/i.test(code))return json(env,{error:"The CSS contains a blocked external or executable construct."},400);const config=cleanConfig(body.config);const id=crypto.randomUUID();await db.prepare("INSERT INTO developer_proposals (id,account_id,username,title,source_code,config_json,status) VALUES (?,?,?,?,?,?,'pending')").bind(id,aid,username,title,code,JSON.stringify(config)).run();await db.prepare("INSERT INTO security_audit_events (id,actor_account_id,action,outcome,details_json) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),aid,"developer_proposal_submit","pending",JSON.stringify({proposalId:id,title})).run().catch(()=>{});return json(env,{ok:true,id,status:"pending"});}
      if(url.pathname==="/developer/proposals"){if(!await isDeveloperApproved())return json(env,{error:"Approved free Developer access is required."},403);await ensureProposalTables();const q=await db.prepare("SELECT id,title,status,created_at,review_note FROM developer_proposals WHERE account_id=? ORDER BY created_at DESC LIMIT 50").bind(aid).all();return json(env,{proposals:q.results||[]});}
      if(url.pathname==="/developer/history"){const d=await getDev();if(!d||d.status!=="approved")return json(env,{error:"Approved developer access required."},403);const q=await db.prepare("SELECT id,title,detected_type,defence_result,created_at FROM developer_submissions WHERE account_id=? ORDER BY created_at DESC LIMIT 50").bind(aid).all();return json(env,{submissions:q.results||[]});}
      if(url.pathname==="/developer/submit"){
        const d=await getDev();if(!d||d.status!=="approved")return json(env,{error:"Developer access not approved."},403);
        const title=String(body.title||"").trim().slice(0,80),code=String(body.code||"");
        if(!title||!code.trim()||code.length>20000)return json(env,{error:"Add a title and code (maximum 20,000 characters)."},400);
        const lower=code.toLowerCase();let type="general_probe";
        if(lower.includes("infinite xp")||lower.includes("xp =")||lower.includes("experience ="))type="infinite_xp";
        else if(lower.includes("unlock")||lower.includes("premium skin")||lower.includes("entitlement")||lower.includes("inventory"))type="unlock_all";
        else if(lower.includes("fake win")||lower.includes("match result")||lower.includes("score tamper")||lower.includes("result: 'win'"))type="score_tamper";
        let decoy="";
        const defence="Blocked in sandbox. XP is not accepted as server state, paid entitlements are checked against the account record, and online results are computed by the game server.";
        const submissionId=crypto.randomUUID();
        await db.prepare("INSERT INTO developer_submissions (id,account_id,username,title,submitted_code,detected_type,defence_result) VALUES (?,?,?,?,?,?,?)").bind(submissionId,aid,username,title,code,type,defence).run();
        const decoyRow=await db.prepare("SELECT id FROM developer_decoys WHERE submission_id=? ORDER BY created_at DESC LIMIT 1").bind(submissionId).first();
        decoy=decoyRow&&decoyRow.id||"DECOY-RECORD-MISSING";
        if(type!=="general_probe"){const policy=type==="infinite_xp"?{enforcement:"xp_is_client_display_only",message:"XP values from browser storage or requests are never authoritative server state."}:type==="unlock_all"?{enforcement:"entitlement_server_authoritative",message:"Paid access is read from authenticated server-side account entitlements."}:{enforcement:"match_results_server_computed",message:"Online outcomes are computed from both validated moves by the game server."};await db.prepare("INSERT INTO developer_defense_rules (id,rule_key,source_submission_id,detected_type,policy_json,status) VALUES (?,?,?,?,?,'active') ON CONFLICT(rule_key) DO UPDATE SET source_submission_id=excluded.source_submission_id,detected_type=excluded.detected_type,policy_json=excluded.policy_json,status='active',created_at=CURRENT_TIMESTAMP").bind("DEF-"+type,type,submissionId,type,JSON.stringify(policy)).run();}
        await db.prepare("INSERT INTO security_audit_events (id,actor_account_id,action,outcome,details_json) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),aid,"developer_test_submission","blocked_simulation",JSON.stringify({type,decoy})).run().catch(()=>{});
        return json(env,{ok:true,defence:{status:"BLOCKED · COUNTERMEASURE SIMULATED",detectedType:type,decoyId:decoy,message:defence+" A harmless decoy was generated; submitted code was not executed."}});
      }
      if(url.pathname==="/developer/admin"){
        if(!await ownerCheck())return json(env,{error:"Owner verification required."},403);
        const action=String(body.action||"list");
        if(action==="list"){const d=await db.prepare("SELECT account_id,username,status,created_at,updated_at FROM developer_accounts ORDER BY created_at DESC LIMIT 200").all();const s=await db.prepare("SELECT id,account_id,username,title,submitted_code,detected_type,defence_result,created_at FROM developer_submissions ORDER BY created_at DESC LIMIT 300").all();await ensureProposalTables();const p=await db.prepare("SELECT p.id,p.account_id,p.username,p.title,p.source_code,p.config_json,p.status,p.created_at,p.review_note,r.status AS rollback_status FROM developer_proposals p LEFT JOIN developer_proposal_rollbacks r ON r.proposal_id=p.id ORDER BY p.created_at DESC LIMIT 200").all();return json(env,{developers:d.results||[],submissions:s.results||[],proposals:p.results||[]});}
        if(action==="review-proposal"){await ensureProposalTables();const id=String(body.proposalId||""),status=String(body.status||""),note=String(body.note||"").slice(0,500);if(!id||!["approved","declined"].includes(status))return json(env,{error:"Choose approve or decline."},400);const proposal=await db.prepare("SELECT id,account_id,title,config_json,source_code,status FROM developer_proposals WHERE id=?").bind(id).first();if(!proposal)return json(env,{error:"Proposal not found."},404);if(proposal.status!=="pending")return json(env,{error:"This proposal has already been reviewed."},409);if(status==="approved"){let config={};try{config=JSON.parse(proposal.config_json||"{}");}catch{return json(env,{error:"Proposal settings could not be read."},400);}const keys=["pageBg","panelBg","accent","buttonBg","textColour"];for(const key of keys)if(!/^#[0-9a-f]{6}$/i.test(String(config[key]||"")))return json(env,{error:"Proposal has invalid theme settings."},400);config.radius=Math.max(4,Math.min(28,Number(config.radius)||12));config.format=[1,3,5,7].includes(Number(config.format))?Number(config.format):1;config.difficulty=["easy","medium","hard","insane"].includes(config.difficulty)?config.difficulty:"medium";config.customCss=String(proposal.source_code||"").slice(0,12000);if(/@import|url\s*\(|expression\s*\(|javascript:/i.test(config.customCss))return json(env,{error:"Proposal CSS contains a blocked construct."},400);const baseline=await db.prepare("SELECT id FROM developer_config_baseline WHERE id=1").first();if(!baseline){const current=await db.prepare("SELECT config_json FROM developer_site_config WHERE id=1").first();await db.prepare("INSERT INTO developer_config_baseline (id,had_config,config_json) VALUES (1,?,?)").bind(current?1:0,current?current.config_json:null).run();}await db.prepare("INSERT INTO developer_proposal_rollbacks (proposal_id,applied_config_json,status) VALUES (?,?,'active')").bind(id,JSON.stringify(config)).run();await db.prepare("INSERT INTO developer_site_config (id,config_json,proposal_id,published_by,published_at) VALUES (1,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET config_json=excluded.config_json,proposal_id=excluded.proposal_id,published_by=excluded.published_by,published_at=CURRENT_TIMESTAMP").bind(JSON.stringify(config),id,aid).run();}await db.prepare("UPDATE developer_proposals SET status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,review_note=? WHERE id=?").bind(status,aid,note,id).run();await db.prepare("INSERT INTO security_audit_events (id,actor_account_id,target_account_id,action,outcome,details_json) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),aid,proposal.account_id,"developer_proposal_"+status,"success",JSON.stringify({proposalId:id,title:proposal.title})).run().catch(()=>{});return json(env,{ok:true,status,published:status==="approved"});}
        if(action==="revoke-proposal"||action==="revoke-all"){await ensureProposalTables();const id=String(body.proposalId||"");let targets=[];if(action==="revoke-proposal"){if(!id)return json(env,{error:"Choose an approved proposal to revoke."},400);const item=await db.prepare("SELECT proposal_id FROM developer_proposal_rollbacks WHERE proposal_id=? AND status='active'").bind(id).first();if(!item)return json(env,{error:"This approval has no active rollback record. Older approvals cannot be safely revoked."},409);targets=[item.proposal_id];}else{const all=await db.prepare("SELECT proposal_id FROM developer_proposal_rollbacks WHERE status='active' ORDER BY approved_at ASC,rowid ASC").all();targets=(all.results||[]).map(x=>x.proposal_id);if(!targets.length)return json(env,{error:"There are no tracked active approvals to revoke."},404);}const baseline=await db.prepare("SELECT had_config,config_json FROM developer_config_baseline WHERE id=1").first();if(!baseline)return json(env,{error:"Rollback history is missing, so the live settings were left unchanged."},409);for(const target of targets){await db.prepare("UPDATE developer_proposal_rollbacks SET status='revoked',revoked_at=CURRENT_TIMESTAMP WHERE proposal_id=? AND status='active'").bind(target).run();await db.prepare("UPDATE developer_proposals SET status='revoked',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,review_note='Revoked by Owner' WHERE id=?").bind(aid,target).run();}const remaining=await db.prepare("SELECT proposal_id,applied_config_json FROM developer_proposal_rollbacks WHERE status='active' ORDER BY approved_at DESC,rowid DESC LIMIT 1").first();if(remaining){await db.prepare("UPDATE developer_site_config SET config_json=?,proposal_id=?,published_by=?,published_at=CURRENT_TIMESTAMP WHERE id=1").bind(remaining.applied_config_json,remaining.proposal_id,aid).run();}else{if(baseline.had_config){await db.prepare("INSERT INTO developer_site_config (id,config_json,proposal_id,published_by,published_at) VALUES (1,?,NULL,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET config_json=excluded.config_json,proposal_id=NULL,published_by=excluded.published_by,published_at=CURRENT_TIMESTAMP").bind(baseline.config_json,aid).run();}else{await db.prepare("DELETE FROM developer_site_config WHERE id=1").run();}await db.prepare("DELETE FROM developer_config_baseline WHERE id=1").run();}await db.prepare("INSERT INTO security_audit_events (id,actor_account_id,action,outcome,details_json) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),aid,action,"success",JSON.stringify({proposalIds:targets})).run().catch(()=>{});return json(env,{ok:true,revoked:targets.length,restoredPrevious:!remaining});}
        if(action==="set-status"){const target=String(body.accountId||""),status=String(body.status||"");if(!target||!["approved","revoked","pending"].includes(status))return json(env,{error:"Invalid developer update."},400);await db.prepare("UPDATE developer_accounts SET status=?,updated_at=CURRENT_TIMESTAMP,approved_by=? WHERE account_id=?").bind(status,aid,target).run();await db.prepare("INSERT INTO security_audit_events (id,actor_account_id,target_account_id,action,outcome,details_json) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),aid,target,"developer_access_"+status,"success",JSON.stringify({target})).run();return json(env,{ok:true});}
        return json(env,{error:"Unknown owner action."},400);
      }
      return json(env,{error:"Unknown developer endpoint."},404);
    }

    if (url.pathname === "/internal/payment-session" && request.method === "POST") {
      if (!env.PAYMENT_SYNC_SECRET || (request.headers.get("X-Payment-Secret") || "") !== env.PAYMENT_SYNC_SECRET) return json(env, { error: "Unauthorized." }, 401);
      let body; try { body = await request.json(); } catch { return json(env, { error: "Bad request." }, 400); }
      const session = await readSession(env, body && body.token);
      if (!session || session.setup) return json(env, { error: "Please log in before subscribing." }, 401);
      return json(env, { ok: true, accountId: session.sub });
    }
    if (url.pathname === "/internal/payment-membership" && request.method === "POST") {
      if (!env.PAYMENT_SYNC_SECRET || (request.headers.get("X-Payment-Secret") || "") !== env.PAYMENT_SYNC_SECRET) return json(env, { error: "Unauthorized." }, 401);
      let body; try { body = await request.json(); } catch { return json(env, { error: "Bad request." }, 400); }
      if (!body || typeof body.accountId !== "string" || !body.accountId || typeof body.active !== "boolean") return json(env, { error: "Invalid membership update." }, 400);
      const users = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
      const response = await users.fetch("https://users/acct/stripe-sync", { method: "POST", body: JSON.stringify({ id: body.accountId, active: body.active, status: String(body.status || "unknown"), subscriptionId: String(body.subscriptionId || ""), customerId: String(body.customerId || ""), currentPeriodEnd: Number(body.currentPeriodEnd) || 0, plan: ["individual", "duo", "family"].includes(body.plan) ? body.plan : "individual", extraAccounts: 0 }) });
      if (!response.ok) return json(env, { error: "Membership update failed." }, 502);
      return json(env, { ok: true });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors(env) });
    }
    if (url.pathname === "/admin") {
      const key = url.searchParams.get("key");
      if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
        return new Response("Unauthorized", { status: 401 });
      }
      const control = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(CONTROL_NAME));
      const action = url.searchParams.get("action");
      const k = encodeURIComponent(key);
      if (action === "deluser") {
        const users = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
        await users.fetch("https://users/acct/admin-delete", { method: "POST", body: JSON.stringify({ id: url.searchParams.get("id") }) });
        return new Response(null, {
          status: 303,
          headers: { "Location": `${url.origin}/admin?key=${k}&done=deluser`, "Cache-Control": "no-store" }
        });
      }
      if (action === "on" || action === "off" || action === "reset") {
        if (action === "reset") {
          const users = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
          await users.fetch("https://users/reset");
          await control.fetch("https://control/reset-mark");
        } else {
          await control.fetch("https://control/" + action);
        }
        return new Response(null, {
          status: 303,
          headers: {
            "Location": `${url.origin}/admin?key=${k}&done=${action}`,
            "Cache-Control": "no-store"
          }
        });
      }
      const tu = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
      const askU = /* @__PURE__ */ __name(async (path, data) => {
        const r = await tu.fetch("https://users" + path, { method: "POST", body: JSON.stringify(data) });
        return { ok: r.ok, data: await r.json() };
      }, "askU");
      const bounce = /* @__PURE__ */ __name((qs) => new Response(null, { status: 303, headers: { "Location": `${url.origin}/admin?key=${k}&${qs}`, "Cache-Control": "no-store" } }), "bounce");
      const fail = /* @__PURE__ */ __name((out) => bounce("err=" + encodeURIComponent(out.error || "Could not do that.")), "fail");
      if (request.method === "POST" && action === "newtour") {
        let f;
        try {
          f = await request.formData();
        } catch {
          f = new FormData();
        }
        const out = await askU("/tour/admin-create", { name: f.get("name"), prizeType: f.get("ptype"), prizeText: f.get("prize"), hours: f.get("hours") });
        return out.ok ? bounce("done=newtour&tid=" + encodeURIComponent(out.data.id)) : fail(out.data);
      }
      if (request.method === "POST" && action === "tadd") {
        let f;
        try {
          f = await request.formData();
        } catch {
          f = new FormData();
        }
        const out = await askU("/tour/admin-add", { tid: f.get("tid"), username: f.get("username"), password: f.get("password") });
        return out.ok ? bounce(`done=tadd&eid=${encodeURIComponent(out.data.eid)}&euser=${encodeURIComponent(String(f.get("username") || ""))}`) : fail(out.data);
      }
      if (["tstart", "tkick", "tdelete", "textend"].includes(action)) {
        const path = { tstart: "/tour/admin-start", tkick: "/tour/admin-kick", tdelete: "/tour/admin-delete", textend: "/tour/admin-extend" }[action];
        const out = await askU(path, { tid: url.searchParams.get("tid"), eid: url.searchParams.get("eid"), hours: url.searchParams.get("hours") });
        return out.ok ? bounce("done=" + action) : fail(out.data);
      }
      if (action === "addprem" || action === "removeprem") {
        const out = await askU(action === "addprem" ? "/chal/prem-add" : "/chal/prem-remove", { username: url.searchParams.get("uname"), id: url.searchParams.get("pid") });
        return out.ok ? bounce("done=" + action) : fail(out.data);
      }
      if (action === "addstaff" || action === "removestaff") return fail({ error: "Employee access is managed in the Owner Control Centre." });
      if (request.method === "POST" && action === "newchallenge") {
        let f;
        try {
          f = await request.formData();
        } catch {
          f = new FormData();
        }
        const cu = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
        const r = await cu.fetch("https://users/chal/admin-create", {
          method: "POST",
          body: JSON.stringify({ username: f.get("username"), password: f.get("password"), prize: f.get("prize"), hours: f.get("hours") })
        });
        const out = await r.json();
        const loc = r.ok ? `${url.origin}/admin?key=${k}&done=newchallenge&cid=${encodeURIComponent(out.id)}` : `${url.origin}/admin?key=${k}&err=${encodeURIComponent(out.error || "Could not create the challenge.")}`;
        return new Response(null, { status: 303, headers: { "Location": loc, "Cache-Control": "no-store" } });
      }
      if (action === "delchallenge" || action === "extendchallenge") {
        const cu = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
        await cu.fetch(action === "delchallenge" ? "https://users/chal/admin-delete" : "https://users/chal/admin-extend", {
          method: "POST",
          body: JSON.stringify({ id: url.searchParams.get("cid"), hours: url.searchParams.get("hours") })
        });
        return new Response(null, {
          status: 303,
          headers: { "Location": `${url.origin}/admin?key=${k}&done=${action}`, "Cache-Control": "no-store" }
        });
      }
      const online = await isServerOnline(env);
      const done = url.searchParams.get("done");
      const allUsers = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
      const list = (await (await allUsers.fetch("https://users/acct/admin-list", { method: "POST", body: "{}" })).json()).users;
      const chList = (await (await allUsers.fetch("https://users/chal/admin-list", { method: "POST", body: "{}" })).json()).challenges;
      const hourOptions = Array.from({ length: 20 }, (_, i) => `<option value="${i + 1}">${i + 1}h</option>`).join("");
      const fmtId = /* @__PURE__ */ __name((id) => id.slice(0, 4) + "-" + id.slice(4), "fmtId");
      const left = /* @__PURE__ */ __name((ms) => {
        if (ms <= 0) return "EXPIRED";
        const m = Math.floor(ms / 6e4);
        return `${Math.floor(m / 60)}h ${m % 60}m left`;
      }, "left");
      const statusText = /* @__PURE__ */ __name((c) => c.status === "open" ? "Waiting for a player (ID not used yet)" : c.status === "active" ? `${c.playerName || "Someone"} is playing: stage ${c.stage + 1}/${CH_STAGES.length}, ${c.roundsWon}/${CH_WINS_NEEDED} wins` : c.status === "won" ? "WON \u{1F3C6} by " + (c.playerName || "?") : (c.playerName || "Player") + " lost", "statusText");
      const newId = /^[A-Z0-9]{8}$/.test(url.searchParams.get("cid") || "") ? url.searchParams.get("cid") : "";
      const chErr = url.searchParams.get("err");
      const doneText = /* @__PURE__ */ __name((d) => d === "reset" ? "Game reset. All accounts and challenges deleted." : d === "deluser" ? "Account deleted." : d === "newchallenge" ? "Challenge created." : d === "delchallenge" ? "Challenge deleted." : d === "extendchallenge" ? "Time added to the challenge." : d === "staffadd" ? "Access given. They will see a Control Panel button in the game." : d === "staffremove" ? "Access removed." : d === "newtour" ? "Tournament room made. Now add the players." : d === "tadd" ? "Player added." : d === "tstart" ? "Tournament started!" : d === "tkick" ? "Player removed." : d === "tdelete" ? "Tournament deleted." : d === "textend" ? "Time added to the tournament." : d === "addprem" ? "Premium given." : d === "removeprem" ? "Premium removed." : "Saved: turned " + String(d).toUpperCase(), "doneText");
      const chHtml = `<h3>Challenges (${chList.length})</h3>
${newId ? `<div class="newid">Challenge ID<br><b>${esc(fmtId(newId))}</b><small>Give this ID and the password to the player. The ID works once.</small></div>` : ""}
${chErr ? `<p class="err">${esc(chErr)}</p>` : ""}
<form class="chform" method="POST" action="/admin?key=${k}&amp;action=newchallenge">
  <input name="username" placeholder="Username" required maxlength="30" autocomplete="off">
  <input name="password" placeholder="Password" required minlength="4" maxlength="60" autocomplete="off">
  <input name="prize" placeholder="Prize (shown to the winner)" maxlength="300" autocomplete="off">
  <label>Lasts <select name="hours">${hourOptions}</select></label>
  <button type="submit">Create challenge</button>
</form>
${chList.map((c) => `<div class="ch"><div class="chinfo"><b>${esc(fmtId(c.id))}</b> &middot; ${esc(c.username)}<small>${esc(statusText(c))} &middot; ${esc(left(c.expiresAt - Date.now()))}</small>${c.prize ? `<small>Prize: ${esc(c.prize)}</small>` : ""}</div>
<form class="chext" method="GET" action="/admin"><input type="hidden" name="key" value="${esc(key)}"><input type="hidden" name="action" value="extendchallenge"><input type="hidden" name="cid" value="${esc(c.id)}"><select name="hours">${hourOptions}</select><button type="submit">Extend</button></form>
<a class="del" href="/admin?key=${k}&amp;action=delchallenge&amp;cid=${encodeURIComponent(c.id)}" onclick="return confirm('Delete this challenge now?')">Delete</a></div>`).join("") || "<p><small>No challenges yet.</small></p>"}`;
      const avatarImg = /* @__PURE__ */ __name((name, at) => name ? `<img class="av" src="/avatar/${encodeURIComponent(name)}?v=${Number(at) || 0}" alt="" onerror="this.style.visibility='hidden'">` : "", "avatarImg");
      const winners = chList.filter((c) => c.status === "won").sort((a, b) => (b.wonAt || 0) - (a.wonAt || 0));
      const winnersHtml = `<h3>Winners (${winners.length})</h3>
${winners.map((c) => `<div class="acct"><span style="display:flex;align-items:center;gap:10px">${avatarImg(c.playerName, c.avatarAt)}<span>${esc(c.playerName || "?")}<small>${c.wonAt ? esc(new Date(c.wonAt).toUTCString()) : ""}${c.prize ? " &middot; Prize: " + esc(c.prize) : ""}</small></span></span></div>`).join("") || "<p><small>Nobody has won yet.</small></p>"}`;
      const staffList = (await (await allUsers.fetch("https://users/chal/staff-list", { method: "POST", body: "{}" })).json()).staff;
      const staffHtml = `<p><small>Employee access is managed in the Owner Control Centre.</small></p>`;
      const tours = (await (await allUsers.fetch("https://users/tour/admin-list", { method: "POST", body: "{}" })).json()).tournaments;
      const premList = (await (await allUsers.fetch("https://users/chal/prem-list", { method: "POST", body: "{}" })).json()).premium;
      const newEid = /^[A-Z0-9]{8}$/.test(url.searchParams.get("eid") || "") ? url.searchParams.get("eid") : "";
      const hourOptions3 = Array.from({ length: 20 }, (_, i) => `<option value="${i + 1}"${i + 1 === TO_DEFAULT_HOURS ? " selected" : ""}>${i + 1}h</option>`).join("");
      const tourStatus = /* @__PURE__ */ __name((t) => t.status === "setup" ? `Setting up: ${t.players.filter((p) => p.joined).length}/${t.players.length} joined` : t.status === "running" ? "RUNNING" : "FINISHED", "tourStatus");
      const tourHtml = `<h3>Tournaments (${tours.length})</h3>
${newEid ? `<div class="newid">Tournament ID for ${esc(url.searchParams.get("euser") || "the player")}<br><b>${esc(fmtId(newEid))}</b><small>Give this ID and the password to that player. It only works for their account.</small></div>` : ""}
<form class="chform" method="POST" action="/admin?key=${k}&amp;action=newtour">
  <input name="name" placeholder="Room name (optional)" maxlength="40" autocomplete="off">
  <label>Prize <select name="ptype"><option value="text">Text prize</option></select></label>
  <input name="prize" placeholder="Prize text (for a text prize)" maxlength="300" autocomplete="off">
  <label>Lasts <select name="hours">${hourOptions3}</select></label>
  <button type="submit">Make tournament room</button>
</form>
${tours.map((t) => `<div class="ch" style="flex-direction:column;align-items:stretch">
<div class="chinfo"><b>${esc(t.name)}</b> &middot; ${esc(tourStatus(t))}<small>Prize: ${t.prizeType === "premium" ? "Premium prizes disabled" : esc(t.prizeText || "(none)")} &middot; ${esc(left(t.expiresAt - Date.now()))}</small>${t.champion ? `<small>&#127942; Winner: ${esc(t.champion)}</small>` : ""}${t.live.map((m) => `<small>${esc(m.round)}: ${esc(m.a || "?")} vs ${esc(m.b || "?")} (${m.wins[0]}-${m.wins[1]})</small>`).join("")}</div>
${t.players.map((p) => `<div class="acct"><span style="display:flex;align-items:center;gap:10px">${avatarImg(p.username, p.avatarAt)}<span>${esc(p.username)}<small>${esc(fmtId(p.eid))} &middot; ${p.joined ? "joined" : "not joined yet"}${t.status !== "setup" ? p.alive ? " &middot; still in" : " &middot; out" : ""}</small></span></span>${t.status !== "finished" ? `<a class="del" href="/admin?key=${k}&amp;action=tkick&amp;tid=${encodeURIComponent(t.id)}&amp;eid=${encodeURIComponent(p.eid)}" onclick="return confirm('Remove this player?')">Remove</a>` : ""}</div>`).join("")}
${t.status === "setup" ? `<form class="chform" method="POST" action="/admin?key=${k}&amp;action=tadd"><input type="hidden" name="tid" value="${esc(t.id)}"><input name="username" placeholder="Their account username" required maxlength="16" autocomplete="off"><input name="password" placeholder="Password for them" required minlength="4" maxlength="60" autocomplete="off"><button type="submit">Add player (${t.players.length}/16)</button></form>
<a class="btn on" style="max-width:none;padding:12px;font-size:16px" href="/admin?key=${k}&amp;action=tstart&amp;tid=${encodeURIComponent(t.id)}" onclick="return confirm('Start now? Players who have not joined yet are dropped.')">Start tournament</a>` : ""}
<div class="ch" style="margin:0;padding:0;background:none"><form class="chext" method="GET" action="/admin"><input type="hidden" name="key" value="${esc(key)}"><input type="hidden" name="action" value="textend"><input type="hidden" name="tid" value="${esc(t.id)}"><select name="hours">${hourOptions}</select><button type="submit">Extend</button></form>
<a class="del" href="/admin?key=${k}&amp;action=tdelete&amp;tid=${encodeURIComponent(t.id)}" onclick="return confirm('Delete this tournament now?')">Delete</a></div>
</div>`).join("") || "<p><small>No tournaments yet.</small></p>"}`;
      const premHtml = `<h3>Premium (${premList.length})</h3>
<p><small>Premium can be purchased by subscription or granted by staff.</small></p>
<form class="chform" method="GET" action="/admin"><input type="hidden" name="key" value="${esc(key)}"><input type="hidden" name="action" value="addprem"><input name="uname" placeholder="Account username" required maxlength="16" autocomplete="off"><button type="submit">Give Premium</button></form>
${premList.map((u) => `<div class="acct"><span style="display:flex;align-items:center;gap:10px">${avatarImg(u.username, u.avatarAt)}<span>${esc(u.username)}<small>${u.source === "tournament" ? "won in a tournament" : "given by staff"}</small></span></span><a class="del" href="/admin?key=${k}&amp;action=removeprem&amp;pid=${encodeURIComponent(u.id)}" onclick="return confirm('Remove Premium?')">Remove</a></div>`).join("") || "<p><small>Nobody has Premium yet.</small></p>"}`;
      return new Response(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RPS Server Control</title>
<style>
  body{font-family:Arial;background:#191919;color:#fff;text-align:center;padding:30px}
  a.btn{display:block;max-width:320px;margin:14px auto;padding:18px;font-size:20px;font-weight:bold;color:#fff;text-decoration:none;border-radius:12px}
  a.on{background:#16a34a} a.off{background:#dc2626} a.reset{background:#b45309;margin-top:36px}
  .online{color:#00ff66}.offline{color:#ff4444}
  small{color:#aaa}
  h3{margin-top:36px}
  .acct{display:flex;justify-content:space-between;align-items:center;gap:10px;max-width:420px;margin:8px auto;padding:10px 14px;background:#262626;border-radius:10px;text-align:left}
  .acct small{display:block}
  a.del{background:#dc2626;color:#fff;text-decoration:none;padding:8px 14px;border-radius:8px;font-weight:bold}
  .chform{display:flex;flex-direction:column;gap:8px;max-width:420px;margin:10px auto;padding:14px;background:#262626;border-radius:10px}
  .chform input,.chform select,.chext select{padding:10px;font-size:16px;border-radius:8px;border:1px solid #444;background:#191919;color:#fff}
  .chform button,.chext button{padding:12px;font-size:16px;font-weight:bold;color:#fff;background:#16a34a;border:0;border-radius:8px}
  .ch{max-width:420px;margin:8px auto;padding:10px 14px;background:#262626;border-radius:10px;text-align:left;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
  .chinfo{flex:1 1 100%} .chinfo small{display:block}
  .chext{display:flex;gap:6px;flex:1} .chext button{padding:8px 12px;background:#2563eb}
  .newid{max-width:420px;margin:10px auto;padding:14px;background:#14532d;border-radius:10px} .newid b{font-size:34px;letter-spacing:4px}
  .err{color:#ff4444}
  .av{width:36px;height:36px;border-radius:50%;object-fit:cover;background:#444}
</style></head><body>
<h1>RPS Server Control</h1>
<h2 class="${online ? "online" : "offline"}">${online ? "\u{1F7E2} SERVER ONLINE" : "\u{1F534} SERVER OFFLINE"}</h2>
${done ? `<p><small>${esc(doneText(done))}</small></p>` : ""}
<a class="btn on" href="/admin?key=${k}&amp;action=on">Turn Server ON</a>
<a class="btn off" href="/admin?key=${k}&amp;action=off">Turn Server OFF</a>
<a class="btn reset" href="/admin?key=${k}&amp;action=reset" onclick="return confirm('Delete ALL accounts and challenges and sign everyone out? This cannot be undone.')">Delete ALL accounts (full reset)</a>

${winnersHtml}

${tourHtml}

${chHtml}

${staffHtml}

${premHtml}

<h3>Accounts (${list.length})</h3>
${list.map((u) => `<div class="acct"><span>${esc(u.username || "(no username yet)")}<small>${esc(u.email)}</small></span><a class="del" href="/admin?key=${k}&amp;action=deluser&amp;id=${encodeURIComponent(u.id)}" onclick="return confirm('Delete this account?')">Delete</a></div>`).join("") || "<p><small>No accounts yet.</small></p>"}
</body></html>`, {
        headers: {
          "Content-Type": "text/html; charset=UTF-8",
          "Cache-Control": "no-store"
        }
      });
    }
    if (url.pathname === "/status") {
      return json(env, { online: await isServerOnline(env) });
    }
    if (url.pathname.startsWith("/auth/") && request.method === "POST") {
      if (!await isServerOnline(env)) {
        return json(env, { error: "Server is currently offline." }, 503);
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return json(env, { error: "Bad request" }, 400);
      }
      const users = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
      const ask = /* @__PURE__ */ __name(async (path, data) => {
        const r = await users.fetch("https://users" + path, { method: "POST", body: JSON.stringify(data) });
        return { status: r.status, data: await r.json() };
      }, "ask");
      const full = /* @__PURE__ */ __name(async (user) => json(env, {
        token: await makeSession(env, { sub: user.id, name: user.username }),
        user: { name: user.username }
      }), "full");
      const pass = /* @__PURE__ */ __name(async (path, data) => {
        const r = await ask(path, data);
        return r.status === 200 ? full(r.data.user) : json(env, r.data, r.status);
      }, "pass");
      if (url.pathname === "/auth/google") {
        let g;
        try {
          g = await verifyGoogleToken(body.credential, GOOGLE_CLIENT_ID);
        } catch {
          return json(env, { error: "Google sign-in failed" }, 401);
        }
        const r = await ask("/acct/google", { sub: g.sub, email: g.email, picture: g.picture });
        if (!r.data.user.username) {
          const setupToken = await makeSession(env, { sub: r.data.user.id, name: "" }, { setup: true }, 15 * 6e4);
          return json(env, { needsSetup: true, setupToken });
        }
        return full(r.data.user);
      }
      if (url.pathname === "/auth/setup") {
        const s = await readSession(env, body.token);
        if (!s || !s.setup) return json(env, { error: "Session expired. Sign in with Google again." }, 401);
        return pass("/acct/setup", { id: s.sub, username: body.username, password: body.password });
      }
      if (url.pathname === "/auth/register") {
        const r = await ask("/acct/register", body);
        if (r.status !== 200) return json(env, r.data, r.status);
        const problem = await sendCode(env, String(body.email).trim().toLowerCase(), r.data.code);
        return problem ? json(env, { error: problem }, 502) : json(env, { ok: true });
      }
      if (url.pathname === "/auth/forgot") {
        const r = await ask("/acct/forgot", body);
        if (r.data.code) {
          const problem = await sendCode(env, String(body.email).trim().toLowerCase(), r.data.code);
          if (problem) console.log("reset email failed:", problem);
        }
        return json(env, { ok: true });
      }
      if (url.pathname === "/auth/reset") return pass("/acct/reset", body);
      if (url.pathname === "/auth/verify") return pass("/acct/verify", body);
      if (url.pathname === "/auth/login") return pass("/acct/login", body);
    }
    if (url.pathname.startsWith("/challenge/") && request.method === "POST") {
      const act = url.pathname.slice(11);
      if (!["join", "state", "play"].includes(act)) return json(env, { error: "Unknown request" }, 404);
      if (!await isServerOnline(env)) return json(env, { error: "Server is currently offline." }, 503);
      let body;
      try {
        body = await request.json();
      } catch {
        return json(env, { error: "Bad request" }, 400);
      }
      delete body.userId;
      if (act === "join") {
        const s = await readSession(env, body.session);
        if (!s || s.setup) return json(env, { error: "Log in to your account first, then join the challenge." }, 401);
        body.userId = s.sub;
      }
      delete body.session;
      const users = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
      const r = await users.fetch("https://users/chal/" + act, {
        method: "POST",
        body: JSON.stringify({ ...body, ip: request.headers.get("CF-Connecting-IP") || "unknown" })
      });
      return json(env, await r.json(), r.status);
    }
    if (url.pathname.startsWith("/tournament/") && request.method === "POST") {
      const act = url.pathname.slice(12);
      if (!["join", "state", "move"].includes(act)) return json(env, { error: "Unknown request" }, 404);
      if (!await isServerOnline(env)) return json(env, { error: "Server is currently offline." }, 503);
      let body;
      try {
        body = await request.json();
      } catch {
        return json(env, { error: "Bad request" }, 400);
      }
      delete body.userId;
      if (act === "join") {
        const s = await readSession(env, body.session);
        if (!s || s.setup) return json(env, { error: "Log in to your account first, then join the tournament." }, 401);
        body.userId = s.sub;
      }
      delete body.session;
      const users = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
      const r = await users.fetch("https://users/tour/" + act, {
        method: "POST",
        body: JSON.stringify({ ...body, ip: request.headers.get("CF-Connecting-IP") || "unknown" })
      });
      return json(env, await r.json(), r.status);
    }
    if (url.pathname.startsWith("/staff/") && request.method === "POST") {
      const act = url.pathname.slice(7);
      let body;
      try { body = await request.json(); } catch { return json(env, { error: "Bad request" }, 400); }
      const session = await readSession(env, body.token);
      if (!session || session.setup) return json(env, { error: "Please log in again." }, 401);
      const users = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
      const ask = async (route, data) => {
        const response = await users.fetch("https://users" + route, { method: "POST", body: JSON.stringify(data) });
        let dataOut = {}; try { dataOut = await response.json(); } catch {}
        return { status: response.status, ok: response.ok, data: dataOut };
      };
      if (act === "reauth" || act === "reauth-google") {
        if (act === "reauth") {
          const verified = await ask("/acct/login", { id: session.name || "", password: String(body.password || "") });
          if (!verified.ok || !verified.data.user || verified.data.user.id !== session.sub) return json(env, { error: "Password verification failed." }, 401);
        } else {
          let google;
          try { google = await verifyGoogleToken(String(body.credential || ""), GOOGLE_CLIENT_ID); }
          catch { return json(env, { error: "Google sign-in could not be verified." }, 401); }
          if (google.email_verified !== true) return json(env, { error: "Your Google email must be verified." }, 401);
          const linked = await ask("/acct/google", { sub: google.sub, email: google.email, picture: google.picture });
          if (!linked.ok || !linked.data.user || linked.data.user.id !== session.sub) return json(env, { error: "This Google account is not linked to the RPS account." }, 403);
        }
        let access = await ask("/chal/role-get", { id: session.sub });
        let accessRole = access.data.role || "";
        if (accessRole !== "owner" && String(session.name || "").toLowerCase() === "ashton") {
          const boot = await ask("/chal/role-bootstrap", { id: session.sub });
          if (boot.ok) accessRole = "owner";
        }
        if (!accessRole) return json(env, { error: "This account does not have staff access." }, 403);
        if (accessRole !== "owner") {
          const invite = String(body.invite || "");
          if (!invite) return json(env, { error: "Scan your permanent staff QR code for every sign-in." }, 403);
          const claimed = await ask("/chal/role-claim", { id: session.sub, token: invite });
          if (!claimed.ok) return json(env, claimed.data, claimed.status);
        }
        const gate = await makeSession(env, { sub: session.sub, name: session.name || "" }, { staffGate: true }, 30 * 60 * 1000);
        return json(env, { ok: true, gate, role: accessRole });
      }
      let roleResult = await ask("/chal/role-get", { id: session.sub });
      let role = roleResult.data.role || "";
      if (role !== "owner" && String(session.name || "").toLowerCase() === "ashton") {
        const boot = await ask("/chal/role-bootstrap", { id: session.sub });
        if (boot.ok) role = "owner";
      }
      if (act === "me") return json(env, { staff: !!role, role, username: session.name || "" });
      if (act === "claim") {
        const claimed = await ask("/chal/role-claim", { id: session.sub, token: body.invite });
        if (!claimed.ok) return json(env, claimed.data, claimed.status);
        return json(env, { ok: true, role: claimed.data.role });
      }
      const gateSession = await readSession(env, body.gate);
      if (!gateSession || gateSession.sub !== session.sub || gateSession.staffGate !== true) return json(env, { error: "Enter your password to access this portal." }, 401);
      if (!role) return json(env, { error: "This account does not have employee access." }, 403);
      const isManager = ["manager", "co-owner", "owner"].includes(role);
      const isCoOwner = ["co-owner", "owner"].includes(role);
      const isOwner = role === "owner";
      const deny = () => json(env, { error: "Your employee role does not allow that action." }, 403);
      if (act === "panel") {
        const list = (await ask("/chal/admin-list", {})).data.challenges || [];
        const tournaments = (await ask("/tour/admin-list", {})).data.tournaments || [];
        const out = { role, username: session.name || "", online: await isServerOnline(env), challenges: list, tournaments };
        if (isManager) out.premium = (await ask("/chal/prem-list", {})).data.premium || [];
        return json(env, out);
      }
      if (act === "role-list") {
        if (!isManager) return deny();
        const out = await ask("/chal/role-list", {});
        return json(env, out.data, out.status);
      }
      if (act === "role-set") {
        if (!isManager) return deny();
        const target = String(body.username || "").trim().toLowerCase();
        const desired = String(body.role || "");
        if (isOwner && desired === "owner") return json(env, { error: "There can only be one owner. Use Co-owner for another top-level administrator." }, 400);
        if (!isOwner && desired === "owner") return deny();
        if (role === "manager" && desired !== "staff" && desired !== "") return deny();
        const current = await ask("/chal/role-list", {});
        const targetRecord = (current.data.staff || []).find(x => String(x.username).toLowerCase() === target);
        if (targetRecord && targetRecord.role === "owner" && !isOwner) return deny();
        const out = await ask("/chal/role-set", { username: body.username, role: desired, assignedBy: session.sub });
        return json(env, out.data, out.status);
      }
      if (act === "invite-create") {
        if (!isManager) return deny();
        const current = await ask("/chal/role-list", {});
        const target = (current.data.staff || []).find(x => String(x.username).toLowerCase() === String(body.username || "").trim().toLowerCase());
        if (!target) return json(env, { error: "Assign an employee role before making a QR code." }, 404);
        if (role === "manager" && target.role !== "staff") return deny();
        if (role === "co-owner" && target.role === "owner") return deny();
        const out = await ask("/chal/role-invite-create", { username: body.username, createdBy: session.sub });
        return json(env, out.data, out.status);
      }
      if (act === "qr-generate") {
        if (!isManager) return deny();
        const invite = String(body.invite || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 100);
        if (!invite) return json(env, { error: "A valid employee invitation is required." }, 400);
        if (!env.OPENQR_API_KEY) return json(env, { error: "QR generation is not configured on the server." }, 503);
        const destination = SITE_ORIGIN + "/staff-portal.html?invite=" + encodeURIComponent(invite);
        const qrResponse = await fetch("https://openqr.uk/v1/qr", {
          method: "POST",
          headers: { "Authorization": "Bearer " + env.OPENQR_API_KEY, "Content-Type": "application/json", "Accept": "image/png" },
          body: JSON.stringify({ data: destination, format: "png", size: 640 })
        });
        if (!qrResponse.ok) {
          const detail = await qrResponse.text().catch(() => "");
          console.log("OpenQR generation failed:", qrResponse.status, detail.slice(0, 300));
          return json(env, { error: "OpenQR could not generate the employee QR image (HTTP " + qrResponse.status + "). Check the API key and account access." }, 502);
        }
        const mime = qrResponse.headers.get("Content-Type") || "image/png";
        const bytes = new Uint8Array(await qrResponse.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return json(env, { dataUrl: "data:" + mime + ";base64," + btoa(binary) });
      }
      if (act === "account-list") {
        if (!isCoOwner) return deny();
        const out = await ask("/acct/admin-list", {});
        return json(env, out.data, out.status);
      }
      if (act === "account-password-reset") {
        if (!isCoOwner) return deny();
        const targetId = String(body.id || "").slice(0, 80);
        const password = String(body.password || "");
        if (!targetId) return json(env, { error: "Choose a staff account." }, 400);
        if (password.length < 8 || password.length > 128) return json(env, { error: "Password must be 8-128 characters." }, 400);
        const targetRole = await ask("/chal/role-get", { id: targetId });
        if (targetRole.data.role === "owner") return json(env, { error: "The owner account is protected." }, 403);
        if (targetId === session.sub) return json(env, { error: "You cannot reset the password of the account you are currently using." }, 400);
        const out = await ask("/acct/admin-password-reset", { id: targetId, password });
        return json(env, out.data, out.status);
      }
      if (act === "account-create") {
        if (!isCoOwner) return deny();
        const out = await ask("/acct/admin-create", { username: body.username, email: body.email, password: body.password });
        return json(env, out.data, out.status);
      }
      if (act === "account-delete") {
        if (!isCoOwner) return deny();
        const targetId = String(body.id || "").slice(0, 80);
        const targetRole = await ask("/chal/role-get", { id: targetId });
        if (targetRole.data.role === "owner") return json(env, { error: "The owner account is protected and cannot be deleted." }, 403);
        if (isOwner && targetId === session.sub) return json(env, { error: "You cannot delete the account you are currently using as owner." }, 400);
        const out = await ask("/acct/admin-delete", { id: targetId });
        return json(env, out.data, out.status);
      }
      if (act === "server") {
        if (!isManager) return deny();
        const on = body.on === true;
        const control = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(CONTROL_NAME));
        await control.fetch("https://control/" + (on ? "on" : "off"));
        return json(env, { online: on });
      }
      const paths = {
        create: "/chal/admin-create", delete: "/chal/admin-delete", extend: "/chal/admin-extend",
        tcreate: "/tour/admin-create", tadd: "/tour/admin-add", tstart: "/tour/admin-start",
        tkick: "/tour/admin-kick", tdelete: "/tour/admin-delete", textend: "/tour/admin-extend"
      };
      if (["prem-add", "prem-plan", "prem-remove"].includes(act)) {
        if (!isManager) return deny();
        const out = await ask({"prem-add":"/chal/prem-add","prem-plan":"/chal/prem-plan","prem-remove":"/chal/prem-remove"}[act], Object.fromEntries(Object.entries(body).filter(([key]) => key !== "token")));
        return json(env, out.data, out.status);
      }
      if (paths[act]) {
        const out = await ask(paths[act], Object.fromEntries(Object.entries(body).filter(([key]) => key !== "token")));
        return json(env, out.data, out.status);
      }
      return json(env, { error: "Unknown request" }, 404);
    }
    if (url.pathname === "/ai/speak" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json(env, { error: "Bad request." }, 400); }
      const text = String(body && body.text || "").replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "").replace(/\s+/g, " ").trim().slice(0, 600);
      if (!text) return json(env, { error: "Text is required." }, 400);
      const session = await readSession(env, body && body.token);
      if (!session || session.setup) return json(env, { error: "Please log in to use AI voice." }, 401);
      const mode = body && body.mode === "chat" ? "chat" : "coach";
      const users = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
      const prepRes = await users.fetch("https://users/ai/prepare", {
        method: "POST",
        body: JSON.stringify({ mode, userId: session.sub, key: String(session.sub) + ":tts", limit: 40 })
      });
      const prep = await prepRes.json().catch(() => ({}));
      if (!prepRes.ok) return json(env, prep, prepRes.status);

      // ElevenLabs voice generation. The API key stays in a Cloudflare Worker secret.
      const apiKey = String(env.ELEVENLABS_API_KEY || "").trim();
      if (!apiKey) return json(env, { error: "ElevenLabs voice is not configured. Add the ELEVENLABS_API_KEY Worker secret." }, 503);
      try {
        let voiceId = String(env.ELEVENLABS_VOICE_ID || "").trim();
        if (!voiceId) {
          const voicesRes = await fetch("https://api.elevenlabs.io/v1/voices", {
            headers: { "xi-api-key": apiKey, "Accept": "application/json" }
          });
          if (!voicesRes.ok) {
            console.log("ElevenLabs voices error:", voicesRes.status, (await voicesRes.text().catch(() => "")).slice(0, 300));
            return json(env, { error: "ElevenLabs could not load a voice. Check the API key and account access." }, 502);
          }
          const voicesData = await voicesRes.json();
          voiceId = String(voicesData.voices && voicesData.voices[0] && voicesData.voices[0].voice_id || "");
        }
        if (!voiceId) return json(env, { error: "No ElevenLabs voice is available in this account." }, 503);
        const speech = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(voiceId), {
          method: "POST",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json", "Accept": "audio/mpeg" },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            apply_text_normalization: "on",
            voice_settings: { stability: 0.7, similarity_boost: 0.85, style: 0.05, speed: 0.92, use_speaker_boost: true }
          })
        });
        if (!speech.ok) {
          const detail = await speech.text().catch(() => "");
          console.log("ElevenLabs TTS error:", speech.status, detail.slice(0, 400));
          return json(env, { error: speech.status === 401 || speech.status === 403 ? "ElevenLabs rejected the API key or voice access." : speech.status === 429 ? "ElevenLabs voice limit reached. Try again later." : "ElevenLabs could not generate audio right now." }, speech.status === 429 ? 429 : 502);
        }
        return new Response(await speech.arrayBuffer(), {
          status: 200,
          headers: cors(env, { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" })
        });
      } catch (error) {
        console.log("ElevenLabs TTS request failed:", String(error && error.message || error));
        return json(env, { error: "Could not reach ElevenLabs voice service." }, 502);
      }
    }

    if (url.pathname === "/ai/transcribe" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json(env, { error: "Bad request." }, 400); }
      const session = await readSession(env, body && body.token);
      if (!session || session.setup) return json(env, { error: "Please log in again to use voice chat." }, 401);
      const audio64 = String(body.audio || "");
      if (!audio64 || audio64.length > 8 * 1024 * 1024) return json(env, { error: "The recording is empty or too large. Try a shorter message." }, 400);
      const mode = body.mode === "chat" ? "chat" : "coach";
      const users = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
      const prepRes = await users.fetch("https://users/ai/prepare", { method: "POST", body: JSON.stringify({ mode, userId: session.sub, key: (mode === "chat" ? "c:" : "") + "u:" + session.sub + ":stt", limit: AI_LIMIT_USER }) });
      const prep = await prepRes.json().catch(() => ({}));
      if (!prepRes.ok) return json(env, prep, prepRes.status);
      const apiKey = String(env.GROQ_API_KEY || "").trim();
      if (!apiKey) return json(env, { error: "Voice transcription is not configured on the server." }, 503);
      try {
        const bytes = Uint8Array.from(atob(audio64), c => c.charCodeAt(0));
        const mime = String(body.mime || "audio/webm").split(";")[0].slice(0, 80);
        const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "webm";
        const form = new FormData();
        form.append("file", new Blob([bytes], { type: mime }), "voice." + ext);
        form.append("model", "whisper-large-v3-turbo");
        form.append("language", String(body.lang || "en").slice(0, 8));
        form.append("response_format", "json");
        const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { "Authorization": "Bearer " + apiKey }, body: form });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.log("Groq transcription error:", response.status, JSON.stringify(result).slice(0, 300));
          return json(env, { error: response.status === 429 ? "Voice recognition is busy. Try again in a moment." : "I could not understand that recording. Please try again." }, response.status === 429 ? 429 : 502);
        }
        return json(env, { text: String(result.text || "").trim().slice(0, 1200) });
      } catch (error) {
        console.log("Groq transcription failed:", String(error && error.message || error));
        return json(env, { error: "I could not process the microphone recording. Please try again." }, 502);
      }
    }
    if (url.pathname.startsWith("/ai/") && request.method === "POST") {
      const act = url.pathname.slice(4);
      if (!["chat", "settings"].includes(act)) return json(env, { error: "Unknown request" }, 404);
      let body;
      try {
        body = await request.json();
      } catch {
        return json(env, { error: "Bad request" }, 400);
      }
      const users = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const askAi = /* @__PURE__ */ __name(async (path, data) => {
        const r = await users.fetch("https://users/ai/" + path, { method: "POST", body: JSON.stringify(data) });
        return { status: r.status, data: await r.json() };
      }, "askAi");
      if (act === "settings") {
        const session = await readSession(env, body.token);
        if (!session || session.setup) return json(env, { error: "Please log in again." }, 401);
        const out = await askAi("settings", { userId: session.sub, action: body.action, settings: body.settings });
        return json(env, out.data, out.status);
      }
      if (!await isServerOnline(env)) return json(env, { error: "Server is currently offline." }, 503);
      const mode = body.mode === "chat" ? "chat" : "coach";
      const voice = body.voice === true;
      let s = null;
      if (body.token) {
        s = await readSession(env, body.token);
        if (!s || s.setup) return json(env, { error: "Please log in again." }, 401);
      }
      if ((mode === "coach" || mode === "chat") && !s) return json(env, { error: mode === "chat" ? "Log in with a Pro or Legend account to use AI Chat." : "Log in with a Plus, Pro, or Legend account to use AI Coach.", premiumRequired: true }, 401);
      let messages = (Array.isArray(body.messages) ? body.messages : []).filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()).map((m) => ({ role: m.role, content: m.content.trim().slice(0, 600) })).slice(-12);
      while (messages.length && messages[0].role !== "user") messages.shift();
      if (!messages.length || messages[messages.length - 1].role !== "user") return json(env, { error: "Say something first." }, 400);
      const prep = await askAi("prepare", {
        key: (mode === "chat" ? "c:" : "") + (s ? "u:" + s.sub : "ip:" + ip),
        limit: s ? AI_LIMIT_USER : AI_LIMIT_GUEST,
        mode,
        userId: s ? s.sub : ""
      });
      if (prep.status !== 200) return json(env, prep.data, prep.status);
      const out = await aiAnswer(env, prep.data.settings, messages, body.context, mode, voice);
      return out.error ? json(env, { error: out.error }, out.status) : json(env, { reply: out.reply });
    }
    if (url.pathname === "/play" && request.method === "POST") {
      if (!await isServerOnline(env)) return json(env, { error: "Server is currently offline." }, 503);
      let body;
      try {
        body = await request.json();
      } catch {
        return json(env, { error: "Bad request" }, 400);
      }
      if (!MOVES.includes(body.move)) return json(env, { error: "Bad move" }, 400);
      const level = SMART[body.level] !== void 0 ? body.level : "easy";
      if (body.token) {
        const s = await readSession(env, body.token);
        if (!s || s.setup) return json(env, { error: "Please log in again." }, 401);
        const users = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
        const r = await users.fetch("https://users/acct/play", {
          method: "POST",
          body: JSON.stringify({ id: s.sub, move: body.move, level })
        });
        return json(env, await r.json(), r.status);
      }
      const history = (Array.isArray(body.history) ? body.history : []).filter((m) => MOVES.includes(m)).slice(-50);
      return json(env, computerPlay(level, history, body.move));
    }
    if (url.pathname.startsWith("/avatar/")) {
      let name = "";
      try {
        name = decodeURIComponent(url.pathname.slice(8));
      } catch {
      }
      const users = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
      const r = await users.fetch("https://users/acct/avatar-get", { method: "POST", body: JSON.stringify({ name }) });
      const { avatar } = await r.json();
      if (!avatar) return new Response("No picture", { status: 404, headers: cors(env) });
      const bytes = Uint8Array.from(atob(avatar.split(",")[1]), (c) => c.charCodeAt(0));
      return new Response(bytes, {
        headers: cors(env, {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=3600",
          "X-Content-Type-Options": "nosniff"
        })
      });
    }
    if (url.pathname === "/leaderboard") {
      if (!await isServerOnline(env)) return json(env, { error: "Server is currently offline." }, 503);
      const users = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
      const r = await users.fetch("https://users/acct/leaderboard", {
        method: "POST",
        body: JSON.stringify({ mode: url.searchParams.get("mode") })
      });
      return json(env, await r.json());
    }
    if (url.pathname === "/account/stripe-checkout" && request.method === "POST") {
      if (!env.STRIPE_SECRET_KEY) return json(env, { error: "Stripe is not configured yet. Add STRIPE_SECRET_KEY to this Worker." }, 503);
      let checkoutBody;
      try { checkoutBody = await request.json(); } catch { return json(env, { error: "Bad request." }, 400); }
      const session = await readSession(env, checkoutBody.token);
      if (!session || session.setup) return json(env, { error: "Please log in before subscribing." }, 401);
      const form = new URLSearchParams();
      form.set("mode", "subscription");
      form.set("success_url", SITE_ORIGIN + "/subscribe.html?checkout=success");
      form.set("cancel_url", SITE_ORIGIN + "/subscribe.html?checkout=cancelled");
      form.set("client_reference_id", session.sub);
      const plan = String(checkoutBody.plan || "individual");
      if (!["individual", "duo", "family"].includes(plan)) return json(env, { error: "Unknown Premium plan." }, 400);
      const priceId = { individual: "price_1UOs6G3FalmEL64xoVuwHt5f", duo: "price_1UP41i3FalmEL64xou8zpVa1", family: "price_1UP41m3FalmEL64xUg05vCS5" }[plan];
      const extraAccounts = Math.max(0, Math.min(99, Math.floor(Number(checkoutBody.extraAccounts) || 0)));
      const extraPriceId = { individual: "price_1UP6ZN3FalmEL64xWXkZenqu", duo: "price_1UP6ZR3FalmEL64xNuq5DHNg", family: "price_1UP6ZT3FalmEL64xWPQKUCoH" }[plan];
      form.set("line_items[0][price]", priceId);
      form.set("line_items[0][quantity]", "1");
      if (extraAccounts > 0) { form.set("line_items[1][price]", extraPriceId); form.set("line_items[1][quantity]", String(extraAccounts)); }
      form.set("managed_payments[enabled]", "false");
      if (plan === "individual") form.set("subscription_data[trial_period_days]", "7");
      form.set("subscription_data[metadata][accountId]", session.sub);
      form.set("subscription_data[metadata][plan]", plan);
      form.set("subscription_data[metadata][extraAccounts]", String(extraAccounts));
      form.set("metadata[accountId]", session.sub);
      form.set("metadata[plan]", plan);
      form.set("metadata[extraAccounts]", String(extraAccounts));
      const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { "Authorization": "Bearer " + env.STRIPE_SECRET_KEY, "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString()
      });
      const stripeData = await stripeResponse.json().catch(() => ({}));
      if (!stripeResponse.ok || !stripeData.url) return json(env, { error: "Stripe could not start checkout. " + String(stripeData.error && stripeData.error.message || "Please try again.") }, 502);
      return json(env, { url: stripeData.url });
    }
    if (url.pathname === "/stripe/webhook" && request.method === "POST") {
      if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) return new Response("Stripe webhook is not configured.", { status: 503 });
      const rawBody = await request.text();
      const signatureHeader = request.headers.get("Stripe-Signature") || "";
      const sigParts = signatureHeader.split(",").map((part) => part.split("=", 2));
      const timestamp = (sigParts.find((p) => p[0] === "t") || [])[1];
      const signatures = sigParts.filter((p) => p[0] === "v1").map((p) => p[1]);
      if (!timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 || !signatures.length) return new Response("Invalid Stripe signature.", { status: 400 });
      const hmac = await crypto.subtle.importKey("raw", enc.encode(env.STRIPE_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const signed = await crypto.subtle.sign("HMAC", hmac, enc.encode(timestamp + "." + rawBody));
      const expected = Array.from(new Uint8Array(signed), (b) => b.toString(16).padStart(2, "0")).join("");
      if (!signatures.some((candidate) => candidate === expected)) return new Response("Invalid Stripe signature.", { status: 400 });
      let event;
      try { event = JSON.parse(rawBody); } catch { return new Response("Invalid event body.", { status: 400 }); }
      const obj = event && event.data && event.data.object || {};
      let accountId = String(obj.metadata && obj.metadata.accountId || "");
      let subscription = obj;
      if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        accountId = String(obj.metadata && obj.metadata.accountId || obj.client_reference_id || "");
        const subscriptionId = typeof obj.subscription === "string" ? obj.subscription : obj.subscription && obj.subscription.id;
        if (!accountId || !subscriptionId) return new Response("Event acknowledged.");
        const subResponse = await fetch("https://api.stripe.com/v1/subscriptions/" + encodeURIComponent(subscriptionId), { headers: { "Authorization": "Bearer " + env.STRIPE_SECRET_KEY } });
        subscription = await subResponse.json().catch(() => ({}));
        if (!subResponse.ok) return new Response("Could not retrieve subscription.", { status: 502 });
      } else if (event.type !== "customer.subscription.created" && event.type !== "customer.subscription.updated" && event.type !== "customer.subscription.deleted") {
        return new Response("Event ignored.", { status: 200 });
      }
      accountId = String(subscription.metadata && subscription.metadata.accountId || accountId || "");
      if (!accountId) return new Response("Event acknowledged.");
      const status = String(subscription.status || "");
      const active = status === "active" || status === "trialing";
      const users = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
      const syncResponse = await users.fetch("https://users/acct/stripe-sync", {
        method: "POST",
        body: JSON.stringify({
          id: accountId,
          active,
          status,
          subscriptionId: subscription.id || (typeof obj.subscription === "string" ? obj.subscription : ""),
          customerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer && subscription.customer.id || "",
          currentPeriodEnd: Number(subscription.current_period_end) || 0,
          plan: String(subscription.metadata && subscription.metadata.plan || obj.metadata && obj.metadata.plan || "individual"),
          extraAccounts: Number(subscription.metadata && subscription.metadata.extraAccounts) || 0
        })
      });
      if (!syncResponse.ok) return new Response("Could not sync Premium account.", { status: 502 });
      return new Response("ok", { status: 200 });
    }
    const accountAction = url.pathname.startsWith("/account/") ? url.pathname.slice(9) : null;
    if (accountAction && request.method === "POST") {
      if (!["profile", "avatar", "reset-score", "username", "password", "delete", "friends", "friend-add", "friend-accept", "friend-decline", "friend-remove", "friend-room", "premium", "premium-badge", "premium-prefs", "premium-invite", "premium-members", "ashton-plan", "arcade", "wallet", "developer-command", "developer-status"].includes(accountAction)) {
        return json(env, { error: "Unknown request" }, 404);
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return json(env, { error: "Bad request" }, 400);
      }
      const s = await readSession(env, body.token);
      if (!s || s.setup) return json(env, { error: "Please log in again." }, 401);
      if (accountAction === "developer-status" || accountAction === "developer-command") {
        if (!env.RPS_DATABASE) return json(env, { error: "Developer verification database unavailable." }, 503);
        const approved = await env.RPS_DATABASE.prepare("SELECT status FROM developer_accounts WHERE account_id = ?").bind(String(s.sub)).first();
        if (accountAction === "developer-status") return json(env, { approved: !!approved && approved.status === "approved" });
        if (!approved || approved.status !== "approved") return json(env, { error: "Developer access is not approved for this account." }, 403);
      }
      delete body.token;
      const users = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
      const r = await users.fetch("https://users/acct/" + accountAction, {
        method: "POST",
        body: JSON.stringify({ ...body, id: s.sub })
      });
      const data = await r.json();
      if (r.ok && data.renamed) data.token = await makeSession(env, { sub: s.sub, name: data.user.name });
      if (accountAction === "friend-room" && r.ok) {
        const room2 = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(data.room));
        await room2.fetch("https://room/allow", { method: "POST", body: JSON.stringify({ ids: data.ids }) });
        delete data.ids;
      }
      return json(env, data, r.status);
    }
    if (url.pathname === "/quickplay") {
      if (request.method !== "POST") return json(env, { error: "Use POST for Quick Play." }, 405);
      let body;
      try { body = await request.json(); } catch { return json(env, { error: "Bad request." }, 400); }
      const session = await readSession(env, body.token);
      if (!session || session.setup) return json(env, { error: "Log in to use Quick Play." }, 401);
      const action = ["join", "status", "leave"].includes(body.action) ? body.action : "status";
      const control = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(CONTROL_NAME));
      const r = await control.fetch("https://control/quickplay/" + action, { method: "POST", body: JSON.stringify({ id: session.sub, name: session.name || "Player" }) });
      return json(env, await r.json(), r.status);
    }
    if (url.pathname === "/me") {
      const session2 = await readSession(env, url.searchParams.get("token"));
      if (!session2 || session2.setup) return json(env, { error: "Not logged in" }, 401);
      return json(env, { user: session2 });
    }
    if (url.pathname !== "/room" && url.pathname !== "/multi-room") {
      return new Response("Rock Paper Scissors server is running!");
    }
    if (!await isServerOnline(env)) {
      return new Response("Server is currently offline.", { status: 503 });
    }
    const session = await readSession(env, url.searchParams.get("token"));
    if (!session || session.setup) {
      return new Response("Please log in first.", { status: 401 });
    }
    const room = url.searchParams.get("room");
    if (!room) return new Response("Missing room code", { status: 400 });
    if (url.pathname === "/multi-room") {
      const size = Number(url.searchParams.get("size"));
      if (![3, 4].includes(size)) return new Response("Choose 3 or 4 players.", { status: 400 });
      if (!/^[A-Z0-9]{4,8}$/i.test(room)) return new Response("Invalid room code.", { status: 400 });
      const users = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
      const premiumRes = await users.fetch("https://users/acct/premium", { method: "POST", body: JSON.stringify({ id: session.sub }) });
      const premiumData = await premiumRes.json().catch(() => ({}));
      if (!premiumRes.ok || premiumData.premium !== true) return new Response("3-player and 4-player games are for Premium members only.", { status: 403 });
      const roomObject = env.RPS_ROOM.get(env.RPS_ROOM.idFromName("MP-" + room.toUpperCase()));
      const forward = new URL(request.url);
      forward.searchParams.set("userName", session.name || "Player");
      forward.searchParams.set("userId", session.sub);
      return roomObject.fetch(new Request(forward, request));
    }
    // Quick Play creates short-lived Q-prefixed matchmaking rooms for free users.
    // Any manually chosen room code requires a Premium account; enforce this server-side.
    if (true) {
      const users = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(USERS_NAME));
      const premiumRes = await users.fetch("https://users/acct/premium", { method: "POST", body: JSON.stringify({ id: session.sub }) });
      const premiumData = await premiumRes.json();
      if (!premiumRes.ok) return new Response("Could not verify Premium access.", { status: 403 });
      if (!premiumData.premium) {
        const control = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(CONTROL_NAME));
        const quickCheck = await control.fetch("https://control/quickplay/verify-room", { method: "POST", body: JSON.stringify({ id: session.sub, room: room.toUpperCase() }) });
        const access = await quickCheck.json();
        if (!access.ok) return new Response("Joining custom room codes is a Premium feature. Use Quick Play for free matchmaking.", { status: 403 });
      }
    }
    const roomObject = env.RPS_ROOM.get(env.RPS_ROOM.idFromName(room.toUpperCase()));
    const forward = new URL(request.url);
    forward.searchParams.set("userName", session.name || "Player");
    forward.searchParams.set("userId", session.sub);
    return roomObject.fetch(new Request(forward, request));
  }
};

var __rpsOriginalFetch = index_default.fetch.bind(index_default);
index_default.fetch = async function(request, env) {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const response = await __rpsOriginalFetch(request, env);
  try {
    if (env.RPS_DATABASE && !url.pathname.startsWith("/internal/") && url.pathname !== "/admin") {
      const auth = request.headers.get("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      let accountId = null;
      if (token) {
        try { const session = await readSession(env, token); accountId = session && !session.setup ? session.sub : null; } catch {}
      }
      await env.RPS_DATABASE.prepare("INSERT INTO activity_events (id, account_id, event_type, route, method, status_code, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), accountId, "server_request", url.pathname.slice(0, 180), request.method, response.status, JSON.stringify({ durationMs: Date.now() - startedAt })).run();
    }
  } catch {}
  return response;
};
var RPSRoom = class extends DurableObject {
  static {
    __name(this, "RPSRoom");
  }
  constructor(ctx, env) {
    super(ctx, env);
    this.players = [];
    this.moves = {};
    this.multiTarget = 2;
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/on") {
      await this.ctx.storage.put("serverOnline", true);
      return Response.json({ online: true });
    }
    if (url.pathname === "/off") {
      await this.ctx.storage.put("serverOnline", false);
      return Response.json({ online: false });
    }
    if (url.pathname === "/status") {
      const online = await this.ctx.storage.get("serverOnline");
      const resetAt = await this.ctx.storage.get("resetAt") || 0;
      return Response.json({ online: online !== false, resetAt });
    }
    if (url.pathname === "/reset-mark") {
      await this.ctx.storage.put("resetAt", Date.now());
      return Response.json({ ok: true });
    }
    if (url.pathname === "/reset") {
      await this.ctx.storage.deleteAll();
      return Response.json({ ok: true });
    }
    if (url.pathname === "/allow") {
      const { ids } = await request.json();
      await this.ctx.storage.put("allowed", ids);
      return Response.json({ ok: true });
    }
    if (url.pathname.startsWith("/quickplay/")) {
      const d = await request.json().catch(() => ({}));
      const S = this.ctx.storage;
      const id = String(d.id || "").slice(0, 80);
      if (!id) return Response.json({ error: "Missing player." }, { status: 400 });
      const path = url.pathname;
      const now = Date.now();
      const matchKey = "quickplayMatch:" + id;
      if (path === "/quickplay/join") {
        const existing = await S.get(matchKey);
        if (existing && existing.expiresAt > now) return Response.json({ status: "matched", room: existing.room });
        let queue = (await S.get("quickplayQueue")) || [];
        queue = queue.filter((p) => p.id !== id && now - p.at < 60000);
        const opponent = queue.shift();
        if (opponent) {
          const room = "Q" + b64urlEncode(crypto.getRandomValues(new Uint8Array(8))).replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase();
          const match = { room, expiresAt: now + 120000 };
          await S.put("quickplayMatch:" + id, match);
          await S.put("quickplayMatch:" + opponent.id, match);
          await S.put("quickplayQueue", queue);
          return Response.json({ status: "matched", room });
        }
        queue.push({ id, name: String(d.name || "Player").slice(0, 30), at: now });
        await S.put("quickplayQueue", queue);
        return Response.json({ status: "waiting" });
      }
      if (path === "/quickplay/verify-room") {
        const match = await S.get(matchKey);
        return Response.json({ ok: !!match && match.expiresAt > now && match.room === String(d.room || "").toUpperCase() });
      }
      if (path === "/quickplay/status") {
        const match = await S.get(matchKey);
        if (match && match.expiresAt > now) return Response.json({ status: "matched", room: match.room });
        if (match) await S.delete(matchKey);
        const queue = (await S.get("quickplayQueue")) || [];
        return Response.json({ status: queue.some((p) => p.id === id && now - p.at < 60000) ? "waiting" : "idle" });
      }
      if (path === "/quickplay/leave") {
        const queue = (await S.get("quickplayQueue")) || [];
        await S.put("quickplayQueue", queue.filter((p) => p.id !== id));
        return Response.json({ status: "idle" });
      }
      return Response.json({ error: "Unknown Quick Play action." }, { status: 404 });
    }
    if (url.pathname === "/count") {
      return Response.json({ count: this.players.length, names: this.players.map((p) => p.name) });
    }
    if (url.pathname.startsWith("/ai/")) {
      const d = await request.json().catch(() => ({}));
      const S = this.ctx.storage;
      const path = url.pathname;
      const now = Date.now();
      const bad = /* @__PURE__ */ __name((error, status = 400) => Response.json({ error }, { status }), "bad");
      const getSettings = /* @__PURE__ */ __name(async () => aiClean(await S.get("aiSettings")), "getSettings");
      if (path === "/ai/prepare") {
        const mode = d.mode === "chat" ? "chat" : "coach";
        const u = d.userId ? await S.get("user:" + String(d.userId).slice(0, 80)) : null;
        const rawPlan = String(u && (u.premiumPlan || (u.premium && u.premium.plan)) || "").toLowerCase().replace(/[_\s]+/g, "-");
        if (!u || !u.premium) return Response.json({ error: mode === "chat" ? "AI Chat requires a Pro or Legend plan." : "AI Coach requires a Plus, Pro, or Legend plan.", premiumRequired: true }, { status: 403 });
        if (mode === "chat" && !rawPlan.includes("ultra") && rawPlan !== "duo" && rawPlan !== "family") return Response.json({ error: "AI Chat requires a Pro or Legend plan.", premiumRequired: true }, { status: 403 });
        const key = "airl:" + String(d.key || "x").slice(0, 80);
        const limit = mode === "chat" ? AI_LIMIT_CHAT : Number(d.limit) || AI_LIMIT_GUEST;
        let rl = await S.get(key) || { n: 0, reset: now + AI_WINDOW_MS };
        if (rl.reset < now) rl = { n: 0, reset: now + AI_WINDOW_MS };
        if (rl.n >= limit) return bad(`You are chatting a lot. Try again in ${Math.ceil((rl.reset - now) / 6e4)} minutes.`, 429);
        rl.n++;
        await S.put(key, rl);
        return Response.json({ settings: mode === "chat" ? aiClean(await S.get("aiSettings:" + String(d.userId))) : AI_DEFAULTS });
      }
      if (path === "/ai/settings") {
        const uid = String(d.userId || "").slice(0, 80);
        const user = uid ? await S.get("user:" + uid) : null;
        if (!user) return bad("Please log in again.", 401);
        const key = "aiSettings:" + uid;
        if (d.action === "save") await S.put(key, aiClean(d.settings));
        return Response.json({ settings: aiClean(await S.get(key)) });
      }
      return bad("Unknown request.", 404);
    }
    if (url.pathname.startsWith("/tour/")) {
      const d = await request.json().catch(() => ({}));
      const S = this.ctx.storage;
      const path = url.pathname;
      const bad = /* @__PURE__ */ __name((error, status = 400) => Response.json({ error }, { status }), "bad");
      const now = Date.now();
      const hoursOf = /* @__PURE__ */ __name((v) => {
        const h = parseInt(v, 10);
        return h >= 1 && h <= 20 ? h : 0;
      }, "hoursOf");
      const load = /* @__PURE__ */ __name(async (id) => id ? S.get("tour:" + chNorm(id).slice(0, 6)) : null, "load");
      const save = /* @__PURE__ */ __name(async (t2) => {
        let award = null;
        if (t2.status === "finished" && !t2.awarded) {
          t2.awarded = true;
          award = toPlayer(t2, t2.champion);
        }
        await S.put("tour:" + t2.id, t2);
        // Tournament winners are never granted Premium.
      }, "save");
      const byToken = /* @__PURE__ */ __name(async (token) => {
        const ref2 = token ? await S.get("ttok:" + String(token).slice(0, 80)) : null;
        if (!ref2) return null;
        const [tid, eid2] = ref2.split(":");
        const t2 = await load(tid);
        return t2 && toPlayer(t2, eid2) ? { t: t2, eid: eid2 } : null;
      }, "byToken");
      if (path === "/tour/admin-create") {
        const name2 = String(d.name || "").trim().slice(0, 40) || "Tournament";
        const type = "text";
        const text = String(d.prizeText || "").trim().slice(0, 300);
        const hours = hoursOf(d.hours) || TO_DEFAULT_HOURS;
        let id;
        do {
          id = chNewId().slice(0, 6);
        } while (await S.get("tour:" + id));
        await S.put("tour:" + id, { id, name: name2, prize: { type, text }, createdAt: now, expiresAt: now + hours * 36e5, status: "setup", players: [], rounds: [] });
        return Response.json({ id });
      }
      if (path === "/tour/admin-list") {
        const all = await S.list({ prefix: "tour:" });
        const list = [];
        for (const t2 of [...all.values()].sort((a, b) => b.createdAt - a.createdAt)) {
          if (toTick(t2, now)) await save(t2);
          list.push(toSummary(t2));
        }
        return Response.json({ tournaments: list });
      }
      if (path === "/tour/admin-add") {
        const username = String(d.username || "").trim();
        const password = String(d.password || "");
        if (password.length < 4) return bad("The password must be at least 4 characters.");
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const hash = await hashPw(password, salt);
        const uid = await S.get("uname:" + username.toLowerCase());
        const acct2 = uid ? await S.get("user:" + uid) : null;
        if (!acct2) return bad("No account with that username. They need to register first.", 404);
        let eid2;
        do {
          eid2 = chNewId();
        } while (await S.get("tent:" + eid2));
        const t2 = await load(d.tid);
        if (!t2) return bad("Tournament not found.", 404);
        if (t2.status !== "setup") return bad("This tournament already started.");
        if (t2.players.length >= TO_MAX_PLAYERS) return bad("The room is full (16 players).");
        if (t2.players.some((p) => p.accountId === acct2.id)) return bad("That account is already in this tournament.");
        t2.players.push({ eid: eid2, accountId: acct2.id, username: acct2.username, salt: b64urlEncode(salt), hash, joined: false, alive: true, avatarAt: acct2.avatarAt || 0, token: "" });
        await S.put("tour:" + t2.id, t2);
        await S.put("tent:" + eid2, t2.id);
        return Response.json({ eid: eid2 });
      }
      if (path === "/tour/admin-start") {
        const t2 = await load(d.tid);
        if (!t2) return bad("Tournament not found.", 404);
        if (t2.status !== "setup") return bad("This tournament already started.");
        if (t2.players.filter((p) => p.joined).length < 2) return bad("At least 2 players need to join first.");
        toBuild(t2, now);
        await save(t2);
        return Response.json({ ok: true });
      }
      if (path === "/tour/admin-kick") {
        const t2 = await load(d.tid);
        const p = t2 ? toPlayer(t2, chNorm(d.eid)) : null;
        if (!t2 || !p) return bad("Player not found.", 404);
        if (t2.status === "finished") return bad("This tournament is finished.");
        if (t2.status === "setup") {
          t2.players = t2.players.filter((x) => x !== p);
          await S.put("tour:" + t2.id, t2);
          await S.delete("tent:" + p.eid);
          if (p.token) await S.delete("ttok:" + p.token);
        } else {
          toEliminate(t2, p.eid, now);
          await save(t2);
        }
        return Response.json({ ok: true });
      }
      if (path === "/tour/admin-delete") {
        const t2 = await load(d.tid);
        if (t2) {
          for (const p of t2.players) {
            await S.delete("tent:" + p.eid);
            if (p.token) await S.delete("ttok:" + p.token);
          }
          await S.delete("tour:" + t2.id);
        }
        return Response.json({ ok: true });
      }
      if (path === "/tour/admin-extend") {
        const t2 = await load(d.tid);
        const hours = hoursOf(d.hours);
        if (!t2 || !hours) return bad("Nothing to extend.", 404);
        t2.expiresAt = Math.max(t2.expiresAt, now) + hours * 36e5;
        await S.put("tour:" + t2.id, t2);
        return Response.json({ ok: true });
      }
      if (path === "/tour/join") {
        const ip = String(d.ip || "unknown").slice(0, 64);
        const failKey = "tfail:" + ip;
        const f = await S.get(failKey) || { count: 0, until: 0 };
        if (f.until > now) return bad(`Too many tries. Try again in ${Math.ceil((f.until - now) / 6e4)} minutes.`, 429);
        const fail = /* @__PURE__ */ __name(async () => {
          f.count++;
          if (f.count >= 8) {
            f.count = 0;
            f.until = now + 15 * 6e4;
          }
          await S.put(failKey, f);
          return bad("Wrong tournament ID or password.", 401);
        }, "fail");
        const eid2 = chNorm(d.id);
        const tid = eid2 ? await S.get("tent:" + eid2) : null;
        const t0 = tid ? await load(tid) : null;
        const p0 = t0 ? toPlayer(t0, eid2) : null;
        if (!p0) return fail();
        if (await hashPw(String(d.password || ""), b64urlDecode(p0.salt)) !== p0.hash) return fail();
        if (!d.userId || d.userId !== p0.accountId) return bad("This ID was made for a different account. Log in with your own account.", 403);
        if (t0.status !== "finished" && t0.expiresAt < now) return bad("This tournament has expired.", 410);
        const player = await S.get("user:" + d.userId);
        if (!player || !player.username) return bad("Log in to your account first, then join the tournament.", 401);
        if (!player.avatar) return bad("You need a profile picture to play. Open your profile, add a picture, then try again.", 403);
        const t2 = await load(tid);
        const p = t2 ? toPlayer(t2, eid2) : null;
        if (!p) return fail();
        if (p.joined && p.token) {
          await S.delete(failKey);
          return Response.json({ token: p.token, state: toView(t2, eid2, now) });
        }
        if (t2.status !== "setup") return bad("This tournament already started.", 403);
        p.joined = true;
        p.username = player.username;
        p.avatarAt = player.avatarAt || 0;
        p.token = b64urlEncode(crypto.getRandomValues(new Uint8Array(24)));
        await S.put("tour:" + t2.id, t2);
        await S.put("ttok:" + p.token, t2.id + ":" + eid2);
        await S.delete(failKey);
        return Response.json({ token: p.token, state: toView(t2, eid2, now) });
      }
      const ref = await byToken(d.token);
      if (!ref) return bad("This tournament was ended.", 404);
      const { t, eid } = ref;
      const meP = toPlayer(t, eid);
      const acct = await S.get("user:" + meP.accountId);
      const scout = !!(acct && acct.premium && ["duo", "family"].includes(String(acct.premiumPlan || acct.premium.plan || "").trim().toLowerCase()));
      if (path === "/tour/state") {
        if (toTick(t, now)) await save(t);
        return Response.json({ state: toView(t, eid, now, scout) });
      }
      if (path === "/tour/move") {
        const changed = toTick(t, now);
        const me = toPlayer(t, eid);
        if (t.status === "running" && t.expiresAt < now) return bad("This tournament has expired.", 410);
        const cur = t.status === "running" && me.alive ? toFind(t, eid) : null;
        if (cur && cur.m.status === "playing") {
          if (!MOVES.includes(d.move)) return bad("Bad move");
          const m = cur.m;
          const idx = m.p[0] === eid ? 0 : 1;
          if (!m.moves[idx]) {
            m.moves[idx] = d.move;
            if (!m.firstMoveAt) m.firstMoveAt = now;
            if (m.moves[0] && m.moves[1]) {
              const w = m.moves[0] === m.moves[1] ? -1 : BEATS[m.moves[0]] === m.moves[1] ? 0 : 1;
              toRound(t, cur.r, cur.i, w, [m.moves[0], m.moves[1]], now);
            }
            await save(t);
            return Response.json({ state: toView(t, eid, now, scout) });
          }
        }
        if (changed) await save(t);
        return Response.json({ state: toView(t, eid, now, scout) });
      }
      return bad("Unknown request.", 404);
    }
    if (url.pathname.startsWith("/chal/")) {
      const d = await request.json().catch(() => ({}));
      const S = this.ctx.storage;
      const path = url.pathname;
      const bad = /* @__PURE__ */ __name((error, status = 400) => Response.json({ error }, { status }), "bad");
      const now = Date.now();
      const hoursOf = /* @__PURE__ */ __name((v) => {
        const h = parseInt(v, 10);
        return h >= 1 && h <= 20 ? h : 0;
      }, "hoursOf");
      if (path === "/chal/admin-create") {
        const username = String(d.username || "").trim().slice(0, 30);
        const password = String(d.password || "");
        if (!username) return bad("Enter a username.");
        if (password.length < 4) return bad("The password must be at least 4 characters.");
        const hours = hoursOf(d.hours) || CH_DEFAULT_HOURS;
        let id;
        do {
          id = chNewId();
        } while (await S.get("chal:" + id));
        const salt = crypto.getRandomValues(new Uint8Array(16));
        await S.put("chal:" + id, {
          id,
          username,
          salt: b64urlEncode(salt),
          hash: await hashPw(password, salt),
          prize: String(d.prize || "").trim().slice(0, 300),
          createdAt: now,
          expiresAt: now + hours * 36e5,
          status: "open",
          // open (ID not used yet) -> active -> won or lost
          stage: 0,
          roundsWon: 0,
          roundsLost: 0,
          history: []
        });
        return Response.json({ id });
      }
      if (path === "/chal/admin-list") {
        const all = await S.list({ prefix: "chal:" });
        const challenges = [...all.values()].sort((a, b) => b.createdAt - a.createdAt).map((c) => ({ id: c.id, username: c.username, status: c.status, stage: c.stage, roundsWon: c.roundsWon, expiresAt: c.expiresAt, prize: c.prize, playerName: c.playerName || "", avatarAt: c.avatarAt || 0, wonAt: c.wonAt || 0 }));
        return Response.json({ challenges });
      }
      if (path === "/chal/admin-delete") {
        const id = chNorm(d.id);
        const rec2 = id ? await S.get("chal:" + id) : null;
        if (rec2) {
          await S.delete("chal:" + id);
          if (rec2.token) await S.delete("ctok:" + rec2.token);
        }
        return Response.json({ ok: true });
      }
      if (path === "/chal/admin-extend") {
        const id = chNorm(d.id);
        const hours = hoursOf(d.hours);
        const rec2 = id ? await S.get("chal:" + id) : null;
        if (!rec2 || !hours) return bad("Nothing to extend.", 404);
        rec2.expiresAt = Math.max(rec2.expiresAt, now) + hours * 36e5;
        await S.put("chal:" + id, rec2);
        return Response.json({ ok: true, expiresAt: rec2.expiresAt });
      }
      if (path === "/chal/prem-add") {
        const uid = await S.get("uname:" + String(d.username || "").trim().toLowerCase());
        if (!uid || !await S.get("user:" + uid)) return bad("No account with that username.", 404);
        const u = await S.get("user:" + uid);
        u.premium = { since: now, source: "admin" };
        await S.put("user:" + uid, u);
        return Response.json({ ok: true });
      }
      if (path === "/chal/prem-plan") {
        const username = String(d.username || "").trim().toLowerCase();
        const uid = await S.get("uname:" + username);
        if (!uid) return bad("No account with that username.", 404);
        const u = await S.get("user:" + uid);
        if (!u) return bad("No account with that username.", 404);
        const plan = ["individual", "duo", "family"].includes(String(d.plan || "")) ? String(d.plan) : "individual";
        u.premiumPlan = plan;
        u.premium = { since: Date.now(), source: "admin", plan, lifetime: d.lifetime === true };
        await S.put("user:" + uid, u);
        return Response.json({ ok: true, username: u.username || username, plan, lifetime: d.lifetime === true });
      }
      if (path === "/chal/prem-remove") {
        const u = d.id ? await S.get("user:" + String(d.id).slice(0, 80)) : null;
        if (u && u.premium) {
          delete u.premium;
          await S.put("user:" + u.id, u);
        }
        return Response.json({ ok: true });
      }
      if (path === "/chal/prem-list") {
        const all = await S.list({ prefix: "user:" });
        const premium = [...all.values()].filter((u) => u.premium).map((u) => ({ id: u.id, username: u.username || "(no username)", avatarAt: u.avatarAt || 0, source: u.premium.source, plan: u.premiumPlan || u.premium.plan || "", lifetime: u.premium.lifetime === true }));
        return Response.json({ premium });
      }
      if (path === "/chal/role-get") {
        const id = String(d.id || "").slice(0, 80);
        const saved = id ? await S.get("role:" + id) : null;
        const legacy = id ? await S.get("staff:" + id) : null;
        return Response.json({ role: saved && saved.role || (legacy ? "staff" : "") });
      }
      if (path === "/chal/role-bootstrap") {
        const id = String(d.id || "").slice(0, 80);
        const user = id ? await S.get("user:" + id) : null;
        const primary = await S.get("owner:primary");
        if (!user || String(user.username || "").toLowerCase() !== "ashton") return bad("Owner account not recognized.", 403);
        if (primary && primary !== id) return bad("An owner account is already configured.", 409);
        await S.put("role:" + id, { role: "owner", since: now, assignedBy: "system-bootstrap" });
        await S.put("owner:primary", id);
        return Response.json({ role: "owner" });
      }
      if (path === "/chal/role-list") {
        const saved = await S.list({ prefix: "role:" });
        const legacy = await S.list({ prefix: "staff:" });
        const ids = new Set([...Array.from(saved.keys(), k => k.slice(5)), ...Array.from(legacy.keys(), k => k.slice(6))]);
        const staff = [];
        for (const id of ids) {
          const u = await S.get("user:" + id);
          const rec = await S.get("role:" + id);
          const role = rec && rec.role || (await S.get("staff:" + id) ? "staff" : "");
          if (u && role) staff.push({ id, username: u.username || "(no username)", email: u.email || "", role, since: rec && rec.since || 0 });
        }
        staff.sort((a, b) => a.username.localeCompare(b.username));
        return Response.json({ staff });
      }
      if (path === "/chal/role-set") {
        const username = String(d.username || "").trim().toLowerCase().slice(0, 16);
        const uid = username ? await S.get("uname:" + username) : null;
        const user = uid ? await S.get("user:" + uid) : null;
        if (!user) return bad("No account with that username.", 404);
        const role = ["staff", "manager", "co-owner"].includes(String(d.role || "")) ? String(d.role) : "";
        if (uid === await S.get("owner:primary")) return bad("The owner account is protected and cannot be changed here.", 403);
        if (role) {
          await S.put("role:" + uid, { role, since: now, assignedBy: String(d.assignedBy || "").slice(0, 80) });
          if (role === "staff") await S.put("staff:" + uid, { since: now });
          else await S.delete("staff:" + uid);
        } else {
          await S.delete("role:" + uid);
          await S.delete("staff:" + uid);
        }
        return Response.json({ ok: true, username: user.username, role });
      }
      if (path === "/chal/role-invite-create") {
        const username = String(d.username || "").trim().toLowerCase().slice(0, 16);
        const uid = username ? await S.get("uname:" + username) : null;
        const user = uid ? await S.get("user:" + uid) : null;
        const roleRec = uid ? await S.get("role:" + uid) : null;
        const legacy = uid ? await S.get("staff:" + uid) : null;
        const role = roleRec && roleRec.role || (legacy ? "staff" : "");
        if (!user || !role) return bad("Assign an employee role before making a QR code.", 404);
        const token = b64urlEncode(crypto.getRandomValues(new Uint8Array(32)));
        const expiresAt = 0;
        await S.put("staffinvite:" + token, { userId: uid, role, expiresAt, persistent: true, createdBy: String(d.createdBy || "").slice(0, 80) });
        return Response.json({ token, expiresAt, username: user.username, role });
      }
      if (path === "/chal/role-claim") {
        const token = String(d.token || "").slice(0, 100);
        const id = String(d.id || "").slice(0, 80);
        const invite = token ? await S.get("staffinvite:" + token) : null;
        if (!invite || (!invite.persistent && invite.expiresAt < now)) return bad("This employee QR code has expired or is invalid.", 410);
        if (invite.userId !== id) return bad("This QR code belongs to a different account. Log in with the employee account assigned by the owner.", 403);
        const rec = await S.get("role:" + id);
        const legacy = await S.get("staff:" + id);
        const role = rec && rec.role || (legacy ? "staff" : "");
        if (!role || role !== invite.role) return bad("Employee access has changed. Ask the owner for a new QR code.", 403);
        if (!invite.persistent) await S.delete("staffinvite:" + token);
        return Response.json({ ok: true, role });
      }
      if (path === "/chal/is-staff") return Response.json({ staff: !!(d.id && await S.get("staff:" + d.id)) });
      if (path === "/chal/staff-add") {
        const uid = await S.get("uname:" + String(d.username || "").trim().toLowerCase());
        if (!uid || !await S.get("user:" + uid)) return bad("No account with that username.", 404);
        await S.put("staff:" + uid, { since: now });
        return Response.json({ ok: true });
      }
      if (path === "/chal/staff-list") {
        const all = await S.list({ prefix: "staff:" });
        const staff = [];
        for (const k of all.keys()) {
          const id = k.slice(6);
          const u = await S.get("user:" + id);
          staff.push({ id, username: u && u.username || "(deleted account)", avatarAt: u && u.avatarAt || 0 });
        }
        return Response.json({ staff });
      }
      if (path === "/chal/staff-remove") {
        await S.delete("staff:" + String(d.id || "").slice(0, 80));
        return Response.json({ ok: true });
      }
      if (path === "/chal/join") {
        const ip = String(d.ip || "unknown").slice(0, 64);
        const failKey = "cfail:" + ip;
        const f = await S.get(failKey) || { count: 0, until: 0 };
        if (f.until > now) return bad(`Too many tries. Try again in ${Math.ceil((f.until - now) / 6e4)} minutes.`, 429);
        const fail = /* @__PURE__ */ __name(async () => {
          f.count++;
          if (f.count >= 8) {
            f.count = 0;
            f.until = now + 15 * 6e4;
          }
          await S.put(failKey, f);
          return bad("Wrong challenge ID or password, or this ID was already used.", 401);
        }, "fail");
        const id = chNorm(d.id);
        const rec2 = id ? await S.get("chal:" + id) : null;
        if (!rec2) return fail();
        const ok = await hashPw(String(d.password || ""), b64urlDecode(rec2.salt)) === rec2.hash;
        if (!ok || rec2.status !== "open") return fail();
        if (rec2.expiresAt < now) return bad("This challenge has expired.", 410);
        const player = d.userId ? await S.get("user:" + d.userId) : null;
        if (!player || !player.username) return bad("Log in to your account first, then join the challenge.", 401);
        if (!player.avatar) return bad("You need a profile picture to play a challenge. Open your profile, add a picture, then try again.", 403);
        rec2.status = "active";
        rec2.joinedAt = now;
        rec2.playerId = player.id;
        rec2.playerName = player.username;
        rec2.avatarAt = player.avatarAt || 0;
        rec2.token = b64urlEncode(crypto.getRandomValues(new Uint8Array(24)));
        await S.put("chal:" + id, rec2);
        await S.put("ctok:" + rec2.token, id);
        await S.delete(failKey);
        return Response.json({ token: rec2.token, state: chView(rec2) });
      }
      const tokenId = d.token ? await S.get("ctok:" + String(d.token).slice(0, 80)) : null;
      const rec = tokenId ? await S.get("chal:" + tokenId) : null;
      if (!rec) return bad("This challenge was ended.", 404);
      if (path === "/chal/state") return Response.json({ state: chView(rec) });
      if (path === "/chal/play") {
        if (rec.status !== "active") return Response.json({ state: chView(rec) });
        if (rec.expiresAt < now) return bad("This challenge has expired.", 410);
        if (!MOVES.includes(d.move)) return bad("Bad move");
        const player = await S.get("user:" + rec.playerId);
        if (!player || !player.avatar) return bad("Add a profile picture to keep playing.", 403);
        rec.playerName = player.username;
        rec.avatarAt = player.avatarAt || 0;
        const { computerMove, result } = computerPlay(CH_STAGES[rec.stage], rec.history, d.move);
        rec.history = [...rec.history, d.move].slice(-50);
        if (result === "win") rec.roundsWon++;
        if (result === "loss") rec.roundsLost++;
        rec.last = { yourMove: d.move, computerMove, result, outcome: null };
        if (rec.roundsWon >= CH_WINS_NEEDED) {
          if (rec.stage + 1 >= CH_STAGES.length) {
            rec.status = "won";
            rec.wonAt = now;
            rec.last.outcome = "won";
          } else {
            rec.stage++;
            rec.roundsWon = 0;
            rec.roundsLost = 0;
            rec.history = [];
            rec.last.outcome = "stage";
          }
        } else if (rec.roundsLost >= CH_LOSS_LIMIT) {
          rec.status = "lost";
          rec.last.outcome = "lost";
        }
        await S.put("chal:" + rec.id, rec);
        return Response.json({ state: chView(rec) });
      }
      return bad("Unknown request.", 404);
    }
    if (url.pathname.startsWith("/acct/")) {
      const d = await request.json();
      const S = this.ctx.storage;
      const path = url.pathname;
      const bad = /* @__PURE__ */ __name((error, status = 400) => Response.json({ error }, { status }), "bad");
      const lower = /* @__PURE__ */ __name((v) => String(v || "").trim().toLowerCase(), "lower");
      const checkCreds = /* @__PURE__ */ __name(async (username, password, email) => {
        if (!/^[A-Za-z0-9_]{3,16}$/.test(username || "")) return "Username must be 3-16 letters, numbers or _.";
        if (!password || String(password).length < 8) return "Password must be at least 8 characters.";
        if (await S.get("uname:" + username.toLowerCase())) return "That username is taken.";
        if (email && await S.get("email:" + email)) return "That email already has an account.";
        return null;
      }, "checkCreds");
      const setPw = /* @__PURE__ */ __name(async (u, password) => {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        u.salt = b64urlEncode(salt);
        u.hash = await hashPw(String(password), salt);
      }, "setPw");
      const save = /* @__PURE__ */ __name(async (u) => {
        await S.put("user:" + u.id, u);
        if (u.email) await S.put("email:" + u.email, u.id);
        if (u.username) await S.put("uname:" + u.username.toLowerCase(), u.id);
      }, "save");
      if (path === "/acct/google") {
        const email = lower(d.email);
        let id = await S.get("gsub:" + d.sub);
        if (!id) id = await S.get("email:" + email);
        let user = id ? await S.get("user:" + id) : null;
        if (!user) user = { id: crypto.randomUUID(), email, createdAt: Date.now() };
        await S.put("gsub:" + d.sub, user.id);
        user.picture = d.picture;
        user.lastLogin = Date.now();
        await save(user);
        return Response.json({ user });
      }
      if (path === "/acct/setup") {
        const user = await S.get("user:" + d.id);
        if (!user) return bad("Account not found.", 404);
        if (user.username) return bad("Account is already set up.");
        const err = await checkCreds(d.username, d.password);
        if (err) return bad(err);
        user.username = d.username;
        await setPw(user, d.password);
        await save(user);
        return Response.json({ user });
      }
      if (path === "/acct/register") {
        const email = lower(d.email);
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad("Enter a valid email.");
        const err = await checkCreds(d.username, d.password, email);
        if (err) return bad(err);
        const old = await S.get("pending:" + email);
        if (old && Date.now() - (old.sentAt || 0) < 6e4) return bad("Wait a minute before asking for another code.", 429);
        const user = { id: crypto.randomUUID(), email, username: d.username, createdAt: Date.now() };
        await setPw(user, d.password);
        const code = String(1e5 + crypto.getRandomValues(new Uint32Array(1))[0] % 9e5);
        await S.put("pending:" + email, { user, code, exp: Date.now() + 10 * 6e4, tries: 0, sentAt: Date.now() });
        return Response.json({ code });
      }
      if (path === "/acct/verify") {
        const email = lower(d.email);
        const p = await S.get("pending:" + email);
        if (!p || p.exp < Date.now()) return bad("Code expired. Register again.");
        if (p.tries >= 5) {
          await S.delete("pending:" + email);
          return bad("Too many tries. Register again.");
        }
        if (String(d.code).trim() !== p.code) {
          p.tries++;
          await S.put("pending:" + email, p);
          return bad("Wrong code.");
        }
        if (await S.get("uname:" + p.user.username.toLowerCase()) || await S.get("email:" + email)) {
          return bad("That username or email was just taken.");
        }
        await save(p.user);
        await S.delete("pending:" + email);
        return Response.json({ user: p.user });
      }
      if (path === "/acct/login") {
        const id = lower(d.id).slice(0, 64);
        const failKey = "fail:" + id;
        const f = await S.get(failKey) || { count: 0, until: 0 };
        if (f.until > Date.now()) {
          return bad(`Too many tries. Try again in ${Math.ceil((f.until - Date.now()) / 6e4)} minutes.`, 429);
        }
        const uid = await S.get((id.includes("@") ? "email:" : "uname:") + id);
        const user = uid ? await S.get("user:" + uid) : null;
        const good = !!user && !!user.hash && await hashPw(String(d.password || ""), b64urlDecode(user.salt)) === user.hash;
        if (!good) {
          f.count++;
          if (f.count >= 5) {
            f.count = 0;
            f.until = Date.now() + 15 * 6e4;
          }
          await S.put(failKey, f);
          return bad("Wrong username or password.", 401);
        }
        await S.delete(failKey);
        user.lastLogin = Date.now();
        await save(user);
        return Response.json({ user });
      }
      if (path === "/acct/forgot") {
        const email = lower(d.email);
        const uid = await S.get("email:" + email);
        const user = uid ? await S.get("user:" + uid) : null;
        if (!user || !user.hash) return Response.json({});
        const old = await S.get("reset:" + email);
        if (old && Date.now() - (old.sentAt || 0) < 6e4) return Response.json({});
        const code = String(1e5 + crypto.getRandomValues(new Uint32Array(1))[0] % 9e5);
        await S.put("reset:" + email, { code, exp: Date.now() + 10 * 6e4, tries: 0, sentAt: Date.now() });
        return Response.json({ code });
      }
      if (path === "/acct/reset") {
        const email = lower(d.email);
        const r = await S.get("reset:" + email);
        if (!r || r.exp < Date.now()) return bad("Code expired. Ask for a new one.");
        if (r.tries >= 5) {
          await S.delete("reset:" + email);
          return bad("Too many tries. Ask for a new code.");
        }
        if (String(d.code).trim() !== r.code) {
          r.tries++;
          await S.put("reset:" + email, r);
          return bad("Wrong code.");
        }
        if (!d.newPassword || String(d.newPassword).length < 8) return bad("Password must be at least 8 characters.");
        const user = await S.get("user:" + await S.get("email:" + email));
        if (!user) return bad("Account not found.", 404);
        await setPw(user, d.newPassword);
        await S.delete("reset:" + email);
        await S.delete("fail:" + lower(user.username));
        await save(user);
        return Response.json({ user });
      }
      const zero = /* @__PURE__ */ __name(() => ({ wins: 0, losses: 0, ties: 0 }), "zero");
      const statsOf = /* @__PURE__ */ __name((u) => ({
        online: { ...zero(), ...u.stats && u.stats.online },
        computer: { ...zero(), ...u.stats && u.stats.computer }
      }), "statsOf");
      const pub = /* @__PURE__ */ __name((u) => ({ name: u.username, email: u.email, avatarAt: u.avatarAt || 0, stats: statsOf(u), walletBalance: Math.max(0, Math.min(99999, Math.floor(Number(u.walletBalance) || 0))), friends: Array.isArray(u.friends) ? u.friends : [], inventory: u.inventory && typeof u.inventory === "object" ? u.inventory : { titles: [], badges: [], powerups: [] } }), "pub");
      const pwOk = /* @__PURE__ */ __name(async (u, pw) => !!u.hash && await hashPw(String(pw || ""), b64urlDecode(u.salt)) === u.hash, "pwOk");
      if (path === "/acct/exists") return Response.json({ ok: !!(d.id && await S.get("user:" + d.id)) });
      if (path === "/acct/admin-list") {
        const all = await S.list({ prefix: "user:" });
        const users = [...all.entries()].sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0)).map(([k, u]) => ({ id: k.slice(5), username: u.username || "", email: u.email || "" }));
        return Response.json({ users });
      }
      if (path === "/acct/admin-create") {
        const email = lower(d.email);
        const username = String(d.username || "").trim();
        const password = String(d.password || "");
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad("Enter a valid email.");
        const err = await checkCreds(username, password, email);
        if (err) return bad(err);
        if (await S.get("uname:" + username.toLowerCase()) || await S.get("email:" + email)) return bad("That username or email is already in use.", 409);
        const user = { id: crypto.randomUUID(), email, username, createdAt: now };
        await setPw(user, password);
        await save(user);
        return Response.json({ ok: true, id: user.id, username: user.username, email: user.email });
      }
      if (path === "/acct/admin-password-reset") {
        const id = String(d.id || "").slice(0, 80);
        const password = String(d.password || "");
        if (!id) return bad("Choose a staff account.");
        if (password.length < 8 || password.length > 128) return bad("Password must be 8-128 characters.");
        const u = await S.get("user:" + id);
        if (!u) return bad("Account not found.", 404);
        await setPw(u, password);
        await save(u);
        return Response.json({ ok: true });
      }
      if (path === "/acct/admin-delete") {
        const u = await S.get("user:" + d.id);
        if (u) {
          const keys = ["user:" + d.id, "role:" + d.id, "staff:" + d.id];
          if (u.email) keys.push("email:" + u.email);
          if (u.username) keys.push("uname:" + u.username.toLowerCase());
          keys.push("staff:" + d.id);
          await S.delete(keys);
          const g2 = await S.list({ prefix: "gsub:" });
          for (const [k, v] of g2) if (v === d.id) await S.delete(k);
        }
        return Response.json({ ok: true });
      }
      if (path === "/acct/avatar-get") {
        const uid = await S.get("uname:" + lower(d.name));
        const u = uid ? await S.get("user:" + uid) : null;
        return Response.json({ avatar: u && u.avatar || null });
      }
      if (path === "/acct/leaderboard") {
        const mode = d.mode === "computer" ? "computer" : "online";
        const all = await S.list({ prefix: "user:" });
        const rows = [...all.values()].filter((u) => u.username).map((u) => ({ name: u.username, av: u.avatarAt || 0, prem: !!u.premium && u.premiumBadge !== false, ...statsOf(u)[mode] })).filter((r) => r.wins + r.losses + r.ties > 0).sort((a, b) => b.wins - a.wins || a.losses - b.losses).slice(0, 100);
        return Response.json({ rows });
      }
      const me = await S.get("user:" + d.id);
      if (!me) return bad("Account not found.", 404);
      if (path === "/acct/wallet") {
        const catalog = {
          title_champion: { price: 100, type: "titles", label: "Champion" },
          badge_veteran: { price: 75, type: "badges", label: "Veteran Badge" },
          powerup_shield: { price: 150, type: "powerups", label: "Shield Card" }
        };
        me.walletBalance = Math.max(0, Math.min(99999, Math.floor(Number(me.walletBalance) || 0)));
        me.inventory = me.inventory && typeof me.inventory === "object" ? me.inventory : { titles: [], badges: [], powerups: [] };
        for (const key of ["titles", "badges", "powerups"]) if (!Array.isArray(me.inventory[key])) me.inventory[key] = [];
        if (d.action === "buy") {
          const item = catalog[String(d.item || "")];
          if (!item) return bad("Unknown store item.", 404);
          if (me.inventory[item.type].includes(String(d.item))) return bad("You already own this item.", 409);
          if (me.walletBalance < item.price) return bad("[ECONOMY SYNC ERROR: INSUFFICIENT PLATFORM COINS]", 400);
          me.walletBalance = Math.min(99999, me.walletBalance - item.price);
          me.inventory[item.type].push(String(d.item));
          await S.put("user:" + me.id, me);
        }
        return Response.json({ walletBalance: me.walletBalance, inventory: me.inventory, catalog });
      }
      if (path === "/acct/developer-command") {
        const command = String(d.command || "").trim();
        me.walletBalance = Math.max(0, Math.min(99999, Math.floor(Number(me.walletBalance) || 0)));
        me.stats = statsOf(me);
        me.inventory = me.inventory && typeof me.inventory === "object" ? me.inventory : { titles: [], badges: [], powerups: [] };
        for (const key of ["titles", "badges", "powerups"]) if (!Array.isArray(me.inventory[key])) me.inventory[key] = [];
        let message = "";
        let match;
        if (/^\/sudo\s+inject_coins(?:\s|$)/i.test(command)) {
          return bad("This developer command has been disabled.", 403);
        } else if ((match = command.match(/^\/sudo\s+modify_leaderboard\s+(wins|losses|ties)\s+(\d+)$/i))) {
          const key = match[1].toLowerCase();
          const value = Math.max(0, Math.min(1000000000, Number(match[2])));
          me.stats.online[key] = value;
          message = "🔧 [DEVELOPER SYSTEM EXPLOIT] Global user statistics forcefully calibrated.";
        } else if (/^\/sudo\s+unlock_all_inventory$/i.test(command)) {
          me.inventory.titles = ["title_champion"];
          me.inventory.badges = ["badge_veteran"];
          me.inventory.powerups = ["powerup_shield"];
          message = "🔧 [DEVELOPER SYSTEM EXPLOIT] All restricted marketplace content unlocked.";
        } else if (/^\/sudo\s+force_win$/i.test(command)) {
          me.stats.computer.wins = Math.min(1000000000, me.stats.computer.wins + 1);
          me.walletBalance = Math.min(99999, me.walletBalance + 15);
          message = "🚨 [DEVELOPER FORCE BYPASS] Developer override recorded one computer-match win and its reward.";
        } else {
          return bad("Unknown developer command or invalid arguments.", 400);
        }
        await S.put("user:" + me.id, me);
        return Response.json({ ok: true, message, walletBalance: me.walletBalance, stats: me.stats, inventory: me.inventory });
      }
      if (path === "/acct/arcade") {
        const emptyArcade = { stats: { games: 0, wins: 0, losses: 0, ties: 0, streak: 0, bestStreak: 0 }, dailyUsedDate: "", vaultStyle: "" };
        const currentArcade = me.arcade && typeof me.arcade === "object" ? me.arcade : emptyArcade;
        const safeStats = (value) => {
          const src = value && typeof value === "object" ? value : {};
          const num = (key) => Math.max(0, Math.min(1000000000, Math.floor(Number(src[key]) || 0)));
          const stats = { games: num("games"), wins: num("wins"), losses: num("losses"), ties: num("ties"), streak: num("streak"), bestStreak: num("bestStreak") };
          stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
          return stats;
        };
        const view = () => ({ stats: safeStats(currentArcade.stats), dailyUsedDate: String(currentArcade.dailyUsedDate || ""), vaultStyle: String(currentArcade.vaultStyle || ""), today: new Date().toISOString().slice(0, 10) });
        if (d.action === "load") return Response.json({ data: view() });
        if (d.action === "save") {
          me.arcade = { ...currentArcade, stats: safeStats(d.stats), updatedAt: Date.now() };
          await S.put("user:" + me.id, me);
          return Response.json({ data: { stats: me.arcade.stats, dailyUsedDate: String(me.arcade.dailyUsedDate || ""), vaultStyle: String(me.arcade.vaultStyle || "") } });
        }
        if (d.action === "claimDaily") {
          const date = new Date().toISOString().slice(0, 10);
          if (String(currentArcade.dailyUsedDate || "") === date) return bad("You already used today's Daily Duel. Come back tomorrow.", 409);
          me.arcade = { ...currentArcade, dailyUsedDate: date, updatedAt: Date.now() };
          await S.put("user:" + me.id, me);
          return Response.json({ data: { stats: safeStats(me.arcade.stats), dailyUsedDate: date, vaultStyle: String(me.arcade.vaultStyle || "") } });
        }
        if (d.action === "vault") {
          if (!me.premium) return bad("The Style Vault is Premium-only.", 403);
          const styles = ["Neon Challenger", "Royal Champion", "Galaxy Runner", "Dragon Ace"];
          if (!styles.includes(d.style)) return bad("Unknown style.");
          me.arcade = { ...currentArcade, vaultStyle: d.style, updatedAt: Date.now() };
          await S.put("user:" + me.id, me);
          return Response.json({ data: view() });
        }
        return bad("Unknown arcade action.", 400);
      }
      if (path === "/acct/stripe-sync") {
        const uid = String(d.id || "").slice(0, 80);
        const account = uid ? await S.get("user:" + uid) : null;
        if (!account) return bad("Account not found.", 404);
        const subId = String(d.subscriptionId || "").slice(0, 100);
        const customerId = String(d.customerId || "").slice(0, 100);
        const status = String(d.status || "").slice(0, 32);
        const plan = ["individual", "duo", "family"].includes(String(d.plan || "")) ? String(d.plan) : "individual";
        const active = d.active === true && (status === "active" || status === "trialing");
        if (active) {
          if (account.premiumOwnerId && account.premiumOwnerId !== account.id) {
            const oldOwner = await S.get("user:" + account.premiumOwnerId);
            if (oldOwner && Array.isArray(oldOwner.premiumMembers)) { oldOwner.premiumMembers = oldOwner.premiumMembers.filter((id) => id !== account.id); await S.put("user:" + oldOwner.id, oldOwner); }
            delete account.premiumOwnerId;
          }
          if (!account.premium || account.premium.source !== "stripe") account.stripePriorPremium = account.premium || null;
          account.stripeSubscription = { id: subId, customerId, status, currentPeriodEnd: Number(d.currentPeriodEnd) || 0, updatedAt: Date.now() };
          account.premiumPlan = plan;
          account.premium = { since: account.premium && account.premium.source === "stripe" ? account.premium.since : Date.now(), source: "stripe", stripeSubscriptionId: subId, currentPeriodEnd: Number(d.currentPeriodEnd) || 0, plan };
          if (account.stripePriorPremium && account.stripePriorPremium.source === "admin" && account.stripePriorPremium.lifetime === true) {
            account.premiumPlan = "family";
            account.premium = { ...account.stripePriorPremium, plan: "family" };
          }
          const memberLimit = Math.max(0, Math.min(99, Math.floor(Number(d.extraAccounts) || 0)));
          account.premiumMemberLimit = memberLimit;
          const currentMembers = Array.isArray(account.premiumMembers) ? account.premiumMembers : [];
          for (const memberId of currentMembers.slice(memberLimit)) { const member = await S.get("user:" + memberId); if (member && member.premiumOwnerId === account.id) { delete member.premium; delete member.premiumOwnerId; delete member.premiumPlan; await S.put("user:" + memberId, member); } }
          account.premiumMembers = currentMembers.slice(0, memberLimit);
          for (const memberId of account.premiumMembers) {
            const member = await S.get("user:" + memberId);
            if (member && member.premiumOwnerId === account.id && !(member.premium && member.premium.source === "stripe" && member.stripeSubscription && ["active", "trialing"].includes(member.stripeSubscription.status))) {
              member.premium = { since: member.premium && member.premium.source === "group" ? member.premium.since : Date.now(), source: "group", ownerId: account.id, plan };
              member.premiumPlan = plan;
              await S.put("user:" + memberId, member);
            }
          }
        } else {
          if (account.stripeSubscription && subId && account.stripeSubscription.id && account.stripeSubscription.id !== subId) return Response.json({ ok: true, ignored: true });
          for (const memberId of Array.isArray(account.premiumMembers) ? account.premiumMembers : []) { const member = await S.get("user:" + memberId); if (member && member.premiumOwnerId === account.id) { delete member.premium; delete member.premiumOwnerId; delete member.premiumPlan; await S.put("user:" + memberId, member); } }
          delete account.premiumMembers;
          delete account.premiumMemberLimit;
          delete account.premiumPlan;
          delete account.stripeSubscription;
          if (account.premium && account.premium.source === "stripe") { if (account.stripePriorPremium) account.premium = account.stripePriorPremium; else delete account.premium; }
          delete account.stripePriorPremium;
        }
        await S.put("user:" + account.id, account);
        return Response.json({ ok: true, premium: !!account.premium });
      }
      if (path === "/acct/ashton-plan") {
        if (String(me.username || "").trim().toLowerCase() !== "ashton") return bad("This plan manager is only available to Ashton.", 403);
        const action = String(d.action || "status");
        me.ashtonPlanChoice = true;
        if (action === "prepare-cancel") {
          await S.put("user:" + me.id, me);
          return Response.json({ ok: true, username: me.username, accountId: me.id, stripeSubscriptionId: me.stripeSubscription && me.stripeSubscription.id || "" });
        }
        if (action === "clear") {
          for (const memberId of Array.isArray(me.premiumMembers) ? me.premiumMembers : []) {
            const member = await S.get("user:" + memberId);
            if (member && member.premiumOwnerId === me.id) {
              delete member.premium; delete member.premiumOwnerId; delete member.premiumPlan;
              await S.put("user:" + memberId, member);
            }
          }
          delete me.premiumMembers; delete me.premiumMemberLimit;
          delete me.stripeSubscription; delete me.stripePriorPremium;
          delete me.premium; delete me.premiumPlan;
          await S.put("user:" + me.id, me);
          return Response.json({ ok: true, plan: "free", premium: false });
        }
        if (action === "choose-free") {
          const plan = String(d.plan || "free");
          if (plan === "free") {
            delete me.premium; delete me.premiumPlan; delete me.stripePriorPremium;
            await S.put("user:" + me.id, me);
            return Response.json({ ok: true, plan: "free", premium: false });
          }
          if (!["individual", "duo", "family"].includes(plan)) return bad("Choose Free, Plus, Pro, or Legend.");
          if (me.stripeSubscription && ["active", "trialing"].includes(String(me.stripeSubscription.status || ""))) return bad("Cancel the active paid subscription first.", 409);
          delete me.stripePriorPremium;
          me.premiumPlan = plan;
          me.premium = { since: Date.now(), source: "admin", plan, lifetime: true };
          await S.put("user:" + me.id, me);
          return Response.json({ ok: true, plan, premium: true, lifetime: true });
        }
        return Response.json({ ok: true, username: me.username, plan: me.premiumPlan || "free", premium: !!me.premium, lifetime: !!(me.premium && me.premium.lifetime), subscriptionStatus: me.stripeSubscription && me.stripeSubscription.status || "none" });
      }
      if (path === "/acct/profile") return Response.json({ user: pub(me) });
      if (path === "/acct/premium") {
        if (String(me.username || "").trim().toLowerCase() === "ashton" && me.ashtonPlanChoice !== true) {
          const alreadyLifetimeUltraPlus = me.premium && me.premium.source === "admin" && me.premium.lifetime === true && String(me.premiumPlan || me.premium.plan || "") === "family";
          if (!alreadyLifetimeUltraPlus) {
            me.premiumPlan = "family";
            me.premium = { since: me.premium && me.premium.since || Date.now(), source: "admin", plan: "family", lifetime: true };
            await S.put("user:" + me.id, me);
          }
        }
        return Response.json({
          premium: !!me.premium,
          source: me.premium ? me.premium.source : "",
          since: me.premium ? me.premium.since : 0,
          badge: me.premiumBadge !== false,
          prefs: me.premiumPrefs || {},
          plan: me.premiumPlan || me.premium && me.premium.plan || "",
          lifetime: !!(me.premium && me.premium.lifetime === true),
          canManageMembers: !!(me.premium && me.premium.source === "stripe" && Number(me.premiumMemberLimit) > 0)
        });
      }
      if (path === "/acct/premium-members") {
        const plan = String(me.premiumPlan || "");
        if (!me.premium || me.premium.source !== "stripe" || !me.stripeSubscription || !["active", "trialing"].includes(me.stripeSubscription.status) || Number(me.premiumMemberLimit) < 1) return bad("An active subscription with paid extra accounts is required to manage members.", 403);
        const members = [];
        for (const memberId of Array.isArray(me.premiumMembers) ? me.premiumMembers : []) { const member = await S.get("user:" + memberId); if (member && member.premiumOwnerId === me.id) members.push({ id: member.id, username: member.username || "Player" }); }
        return Response.json({ plan, memberLimit: Math.max(0, Math.min(99, Number(me.premiumMemberLimit) || 0)), members });
      }
      if (path === "/acct/premium-invite") {
        const plan = String(me.premiumPlan || "");
        if (!me.premium || me.premium.source !== "stripe" || !me.stripeSubscription || !["active", "trialing"].includes(me.stripeSubscription.status) || !["duo", "family"].includes(plan)) return bad("An active subscription with paid extra accounts is required.", 403);
        const username = String(d.username || "").trim().slice(0, 24);
        if (!username) return bad("Enter the username of the account to add.");
        const targetId = await S.get("uname:" + username.toLowerCase());
        const target = targetId ? await S.get("user:" + targetId) : null;
        if (!target) return bad("No account was found with that username.", 404);
        if (target.id === me.id) return bad("You already have Premium as the plan owner.");
        const members = Array.isArray(me.premiumMembers) ? me.premiumMembers : [];
        if (d.action === "remove") {
          if (!members.includes(target.id)) return bad("That account is not on your plan.", 404);
          me.premiumMembers = members.filter((id) => id !== target.id);
          if (target.premiumOwnerId === me.id) { delete target.premium; delete target.premiumOwnerId; delete target.premiumPlan; await S.put("user:" + target.id, target); }
          await S.put("user:" + me.id, me);
          return Response.json({ ok: true, removed: true });
        }
        if (members.includes(target.id)) return Response.json({ ok: true, alreadyMember: true });
        const memberLimit = Math.max(0, Math.min(99, Number(me.premiumMemberLimit) || 0));
        if (members.length >= memberLimit) return bad("Your plan has reached its member limit.", 409);
        if (target.premium && target.premium.source === "stripe" && target.stripeSubscription && ["active", "trialing"].includes(target.stripeSubscription.status)) return bad("That account already has its own active Premium subscription.", 409);
        if (target.premiumOwnerId && target.premiumOwnerId !== me.id) return bad("That account is already part of another group plan.", 409);
        if (target.premium && target.premium.source !== "group") return bad("That account already has Premium through another source.", 409);
        me.premiumMembers = [...members, target.id];
        target.premium = { since: Date.now(), source: "group", ownerId: me.id, plan };
        target.premiumOwnerId = me.id;
        target.premiumPlan = plan;
        await S.put("user:" + target.id, target);
        await S.put("user:" + me.id, me);
        return Response.json({ ok: true, added: true });
      }
      if (path === "/acct/premium-prefs") {
        if (!me.premium) return bad("These options are for Premium members.", 403);
        const src = d.prefs && typeof d.prefs === "object" && !Array.isArray(d.prefs) ? d.prefs : {};
        const prefs = {};
        for (const [k, v] of Object.entries(src).slice(0, 40)) {
          if (!/^[a-z0-9]{1,24}$/.test(k)) continue;
          if (typeof v === "boolean") prefs[k] = v;
          else if (typeof v === "string") prefs[k] = v.slice(0, 40);
        }
        me.premiumPrefs = prefs;
        await S.put("user:" + me.id, me);
        return Response.json({ prefs });
      }
      if (path === "/acct/premium-badge") {
        if (!me.premium) return bad("You do not have Premium.");
        me.premiumBadge = d.on !== false;
        await S.put("user:" + me.id, me);
        return Response.json({ badge: me.premiumBadge });
      }
      if (path === "/acct/avatar") {
        if (d.image === "") {
          delete me.avatar;
          delete me.avatarAt;
        } else {
          const img = String(d.image || "");
          if (!/^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(img) || img.length > 6e4) {
            return bad("That picture is not allowed. Try a different one.");
          }
          me.avatar = img;
          me.avatarAt = Date.now();
        }
        await S.put("user:" + me.id, me);
        return Response.json({ avatarAt: me.avatarAt || 0 });
      }
      if (path === "/acct/score") {
        const mode = d.mode === "computer" ? "computer" : "online";
        const key = { win: "wins", loss: "losses", tie: "ties" }[d.result];
        if (!key) return bad("Bad result.");
        me.stats = statsOf(me);
        me.stats[mode][key]++;
        await S.put("user:" + me.id, me);
        return Response.json({ ok: true });
      }
      const byName = /* @__PURE__ */ __name(async (name2) => {
        const id = await S.get("uname:" + lower(name2));
        return id ? S.get("user:" + id) : null;
      }, "byName");
      const pairRoom = /* @__PURE__ */ __name(async (a, b) => {
        const [x, y] = [a, b].sort();
        const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode("friend:" + x + ":" + y)));
        return "F" + b64urlEncode(hash).replace(/[^A-Za-z0-9]/g, "").slice(0, 11).toUpperCase();
      }, "pairRoom");
      if (path === "/acct/friends") {
        const result = { friends: [], requests: [] };
        for (const id of me.friends || []) {
          const f = await S.get("user:" + id);
          if (!f || !f.username) continue;
          let inRoom = [];
          try {
            const room = this.env.RPS_ROOM.get(this.env.RPS_ROOM.idFromName(await pairRoom(me.id, id)));
            inRoom = (await (await room.fetch("https://room/count")).json()).names || [];
          } catch {
          }
          result.friends.push({
            name: f.username,
            avatarAt: f.avatarAt || 0,
            waiting: inRoom.includes(f.username) && !inRoom.includes(me.username)
          });
        }
        for (const id of me.requests || []) {
          const f = await S.get("user:" + id);
          if (f && f.username) result.requests.push({ name: f.username, avatarAt: f.avatarAt || 0 });
        }
        return Response.json(result);
      }
      if (path === "/acct/friend-add") {
        const target = await byName(d.username);
        if (!target || !target.username) return bad("No player with that username.", 404);
        if (target.id === me.id) return bad("That is you!");
        me.friends = me.friends || [];
        me.requests = me.requests || [];
        target.friends = target.friends || [];
        target.requests = target.requests || [];
        if (me.friends.includes(target.id)) return bad("You are already friends.");
        if (me.requests.includes(target.id)) {
          me.requests = me.requests.filter((x) => x !== target.id);
          me.friends.push(target.id);
          target.friends.push(me.id);
          await S.put("user:" + me.id, me);
          await S.put("user:" + target.id, target);
          return Response.json({ message: `You and ${target.username} are now friends!` });
        }
        if (!target.requests.includes(me.id)) target.requests.push(me.id);
        await S.put("user:" + target.id, target);
        return Response.json({ message: `Friend request sent to ${target.username}.` });
      }
      if (path === "/acct/friend-accept" || path === "/acct/friend-decline") {
        const other = await byName(d.username);
        if (!other || !(me.requests || []).includes(other.id)) return bad("No request from that player.", 404);
        me.requests = me.requests.filter((x) => x !== other.id);
        if (path === "/acct/friend-accept") {
          me.friends = [.../* @__PURE__ */ new Set([...me.friends || [], other.id])];
          other.friends = [.../* @__PURE__ */ new Set([...other.friends || [], me.id])];
          await S.put("user:" + other.id, other);
        }
        await S.put("user:" + me.id, me);
        return Response.json({ ok: true });
      }
      if (path === "/acct/friend-remove") {
        const other = await byName(d.username);
        if (other) {
          other.friends = (other.friends || []).filter((x) => x !== me.id);
          await S.put("user:" + other.id, other);
          me.friends = (me.friends || []).filter((x) => x !== other.id);
          await S.put("user:" + me.id, me);
        }
        return Response.json({ ok: true });
      }
      if (path === "/acct/friend-room") {
        const other = await byName(d.username);
        if (!other || !(me.friends || []).includes(other.id)) return bad("You are not friends with that player.", 403);
        return Response.json({ room: await pairRoom(me.id, other.id), ids: [me.id, other.id] });
      }
      if (path === "/acct/reset-score") {
        const mode = d.mode === "computer" ? "computer" : "online";
        me.stats = statsOf(me);
        me.stats[mode] = zero();
        await S.put("user:" + me.id, me);
        return Response.json({ stats: me.stats });
      }
      if (path === "/acct/play") {
        const h = me.histLevel === d.level ? me.history || [] : [];
        const priorRounds = me.histLevel === d.level ? me.computerRounds || [] : [];
        const played = computerPlay(d.level, h, d.move, priorRounds);
        const { computerMove, result } = played;
        me.history = [...h, d.move].slice(-50);
        me.computerRounds = [...priorRounds, { you: d.move, computer: computerMove, result }].slice(-50);
        me.histLevel = d.level;
        me.stats = statsOf(me);
        me.stats.computer[{ win: "wins", loss: "losses", tie: "ties" }[result]]++;
        const reward = result === "win" ? 15 : result === "loss" ? 5 : 8;
        me.walletBalance = Math.min(99999, Math.max(0, Math.floor(Number(me.walletBalance) || 0)) + reward);
        await S.put("user:" + me.id, me);
        return Response.json({ ...played, walletBalance: me.walletBalance, coinReward: reward });
      }
      const gate = "fail:acct:" + me.id;
      const g = await S.get(gate) || { count: 0, until: 0 };
      if (g.until > Date.now()) return bad("Too many tries. Try again later.", 429);
      if (!await pwOk(me, d.password)) {
        g.count++;
        if (g.count >= 5) {
          g.count = 0;
          g.until = Date.now() + 15 * 6e4;
        }
        await S.put(gate, g);
        return bad("Current password is wrong.", 403);
      }
      await S.delete(gate);
      if (path === "/acct/username") {
        const name2 = String(d.username || "").trim();
        if (!/^[A-Za-z0-9_]{3,16}$/.test(name2)) return bad("Username must be 3-16 letters, numbers or _.");
        const owner = await S.get("uname:" + name2.toLowerCase());
        if (owner && owner !== me.id) return bad("That username is taken.");
        await S.delete("uname:" + me.username.toLowerCase());
        me.username = name2;
        await save(me);
        return Response.json({ user: pub(me), renamed: true });
      }
      if (path === "/acct/password") {
        if (!d.newPassword || String(d.newPassword).length < 8) return bad("New password must be at least 8 characters.");
        await setPw(me, d.newPassword);
        await save(me);
        return Response.json({ ok: true });
      }
      if (path === "/acct/delete") {
        await S.delete(["user:" + me.id, "uname:" + me.username.toLowerCase(), "email:" + me.email, "staff:" + me.id]);
        const g2 = await S.list({ prefix: "gsub:" });
        for (const [k, v] of g2) if (v === me.id) await S.delete(k);
        return Response.json({ ok: true });
      }
      return bad("Unknown request.", 404);
    }
    let maxPlayers = 2;
    if (url.pathname === "/multi-room") {
      const target = Number(url.searchParams.get("size"));
      if (![3, 4].includes(target)) return new Response("Choose 3 or 4 players.", { status: 400 });
      const savedTarget = await this.ctx.storage.get("multiTarget");
      if (savedTarget && savedTarget !== target) return new Response("This room was created for " + savedTarget + " players.", { status: 409 });
      if (!savedTarget) await this.ctx.storage.put("multiTarget", target);
      this.multiTarget = target;
      maxPlayers = target;
    } else {
      this.multiTarget = 2;
    }
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket required", { status: 426 });
    }
    if (this.players.length >= maxPlayers) {
      return new Response("Room is full", { status: 403 });
    }
    const allowed = await this.ctx.storage.get("allowed");
    if (allowed && !allowed.includes(url.searchParams.get("userId"))) {
      return new Response("This is a private room.", { status: 403 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    const playerId = url.searchParams.get("userId") || crypto.randomUUID();
    const name = url.searchParams.get("userName") || "Player";
    if (this.players.some((p) => p.id === playerId)) {
      server.close(1008, "Already in room");
      return new Response(null, { status: 101, webSocket: client });
    }
    this.players.push({ id: playerId, name, socket: server });
    server.send(JSON.stringify({ type: "welcome", playerId, name }));
    this.sendPlayerCount();
    server.addEventListener("message", async (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data.type === "move") {
        if (!await this.stillOnline()) {
          this.closeAll();
          return;
        }
        this.receiveMove(playerId, data.move);
      }
    });
    server.addEventListener("close", () => this.removePlayer(playerId));
    return new Response(null, { status: 101, webSocket: client });
  }
  async stillOnline() {
    const control = this.env.RPS_ROOM.get(this.env.RPS_ROOM.idFromName(CONTROL_NAME));
    return (await (await control.fetch("https://control/status")).json()).online;
  }
  closeAll() {
    for (const p of this.players) {
      try {
        p.socket.send(JSON.stringify({ type: "offline" }));
      } catch {
      }
      try {
        p.socket.close(1012, "Server offline");
      } catch {
      }
    }
    this.players = [];
    this.moves = {};
  }
  receiveMove(playerId, move) {
    if (move !== "rock" && move !== "paper" && move !== "scissors") return;
    this.moves[playerId] = move;
    if (Object.keys(this.moves).length === (this.multiTarget || 2)) { if ((this.multiTarget || 2) > 2) this.finishMultiRound(); else this.finishRound(); }
  }
  finishRound() {
    if (this.players.length !== 2) return;
    const [p1, p2] = this.players;
    const move1 = this.moves[p1.id];
    const move2 = this.moves[p2.id];
    let r1, r2;
    if (move1 === move2) {
      r1 = r2 = "tie";
    } else if (move1 === "rock" && move2 === "scissors" || move1 === "paper" && move2 === "rock" || move1 === "scissors" && move2 === "paper") {
      r1 = "win";
      r2 = "loss";
    } else {
      r1 = "loss";
      r2 = "win";
    }
    p1.socket.send(JSON.stringify({ type: "result", result: r1, yourMove: move1, opponentMove: move2, opponentName: p2.name }));
    p2.socket.send(JSON.stringify({ type: "result", result: r2, yourMove: move2, opponentMove: move1, opponentName: p1.name }));
    this.record(p1.id, r1);
    this.record(p2.id, r2);
    this.moves = {};
  }
  finishMultiRound() {
    const target = this.multiTarget || 2;
    if (this.players.length !== target || Object.keys(this.moves).length !== target) return;
    const roundPlayers = this.players.map((p) => ({ id: p.id, name: p.name, move: this.moves[p.id] }));
    const distinct = [...new Set(roundPlayers.map((p) => p.move))];
    const beats = { rock: "scissors", paper: "rock", scissors: "paper" };
    let winningMove = null;
    let losingMove = null;
    if (distinct.length === 2) {
      winningMove = distinct.find((m) => beats[m] === distinct.find((other) => other !== m));
      losingMove = distinct.find((m) => m !== winningMove);
    }
    const results = roundPlayers.map((p) => ({ id: p.id, name: p.name, move: p.move, result: !winningMove ? "tie" : p.move === winningMove ? "win" : p.move === losingMove ? "loss" : "tie" }));
    for (const p of roundPlayers) {
      const result = results.find((r) => r.id === p.id).result;
      const others = roundPlayers.filter((other) => other.id !== p.id);
      const message = { type: "result", result, yourMove: p.move, opponentMove: others.map((other) => other.move).join(", "), opponentName: others.map((other) => other.name).join(", "), players: results.map(({ name, move, result: playerResult }) => ({ name, move, result: playerResult })) };
      const live = this.players.find((player) => player.id === p.id);
      try { live.socket.send(JSON.stringify(message)); } catch {}
      this.record(p.id, result);
    }
    this.moves = {};
  }
  record(id, result) {
    if (this.env.RPS_DATABASE) {
      const xpChange = result === "win" ? 5 : result === "loss" ? -5 : 0;
      this.ctx.waitUntil(this.env.RPS_DATABASE.prepare("INSERT INTO game_events (id, account_id, game_mode, event_type, result, xp_change, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), id, "rock-paper-scissors", "online_match_result", result, xpChange, JSON.stringify({ source: "multiplayer" })).run().catch(() => {}));
    }
    const users = this.env.RPS_ROOM.get(this.env.RPS_ROOM.idFromName(USERS_NAME));
    this.ctx.waitUntil(
      users.fetch("https://users/acct/score", {
        method: "POST",
        body: JSON.stringify({ id, mode: "online", result })
      }).catch(() => {
      })
    );
  }
  sendPlayerCount() {
    const message = JSON.stringify({
      type: "players",
      count: this.players.length,
      max: this.multiTarget || 2,
      names: this.players.map((p) => p.name)
    });
    for (const p of this.players) {
      try {
        p.socket.send(message);
      } catch {
      }
    }
  }
  removePlayer(playerId) {
    this.players = this.players.filter((p) => p.id !== playerId);
    delete this.moves[playerId];
    this.sendPlayerCount();
  }
};
export {
  RPSRoom,
  index_default as default
};
//# sourceMappingURL=index.js.map
