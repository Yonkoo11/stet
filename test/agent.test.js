import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDecide = vi.fn();
vi.mock("../lib/decide.js", () => ({ decide: (...args) => mockDecide(...args) }));

const { runDecideRefund, decideRefundInputSchema } = await import("../agent/index.js");

describe("runDecideRefund -- the decide_refund capability's run logic", () => {
  beforeEach(() => mockDecide.mockReset());

  it("calls decide() with the capability args and returns the decision as JSON", async () => {
    mockDecide.mockResolvedValue({
      decision: "approve",
      refund_amount: 10,
      refund_to: "original_payment",
      rule_path: [],
      customer_reply: "ok",
      missing_info: [],
      injection_detected: false,
      engine: "plain:gpt-4.1-mini",
    });

    const args = { policy: "policy text", request: "refund please", order: { order_total: 10 } };
    const result = await runDecideRefund({ args });

    expect(mockDecide).toHaveBeenCalledWith(args);
    expect(typeof result).toBe("string");
    const parsed = JSON.parse(result);
    expect(parsed.decision).toBe("approve");
    expect(parsed.engine).toBe("plain:gpt-4.1-mini");
  });

  it("propagates an escalate decision unchanged", async () => {
    mockDecide.mockResolvedValue({
      decision: "escalate",
      refund_amount: 0,
      refund_to: "none",
      rule_path: [],
      customer_reply: "Escalated.",
      missing_info: [],
      injection_detected: false,
      guard: ["engine error: no credits"],
      engine: "plain:gpt-4.1-mini",
    });

    const result = await runDecideRefund({
      args: { policy: "p", request: "r", order: { order_total: 5 } },
    });
    expect(JSON.parse(result).decision).toBe("escalate");
  });
});

describe("decideRefundInputSchema", () => {
  it("accepts a valid capability input", () => {
    const parsed = decideRefundInputSchema.parse({
      policy: "policy text",
      request: "customer request",
      order: { order_total: 50, days_since_delivery: 5 },
    });
    expect(parsed.order.order_total).toBe(50);
  });

  it("rejects input missing a required field", () => {
    expect(() =>
      decideRefundInputSchema.parse({ request: "r", order: { order_total: 50 } }),
    ).toThrow();
  });

  it("rejects an order without order_total", () => {
    expect(() =>
      decideRefundInputSchema.parse({ policy: "p", request: "r", order: {} }),
    ).toThrow();
  });
});
