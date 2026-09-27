// Same split as policySentences() in lib/decide.js, which the code check uses.
// Kept separate because lib/decide.js pulls in the server-side model client.
export function splitSentences(policy) {
  return String(policy ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

// For each policy sentence, the rule_path steps that quote it (or a clause of it).
export function markSentences(policy, rulePath = []) {
  return splitSentences(policy).map((text) => {
    const n = norm(text);
    const steps = rulePath.filter((s) => {
      const q = norm(s.policy_quote);
      return q.length > 3 && (n.includes(q) || q.includes(n));
    });
    return { text, steps };
  });
}
