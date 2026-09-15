# Lit Agent Keychain action library

Open catalog of **"use inside Lit"** actions for
[Lit Agent Keychain](https://keychain.litprotocol.com). An owner stores a credential
in Keychain and picks one of these actions; agents can then _use_ the credential
(read a Stripe balance, run an OpenAI chat completion, read a file from a private
GitHub repo, post to Slack) inside a Lit TEE without ever seeing its value. The
action can reach only the hosts its manifest declares and return only the shape it
declares.

Each subdirectory of `actions/` is one action: `action.json` (the manifest) and
`action.ts` (the projection code). Keychain's server, web UI, SDK, CLI and local MCP
server all read this catalog, so a merged action appears in the owner's "How agents
may use it" dropdown, in `keychain actions`, and as an MCP tool once Keychain bumps
its pinned version. Contributions are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md).

| Action               | Provider | Agents get back                                   |
| -------------------- | -------- | ------------------------------------------------- |
| `stripe_balance`     | Stripe   | available/pending balances, live-mode flag        |
| `openai_chat`        | OpenAI   | assistant reply, finish reason, token usage       |
| `github_read_file`   | GitHub   | decoded text, size and blob SHA of one file       |
| `slack_post_message` | Slack    | channel id and message timestamp                  |
| `export`             | (none)   | the value itself, re-encrypted to the agent's key |

## How an action is bounded

