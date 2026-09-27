import { describe, it, expect } from "vitest";
import { rateLimited } from "../lib/ratelimit.js";

describe("rateLimited", () => {
  it("allows up to the limit per minute, then refuses, then recovers", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimited("ip-a", 3, t0 + i)).toBe(false);
    expect(rateLimited("ip-a", 3, t0 + 10)).toBe(true);
    expect(rateLimited("ip-b", 3, t0 + 10)).toBe(false);
    expect(rateLimited("ip-a", 3, t0 + 61_000)).toBe(false);
  });
});
