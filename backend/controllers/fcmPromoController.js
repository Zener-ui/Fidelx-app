// Scheduled "come back to the app" reminders for the Customer Android app.
// FCM-only: does not touch Web Push, the notifications table, or orders
// (orders is only READ, to skip people who just ordered).
const crypto = require("crypto");
const { adminClient } = require("../config/db");
const fcmService = require("../services/fcmService");
const { SLOTS, pickMessage, watDate } = require("../services/fcmPromoMessages");

const RECENT_ORDER_WINDOW_MS = 2 * 60 * 60 * 1000; // skip people who ordered in the last 2h
const PAGE = 1000;
const CONCURRENCY = 25;

const secretOk = (given) => {
  const expected = process.env.INTERNAL_WEBHOOK_SECRET;
  if (!expected || !given) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Pure helper (unit-tested): drop opted-out users and people who ordered recently.
const selectRecipients = (tokenRows, optedOutIds, recentOrderIds) =>
  tokenRows.filter((r) => !optedOutIds.has(r.user_id) && !recentOrderIds.has(r.user_id));

const fetchAll = async (build) => {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
};

const runSlot = async (slot, logId) => {
  const message = pickMessage(slot);
  const tokenRows = await fetchAll(() =>
    adminClient.from("fcm_device_tokens").select("token, user_id").eq("active", true).eq("app_type", "customer")
  );
  const optouts = await fetchAll(() => adminClient.from("fcm_promo_optouts").select("user_id"));
  const since = new Date(Date.now() - RECENT_ORDER_WINDOW_MS).toISOString();
  const recent = await fetchAll(() => adminClient.from("orders").select("customer_id").gte("created_at", since));

  const recipients = selectRecipients(
    tokenRows,
    new Set(optouts.map((r) => r.user_id)),
    new Set(recent.map((r) => r.customer_id))
  );

  let sent = 0, failed = 0, invalid = 0;
  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
    const batch = recipients.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((r) =>
        fcmService.sendToToken({
          token: r.token,
          title: message.title,
          body: message.body,
          data: { type: "promo", slot },
          channelId: "fidelx-promotions",
        })
      )
    );
    for (const o of results) {
      if (o.success) sent += 1;
      else if (o.invalidToken) invalid += 1;
      else failed += 1;
    }
  }
  await adminClient
    .from("fcm_promo_log")
    .update({ sent, failed, invalid, skipped_users: tokenRows.length - recipients.length, finished_at: new Date().toISOString() })
    .eq("id", logId);
  console.log(`[FCM promo] slot=${slot} sent=${sent} failed=${failed} invalid=${invalid} skipped=${tokenRows.length - recipients.length}`);
};

// Called by pg_cron (via pg_net) 5x a day. Guarded by the same shared secret
// as the website's /dispatch-internal. Off unless FCM_PROMO_ENABLED=true.
const promoDispatch = async (req, res) => {
  try {
    if (!secretOk(req.headers["x-internal-webhook-secret"])) return res.status(401).json({ success: false });
    if (process.env.FCM_PROMO_ENABLED !== "true") return res.json({ success: true, skipped: "FCM_PROMO_ENABLED is not true" });
    const slot = String(req.body?.slot || "");
    if (!SLOTS[slot]) return res.status(400).json({ success: false, message: "Unknown slot." });
    if (!fcmService.isConfigured()) return res.json({ success: true, skipped: "FCM not configured" });

    // One send per slot per day, even if cron fires twice (unique slot+date).
    const { data: log, error } = await adminClient
      .from("fcm_promo_log")
      .insert({ slot, send_date: watDate() })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return res.json({ success: true, skipped: "already sent today" });
      throw error;
    }

    res.status(202).json({ success: true, started: true }); // answer fast; pg_net waits only a few seconds
    runSlot(slot, log.id).catch((err) => console.error("[FCM promo] run failed:", err.message));
  } catch (err) {
    console.error("[FCM promo] dispatch failed:", err.message);
    if (!res.headersSent) res.status(500).json({ success: false });
  }
};

// Logged-in customer turns reminder notifications off/on. Order updates are unaffected.
const setPromoOptOut = async (req, res) => {
  try {
    const optOut = req.body?.opt_out === true;
    const q = optOut
      ? adminClient.from("fcm_promo_optouts").upsert({ user_id: req.user.id }, { onConflict: "user_id" })
      : adminClient.from("fcm_promo_optouts").delete().eq("user_id", req.user.id);
    const { error } = await q;
    if (error) throw error;
    res.json({ success: true, opt_out: optOut });
  } catch (err) {
    console.error("[FCM promo] opt-out failed:", err.message);
    res.status(500).json({ success: false, message: "Could not update reminder preference." });
  }
};

const getPromoOptOut = async (req, res) => {
  try {
    const { data, error } = await adminClient.from("fcm_promo_optouts").select("user_id").eq("user_id", req.user.id).maybeSingle();
    if (error) throw error;
    res.json({ success: true, opt_out: !!data });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not read reminder preference." });
  }
};

module.exports = { promoDispatch, setPromoOptOut, getPromoOptOut, selectRecipients };
