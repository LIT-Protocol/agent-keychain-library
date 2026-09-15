# Contributing an action

1. Copy an existing directory under `actions/` to `actions/<your_id>/`. Ids are
   `^[a-z][a-z0-9_]{1,63}$` and permanent once merged.
2. Edit `action.json` (see the manifest reference in the README). Be as narrow as
   the provider allows: exact API host, provider-specific credential pattern, the
   smallest `output` that serves the agent.
3. Write `action.ts`. It may import only `../../lib.ts`. Project the upstream
   response onto your `output` shape and throw on anything unexpected.
4. Add a sample credential to `SAMPLE_CREDENTIALS` and a test case in
   `tests/actions.test.ts` covering: the exact request you send, the projected
   result, an upstream failure, and that the credential never appears in the
   serialized result.
5. `npm ci && npm test && npm run format:check`. If you touched `lib.ts`, `shape.ts`,
   `schema.ts`, `lint.ts` or `testing.ts`, also run `npm run build` and commit `dist/`
   (Keychain consumes this repo as a source tarball, so compiled helpers ship in git).
6. Open a PR; the template carries the review checklist. Start with
   `"tier": "community"`. Maintainers promote to `verified` (shown in the Keychain
   web UI) after review; both tiers are callable from the SDK, CLI and MCP server.

Never change a merged action's manifest or code: deployed secrets pin the exact
bytes. Add a new id and set `"deprecated": true` on the old one.

By contributing you agree your contribution is licensed under Apache-2.0.
