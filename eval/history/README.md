# Eval history

Runs kept for the record but not shown on the page.

- `results-plain-2026-09-27-schema-v1.json`: Gemini 3.5 Flash Lite, SERV off, 17/20 policy, 5/5 held, 2/5 flagged. The output format then allowed a separate "store_credit" decision, which made case P18 ambiguous. Superseded by the run after that label was removed.
- `results-plain-2026-09-27-prompt-v1.json`: same engine, 18/20 policy, 5/5 held, 2/5 flagged. The system prompt was the policy text alone, with no instruction to consider each sentence; P06 (approved past 30 days) and P15 (declined a valid day-30/200 refund) failed. Superseded by the run with fixed instructions and the sentence-coverage check.
- `results-plain-2026-09-27-coverage-all.json`: fixed instructions plus a coverage check on approvals AND declines. 13/20 policy, 1/5 held. 11 misses, all escalations: correct declines that cited only the blocking rule. Coverage was then limited to approvals.
