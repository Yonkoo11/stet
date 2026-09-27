# Stet OpenServ agent

Exposes one capability, `decide_refund`, on the OpenServ platform. The
decision logic is `lib/decide.js` -- identical to what `api/decide.js`,
`api/telegram.js` and `eval/run.js` use.

`OPENSERV_API_KEY` is not set on this machine. Until it is, the agent can be
exercised locally (`node agent/test.js`, which calls the capability's `run`
function directly) but cannot connect to the OpenServ platform.

## Registration steps (from the `@openserv-labs/sdk` docs, verbatim)

### Platform setup

1. **Log in to the platform** -- visit [platform.openserv.ai](https://platform.openserv.ai) and
   log in with your Google account. This gives you access to developer
   tools and features.
2. **Set up a developer account** -- open the Developer menu in the left
   sidebar, click Profile, and set up your developer account.

### Agent registration

1. **Register your agent**
   - Navigate to Developer -> Add Agent.
   - Fill out required details:
     - Agent Name: `Stet`
     - Description: `Refund-decision agent. Applies a shop's plain-English refund policy exactly, cites the policy sentences it relied on, and refuses to be argued out of the policy.`
     - Capabilities Description: `decide_refund(policy, request, order) -> decision, refund_amount, refund_to, rule_path (with verbatim policy quotes), customer_reply, missing_info, injection_detected.`
     - Agent Endpoint: the deployed URL for this agent process (after deployment; not needed for local tunnel development -- see below).
2. **Create a secret key**
   - Go to Developer -> Your Agents.
   - Open the Stet agent's details.
   - Click "Create Secret Key".
   - Store the key as `OPENSERV_API_KEY` in the environment (never in a
     committed file -- see `SECURITY.md`).

### Running it

```bash
OPENSERV_API_KEY=... node agent/index.js
```

The SDK's `run()` helper (not used here by default) can create a local
tunnel for testing against the platform without a public deployment; see
the `@openserv-labs/sdk` README's "Local Development with Tunnel" section
if that's needed later.

## Local test (no platform connection required)

```bash
node agent/test.js
```

This calls `runDecideRefund()` directly, bypassing the OpenServ platform
connection entirely, so it only needs whichever engine `lib/decide.js`
picks (SERV if `SERV_API_KEY` is set, otherwise the plain OpenAI fallback).