Contributors write ordinary TypeScript, but the harness (the Keychain harness (`lit-agent-keychain/actions/secret-common.ts` in the [chipotle](https://github.com/LIT-Protocol/chipotle) repo))
enforces the manifest around it, so review is mostly review of `action.json`:

| Manifest field            | Enforced by the harness at runtime                                          |
| ------------------------- | --------------------------------------------------------------------------- |
| `credentialPattern`       | The decrypted value must match before your code runs.                       |
| `allowedHosts`            | `fetchJson`/`fetchText` accept only `https://` URLs to exactly these hosts. |
| `limits.maxRequests`      | Upper bound on upstream calls per execution.                                |
| `limits.timeoutMs`        | Per-request timeout; redirects are always errors.                           |
| `limits.maxResponseBytes` | Upstream bodies larger than this are rejected.                              |
| `input`                   | The agent's signed request input is validated before any key is derived.    |
| `output`                  | Your return value must match this shape; the serialized result is ≤ 16 KiB. |

The build additionally rejects `action.ts` that imports anything but `../../lib.ts` (this repo's `lib.ts`)
or references `fetch`, `XMLHttpRequest`, `WebSocket`, `eval`, `Function`, dynamic
`import`, `require`, `Lit`, `Deno`, `process`, `globalThis`, `window`, `self`,
timers or `crypto`. See `lint.ts`.

What the harness cannot do is decide whether your projection leaks the credential
back to the agent through an allowed field, or whether an upstream call has side
effects the owner would not expect. That is what review is for; see the checklist.

## Manifest reference (`action.json`)

```json
{
  "v": 1,
  "id": "stripe_balance",
  "kind": "use",
  "name": "Read Stripe balance",
  "description": "One or two sentences an agent or owner can read.",
  "category": "payments",
  "author": "Lit Protocol",
  "license": "Apache-2.0",
  "operation": "stripe.balance",
  "credentialPattern": "^(?:sk|rk)_(?:test|live)_[A-Za-z0-9]{12,256}$",
  "allowedHosts": ["api.stripe.com"],
  "input": null,
  "output": { "type": "object", "properties": { "...": {} }, "required": [] },
  "limits": { "timeoutMs": 8000, "maxResponseBytes": 65536, "maxRequests": 1 },
  "ui": {
    "label": "Read Stripe balance inside Lit",
    "hint": "Shown under the dropdown when this action is selected.",
    "placeholder": "STRIPE_API_KEY"
  },
  "tier": "verified",
  "deprecated": false
}
```

- `id`: `^[a-z][a-z0-9_]{1,63}$`, equal to the directory name. It is the secret's
  `release` value and is bound into the action's CID. **Ids are permanent.**
- `operation`: dotted lowercase, unique across the catalog. Agents request it; owners
  grant it. `get` is reserved for `export`.
- `category`: `payments`, `ai`, `developer`, `messaging`, `data` or `other`.
- `credentialPattern`: a JavaScript regular expression the plaintext must match.
  Make it as specific as the provider allows so a mis-filed credential is refused.
- `allowedHosts`: 1 to 8 lowercase hostnames. No wildcards, ports or paths.
- `input`: a shape or `null`. Inputs are part of the agent's signed request, so they
  must be canonical JSON: object keys `^[a-z][A-Za-z0-9]{0,63}$`, integers not
  floats, at most 8 KiB.
- `output`: a shape. Prefer enums, bounded integers and short strings. A field that
  can carry an arbitrary long string is where a credential could leak; justify it.
- `tier`: `verified` actions appear in the owner dropdown. `community` actions are
  built, tested and callable from the SDK, CLI and MCP server but not surfaced in
  the web UI until promoted by a maintainer.
- `deprecated`: hides the action for new secrets. Existing secrets keep working and
  can still be restored from backups. **Never delete a directory.**

### Shapes

Shapes are a small JSON Schema subset, converted to strict validators inside the
enclave and exposed unchanged as MCP `inputSchema`:

| `type`    | Fields                                                              |
| --------- | ------------------------------------------------------------------- |
| `object`  | `properties` (≤ 32), `required`; unknown fields are always rejected |
| `string`  | `maxLength` (required, ≤ 16384), `minLength`, `pattern`, `enum`     |
| `integer` | `minimum`, `maximum` (safe integers)                                |
| `number`  | any finite number (output only)                                     |
| `boolean` |                                                                     |
| `array`   | `items`, `maxItems` (required, ≤ 1000)                              |

Every node may carry a `description`.

## Writing `action.ts`

```ts
import { defineAction, requireThat } from "../../lib.ts";
type Input = { channel: string; text: string };
export default defineAction<Input>(async ({ credential, input, fetchJson }) => {
  const result = await fetchJson("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credential}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel: input.channel, text: input.text }),
  });
  requireThat(result?.ok === true && typeof result.ts === "string");
  return { channel: result.channel, ts: result.ts };
});
```

Rules of thumb:

- Project, do not forward. Pick the fields the agent needs and check their types.
  Anything you return is validated against `output`, but the shape cannot know which
  string is a secret.
- Throw on anything unexpected. The agent only ever sees `access_denied`; upstream
  error bodies, headers and status text are never returned or logged.
- Build URLs from validated input with `pathSegment()` from the library; never
  interpolate raw input into a path or query.
- Keep it to one upstream call where possible and set `maxRequests` accordingly.

## Testing locally

```sh
npm ci
npm test   # validates manifests, lints, type-checks, runs every action against in-memory upstreams
```

Add a case to `tests/actions.test.ts` that drives your action through `runAction()`
from `testing.ts`, which applies the same constraints as the Keychain harness, and
asserts: the exact URL, method and headers you send; the projected result; an
upstream failure; and that the sample credential does not appear in the serialized
result. Add a well-formed sample credential to `SAMPLE_CREDENTIALS` in `tests/samples.ts`.

## Review checklist

A maintainer approves a catalog PR when:

1. `allowedHosts` names only the provider's API host(s), and the call has no side
   effects beyond what `description` says.
2. `credentialPattern` is provider-specific.
3. `output` contains no field that could carry the credential or arbitrary upstream
   text without a stated reason, and long strings are the documented purpose of the
   action (for example a model reply).
4. `input` has no field that changes the destination host or path beyond what the
   code validates.
5. Tests cover the happy path, an upstream failure, and credential non-leakage.
6. The lock diff adds exactly one new hash and changes no existing one.

## How Keychain consumes this repo

Keychain depends on this package pinned to an exact commit (`github:LIT-Protocol/agent-keychain-library#<sha>` in
`lit-agent-keychain/package.json`, integrity-locked by its `package-lock.json`).
Its build bundles each action together with the harness into an immutable Lit
Action template and pins every template's SHA-256 in
`lit-agent-keychain/actions/catalog.lock.json`; a rebuild that yields different bytes
fails there. Deployed secrets derive their encryption keys from the CID of those
exact bytes, so ids are permanent, merged actions are never edited, and a behaviour
change is a new id plus a deprecation. Bumping the pin is a reviewed Keychain PR: the
lock diff must add exactly the new template hashes and change none of the existing
ones.
