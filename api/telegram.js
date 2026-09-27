// Vercel serverless function: Telegram Bot API webhook.
//
// Environment:
//   TELEGRAM_BOT_TOKEN       the bot to reply as
//   TELEGRAM_WEBHOOK_SECRET  set as secret_token in setWebhook; Telegram sends it back in the
//                            X-Telegram-Bot-Api-Secret-Token header, so calls that lack it are refused
//   STET_POLICY          the shop's refund policy text
//   STET_ORDERS_JSON     the shop's orders, keyed by order number:
//                            {"1042":{"order_total":80,"days_since_delivery":12,"is_digital":false,
//                                     "download_failed":false,"paid_with_store_credit":false}}
//
// Order facts come ONLY from the shop's order list, never from the customer's message.
// A customer who types "delivered yesterday" changes nothing: the policy is applied to
// what the shop recorded. Unknown order numbers never reach the model.

import { timingSafeEqual } from "node:crypto";
import { decide } from "../lib/decide.js";

const TELEGRAM_API = "https://api.telegram.org";
const NOT_CONFIGURED = { error: "This Stet bot is not configured yet." };

export function extractOrderId(text) {
  const m = text?.match(/#?\b(\d{3,12})\b/);
  return m ? m[1] : null;
}

export function lookupOrder(orderId, ordersJson = process.env.STET_ORDERS_JSON) {
  if (!orderId || !ordersJson) return null;
  try {
    const orders = JSON.parse(ordersJson);
    const o = orders?.[orderId];
    return o && typeof o === "object" ? o : null;
  } catch {
    return null;
  }
}

export function ruleSummary(decision) {
  const steps = decision.rule_path || [];
  if (steps.length === 0) return "No policy steps were cited.";
  return `Rule applied: ${steps[0].step}`;
}

function secretMatches(given, expected) {
  if (typeof given !== "string" || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function reply(token, chatId, text) {
  try {
    await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch {
    // Telegram unreachable: nothing useful to tell the caller; the webhook still returns 200.
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed, use POST" });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const policy = process.env.STET_POLICY;
  if (!token || !secret || !policy) {
    res.status(503).json(NOT_CONFIGURED);
    return;
  }

  if (!secretMatches(req.headers?.["x-telegram-bot-api-secret-token"], secret)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }

  const chatId = body?.message?.chat?.id;
  const text = body?.message?.text;
  if (!chatId || !text) {
    // Not a text message (edits, joins): acknowledge so Telegram doesn't retry.
    res.status(200).json({ ok: true });
    return;
  }

  const orderId = extractOrderId(text);
  const order = lookupOrder(orderId);
  if (!order) {
    await reply(
      token,
      chatId,
      "I couldn't find that order. Please send your order number (for example: order 1042) and what you'd like refunded.",
    );
    res.status(200).json({ ok: true });
    return;
  }

  const decision = await decide({ policy, request: text, order });
  await reply(token, chatId, `${decision.customer_reply}\n\n${ruleSummary(decision)}`);
  res.status(200).json({ ok: true });
}
