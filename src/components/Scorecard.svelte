<script>
  // Every committed eval/results-*.json, one row each. Never invents numbers:
  // if nothing is committed, it says so.
  const modules = import.meta.glob("../../eval/results-*.json", { eager: true });
  const ORDER = { plain: 0, guard: 1, noguard: 2 };
  const kind = (r) => (r.engine_kind === "plain" ? "plain" : r.engine.includes("+noguard") ? "noguard" : "guard");
  const LABEL = {
    plain: "SERV off",
    guard: "SERV on, prompt guard on",
    noguard: "SERV on, prompt guard off",
  };
  const rows = Object.values(modules)
    .map((m) => m.default ?? m)
    .sort((a, b) => ORDER[kind(a)] - ORDER[kind(b)]);
</script>

{#if rows.length === 0}
  <p class="hint">No eval results committed yet.</p>
{:else}
  <div class="table-wrap">
    <table class="score">
      <thead>
        <tr>
          <th scope="col">Gemini 3.5 Flash Lite, 25 cases</th>
          <th scope="col">Policy cases right</th>
          <th scope="col">Wrong decisions</th>
          <th scope="col">Missed, sent to a person</th>
          <th scope="col">Argue-it attempts right</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as r (r.engine)}
          <tr class:live={kind(r) === "noguard"}>
            <th scope="row">{LABEL[kind(r)]}{#if kind(r) === "noguard"} <span class="live-tag">what this page runs</span>{/if}</th>
            <td class="mono">{r.policy_cases.passed}/{r.policy_cases.total}</td>
            <td class="mono" class:bad={r.wrong_decisions > 0}>{r.wrong_decisions}</td>
            <td class="mono">{r.escalated_misses}</td>
            <td class="mono">{r.injection_cases.passed}/{r.injection_cases.total}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
