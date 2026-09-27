<script>
  import { onMount } from "svelte";
  import { REFERENCE_POLICY } from "../lib/policy.js";
  import ProofSheet from "./components/ProofSheet.svelte";
  import RequestPanel from "./components/RequestPanel.svelte";
  import Scorecard from "./components/Scorecard.svelte";
  import { fetchEngineStatus, requestDecision } from "./lib/apiClient.js";

  let policy = $state(REFERENCE_POLICY);
  let order = $state({
    order_total: 50,
    days_since_delivery: 5,
    is_digital: false,
    download_failed: false,
    paid_with_store_credit: false,
  });
  let message = $state("Hi, this jacket doesn't fit. Can I get a refund? Delivered 5 days ago.");

  let decision = $state(null);
  let loading = $state(false);
  let error = $state(null);
  let engine = $state(null);
  let elapsed = $state(0);
  let decidedFor = $state("");
  const snapshot = () => JSON.stringify({ policy, order, message });
  let stale = $derived(Boolean(decision) && decidedFor !== snapshot());

  onMount(async () => {
    engine = (await fetchEngineStatus()).engine;
  });

  async function handleDecide() {
    loading = true;
    error = null;
    decision = null;
    elapsed = 0;
    const started = Date.now();
    const tick = setInterval(() => (elapsed = Math.round((Date.now() - started) / 1000)), 1000);
    if (window.matchMedia("(max-width: 860px)").matches) {
      document.getElementById("sheet")?.scrollIntoView({ block: "start" });
    }
    const asked = snapshot();
    const result = await requestDecision({ policy, request: message, order });
    clearInterval(tick);
    loading = false;
    if (result.error) {
      error = result.error;
      return;
    }
    decision = result.decision;
    decidedFor = asked;
    if (decision?.engine) engine = decision.engine.startsWith("serv:") ? "serv" : "plain";
  }
</script>

<div class="page">
  <header class="top">
    <p class="wordmark"><span class="stet on">Stet</span></p>
    <p class="engine-status mono" data-engine={engine}>
      {#if engine === "serv"}on SERV Reasoning{:else if engine === "plain"}SERV key not set: plain model{:else}checking engine{/if}
    </p>
  </header>

  <main>
    <section class="intro">
      <h1>Refunds that follow your policy, <em>exactly.</em></h1>
      <p class="lede">Stet decides each refund request from the policy you wrote, and marks the sentences it relied on, the way an editor marks a proof.</p>
    </section>

    <section class="tool">
      <div class="tool-request">
        <RequestPanel bind:order bind:message {loading} ondecide={handleDecide} />
      </div>
      <div class="tool-sheet" id="sheet">
        <ProofSheet bind:policy {decision} {loading} {error} {elapsed} {stale} />
      </div>
    </section>

    <section class="measured" id="measured" aria-labelledby="measured-title">
      <div class="section-head">
        <h2 id="measured-title">Same model, with and without SERV.</h2>
        <p>Twenty-five requests against OpenServ's own example policy, with answers from a hand-coded flowchart of it. One run per row, so a gap of one or two cases can be noise.</p>
      </div>
      <Scorecard />
    </section>

    <section class="limits" aria-labelledby="limits-title">
      <h2 id="limits-title" class="label">Where Stet stops</h2>
      <ul>
        <li>Stet decides. It does not issue refunds.</li>
        <li>It knows only the policy you give it and the order facts from your records. What the customer types can't change either.</li>
        <li>When the policy doesn't settle a case, or asks for a manager, it sends the request to a person.</li>
        <li>Twenty-five cases on a four-sentence policy is a small test. It shows specific failures, not an accuracy rate.</li>
        <li>The Telegram bot and the OpenServ listing are built but not connected to a live shop yet.</li>
      </ul>
    </section>
  </main>

  <footer class="foot">
    <p><span class="stet on">stet</span>: the editor's mark for "let it stand as written."</p>
    <p>Built on <a href="https://docs.openserv.ai">OpenServ</a> SERV Reasoning for SERV Hackathon Edition 01. MIT licensed.</p>
  </footer>
</div>
