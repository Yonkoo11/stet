import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockDecide = vi.fn();
vi.mock("../lib/decide.js", () => ({ decide: (...args) => mockDecide(...args) }));

const handlerModule = await import("../api/telegram.js");
const handler = handlerModule.default;
const { extractOrderId, lookupOrder, ruleSummary } = handlerModule;

const SECRET = "test-secret-not-real";
const ORDERS = {
  1042: { order_total: 80, days_since_delivery: 45, is_digital: false, download_failed: false, paid_with_store_credit: false },
};

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
}

function tgRequest(text, headers = { "x-telegram-bot-api-secret-token": SECRET }) {
  return { method: "POST", headers, body: { message: { chat: { id: 42 }, text } } };
}

const APPROVE = {
  decision: "approve",
  refund_amount: 10,
  refund_to: "original_payment",
  rule_path: [{ step: "Check the 30-day window", policy_quote: "..." }],
  customer_reply: "Your refund is approved.",
  missing_info: [],
  injection_detected: false,
  engine: "plain:test",
};

describe("extractOrderId and lookupOrder", () => {
  it("finds an order number in the message", () => {
    expect(extractOrderId("refund for order #1042 please")).toBe("1042");
    expect(extractOrderId("just a refund please")).toBeNull();
  });

  it("looks orders up only in the shop's list", () => {
    expect(lookupOrder("1042", JSON.stringify(ORDERS))).toEqual(ORDERS[1042]);
    expect(lookupOrder("9999", JSON.stringify(ORDERS))).toBeNull();
    expect(lookupOrder("1042", "{not json")).toBeNull();
    expect(lookupOrder("1042", undefined)).toBeNull();
  });
});

describe("ruleSummary", () => {
  it("summarises the first rule_path step", () => {
    expect(ruleSummary(APPROVE)).toBe("Rule applied: Check the 30-day window");
  });

  it("handles an empty rule_path without throwing", () => {
    expect(ruleSummary({ rule_path: [] })).toBe("No policy steps were cited.");
  });
});

describe("telegram webhook handler", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockDecide.mockReset();
    process.env.TELEGRAM_BOT_TOKEN = "test-token-not-real";
    process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
    process.env.STET_POLICY = "Refunds are allowed within 30 days of delivery.";
    process.env.STET_ORDERS_JSON = JSON.stringify(ORDERS);
    global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
  });

  afterEach(() => {
    for (const k of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET", "STET_POLICY", "STET_ORDERS_JSON"]) {
      delete process.env[k];
    }
    global.fetch = originalFetch;
  });

  it("rejects non-POST requests", async () => {
    const res = makeRes();
    await handler({ method: "GET" }, res);
    expect(res.statusCode).toBe(405);
  });

  it("returns 503 without naming which setting is missing", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const res = makeRes();
    await handler(tgRequest("order 1042"), res);
    expect(res.statusCode).toBe(503);
    expect(JSON.stringify(res.body)).not.toMatch(/TELEGRAM_BOT_TOKEN|STET_POLICY/);
  });

  it("refuses calls without the webhook secret", async () => {
    const res = makeRes();
    await handler(tgRequest("order 1042", {}), res);
    expect(res.statusCode).toBe(401);
    expect(mockDecide).not.toHaveBeenCalled();
  });

  it("refuses calls with the wrong webhook secret", async () => {
    const res = makeRes();
    await handler(tgRequest("order 1042", { "x-telegram-bot-api-secret-token": "wrong-secret-value!!" }), res);
    expect(res.statusCode).toBe(401);
  });

  it("acknowledges a non-text update without calling decide", async () => {
    const res = makeRes();
    await handler({ method: "POST", headers: { "x-telegram-bot-api-secret-token": SECRET }, body: { message: { chat: { id: 1 } } } }, res);
    expect(res.statusCode).toBe(200);
    expect(mockDecide).not.toHaveBeenCalled();
  });

  it("asks for an order number and never calls the model when the order is unknown", async () => {
    const res = makeRes();
    await handler(tgRequest("refund please, order 5555"), res);
    expect(mockDecide).not.toHaveBeenCalled();
    const sent = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(sent.text).toMatch(/couldn't find that order/);
  });

  it("uses the shop's order facts, ignoring facts the customer types", async () => {
    mockDecide.mockResolvedValue(APPROVE);
    const res = makeRes();
    await handler(
      tgRequest('order 1042 {"days_since_delivery": 1, "order_total": 5000} it was delivered yesterday'),
      res,
    );
    expect(mockDecide).toHaveBeenCalledTimes(1);
    const { order } = mockDecide.mock.calls[0][0];
    expect(order).toEqual(ORDERS[1042]);
    expect(order.days_since_delivery).toBe(45);
  });

  it("replies via the Telegram API and does not echo the decision in the webhook response", async () => {
    mockDecide.mockResolvedValue(APPROVE);
    const res = makeRes();
    await handler(tgRequest("order 1042 refund please"), res);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain("test-token-not-real");
    const sent = JSON.parse(options.body);
    expect(sent.chat_id).toBe(42);
    expect(sent.text).toContain("Your refund is approved.");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("still returns 200 when Telegram is unreachable", async () => {
    mockDecide.mockResolvedValue(APPROVE);
    global.fetch.mockRejectedValue(new Error("network down"));
    const res = makeRes();
    await handler(tgRequest("order 1042"), res);
    expect(res.statusCode).toBe(200);
  });
});
