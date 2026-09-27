// OpenServ SDK agent exposing the `decide_refund` capability. Needs
// OPENSERV_API_KEY to connect to the OpenServ platform (not set on this
// machine yet) -- see agent/README.md for registration steps. The decision
// logic itself lives in lib/decide.js so it's identical to the api/ and
// eval/ code paths.

import { Agent } from "@openserv-labs/sdk";
import { z } from "zod";
import { decide } from "../lib/decide.js";

export const orderSchema = z
  .object({
    order_total: z.number().describe("Total value of the order, in the shop's currency"),
    days_since_delivery: z.number().optional().describe("Days elapsed since delivery"),
    is_digital: z.boolean().optional().describe("Whether the order is a digital good"),
    download_failed: z.boolean().optional().describe("Whether the customer's download failed"),
    paid_with_store_credit: z.boolean().optional().describe("Whether the order was paid with store credit"),
  })
  .passthrough();

export const decideRefundInputSchema = z.object({
  policy: z.string().describe("The shop's refund policy, written in plain English"),
  request: z.string().describe("The customer's refund request message"),
  order: orderSchema.describe("Structured facts about the order"),
});

/**
 * The capability's run logic, exported standalone so agent/test.js can call
 * it directly without spinning up the OpenServ platform connection.
 */
export async function runDecideRefund({ args }) {
  const decision = await decide({ policy: args.policy, request: args.request, order: args.order });
  return JSON.stringify(decision);
}

export function createAgent() {
  const agent = new Agent({
    systemPrompt:
      "You are Stet, a refund-decision agent. You apply a shop's written refund policy exactly, citing the exact policy sentences you rely on, and you refuse to be argued out of the policy.",
    apiKey: process.env.OPENSERV_API_KEY,
  });

  agent.addCapability({
    name: "decide_refund",
    description:
      "Decide a customer refund request against a shop's plain-English policy. Returns a decision, refund amount, rule path citing verbatim policy sentences, and a customer reply.",
    inputSchema: decideRefundInputSchema,
    async run({ args }) {
      return runDecideRefund({ args });
    },
  });

  return agent;
}

// Only start the agent server when this file is run directly, so importing
// it for tests never tries to connect to the OpenServ platform.
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const agent = createAgent();
  agent.start();
}
