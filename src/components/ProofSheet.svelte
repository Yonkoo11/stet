<script>
  import { markSentences } from "../lib/sentences.js";

  let { policy = $bindable(""), decision = null, loading = false, error = null, elapsed = 0, stale = false } = $props();

  let editing = $state(false);

  const VERDICT = {
    approve: "Approved.",
    store_credit: "Store credit.",
    decline: "Declined.",
    escalate: "Sent to a person.",
  };

  let marked = $derived(markSentences(policy, decision?.rule_path ?? []));
  let showMarks = $derived(!editing && (decision || loading));
  let orderOf = $derived.by(() => {
    // Delay each mark by the order it was cited, so the marks draw in reading order.
    const delays = [140, 220, 300, 520];
    let i = 0;
    return marked.map((m) => (m.steps.length ? delays[Math.min(i++, delays.length - 1)] : 0));
  });

  $effect(() => {
    if (decision || loading) editing = false;
  });
</script>

<article class="sheet" class:is-stale={stale && !loading} aria-live="polite">
  <header class="sheet-head">
    <h2 class="label">Your refund policy</h2>
    {#if showMarks}
      <button type="button" class="text-btn" onclick={() => (editing = true)}>Edit policy</button>
    {:else if decision}
      <button type="button" class="text-btn" onclick={() => (editing = false)}>Show the marks</button>
    {/if}
  </header>

  {#if stale && decision && !loading && !editing}
    <p class="stale">This decision was for the previous request. Press Decide to check the one you've changed.</p>
  {/if}
  {#if loading}
    <p class="status mono">SERV is reading the policy<span class="caret" aria-hidden="true"></span> {elapsed}s</p>
  {:else if error}
    <p class="status error">{error}</p>
  {:else if decision && !editing}
    <div class="verdict">
      <p class="verdict-word" data-kind={decision.decision}>{VERDICT[decision.decision] ?? decision.decision}</p>
      <p class="verdict-facts mono">
        refund {decision.refund_amount} · to {decision.refund_to}
      </p>
      <a class="jump" href="#reply">Reply to the customer, below</a>
    </div>
  {/if}

  {#if showMarks}
    {#if decision && !loading}
      <p class="legend">Dotted lines mark sentences the decision quoted word for word. Code checks every quote against your policy before the answer is shown.</p>
    {/if}
    <ol class="galley" class:reading={loading}>
      {#each marked as m, i (i)}
        <li class="line" class:cited={m.steps.length > 0}>
          <p class="sentence">
            <span class="stet" class:on={m.steps.length > 0 && !loading} style:--delay="{orderOf[i]}ms">{m.text}</span>
          </p>
          <div class="margin">
            {#if !loading && m.steps.length}
              <span class="tag" title="Quoted word for word; checked by code">stet</span>
              {#each m.steps as s, j (j)}<p class="note">{s.step}</p>{/each}
            {:else if !loading && decision}
              <p class="note quiet">Not cited.</p>
            {/if}
          </div>
        </li>
      {/each}
    </ol>
  {:else}
    <textarea
      class="policy-input"
      bind:value={policy}
      rows="7"
      maxlength="4000"
      aria-label="Refund policy"
    ></textarea>
    <p class="hint">Plain English, up to 4,000 characters ({policy.length} so far). An approval has to account for every sentence.</p>
    {#if !decision && !error}
      <p class="empty-note">Pick an example and press Decide. The decision appears here, marked on your policy.</p>
    {/if}
  {/if}

  {#if decision && !loading && !editing}
    {#if decision.guard?.length}
      <div class="flag">
        <p class="flag-title">The code check sent this to a person</p>
        <ul>{#each decision.guard as g (g)}<li>{g}</li>{/each}</ul>
      </div>
    {/if}
    {#if decision.missing_info?.length}
      <div class="flag">
        <p class="flag-title">Missing information</p>
        <ul>{#each decision.missing_info as m (m)}<li>{m}</li>{/each}</ul>
      </div>
    {/if}
    {#if decision.injection_detected}
      <p class="flag-line">The customer tried to argue it out of the policy. The policy stood.</p>
    {/if}
    <figure class="reply" id="reply">
      <figcaption class="label">Reply to the customer</figcaption>
      <blockquote>{decision.customer_reply}</blockquote>
    </figure>
    <p class="engine mono">{decision.engine}</p>
  {/if}
</article>
