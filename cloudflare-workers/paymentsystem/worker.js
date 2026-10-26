var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.js
var SITE_ORIGIN = "https://www.stone-paper-scissors.com";
var PRICE_IDS = {
  plus: { month: "price_1UUhriKoGEk54c2MpTJE5ZeU", year: "price_1UUhsAKoGEk54c2MdGMZUy78" },
  pro: { month: "price_1UUhruKoGEk54c2MjOKQpnlJ", year: "price_1UUhsCKoGEk54c2M8idWNdBy" },
  legend: { month: "price_1UUhrwKoGEk54c2MQfCrqPfy", year: "price_1UUhsEKoGEk54c2MfZGTd6Gk" }
};
var EXTRA_PRICE_IDS = {
  plus: { month: "price_1UUhryKoGEk54c2MKJ5gKIUL", year: "price_1UUhsUKoGEk54c2Mgf1wIM4U" },
  pro: { month: "price_1UUhs0KoGEk54c2MHTGrU9NW", year: "price_1UUhsIKoGEk54c2MXTBM3sN9" },
  legend: { month: "price_1UUhs3KoGEk54c2M78aYsY2S", year: "price_1UUhsKKoGEk54c2M30bQsH5l" }
};
var PROMO_CODE = "734462";
var PROMO_COUPON_ID = "rps-734462-100-off";
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": SITE_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(json, "json");
function ct(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return d === 0;
}
__name(ct, "ct");
function gameFetch(env, path, init) {
  return env.RPS_SERVER ? env.RPS_SERVER.fetch("https://rps-server" + path, init) : fetch("https://rps-server.heyboernathan.workers.dev" + path, init);
}
__name(gameFetch, "gameFetch");
async function stripe(env, path, body) {
  const r = await fetch("https://api.stripe.com/v1" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + env.STRIPE_SECRET_KEY,
      ...body ? {
        "Content-Type": "application/x-www-form-urlencoded"
      } : {}
    },
    body
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(d.error?.message || "Stripe request failed");
    e.stripeType = d.error?.type || "";
    e.stripeCode = d.error?.code || "";
    e.status = r.status;
    throw e;
  }
  return d;
}
__name(stripe, "stripe");
async function verify(raw, header, secret) {
  if (!header || !secret) return false;
  const fields = header.split(",").map((x) => x.split("="));
  const ts = fields.find((x) => x[0] === "t")?.[1];
  const sigs = fields.filter((x) => x[0] === "v1").map((x) => x[1]);
  if (!ts || !sigs.length || Math.abs(Date.now() / 1e3 - Number(ts)) > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(ts + "." + raw)
    )
  );
  const expected = Array.from(
    bytes,
    (b) => b.toString(16).padStart(2, "0")
  ).join("");
  return sigs.some((x) => ct(x, expected));
}
__name(verify, "verify");
async function sessionAccount(env, token) {
  const r = await gameFetch(env, "/internal/payment-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Payment-Secret": env.PAYMENT_SYNC_SECRET
    },
    body: JSON.stringify({ token })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ok || typeof d.accountId !== "string") {
    throw new Error("Invalid game session");
  }
  return d.accountId;
}
__name(sessionAccount, "sessionAccount");
async function sync(env, s) {
  const m = s.metadata || {};
  if (!m.accountId) return;
  const status = String(s.status || "unknown");
  const customer = typeof s.customer === "string" ? s.customer : s.customer?.id || "";
  const r = await gameFetch(env, "/internal/payment-membership", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Payment-Secret": env.PAYMENT_SYNC_SECRET
    },
    body: JSON.stringify({
      accountId: String(m.accountId),
      active: status === "active" || status === "trialing",
      status,
      subscriptionId: s.id || "",
      customerId: customer,
      currentPeriodEnd: Number(s.current_period_end) || 0,
      plan: ({ plus: "individual", pro: "duo", legend: "family", individual: "individual", duo: "duo", family: "family" })[String(m.plan || "")] || "individual",
      extraAccounts: Math.max(0, Math.min(99, Math.floor(Number(m.extraAccounts) || 0)))
    })
  });
  if (!r.ok) throw new Error("Membership sync failed");
}
__name(sync, "sync");
async function findPromo(env) {
  const result = await stripe(
    env,
    "/promotion_codes?code=" + encodeURIComponent(PROMO_CODE) + "&active=true&limit=100"
  );
  return (result.data || []).find(
    (p) => p.code === PROMO_CODE && p.active && p.promotion?.coupon === PROMO_COUPON_ID && (p.max_redemptions == null || p.times_redeemed < p.max_redemptions)
  );
}
__name(findPromo, "findPromo");
var worker_default = {
  async fetch(request, env) {
    const u = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": SITE_ORIGIN,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    if (u.pathname === "/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "paymentsystem",
        configured: !!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.PAYMENT_SYNC_SECRET),
        serviceBinding: !!env.RPS_SERVER
      });
    }
    if (u.pathname === "/account/ashton-cancel" && request.method === "POST") {
      if (request.headers.get("Origin") !== SITE_ORIGIN) return json({ error: "Origin not allowed." }, 403);
      if (!env.STRIPE_SECRET_KEY || !env.PAYMENT_SYNC_SECRET) return json({ error: "Payment service is not configured." }, 503);
      let b; try { b = await request.json(); } catch { return json({ error: "Bad request." }, 400); }
      let accountId; try { accountId = await sessionAccount(env, b?.token); } catch { return json({ error: "Please log in again." }, 401); }
      const check = await gameFetch(env, "/account/ashton-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: b.token, action: "prepare-cancel" }) });
      const who = await check.json().catch(() => ({}));
      if (!check.ok || who.ok !== true || String(who.username || "").trim().toLowerCase() !== "ashton" || who.accountId !== accountId) return json({ error: who.error || "This control is only available to the Ashton account." }, check.status || 403);
      let cancelled = 0, cursor = "", pages = 0;
      try {
        while (pages++ < 50) {
          const query = new URLSearchParams({ status: "all", limit: "100" });
          if (cursor) query.set("starting_after", cursor);
          const page = await stripe(env, "/subscriptions?" + query.toString());
          const items = Array.isArray(page.data) ? page.data : [];
          for (const sub of items) {
            if (String(sub.metadata?.accountId || "") !== accountId && String(sub.id || "") !== String(who.stripeSubscriptionId || "")) continue;
            if (["canceled", "incomplete_expired"].includes(String(sub.status || ""))) continue;
            const resp = await fetch("https://api.stripe.com/v1/subscriptions/" + encodeURIComponent(sub.id), { method: "DELETE", headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY } });
            const result = await resp.json().catch(() => ({}));
            if (!resp.ok) throw new Error(result.error?.message || "Stripe could not cancel a subscription.");
            cancelled++;
          }
          if (!page.has_more || !items.length) break;
          cursor = items[items.length - 1].id;
        }
        if (pages > 50) throw new Error("Too many subscriptions to safely finish this request. Contact support.");
      } catch (e) {
        return json({ error: "Some subscriptions may have been cancelled. Retry this action to finish. " + String(e?.message || "Stripe cancellation failed") }, 502);
      }
      const cleared = await gameFetch(env, "/account/ashton-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: b.token, action: "clear" }) });
      const clearData = await cleared.json().catch(() => ({}));
      if (!cleared.ok || clearData.ok !== true) return json({ error: clearData.error || "Subscriptions were cancelled, but the account plan could not be reset. Retry the action." }, 502);
      return json({ ok: true, cancelled, plan: "free" });
    }
    if (u.pathname === "/account/stripe-checkout" && request.method === "POST") {
      if (request.headers.get("Origin") !== SITE_ORIGIN) {
        return json({ error: "Origin not allowed." }, 403);
      }
      if (!env.STRIPE_SECRET_KEY || !env.PAYMENT_SYNC_SECRET) {
        return json({ error: "Payment service is not configured." }, 503);
      }
      let b;
      try {
        b = await request.json();
      } catch {
        return json({ error: "Bad request." }, 400);
      }
      let accountId;
      try {
        accountId = await sessionAccount(env, b?.token);
      } catch {
        return json({
          error: "Please log in again before subscribing."
        }, 401);
      }
      const plan = String(b?.plan || "plus");
      if (!Object.prototype.hasOwnProperty.call(PRICE_IDS, plan)) {
        return json({ error: "Unknown subscription plan." }, 400);
      }
      const billingPeriod = b?.billingPeriod === "year" ? "year" : "month";
      const extras = Math.max(0, Math.min(99, Math.floor(Number(b?.extraAccounts) || 0)));
      const basePriceId = PRICE_IDS[plan][billingPeriod];
      const extraPriceId = EXTRA_PRICE_IDS[plan][billingPeriod];
      const enteredCode = String(b?.promoCode || "").trim();
      if (enteredCode) return json({ error: "Promo codes are no longer available." }, 400);
      const promoId = "";
      const f = new URLSearchParams();
      f.set("mode", "subscription");
      f.set(
        "success_url",
        SITE_ORIGIN + "/subscribe.html?checkout=success"
      );
      f.set(
        "cancel_url",
        SITE_ORIGIN + "/subscribe.html?checkout=cancelled"
      );
      f.set("client_reference_id", accountId);
      f.set("line_items[0][price]", basePriceId);
      f.set("line_items[0][quantity]", "1");
      if (extras > 0) {
        f.set("line_items[1][price]", extraPriceId);
        f.set("line_items[1][quantity]", String(extras));
      }
      f.set("metadata[accountId]", accountId);
      f.set("metadata[plan]", plan);
      f.set("metadata[extraAccounts]", String(extras));
      f.set("metadata[billingPeriod]", billingPeriod);
      f.set("subscription_data[metadata][accountId]", accountId);
      f.set("subscription_data[metadata][plan]", plan);
      f.set("subscription_data[metadata][extraAccounts]", String(extras));
      f.set("subscription_data[metadata][billingPeriod]", billingPeriod);
      if ((plan === "plus" || plan === "pro") && !promoId) {
        f.set("subscription_data[trial_period_days]", "7");
      }
      try {
        const c = await stripe(
          env,
          "/checkout/sessions",
          f.toString()
        );
        if (!c.url || !c.url.startsWith("https://checkout.stripe.com/")) {
          return json({
            error: "Stripe did not return a valid checkout URL."
          }, 502);
        }
        return json({ url: c.url });
      } catch (e) {
        const msg = String(e?.message || "unknown Stripe error").replace(/sk_(test|live)_[A-Za-z0-9]+/g, "[redacted]").slice(0, 180);
        return json({
          error: "Stripe checkout failed: " + msg,
          code: String(e?.stripeCode || ""),
          type: String(e?.stripeType || ""),
          status: Number(e?.status) || 502
        }, 502);
      }
    }
    if (u.pathname === "/stripe/webhook" && request.method === "POST") {
      if (!env.STRIPE_WEBHOOK_SECRET || !env.PAYMENT_SYNC_SECRET) {
        return new Response("Webhook is not configured.", { status: 503 });
      }
      const raw = await request.text();
      if (!await verify(
        raw,
        request.headers.get("Stripe-Signature"),
        env.STRIPE_WEBHOOK_SECRET
      )) {
        return new Response("Invalid Stripe signature.", { status: 400 });
      }
      let e;
      try {
        e = JSON.parse(raw);
      } catch {
        return new Response("Invalid JSON.", { status: 400 });
      }
      try {
        if ([
          "customer.subscription.created",
          "customer.subscription.updated",
          "customer.subscription.deleted"
        ].includes(e.type)) {
          await sync(env, e.data?.object || {});
        } else if ([
          "checkout.session.completed",
          "checkout.session.async_payment_succeeded"
        ].includes(e.type)) {
          const s = e.data?.object || {};
          const sid = typeof s.subscription === "string" ? s.subscription : s.subscription?.id;
          if (sid) {
            const sub = await stripe(
              env,
              "/subscriptions/" + encodeURIComponent(sid)
            );
            if (s.metadata?.accountId && !sub.metadata?.accountId) {
              sub.metadata = {
                ...sub.metadata || {},
                accountId: s.metadata.accountId,
                plan: s.metadata.plan || "individual"
              };
            }
            await sync(env, sub);
          }
        }
        return new Response("ok");
      } catch {
        return new Response(
          "Webhook processing failed; Stripe may retry.",
          { status: 500 }
        );
      }
    }
    return json({ error: "Not found." }, 404);
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
