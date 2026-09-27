# Contributing

1. `npm install`, then `npm test`. All tests must pass before a change is proposed.
2. A change to how decisions are made must come with an eval run (`node eval/run.js`) and its results file.
3. Never add a test case's expected answer by hand: add the facts to `eval/generate-cases.js` and let `eval/reference.js` produce it.
4. Keys never go in the repo. See SECURITY.md.
