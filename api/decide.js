// Vercel serverless function: POST { policy, request, order } -> decision JSON.
// Never throws a raw 500 -- input errors are 400s with a clear message, and
// engine failures come back as a normal 200 "escalate" decision (decide()
// itself never throws).

import { decide, validateInputSizes } from "../lib/decide.js";
import { rateLimited, clientKey } from "../lib/ratelimit.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed, use POST" });
    return;
  }

  if (rateLimited(clientKey(req))) {
    res.status(429).json({ error: "Too many requests. Try again in a minute." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: "Request body is not valid JSON" });
      return;
    }
  }

  const { policy, request, order } = body || {};

  const sizeError = validateInputSizes(policy, request);
  if (sizeError) {
    res.status(400).json({ error: sizeError });
    return;
  }

  if (!order || typeof order !== "object") {
    res.status(400).json({ error: "order is required" });
    return;
  }

  try {
    const decision = await decide({ policy, request, order });
    res.status(200).json(decision);
  } catch (err) {
    // decide() is designed to never throw, but guard the HTTP boundary
    // anyway rather than ever leak a stack trace.
    res.status(200).json({
      decision: "escalate",
      refund_amount: 0,
      refund_to: "none",
      rule_path: [],
      customer_reply:
        "I wasn't able to reach a confident decision on this request. It's been sent to a person on our team to review.",
      missing_info: [],
      injection_detected: false,
      guard: ["unexpected error"],
      engine: "plain:unknown",
    });
  }
}
