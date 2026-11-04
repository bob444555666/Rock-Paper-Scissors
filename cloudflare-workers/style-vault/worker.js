const ORIGIN = "https://www.stone-paper-scissors.com";
const ACCOUNT_API = "https://rps-server.heyboernathan.workers.dev";
const HEADERS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin"
};
const TIER_RANK = { plus: 1, pro: 2, legend: 3 };
const STYLES = {
  "neon-challenger": { id: "neon-challenger", name: "Neon Challenger", icon: "⚡", effect: "Pulse", tier: "plus", colors: ["#22f5a0", "#3b82f6"], description: "A bright neon ring with a clean pulse on wins." },
  "royal-champion": { id: "royal-champion", name: "Royal Champion", icon: "👑", effect: "Golden burst", tier: "plus", colors: ["#fbbf24", "#f59e0b"], description: "A gold-trimmed champion look with a golden win burst." },
  "galaxy-runner": { id: "galaxy-runner", name: "Galaxy Runner", icon: "🌌", effect: "Starfall", tier: "plus", colors: ["#a78bfa", "#38bdf8"], description: "Cosmic colors with a starfall victory flash." },
  "dragon-ace": { id: "dragon-ace", name: "Dragon Ace", icon: "🐉", effect: "Dragon flame", tier: "plus", colors: ["#fb7185", "#f97316"], description: "A fiery profile glow and flame-style win effect." },
  "void-reaper": { id: "void-reaper", name: "Void Reaper", icon: "🌑", effect: "Void surge", tier: "pro", colors: ["#c084fc", "#6366f1"], description: "A deep violet aura and a sharp void surge." },
  "solar-vanguard": { id: "solar-vanguard", name: "Solar Vanguard", icon: "☀️", effect: "Solar flare", tier: "pro", colors: ["#fde047", "#fb923c"], description: "A radiant solar profile ring and flare effect." },
  "apex-legend": { id: "apex-legend", name: "Apex Legend", icon: "🏆", effect: "Champion shockwave", tier: "legend", colors: ["#38bdf8", "#f0abfc"], description: "An elite champion frame with a match-winning shockwave." },
  "celestial-monarch": { id: "celestial-monarch", name: "Celestial Monarch", icon: "✨", effect: "Celestial burst", tier: "legend", colors: ["#e9d5ff", "#f9a8d4"], description: "A celestial profile glow with a bright burst on wins." }
};
const DEFAULT_STYLE = "neon-challenger";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  });
}

function tierFor(data) {
  const raw = String(data.plan || data.tier || data.membership || "individual").toLowerCase().replace(/[_-]+/g, " ");
  if (raw.includes("legend") || raw.includes("family") || raw.includes("ultra plus")) return "legend";
  if (raw.includes("pro") || raw.includes("duo") || raw === "ultra") return "pro";
  return "plus";
}

function sessionSubject(token) {
  try {
    const part = String(token).split(".")[0];
    if (!part) return "";
    let value = part.replace(/-/g, "+").replace(/_/g, "/");
    while (value.length % 4) value += "=";
    const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
    return String(JSON.parse(new TextDecoder().decode(bytes)).sub || "");
  } catch {
    return "";
  }
}

async function authorize(token) {
  if (typeof token !== "string" || token.length < 20) {
    throw Object.assign(new Error("Sign in to equip and save styles."), { status: 401 });
  }
  const response = await fetch(ACCOUNT_API + "/account/premium", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    cache: "no-store"
  });
  const account = await response.json().catch(() => ({}));
  if (!response.ok || account.premium !== true) {
    throw Object.assign(new Error(account.error || "A paid membership is required to equip Style Vault items."), { status: 403 });
  }
  const userId = sessionSubject(token);
  if (!userId) throw Object.assign(new Error("Your sign-in session could not be verified."), { status: 401 });
  return { userId, tier: tierFor(account), plan: String(account.plan || "") };
}

function allowed(style, tier) {
  return !!style && TIER_RANK[tier] >= TIER_RANK[style.tier];
}

function styleByInput(value) {
  const text = String(value || "").trim().toLowerCase();
  return STYLES[text] || Object.values(STYLES).find(s => s.name.toLowerCase() === text) || null;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") return json({ ok: true, service: "RPS Style Vault" });
    if (url.pathname !== "/vault" || request.method !== "POST") return json({ error: "Not found." }, 404);

    const origin = request.headers.get("Origin");
    if (origin && origin !== ORIGIN) return json({ error: "Origin not allowed." }, 403);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }

    let account;
    try {
      account = await authorize(body.token);
    } catch (error) {
      return json({ error: error.message || "Sign in to use the Style Vault.", premium: false }, error.status || 401);
    }

    const key = "user:" + account.userId;
    const saved = await env.STYLE_VAULT.get(key, "json");
    const savedStyle = styleByInput(saved && saved.styleId) || STYLES[DEFAULT_STYLE];
    const currentStyle = allowed(savedStyle, account.tier) ? savedStyle : STYLES[DEFAULT_STYLE];
    const action = String(body.action || "load").toLowerCase();

    if (action === "load") {
      return json({ ok: true, premium: true, plan: account.plan, tier: account.tier, style: currentStyle, styleId: currentStyle.id, updatedAt: saved && saved.updatedAt || null });
    }

    if (action === "reset") {
      await env.STYLE_VAULT.delete(key);
      return json({ ok: true, premium: true, plan: account.plan, tier: account.tier, style: STYLES[DEFAULT_STYLE], styleId: DEFAULT_STYLE, reset: true });
    }

    if (action === "save" || action === "vault") {
      const selected = styleByInput(body.styleId || body.style);
      if (!selected) return json({ error: "That Style Vault item does not exist." }, 400);
      if (!allowed(selected, account.tier)) {
        return json({ error: selected.tier.toUpperCase() + " membership is required for " + selected.name + ".", requiredTier: selected.tier, tier: account.tier }, 403);
      }
      const record = { styleId: selected.id, updatedAt: Date.now() };
      await env.STYLE_VAULT.put(key, JSON.stringify(record));
      return json({ ok: true, premium: true, plan: account.plan, tier: account.tier, style: selected, styleId: selected.id, updatedAt: record.updatedAt });
    }

    return json({ error: "Unknown Style Vault action." }, 400);
  }
};