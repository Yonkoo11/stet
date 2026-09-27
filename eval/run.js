// Runs all 25 cases (eval/cases.json) through whichever engine is live
// (SERV if SERV_API_KEY is set, otherwise the plain OpenAI fallback),
// compares decision + refund_to against the reference expectation, and
// writes eval/results-<engine>-<date>.json. Never fabricates SERV results:
// if SERV_API_KEY is unset, this runs the plain engine and says so.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { decide, servConfigured } from "../lib/decide.js";
import { REFERENCE_POLICY } from "./reference.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runCase(testCase) {
  const start = Date.now();
  const result = await decide({
    policy: REFERENCE_POLICY,
    request: testCase.customer_message,
    order: testCase.order,
  });
  const latencyMs = Date.now() - start;

  const decisionPass = result.decision === testCase.expected.decision;
  const refundToPass = result.refund_to === testCase.expected.refund_to;
  const pass = decisionPass && refundToPass;

  return {
    id: testCase.id,
    description: testCase.description,
    pass,
    decisionPass,
    refundToPass,
    expected: testCase.expected,
    got: {
      decision: result.decision,
      refund_amount: result.refund_amount,
      refund_to: result.refund_to,
      injection_detected: result.injection_detected,
    },
    expect_injection: testCase.expect_injection ?? false,
    injection_detected: result.injection_detected ?? false,
    engine: result.engine,
    guard: result.guard ?? null,
    engineError: Boolean(result.guard?.some((g) => g.startsWith("engine error:"))),
    latencyMs,
    usage: result.usage
      ? {
          prompt_tokens: result.usage.prompt_tokens,
          completion_tokens: result.usage.completion_tokens,
          total_tokens: result.usage.total_tokens,
        }
      : null,
  };
}

async function main() {
  const cases = JSON.parse(readFileSync(join(__dirname, "cases.json"), "utf8"));
  const allCases = [...cases.policy_cases, ...cases.injection_cases];

  const usingServ = servConfigured();
  console.log(`Running ${allCases.length} cases on the ${usingServ ? "SERV" : "plain"} engine...`);

  const results = [];
  for (const testCase of allCases) {
    // eslint-disable-next-line no-await-in-loop
    const r = await runCase(testCase);
    await new Promise((res) => setTimeout(res, Number(process.env.EVAL_PACE_MS || 4500)));
    results.push(r);
    console.log(`${r.pass ? "PASS" : "FAIL"} ${r.id} [${r.engine}] ${r.description}`);
  }

  const policyResults = results.filter((r) => r.id.startsWith("P"));
  const injectionResults = results.filter((r) => r.id.startsWith("I"));

  const policyPassCount = policyResults.filter((r) => r.pass).length;
  const injectionPassCount = injectionResults.filter((r) => r.pass).length;
  const injectionDetectedCount = injectionResults.filter((r) => r.injection_detected).length;

  const totalLatency = results.reduce((sum, r) => sum + r.latencyMs, 0);
  const totalTokens = results.reduce((sum, r) => sum + (r.usage?.total_tokens ?? 0), 0);
  const engineErrorCount = results.filter((r) => r.engineError).length;
  // A refund desk's costly miss is a wrong decision (money out or refused against the policy).
  // An escalation to a person is a safe miss. Count them separately.
  const wrongCount = results.filter((r) => !r.pass && r.got?.decision !== "escalate").length;
  const escalatedMissCount = results.filter((r) => !r.pass && r.got?.decision === "escalate").length;

  const engine = results[0]?.engine ?? "unknown";
  const engineSlug = engine.split(":")[0]; // "serv" or "plain"
  const modelId = engine.split(":")[1] ?? "unknown";

  const summary = {
    ran_at: new Date().toISOString(),
    engine,
    engine_kind: engineSlug,
    model: modelId,
    policy_cases: { passed: policyPassCount, total: policyResults.length },
    injection_cases: { passed: injectionPassCount, total: injectionResults.length },
    injection_detected_count: injectionDetectedCount,
    injection_detected_total: injectionResults.length,
    total_latency_ms: totalLatency,
    avg_latency_ms: Math.round(totalLatency / results.length),
    total_tokens: totalTokens,
    engine_error_count: engineErrorCount,
    wrong_decisions: wrongCount,
    escalated_misses: escalatedMissCount,
    blocked_by_engine_error: engineErrorCount === results.length,
    results,
  };

  console.log("\n--- Summary ---");
  console.log(`Engine: ${engine}`);
  console.log(`Policy cases: ${policyPassCount}/${policyResults.length}`);
  console.log(`Injection cases: ${injectionPassCount}/${injectionResults.length}`);
  console.log(`Injection detected: ${injectionDetectedCount}/${injectionResults.length}`);
  console.log(`Misses: ${wrongCount} wrong decisions, ${escalatedMissCount} sent to a person`);
  console.log(`Total tokens: ${totalTokens}`);
  console.log(`Avg latency: ${summary.avg_latency_ms}ms`);
  if (summary.blocked_by_engine_error) {
    console.log(
      `\nWARNING: all ${results.length} cases hit an engine error (see each result's "guard" field) -- these 0 pass counts reflect an unreachable engine, not model quality.`,
    );
  } else if (engineErrorCount > 0) {
    console.log(`WARNING: ${engineErrorCount}/${results.length} cases hit an engine error.`);
  }

  const date = new Date().toISOString().slice(0, 10);
  const suffix = engine.includes("+noguard") ? "-noguard" : engine.startsWith("serv:") ? "-guard" : "";
  const outPath = join(__dirname, `results-${engineSlug}${suffix}-${date}.json`);
  writeFileSync(outPath, JSON.stringify(summary, null, 2) + "\n");
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error("eval/run.js failed:", err);
  process.exitCode = 1;
});
