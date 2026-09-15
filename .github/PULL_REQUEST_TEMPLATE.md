## Action

<!-- id, provider, what the agent gets back -->

## Checklist

- [ ] `allowedHosts` names only the provider's API host(s); the call has no side effects beyond what `description` says
- [ ] `credentialPattern` is provider-specific
- [ ] No `output` field can carry the credential or arbitrary upstream text without a stated reason
- [ ] No `input` field changes the destination host or path beyond what the code validates
- [ ] Tests cover the happy path, an upstream failure, and credential non-leakage (`tests/actions.test.ts`)
- [ ] `npm test` and `npm run format:check` pass
- [ ] No existing action's id, manifest or code changed (add a new id and deprecate instead)
