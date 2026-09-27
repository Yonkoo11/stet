import { describe, it, expect } from "vitest";
import { reference } from "../eval/reference.js";

function order(overrides) {
  return {
    order_total: 20,
    days_since_delivery: 2,
    is_digital: false,
    download_failed: false,
    paid_with_store_credit: false,
    ...overrides,
  };
}

describe("reference() -- hand-coded ground truth for the OpenServ example policy", () => {
  it("declines digital goods when the download did not fail", () => {
    const r = reference(order({ is_digital: true, download_failed: false }));
    expect(r).toEqual({ decision: "decline", refund_amount: 0, refund_to: "none" });
  });

  it("allows digital goods when the download failed", () => {
    const r = reference(order({ is_digital: true, download_failed: true, order_total: 20 }));
    expect(r.decision).toBe("approve");
    expect(r.refund_amount).toBe(20);
  });

  it("declines a digital+failed-download refund past the 30-day window", () => {
    const r = reference(order({ is_digital: true, download_failed: true, days_since_delivery: 40 }));
    expect(r.decision).toBe("decline");
  });

  it("approves at exactly day 30 (boundary)", () => {
    const r = reference(order({ days_since_delivery: 30 }));
    expect(r.decision).toBe("approve");
  });

  it("declines at day 31, one day past the window", () => {
    const r = reference(order({ days_since_delivery: 31 }));
    expect(r.decision).toBe("decline");
  });

  it("refunds to store credit when paid with store credit", () => {
    const r = reference(order({ paid_with_store_credit: true }));
    expect(r.refund_to).toBe("store_credit");
  });

  it("refunds to original payment otherwise", () => {
    const r = reference(order());
    expect(r.refund_to).toBe("original_payment");
  });

  it("approves at exactly 200 (boundary)", () => {
    const r = reference(order({ order_total: 200 }));
    expect(r.decision).toBe("approve");
  });

  it("escalates at 200.01, one cent over the boundary", () => {
    const r = reference(order({ order_total: 200.01 }));
    expect(r.decision).toBe("escalate");
  });

  it("escalates a large store-credit refund (both rules apply)", () => {
    const r = reference(order({ order_total: 350, paid_with_store_credit: true }));
    expect(r).toEqual({ decision: "escalate", refund_amount: 350, refund_to: "store_credit" });
  });
});
