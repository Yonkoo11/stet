// Local smoke test for the decide_refund capability. Calls runDecideRefund
// directly -- OPENSERV_API_KEY isn't set, so this never touches the
// OpenServ platform, only lib/decide.js's engine (SERV if configured,
// otherwise the plain OpenAI fallback).

import { runDecideRefund } from "./index.js";
import { REFERENCE_POLICY } from "../eval/reference.js";

async function main() {
  const result = await runDecideRefund({
    args: {
      policy: REFERENCE_POLICY,
      request: "My order arrived 5 days ago and doesn't fit, can I get a refund?",
      order: {
        order_total: 50,
        days_since_delivery: 5,
        is_digital: false,
        download_failed: false,
        paid_with_store_credit: false,
      },
    },
  });

  console.log("decide_refund returned:");
  console.log(result);

  const parsed = JSON.parse(result);
  if (!parsed.decision || !parsed.engine) {
    throw new Error("decide_refund did not return a valid decision object");
  }
  console.log(`\nOK: decision="${parsed.decision}" engine="${parsed.engine}"`);
}

main().catch((err) => {
  console.error("agent/test.js failed:", err);
  process.exitCode = 1;
});
